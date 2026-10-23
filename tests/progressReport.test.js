import { describe, expect, it } from 'vitest';
import { buildProgressReport } from '../src/utils/progressReport';
import { progressReportPalette, progressMuscleIcon } from '../src/utils/progressReportStyle';
import { progressReportPages } from '../src/utils/progressReportRender';
import { computeOverloadStats } from '../src/utils/overload';
import { getAllExercises } from '../src/data/exercises';
import { estimate1RM, getBodyweightLoad } from '../src/utils/oneRepMax';
import { createScienceProgram, emptyScienceState } from '../src/utils/scienceV3';
import { scienceSessionGuidance } from '../src/utils/sciencePlanning';

const start = new Date(2026, 9, 22).getTime();
const workout = (id, kg, reps) => ({ id, startTime: start + id * 3600000, endTime: start + id * 3600000 + 1800000, exercises: [{ id: `e${id}`, name: 'Panca Piana Bilanciere', sets: [{ id: `s${id}`, kg, reps, done: true }] }] });
const state = () => ({ history: [workout(2, 70, 8), workout(1, 60, 10)], userXP: 4200, muscleXP: { Petto: 900, Spalle: 550 }, bodyweight: 80, weightLog: [{ date: '2026-10-20', kg: 80 }, { date: '2026-10-22', kg: 81 }], scienceState: emptyScienceState(), scienceReport: null, customExercises: [], exerciseOverrides: {} });

