import { beforeEach, describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../src/data/exercises';
import { SCIENCE_VOLUME_REFERENCES } from '../src/utils/scienceReferences';
import { balancedStartingTargets, fitBalancedTargets, scienceSessionBudget } from '../src/utils/scienceBalanced';
import { createScienceProgram, closeScienceWeek, emptyScienceState, scienceWeekRange } from '../src/utils/scienceV3';
import { allocateScienceGrowth } from '../src/utils/scienceAllocation';
import { scienceWeekPreview, scienceSessionGuidance } from '../src/utils/sciencePlanning';
import { useStore } from '../src/store/useStore';

const start = new Date(2026, 9, 19).getTime();
const profile = { gender: 'male', goal: 'balanced', priorities: [], experience: 'advanced', daysPerWeek: 3, minutesPerSession: 60, startDate: start };
const make = (extra = {}) => createScienceProgram({ ...profile, ...extra }, [], EXERCISES_DB, emptyScienceState(), null, start);
const total = values => Object.values(values).reduce((n, value) => n + value, 0);
const muscles = ['Petto', 'Dorso', 'Quadricipiti', 'Femorali', 'Polpacci', 'Spalle', 'Bicipiti', 'Tricipiti', 'Addome'];

describe('full-body starting volume', () => {
  it('starts at the low MAV of the table at every experience level when enough sessions are available', () => {
    for (const experience of ['beginner', 'intermediate', 'advanced']) {
      const science = make({ experience, daysPerWeek: 6 });
      for (const m of muscles) expect(science.program.targets[m]).toBe(SCIENCE_VOLUME_REFERENCES[m].mav[0]);
      expect(science.program.landmarks.Petto.source).toBe('balanced-low-mav');
      expect(science.program.initialEstimates.Petto).toMatchObject({ referenceDose: 12, historyWeight: 0, estimate: 12 });
    }
  });
  it('caps three sessions at sixty and reduces calves, abs and hamstrings before the other MEVs', () => {
    const science = make();
    expect(total(science.program.targets)).toBe(60);
    expect(science.program.targets).toMatchObject({ Petto: 10, Dorso: 10, Quadricipiti: 8, Spalle: 8, Bicipiti: 8, Tricipiti: 6 });
    for (const m of ['Polpacci', 'Femorali']) expect(science.program.targets[m]).toBeLessThan(SCIENCE_VOLUME_REFERENCES[m].mev);
    expect(science.program.targets.Addome).toBeGreaterThan(0);
  });
  it('never exceeds twenty per session across schedules, optional districts and genders', () => {
    for (let daysPerWeek = 1; daysPerWeek <= 7; daysPerWeek++) {
      for (const gender of ['male', 'female', 'unspecified']) {
        const science = make({ daysPerWeek, gender, optionalMuscles: ['Collo', 'Avambracci'] });
        expect(total(science.program.targets)).toBeLessThanOrEqual(20 * daysPerWeek);
        Object.values(science.program.targets).forEach(value => { expect(value).toBeGreaterThan(0); expect(Number.isInteger(value)).toBe(true); });
      }
    }
  });
  it('fills space evenly between MEV and low MAV with a slight delay for the three lower priorities', () => {
    const targets = balancedStartingTargets(muscles, { ...profile, daysPerWeek: 5 });
    for (const m of muscles) {
      expect(targets[m]).toBeGreaterThanOrEqual(SCIENCE_VOLUME_REFERENCES[m].mev);
      expect(targets[m]).toBeLessThanOrEqual(SCIENCE_VOLUME_REFERENCES[m].mav[0]);
    }
    expect(total(targets)).toBe(100);
    expect(fitBalancedTargets(targets, 100)).toEqual(targets);
  });
});

describe('full-body adaptive allocation', () => {
  it('redistributes within the cap towards the better-recovering district, using only small donor reductions', () => {
    const science = make(), p = science.program;
    const scores = Object.fromEntries(Object.keys(p.targets).map(m => [m, 0])); scores.Petto = 3;
    const result = allocateScienceGrowth(p, science.profile, ['Petto'], { Petto: 2 }, 2, scores);
    expect(result.targets.Petto).toBe(p.targets.Petto + 2);
    expect(total(result.targets)).toBe(60);
    expect(result.requiresConsent).toBe(false);
    expect(Object.keys(result.reductions).every(m => ['Polpacci', 'Femorali'].includes(m))).toBe(true);
    Object.values(result.reductions).forEach(n => expect(n).toBe(1));
    Object.values(result.targets).forEach(n => expect(n).toBeGreaterThan(0));
  });
  it('does not invent relative recovery differences in forecasts and never lets previews exceed the cap', () => {
    const science = make();
    for (let week = 1; week <= 5; week++) expect(total(scienceWeekPreview(science, [], EXERCISES_DB, week, start).targets)).toBeLessThanOrEqual(60);
    const p = science.program, names = Object.keys(p.targets);
    const result = allocateScienceGrowth(p, science.profile, names, Object.fromEntries(names.map(m => [m, 2])), 2);
    expect(result.targets).toEqual(p.targets);
    expect(result.reductions).toEqual({});
  });
  it('keeps the cap when an accepted temporary pause resumes', () => {
    const science = make();
    science.program.targets.Petto = 0;
    science.program.targets.Dorso += 10;
    science.program.pauses.Petto = { week: 1, resumeTarget: 20 };
    const next = closeScienceWeek(science, [], EXERCISES_DB, scienceWeekRange(start, 1).end);
    expect(total(next.program.targets)).toBe(60);
    expect(next.program.targets.Petto).toBeGreaterThan(0);
    expect(next.program.pauses).toEqual({});
    expect(next.program.weeks[0].targets.Petto).toBe(0);
  });
  it('uses improving comparable loads to favor a district while respecting the total cap', () => {
    const science = make({ daysPerWeek: 6 });
    const history = [1, 2, 3].map((id, i) => ({ id, startTime: start + id * 86400000, exercises: [
      { id: 'chest', name: 'Panca Piana Bilanciere', sets: Array.from({ length: 4 }, (_, id) => ({ id, done: true, reps: 10, kg: 60 + i * 5 })) },
      { id: 'back', name: 'Rematore con Bilanciere', sets: Array.from({ length: 5 }, (_, id) => ({ id, done: true, reps: 10, kg: 60 })) },
    ] }));
    history.forEach(w => {
      science.annotations[w.id] = Object.fromEntries(w.exercises.map(ex => [ex.id, Object.fromEntries(ex.sets.map(set => [set.id, { rir: 0 }]))]));
      science.feedback[w.id] = { sleep: 'good', systemicFatigue: false, muscles: { Petto: { recovery: 'good', quality: 'good', pain: false }, Dorso: { recovery: 'good', quality: 'good', pain: false } } };
    });
    const next = closeScienceWeek(science, history, EXERCISES_DB, scienceWeekRange(start, 1).end);
    expect(next.program.targets.Petto).toBeGreaterThan(science.program.targets.Petto);
    expect(total(next.program.targets)).toBeLessThanOrEqual(120);
    expect(next.program.landmarks.Petto.productiveRange).toEqual([12, 12]);
    expect(next.program.weeks[0].targets).toEqual(science.program.targets);
  });
});

const original = useStore.getInitialState();
beforeEach(() => useStore.setState({ ...original, history: [], scienceState: make({ daysPerWeek: 6 }) }, true));
describe('full-body session cap across store actions', () => {
  it('shrinks targets to changed session availability and prevents manual targets exceeding the cap', () => {
    useStore.getState().setScienceWeekSessions(3);
    let science = useStore.getState().scienceState;
    expect(total(science.program.targets)).toBe(60);
    useStore.getState().setScienceTarget('Petto', 100, 100);
    science = useStore.getState().scienceState;
    expect(total(science.program.targets)).toBe(60);
    expect(scienceSessionBudget(science.profile, science.program)).toBe(60);
    expect(scienceSessionGuidance(science, [], EXERCISES_DB, start).average).toBe(20);
  });
  it('adopts the policy once without rewriting archives, workouts or XP', () => {
    const science = make();
    delete science.program.balancedVolumeVersion;
    science.program.targets.Petto = 30;
    science.program.weeks = [{ week: 1, targets: { Petto: 10 }, volumes: {} }];
    science.program.currentWeek = 2;
    useStore.setState({ scienceState: science, userXP: 1234 });
    const previousWeeks = structuredClone(science.program.weeks);
    useStore.getState().adoptBalancedScienceVolume(start);
    const adopted = useStore.getState().scienceState;
    expect(total(adopted.program.targets)).toBeLessThanOrEqual(60);
    expect(adopted.program.weeks).toEqual(previousWeeks);
    expect(useStore.getState().userXP).toBe(1234);
    useStore.getState().adoptBalancedScienceVolume(start + 1);
    expect(useStore.getState().scienceState).toBe(adopted);
  });
  it('never applies the new full-body starting policy to specialization', () => {
    const science = make({ goal: 'specialization', priorities: ['Petto'] });
    useStore.setState({ scienceState: science });
    useStore.getState().adoptBalancedScienceVolume(start);
    expect(useStore.getState().scienceState).toBe(science);
    expect(science.program.targets).toMatchObject({ Petto: 10, Dorso: 10, Spalle: 8 });
  });
});
