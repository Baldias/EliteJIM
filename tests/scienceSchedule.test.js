import { describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../src/data/exercises';
import { createScienceProgram, emptyScienceState, currentScienceSummary, closeScienceWeek, respondScienceRecommendation } from '../src/utils/scienceV3';
import { scienceProgramWeekRange, projectedScienceWeekRange, scienceWeekTiming } from '../src/utils/scienceCalendar';
import { scienceSessionGuidance, scienceWeekPreview } from '../src/utils/sciencePlanning';
import { createScienceSandbox } from '../src/store/scienceDebug';
import { allocateScienceGrowth, scienceWeeklyGrowthBudget } from '../src/utils/scienceAllocation';

const now = new Date(2026, 9, 22).getTime();
const profile = { experience: 'advanced', daysPerWeek: 5, minutesPerSession: 90, goal: 'specialization', priorities: ['Petto', 'Dorso', 'Spalle'], startDate: now };
const make = (overrides = {}) => createScienceProgram({ ...profile, ...overrides }, [], EXERCISES_DB, emptyScienceState(), null, now);
const source = science => ({ scienceState: science, history: [], customExercises: [], exerciseOverrides: {}, scienceReport: null, weightLog: [], userXP: 800, muscleXP: { Petto: 100 }, currentStreak: 3, highestStreak: 8, templates: [] });
const sum = targets => Object.values(targets).reduce((a, b) => a + b, 0);

describe('specialization with a stable weekly workload', () => {
  it('starts every non-priority at its growth base for the first two weeks', () => {
    const science = make();
    expect(science.program.targets).toMatchObject({ Petto: 10, Dorso: 10, Bicipiti: 8, Spalle: 8, Femorali: 6, Polpacci: 8 });
    expect(science.program.roles.Bicipiti).toBe('support');
    const preview = scienceWeekPreview(science, [], EXERCISES_DB, 2, now);
    expect(preview.targets.Bicipiti).toBe(science.program.targets.Bicipiti);
    expect(sum(preview.targets) - sum(science.program.targets)).toBeLessThanOrEqual(scienceWeeklyGrowthBudget(science.program));
  });
  it('offers bounded transfers only in the last two accumulation weeks and never applies them without consent', () => {
    const data = source(make());
    const store = createScienceSandbox(data, now);
    store.getState().advanceScienceDebugWeek('good');
    store.getState().closeScienceV3Week(store.getState().scienceDebugNow);
    expect(store.getState().scienceState.program.recommendations.some(r => r.type === 'redistribution')).toBe(false);
    const w2 = structuredClone(store.getState().scienceState.program);
    store.getState().advanceScienceDebugWeek('good');
    store.getState().closeScienceV3Week(store.getState().scienceDebugNow);
    const before = store.getState().scienceState;
    const rec = before.program.recommendations.find(r => r.type === 'redistribution' && r.status === 'pending');
    expect(rec).toBeDefined();
    expect(before.program.targets).toEqual(w2.targets);
    expect(sum(rec.proposedTargets) - sum(w2.targets)).toBeLessThanOrEqual(scienceWeeklyGrowthBudget(w2));
    for (const m of Object.keys(rec.reductions)) {
      expect(rec.proposedTargets[m]).toBeGreaterThanOrEqual(Math.ceil(w2.initialTargets[m] * 0.75));
      expect(rec.proposedTargets[m]).toBeGreaterThanOrEqual(w2.landmarks[m].mvEstimate);
    }
    const rejected = respondScienceRecommendation(before, rec.id, 'reject');
    expect(rejected.program.targets).toEqual(w2.targets);
    store.getState().respondScienceRecovery(rec.id, 'redistribute', store.getState().scienceDebugNow);
    expect(store.getState().scienceState.program.targets).toEqual(rec.proposedTargets);
    const w3 = structuredClone(store.getState().scienceState.program);
    store.getState().advanceScienceDebugWeek('good');
    store.getState().closeScienceV3Week(store.getState().scienceDebugNow);
    const next = store.getState().scienceState.program.recommendations.find(r => r.type === 'redistribution' && r.status === 'pending');
    for (const m of Object.keys(next.reductions)) expect(next.proposedTargets[m]).toBeGreaterThanOrEqual(w3.landmarks[m].mvEstimate);
    expect(store.getState().userXP).toBe(800);
    expect(data.scienceState).toEqual(make());
  });
  it('keeps balanced growth small and does not reduce other muscles', () => {
    const science = make({ goal: 'balanced', priorities: [] });
    const names = Object.keys(science.program.targets);
    const result = allocateScienceGrowth(science.program, science.profile, names, Object.fromEntries(names.map(m => [m, 2])), 3);
    expect(result.requiresConsent).toBe(false);
    expect(result.afterTotal - result.beforeTotal).toBeLessThanOrEqual(scienceWeeklyGrowthBudget(science.program));
    names.forEach(m => expect(result.targets[m]).toBeGreaterThanOrEqual(science.program.targets[m]));
  });
});

describe('manual weekly deadlines and overdue accounting', () => {
  it('shows calendar days across a 169-hour winter-time week', () => {
    const science = make();
    const range = scienceProgramWeekRange(science.program);
    expect((range.end - range.start) / 3600000).toBe(169);
    expect(scienceWeekTiming(science.program, now).days).toBe(7);
    expect(scienceWeekTiming(science.program, range.end).overdue).toBe(true);
  });
  it('counts late sessions in the open week and starts the next seven days exactly when advanced', () => {
    let science = make();
    const due = scienceProgramWeekRange(science.program).end;
    const time = new Date(2026, 9, 30, 11).getTime();
    const close = new Date(2026, 9, 31, 14).getTime();
    const workout = { id: 'late', startTime: time, endTime: time + 1000, exercises: [{ id: 'ex', name: 'Panca Piana Bilanciere', sets: [{ id: 'set', kg: 60, reps: 10, done: true }] }] };
    science.annotations.late = { ex: { set: { rir: 0 } } };
    expect(currentScienceSummary([workout], EXERCISES_DB, science, close).muscles.Petto.direct).toBe(1);
    expect(currentScienceSummary([workout], EXERCISES_DB, science, close).end).toBe(close + 1);
    expect(science.program.currentWeek).toBe(1);
    const preview = projectedScienceWeekRange(science.program, 2, close);
    expect(preview.start).toBe(close);
    const next = closeScienceWeek(science, [workout], EXERCISES_DB, close);
    expect(next.program.weeks[0].scheduledEnd).toBe(due);
    expect(next.program.weeks[0].end).toBe(close);
    expect(next.program.weeks[0].volumes.muscles.Petto.direct).toBe(1);
    const range = scienceProgramWeekRange(next.program);
    expect(range.start).toBe(close);
    expect(new Date(range.end).getHours()).toBe(14);
    expect(new Date(range.end).getDate()).toBe(7);
    const boundary = structuredClone(workout); boundary.id = 'boundary'; boundary.startTime = close;
    next.annotations.boundary = { ex: { set: { rir: 0 } } };
    expect(currentScienceSummary([workout, boundary], EXERCISES_DB, next, close + 1).muscles.Petto.direct).toBe(1);
    expect(scienceWeekPreview(next, [workout, boundary], EXERCISES_DB, 1, close + 1).muscles.Petto.direct).toBe(1);
  });
  it('does not skip absent weeks, carry unmet sets as debt or manufacture increases', () => {
    const science = make();
    const close = new Date(2026, 11, 1).getTime();
    const next = closeScienceWeek(science, [], EXERCISES_DB, close);
    expect(next.program.currentWeek).toBe(2);
    expect(next.program.weeks).toHaveLength(1);
    expect(next.program.targets).toEqual(science.program.targets);
    expect(scienceProgramWeekRange(next.program).start).toBe(close);
  });
});

describe('per-session guidance', () => {
  it('changes the mean and remaining workload without changing scientific targets', () => {
    const science = make();
    const snapshot = structuredClone(science);
    const plan = scienceSessionGuidance(science, [], EXERCISES_DB, now);
    expect(plan.average).toBe(sum(science.program.targets) / 5);
    science.program.sessionPlans[1] = { plannedSessions: 3 };
    expect(scienceSessionGuidance(science, [], EXERCISES_DB, now).average).toBe(sum(science.program.targets) / 3);
    expect(science.program.targets).toEqual(snapshot.program.targets);
  });
  it('never divides by zero when planned sessions are used and never offsets one muscle with another', () => {
    const science = make();
    science.program.sessionPlans[1] = { plannedSessions: 1 };
    const workout = { id: 1, startTime: now + 1000, exercises: [{ id: 2, name: 'Panca Piana Bilanciere', sets: Array.from({ length: 20 }, (_, id) => ({ id, done: true, kg: 60, reps: 10 })) }] };
    const plan = scienceSessionGuidance(science, [workout], EXERCISES_DB, now + 2000);
    expect(plan.sessionsLeft).toBe(0);
    expect(plan.remainingAverage).toBeNull();
    expect(plan.unknown).toBe(20);
    expect(plan.remaining).toBe(sum(science.program.targets) - science.program.targets.Petto);
  });
});