describe('read-only graphical progress report', () => {
  it('uses the existing overload calculations and never changes source logs, XP, or scientific annotations', () => {
    const data = state(), before = structuredClone(data);
    const report = buildProgressReport(data, start + 3 * 3600000);
    const stats = computeOverloadStats(data.history, { exercisesDb: getAllExercises([], {}), bodyweight: 80 });
    expect(report.totals.prCount).toBe(stats.prCount);
    expect(report.totals.overloadRate).toBe(stats.overloadRate);
    expect(report.totals.xp).toBe(4200);
    expect(report.totals.completedSets).toBe(2);
    expect(report.totals.workouts).toBe(2);
    expect(report.totals.minutes).toBe(60);
    expect(report).not.toHaveProperty('muscles');
    expect(progressReportPages(report).some(p => p.type === 'muscles')).toBe(false);
    expect(data).toEqual(before);
  });
  it('compares the first and latest performance, keeping the absolute record separate', () => {
    const data = state();
    data.history.push(workout(3, 50, 8));
    const exercise = buildProgressReport(data, start + 4 * 3600000).exercises[0];
    expect(exercise.first.value).toBe(estimate1RM(60, 10));
    expect(exercise.latest.value).toBe(estimate1RM(50, 8));
    expect(exercise.best.value).toBe(estimate1RM(70, 8));
    expect(exercise.deltaPercent).toBeLessThan(0);
  });
  it('includes every registered exercise and paginates without silently dropping details', () => {
    const data = state();
    data.history[0].exercises = Array.from({ length: 85 }, (_, id) => ({ id, name: `Custom ${id}`, sets: [{ done: true, kg: 20, reps: 10 }] }));
    const report = buildProgressReport(data, start + 3 * 3600000);
    const pages = progressReportPages(report);
    expect(report.exercises).toHaveLength(86);
    expect(pages.filter(p => p.type === 'exercises').flatMap(p => p.items).map(ex => ex.name)).toEqual(report.exercises.map(ex => ex.name));
    expect(pages.filter(p => p.type === 'exercises')).toHaveLength(44);
  });
  it('keeps logged techniques in totals without inventing comparable ordinary-set progress', () => {
    const data = state();
    data.history = [{ ...workout(1, 60, 10), exercises: [{ id: 1, name: 'Solo drop set', sets: [{ done: true, kg: 20, reps: 10, isDropset: true }, { done: true, kg: 10, reps: 10, isRestPause: true }] }] }];
    const report = buildProgressReport(data, start + 3 * 3600000);
    expect(report.totals.completedSets).toBe(2);
    expect(report.exercises).toHaveLength(1);
    expect(report.exercises[0].points).toEqual([]);
    expect(report.exercises[0].deltaPercent).toBeNull();
    expect(progressReportPages(report).some(p => p.type === 'exercises')).toBe(true);
  });
  it('excludes weight unless explicitly enabled and does not include personal workout notes', () => {
    const data = state(); data.history[0].notes = 'private';
    const report = buildProgressReport(data, start);
    expect(report.weight).toBeNull();
    expect(JSON.stringify(report)).not.toContain('private');
    expect(progressReportPages(report).some(p => p.type === 'weight')).toBe(false);
    const included = buildProgressReport(data, start, { includeWeight: true });
    expect(included.weight.map(p => p.value)).toEqual([80, 81]);
    expect(progressReportPages(included).some(p => p.type === 'weight')).toBe(true);
  });
  it('uses the app’s bodyweight-exercise estimates and does not invent a percentage from a zero baseline', () => {
    const data = state();
    data.history = [workout(1, 0, 1), workout(2, 5, 8)].map(w => ({ ...w, exercises: w.exercises.map(ex => ({ ...ex, name: 'Trazioni alla Sbarra' })) }));
    const db = getAllExercises([], {}), load = getBodyweightLoad('Trazioni alla Sbarra', db, 80);
    const exercise = buildProgressReport(data, start + 4 * 3600000).exercises[0];
    expect(exercise.latest.value).toBe(estimate1RM(5, 8, load));
    expect(exercise.deltaPercent).toBeNull();
  });
  it('handles empty and single-observation histories without pretending they show a progression', () => {
    const data = state(); data.history = []; data.muscleXP = {};
    const empty = buildProgressReport(data, start);
    expect(empty.totals.workouts).toBe(0);
    expect(empty.exercises).toEqual([]);
    expect(progressReportPages(empty)).toHaveLength(1);
    data.history = [workout(1, 20, 10)];
    expect(buildProgressReport(data, start + 2 * 3600000).exercises[0].deltaPercent).toBeNull();
  });
  it('uses zero-filled local-calendar activity bins, including inactive periods', () => {
    const data = state(); data.history = [workout(1, 20, 10), { ...workout(2, 20, 10), startTime: new Date(2026, 10, 12).getTime() }];
    const report = buildProgressReport(data, new Date(2026, 10, 13).getTime());
    expect(report.activity.points.map(p => p.workouts)).toEqual([1, 0, 0, 1]);
  });
  it('shows identical scientific confirmed counts and per-muscle deficits to the app views', () => {
    const data = state();
    data.scienceState = createScienceProgram({ startDate: start, experience: 'advanced', goal: 'balanced', priorities: [], daysPerWeek: 5, minutesPerSession: 90 }, [], getAllExercises([], {}), emptyScienceState(), null, start);
    const done = data.history[0];
    data.scienceState.annotations[done.id] = { [done.exercises[0].id]: { [done.exercises[0].sets[0].id]: { rir: 0 } } };
    const report = buildProgressReport(data, start + 3 * 3600000, { includeScience: true });
    expect(report.science.rows.find(m => m.name === 'Petto')).toMatchObject({ done: 1, target: 12, unknown: 1, band: 'mev' });
    const missing = scienceSessionGuidance(data.scienceState, data.history, getAllExercises([], {}), start + 3 * 3600000);
    expect(missing.missingMuscles.find(m => m.muscle === 'Petto')).toEqual({ muscle: 'Petto', remaining: 11, unknown: 1 });
    expect(missing.missingMuscles.reduce((sum, m) => sum + m.remaining, 0)).toBe(missing.remaining);
  });
  it('groups exercises by explicit catalog categories, preserving unknown exercises, and puts Science last', () => {
    const data = state();
    data.customExercises = [{ id: 'custom-1', name: 'Il mio curl', category: 'Bicipiti' }];
    const bench = getAllExercises([], {}).find(e => e.name === 'Panca Piana Bilanciere');
    data.exerciseOverrides = { [bench.id]: { category: 'Spalle' } };
    data.history[0].exercises.push(...['Curl Bilanciere', 'Il mio curl', 'Press sconosciuta'].map((name, id) => ({ id, name, sets: [{ done: true, kg: 20, reps: 10 }] })));
    data.scienceState = createScienceProgram({ startDate: start, experience: 'advanced', goal: 'balanced', priorities: [], daysPerWeek: 5, minutesPerSession: 90 }, [], getAllExercises([], {}), emptyScienceState(), null, start);
    const report = buildProgressReport(data, start + 3 * 3600000, { includeWeight: true, includeScience: true });
    const pages = progressReportPages(report);
    expect(report.exercises.find(e => e.name === 'Il mio curl').group).toBe('Bicipiti');
    expect(report.exercises.find(e => e.name === 'Panca Piana Bilanciere').group).toBe('Spalle');
    expect(report.exercises.find(e => e.name === 'Press sconosciuta').group).toBe('Altri esercizi');
    expect(pages.at(-1).type).toBe('science');
    expect(pages[1].type).toBe('exercises');
    const exercisePages = pages.filter(p => p.type === 'exercises');
    expect(exercisePages.every(p => new Set(p.items.map(e => e.group)).size === 1)).toBe(true);
    expect(exercisePages.flatMap(p => p.items)).toHaveLength(report.exercises.length);
    expect(pages.some(p => p.type === 'muscles')).toBe(false);
  });

  it('shares science only on opt-in and includes every week with future estimates clearly labeled', () => {
    const data = state();
    data.scienceState = createScienceProgram({ startDate: start, experience: 'advanced', goal: 'balanced', priorities: [], daysPerWeek: 5, minutesPerSession: 90 }, [], getAllExercises([], {}), emptyScienceState(), null, start);
    expect(buildProgressReport(data, start).science).toBeNull();
    const included = buildProgressReport(data, start, { includeScience:true });
    const pages = progressReportPages(included).filter(p => p.type === 'science');
    expect(pages.map(p => p.week.week)).toEqual([1,2,3,4,5]);
    expect(pages[0].week.kind).toBe('current');
    expect(pages.at(-1).week.kind).toBe('deload-estimate');
    expect(pages.slice(1).flatMap(p => p.items).every(m => m.done === 0)).toBe(true);
  });
  it('shares all 12 legacy weeks without reinterpreting their effort and uses the captured theme', () => {
    const data = state();
    data.theme = 'og';
    data.scienceGlow = 'purple';
    data.scienceReport = { status:'active', startDate:start, currentWeek:2, focus1:['Petto'], baseLandmarks:{Petto:{mev:10,mav:12,mrv:20}}, weekHistory:{1:{startDate:start,completedDate:start+7*86400000}} };
    const before = structuredClone(data);
    const report = buildProgressReport(data, start+8*86400000, {includeScience:true});
    expect(report.theme).toBe('og');
    expect(report.science.weeks).toHaveLength(12);
    expect(report.science.weeks[0].kind).toBe('archive');
    expect(report.science.weeks[1].kind).toBe('current');
    expect(report.science.weeks[2].kind).toBe('estimate');
    expect(progressReportPages(report).filter(p=>p.type==='science')).toHaveLength(12);
    expect(data).toEqual(before);
  });
  it('exports distinct theme palettes and highlights only the named anatomical muscle', () => {
    expect(progressReportPalette('og','gold')).toMatchObject({minimal:false,glow:'0, 180, 230'});
    expect(progressReportPalette('science-v3','purple')).toMatchObject({minimal:true,glow:'168, 85, 247'});
    expect(progressReportPalette('science-v3','invalid').glow).toBe('230, 207, 0');
    for (const muscle of ['Petto','Dorso','Femorali','Spalle','Bicipiti','Tricipiti','Polpacci','Glutei','Quadricipiti','Addome']) {
      expect(progressMuscleIcon(muscle).polygons.some(p=>p.selected)).toBe(true);
    }
    expect(progressMuscleIcon('Dorso').posterior).toBe(true);
    expect(progressMuscleIcon('Petto').selected).toEqual(['chest']);
    expect(progressMuscleIcon('Custom').polygons.some(p=>p.selected)).toBe(false);
  });

});
