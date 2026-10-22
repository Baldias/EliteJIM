import { describe, expect, it } from 'vitest';
import { createScienceProgram, emptyScienceState, scienceWeekRange } from '../src/utils/scienceV3';
import { localScienceDate, nextScienceMonday, scienceWeekPreview, scienceLandmarkBand } from '../src/utils/sciencePlanning';
import { createScienceSandbox } from '../src/store/scienceDebug';
import { EXERCISES_DB } from '../src/data/exercises';

const now = new Date(2026, 9, 22, 12).getTime();
const profile = { experience: 'advanced', daysPerWeek: 5, minutesPerSession: 90, goal: 'specialization', priorities: ['Petto'], startDate: now };
const program = () => createScienceProgram(profile, [], EXERCISES_DB, emptyScienceState(), null, now);
const source = () => ({ scienceState: program(), history: [], customExercises: [], exerciseOverrides: {}, scienceReport: null, weightLog: [], userXP: 1234, muscleXP: { Petto: 80 }, currentStreak: 4, highestStreak: 8, templates: [] });

describe('local start-date choices', () => {
  it('chooses the strictly next Monday, across the winter-time change', () => {
    expect(nextScienceMonday(now)).toBe('2026-10-26');
    expect(nextScienceMonday(new Date(2026, 9, 26, 10).getTime())).toBe('2026-11-02');
    const next = new Date(`${nextScienceMonday(now)}T00:00:00`);
    expect(next.getHours()).toBe(0);
    expect(localScienceDate(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
});

describe('read-only weekly estimates', () => {
  it('projects accumulation and proposed deload without mutating the active program', () => {
    const science = program();
    const before = structuredClone(science);
    const previews = [1, 2, 3, 4, 5].map(w => scienceWeekPreview(science, [], EXERCISES_DB, w, now));
    expect(previews.map(w => w.kind)).toEqual(['current', 'estimate', 'estimate', 'estimate', 'deload-estimate']);
    expect(previews[3].targets.Petto).toBeGreaterThan(previews[0].targets.Petto);
    expect(previews[3].targets.Petto).toBeLessThanOrEqual(science.program.ceilings.Petto);
    expect(previews[4].targets.Petto).toBe(Math.floor(previews[3].targets.Petto / 2));
    expect(previews[2].muscles.Petto.direct).toBe(0);
    expect(science).toEqual(before);
  });
  it('uses immutable recorded targets, counts and landmarks for previous weeks', () => {
    const data = source();
    const store = createScienceSandbox(data, now);
    store.getState().advanceScienceDebugWeek('good');
    store.getState().closeScienceV3Week(store.getState().scienceDebugNow);
    const saved = store.getState().scienceState.program.weeks[0];
    store.getState().setScienceTarget('Petto', 22, 24);
    const preview = scienceWeekPreview(store.getState().scienceState, store.getState().history, EXERCISES_DB, 1, store.getState().scienceDebugNow);
    expect(preview.kind).toBe('archive');
    expect(preview.targets).toEqual(saved.targets);
    expect(preview.muscles).toEqual(saved.volumes.muscles);
    expect(preview.landmarks).toEqual(saved.landmarks);
  });
  it('keeps maintenance unchanged in accumulation and respects user automation limits', () => {
    const science = program();
    science.program.ceilings.Petto = 13;
    const preview = scienceWeekPreview(science, [], EXERCISES_DB, 4, now);
    expect(preview.targets.Petto).toBe(13);
    expect(preview.targets.Bicipiti).toBe(science.program.targets.Bicipiti);
  });
  it('never labels an automation ceiling or a planned peak as a determined MRV', () => {
    const lm = { mvEstimate: 4, mevEstimate: 12, productiveRange: null, mrv: null };
    expect(scienceLandmarkBand(lm, 4, 'maintenance')).toBe('mv');
    expect(scienceLandmarkBand(lm, 12, 'growth')).toBe('mev');
    expect(scienceLandmarkBand(lm, 24, 'growth')).toBe('mav');
    expect(scienceLandmarkBand({ ...lm, mrv: { lower: 20, upper: 22 } }, 20, 'growth')).toBe('mrv');
  });
});

describe('isolated debug sandbox', () => {
  it('runs a full favorable block and deload without changing source, live storage or XP', () => {
    const data = source();
    const before = structuredClone(data);
    const storage = localStorage.getItem('elitejim-storage');
    const sandbox = createScienceSandbox(data, now);
    for (let i = 1; i <= 4; i++) {
      sandbox.getState().advanceScienceDebugWeek('good');
      const time = sandbox.getState().scienceDebugNow;
      sandbox.getState().closeScienceV3Week(time);
      sandbox.getState().closeScienceV3Week(time);
      expect(sandbox.getState().scienceState.program.weeks).toHaveLength(i);
    }
    const p = sandbox.getState().scienceState.program;
    expect(p.currentWeek).toBe(5);
    expect(p.targets.Petto).toBeGreaterThan(before.scienceState.program.targets.Petto);
    expect(p.recommendations.at(-1).status).toBe('pending');
    sandbox.getState().respondScienceRecovery(p.recommendations.at(-1).id, 'reduce-all');
    sandbox.getState().advanceScienceDebugWeek('good');
    sandbox.getState().closeScienceV3Week(sandbox.getState().scienceDebugNow);
    expect(sandbox.getState().scienceState.program.status).toBe('completed');
    expect(sandbox.getState().userXP).toBe(1234);
    expect(sandbox.getState().muscleXP).toEqual(before.muscleXP);
    expect(sandbox.getState().currentStreak).toBe(4);
    expect(data).toEqual(before);
    expect(localStorage.getItem('elitejim-storage')).toBe(storage);
    sandbox.getState().resetScienceDebug();
    expect(sandbox.getState().scienceState).toEqual(before.scienceState);
    expect(sandbox.getState().history).toEqual([]);
  });
  it('produces a fatigue recommendation but never applies a reduction without consent', () => {
    const sandbox = createScienceSandbox(source(), now);
    const target = sandbox.getState().scienceState.program.targets.Petto;
    sandbox.getState().advanceScienceDebugWeek('fatigue');
    sandbox.getState().closeScienceV3Week(sandbox.getState().scienceDebugNow);
    const p = sandbox.getState().scienceState.program;
    expect(p.recommendations[0].systemic).toBe(true);
    expect(p.targets.Petto).toBe(target);
    sandbox.getState().respondScienceRecovery(p.recommendations[0].id, 'reject');
    expect(sandbox.getState().scienceState.program.targets.Petto).toBe(target);
  });
  it('can keep copied workouts or replace a test week without double counting or changing the source', () => {
    const data = source();
    data.history = [{ id: 'real', startTime: now, exercises: [] }];
    const copied = createScienceSandbox(data, now);
    copied.getState().advanceScienceDebugWeek('recorded');
    expect(copied.getState().history).toEqual(data.history);
    const empty = createScienceSandbox(data, now);
    empty.getState().advanceScienceDebugWeek('empty');
    expect(empty.getState().history).toEqual([]);
    const good = createScienceSandbox(data, now);
    good.getState().advanceScienceDebugWeek('good');
    good.getState().advanceScienceDebugWeek('good');
    expect(good.getState().history).toHaveLength(2);
    expect(good.getState().history.every(w => w.id.startsWith('debug-'))).toBe(true);
    expect(data.history).toEqual([{ id: 'real', startTime: now, exercises: [] }]);
  });
  it('keeps empty weeks empty and supports local calendar boundaries', () => {
    const sandbox = createScienceSandbox(source(), now);
    sandbox.getState().advanceScienceDebugWeek('empty');
    expect(sandbox.getState().scienceDebugNow).toBe(scienceWeekRange(program().program.startDate, 1).end);
    sandbox.getState().closeScienceV3Week(sandbox.getState().scienceDebugNow);
    expect(sandbox.getState().scienceState.program.targets).toEqual(program().program.targets);
    expect(sandbox.getState().history).toEqual([]);
  });
});
