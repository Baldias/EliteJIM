import { describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../src/data/exercises';
import { progressRange, weeklyMuscleProgress } from '../src/utils/muscleProgress';
import { currentScienceSummary, createScienceProgram, emptyScienceState } from '../src/utils/scienceV3';
import { scienceCompletedSets } from '../src/utils/scienceCarry';
import { scienceSessionGuidance } from '../src/utils/sciencePlanning';

const time = (day, month = 9) => new Date(2026, month, day, 12).getTime();
const workout = (day, sets) => ({ id: day, startTime: time(day), exercises: [{ id: 'ex', name: 'Panca Piana Bilanciere', sets }] });
const set = (id, extra = {}) => ({ id, done: true, reps: 10, kg: 60, ...extra });

describe('weekly muscle progress', () => {
  it('counts ordinary direct work without RIR, includes zero weeks and respects exact date boundaries', () => {
    const history = [workout(5, [set(1), set(2), set(3, { isWarmup: true }), set(4, { isDropset: true }), set(5, { isRestPause: true }), set(6, { done: false }), set(7, { reps: 0 }), set(8)]), workout(19, [set(1)]), workout(26, [set(1)])];
    const science = emptyScienceState();
    science.annotations[5] = { ex: { 8: { excluded: true } } };
    const before = structuredClone(history);
    const result = weeklyMuscleProgress(history, EXERCISES_DB, science, 'Petto', { start: new Date(2026, 9, 5).getTime(), end: new Date(2026, 9, 26).getTime() });
    expect(result.weeks.map(w => w.sets)).toEqual([2, 0, 1]);
    expect(result).toMatchObject({ total: 3, average: 1, best: 2, activeWeeks: 2 });
    expect(weeklyMuscleProgress(history, EXERCISES_DB, science, 'Tricipiti', { start: time(5), end: time(26) }).total).toBe(0);
    expect(history).toEqual(before);
  });
  it('trims empty weeks outside recorded history for one year, ten years and Max while retaining internal gaps', () => {
    const history = [workout(5, [set(1), set(2)]), workout(19, [set(1)])];
    for (const period of ['12', '120', 'all']) {
      const result = weeklyMuscleProgress(history, EXERCISES_DB, {}, 'Petto', progressRange(period, history, time(29)));
      expect(result.weeks.map(w => w.sets)).toEqual([2, 0, 1]);
      expect(result.average).toBe(1);
      expect(result.total).toBe(3);
    }
  });
  it('uses global history coverage so weeks without work on this muscle still count', () => {
    const history = [workout(5, [set(1)]), { ...workout(19, [set(1)]), exercises: [{ id: 'curl', name: 'Curl Bilanciere', sets: [set(1), set(2)] }] }];
    const range = progressRange('12', history, time(29));
    const result = weeklyMuscleProgress(history, EXERCISES_DB, {}, 'Bicipiti', range);
    expect(result.weeks.map(w => w.sets)).toEqual([0, 0, 2]);
    expect(result.average).toBeCloseTo(2 / 3);
  });
  it('preserves selected date bounds and returns no samples outside history or without completed work', () => {
    const history = [workout(5, [set(1)]), workout(19, [set(1), set(2)])];
    const custom = progressRange('custom', history, time(29), '2026-10-12', '2026-10-19');
    expect(weeklyMuscleProgress(history, EXERCISES_DB, {}, 'Petto', custom).weeks.map(w => w.sets)).toEqual([0, 2]);
    const older = progressRange('custom', history, time(29), '2026-01-01', '2026-02-01');
    expect(weeklyMuscleProgress(history, EXERCISES_DB, {}, 'Petto', older).weeks).toEqual([]);
    expect(weeklyMuscleProgress([workout(5, [set(1, { done: false })])], EXERCISES_DB, {}, 'Petto', custom).average).toBe(0);
  });
  it('uses Monday calendar boundaries over daylight-saving changes', () => {
    const result = weeklyMuscleProgress([workout(25, [set(1)]), workout(26, [set(1), set(2)])], EXERCISES_DB, {}, 'Petto', { start: new Date(2026, 9, 19).getTime(), end: new Date(2026, 10, 2).getTime() });
    expect(result.weeks.map(w => w.sets)).toEqual([1, 2]);
    expect(result.weeks.map(w => new Date(w.time).getHours())).toEqual([0, 0]);
  });
  it('handles month ends, inclusive custom end dates and invalid ranges', () => {
    const range = progressRange('1', [], new Date(2026, 2, 31, 12).getTime());
    expect(new Date(range.start).getDate()).toBe(28);
    expect(new Date(range.start).getMonth()).toBe(1);
    const custom = progressRange('custom', [], time(29), '2026-10-05', '2026-10-05');
    expect(weeklyMuscleProgress([workout(5, [set(1)])], EXERCISES_DB, {}, 'Petto', custom).total).toBe(1);
    expect(progressRange('custom', [], time(29), '2026-10-06', '2026-10-05')).toBeNull();
  });
});

describe('science work without RIR', () => {
  it('counts it in the dashboard and remaining work without inventing annotations or double counting imports', () => {
    const history = [workout(5, [set(1), set(2)])];
    const science = createScienceProgram({ startDate: time(5), experience: 'advanced', daysPerWeek: 4, minutesPerSession: 60, priorities: [] }, [], EXERCISES_DB, emptyScienceState(), null, time(5));
    const summary = currentScienceSummary(history, EXERCISES_DB, science, time(6));
    expect(scienceCompletedSets(summary.muscles.Petto)).toBe(2);
    expect(scienceSessionGuidance(science, history, EXERCISES_DB, time(6)).missingMuscles.find(m => m.muscle === 'Petto').remaining).toBe(science.program.targets.Petto - 2);
    expect(science.annotations).toEqual({});
    expect(scienceCompletedSets({ direct: 2, unknown: 3, imported: 2 })).toBe(5);
  });
});
