import { describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../src/data/exercises';
import {
  emptyScienceState, createScienceProgram, scienceWeekRange, scienceVolumes,
  classifyScienceExercise, captureScienceExercises, closeScienceWeek,
  respondScienceRecommendation, currentScienceSummary, sciencePerformance,
} from '../src/utils/scienceV3';

const start = new Date(2026, 8, 7).getTime();
const profile = { experience: 'advanced', daysPerWeek: 5, minutesPerSession: 90, goal: 'specialization', priorities: ['Petto'], startDate: start };
const program = (p = {}) => createScienceProgram({ ...profile, ...p }, [], EXERCISES_DB, emptyScienceState(), null, start);
function workout(id, time, name = 'Panca Piana Bilanciere', count = 4, reps = 10) {
  return { id, startTime: time, endTime: time + 3600000, exercises: [{ id: `ex-${id}`, name, sets: Array.from({ length: count }, (_, i) => ({ id: `s-${i}`, done: true, kg: 60, reps })) }] };
}
function annotate(science, w, rir = 0) {
  science.annotations[w.id] = Object.fromEntries(w.exercises.map(ex => [ex.id, Object.fromEntries(ex.sets.map(s => [s.id, { rir }]))]));
  science.feedback[w.id] = { sleep: 'good', systemicFatigue: false, muscles: { Petto: { recovery: 'good', quality: 'good', pain: false } } };
}

describe('direct scientific accounting', () => {
  it('keeps shoulders as one district and has no fuzzy press inference', () => {
    expect(classifyScienceExercise({ name: 'Alzate Laterali Manubri' }, EXERCISES_DB, emptyScienceState()).primary).toBe('Spalle');
    expect(classifyScienceExercise({ name: 'Chest Press Custom' }, EXERCISES_DB, emptyScienceState()).primary).toBeNull();
    expect(classifyScienceExercise({ name: 'Adductor Machine' }, EXERCISES_DB, emptyScienceState()).primary).toBeNull();
  });
  it('counts only 0/1 RIR ordinary sets and separates indirect work', () => {
    const science = program();
    const w = workout(1, start + 1000, 'Dip alle Parallele', 6);
    annotate(science, w);
    const sets = w.exercises[0].sets;
    sets[1].isDropset = true;
    sets[2].isRestPause = true;
    sets[3].isWarmup = true;
    science.annotations[1]['ex-1']['s-4'] = { rir: null };
    science.annotations[1]['ex-1']['s-5'] = { rir: 1, excluded: true };
    const result = scienceVolumes([w], EXERCISES_DB, science, start, start + 86400000);
    expect(result.muscles.Petto).toEqual({ direct: 1, ordinary: 2, unknown: 1, indirect: 0 });
    expect(result.muscles.Tricipiti.direct).toBe(0);
    expect(result.muscles.Tricipiti.indirect).toBe(1);
  });
  it('does not invent RIR or modify legacy logs', () => {
    const w = workout(1, start + 1000);
    const before = structuredClone(w);
    const result = scienceVolumes([w], EXERCISES_DB, program(), start, start + 86400000);
    expect(result.muscles.Petto.unknown).toBe(4);
    expect(result.muscles.Petto.direct).toBe(0);
    expect(w).toEqual(before);
  });
  it('freezes classification snapshots against future catalog edits', () => {
    const w = workout(1, start + 1000);
    let science = program(); annotate(science, w);
    science = captureScienceExercises(science, w, EXERCISES_DB);
    const changed = EXERCISES_DB.map(e => ({ ...e, category: 'Quadricipiti' }));
    expect(scienceVolumes([w], changed, science, start, start + 86400000).muscles.Petto.direct).toBe(4);
  });
  it('accepts an explicit custom classification without changing the catalog', () => {
    const science = program(); science.classifications.custom = { primary: 'Spalle', indirect: [] };
    expect(classifyScienceExercise({ name: 'Custom' }, [], science).primary).toBe('Spalle');
  });
});

describe('calendar and initial doses', () => {
  it('uses adjacent half-open weekly windows', () => {
    const a = scienceWeekRange(start, 1), b = scienceWeekRange(start, 2);
    expect(a.end).toBe(b.start);
    const science = program(), w = workout(1, a.end); annotate(science, w);
    expect(scienceVolumes([w], EXERCISES_DB, science, a.start, a.end).muscles.Petto.direct).toBe(0);
    expect(scienceVolumes([w], EXERCISES_DB, science, b.start, b.end).muscles.Petto.direct).toBe(4);
  });
  it('uses local dates across DST changes', () => {
    const anchor = new Date(2026, 9, 22).getTime();
    const a = scienceWeekRange(anchor, 1), b = scienceWeekRange(anchor, 2);
    expect(new Date(a.end).getDate()).toBe(29);
    expect(new Date(a.end).getHours()).toBe(0);
    expect(a.end).toBe(b.start);
    expect((a.end - a.start) / 3600000).toBe(169);
  });
  it('uses the historical median and keeps non-priorities at their growth base', () => {
    const history = [workout(1, scienceWeekRange(start, -1).start, undefined, 14), workout(2, scienceWeekRange(start, 0).start, undefined, 18)];
    const science = createScienceProgram(profile, history, EXERCISES_DB, emptyScienceState(), null, start);
    expect(science.program.targets.Petto).toBe(12);
    expect(science.program.landmarks.Petto.source).toBe('blended-estimate');
    expect(science.program.landmarks.Petto.mrv).toBeNull();
    expect(science.program.roles.Dorso).toBe('support');
    expect(science.program.targets.Dorso).toBe(10);
    expect(science.program.landmarks.Dorso.mevEstimate).toBe(10);
  });
  it('never initializes a growth district to zero because of sparse historical exposure', () => {
    const history = [workout(1, start - 7 * 86400000, 'Panca Piana Bilanciere', 4), workout(2, start - 14 * 86400000, 'Leg Curl', 4), workout(3, start - 21 * 86400000, 'Leg Curl', 4), workout(4, start - 28 * 86400000, 'Leg Curl', 4)];
    const science = createScienceProgram(profile, history, EXERCISES_DB, emptyScienceState(), null, start);
    expect(science.program.targets.Petto).toBe(10);
    expect(science.program.targets.Bicipiti).toBeGreaterThanOrEqual(4);
    expect(science.program.targets.Spalle).toBeGreaterThanOrEqual(5);
  });
  it('starts an advanced growth district from its experience estimate even when the logged median is only three', () => {
    const history = [workout(1, start - 7 * 86400000, undefined, 3), workout(2, start - 14 * 86400000, undefined, 3)];
    const science = createScienceProgram(profile, history, EXERCISES_DB, emptyScienceState(), null, start);
    expect(science.program.targets.Petto).toBe(10);
    expect(science.program.landmarks.Petto.mevEstimate).toBe(10);
    expect(science.program.landmarks.Petto.source).toBe('starting-dose');
  });
  it('carries personally observed landmarks into the next block without mutating the previous one', () => {
    const old = program();
    old.program.landmarks.Petto.productiveRange = [14, 18];
    old.program.landmarks.Petto.maxTolerated = 18;
    old.program.landmarks.Petto.mrv = { lower: 18, upper: 20, confidence: 'low' };
    const next = createScienceProgram(profile, [], EXERCISES_DB, old, null, start + 1);
    expect(next.program.landmarks.Petto.productiveRange).toEqual([14, 18]);
    next.program.landmarks.Petto.productiveRange[1] = 22;
    expect(old.program.landmarks.Petto.productiveRange).toEqual([14, 18]);
  });
  it('does not count known recovery weeks in the historical baseline', () => {
    const history = [workout(1, start - 14 * 86400000, undefined, 25), workout(2, start - 7 * 86400000, undefined, 25)];
    const legacy = { weekHistory: { 9: { startDate: start - 14 * 86400000, completedDate: start } } };
    expect(createScienceProgram(profile, history, EXERCISES_DB, emptyScienceState(), legacy, start).program.landmarks.Petto.source).toBe('starting-dose');
  });
  it('fits new users to their available time, but never shrinks a historical starting dose', () => {
    const science = program({ experience: 'beginner', goal: 'balanced', priorities: [], daysPerWeek: 2, minutesPerSession: 30 });
    expect(Object.values(science.program.targets).reduce((a, b) => a + b, 0)).toBe(15);
    expect(science.program.targets).toHaveProperty('Spalle');
    expect(Object.keys(science.program.targets).some(m => m.includes('Deltoidi'))).toBe(false);
  });
});

describe('accumulation, peak and recovery decisions', () => {
  it('increases a recovered advanced priority from 14 towards 20 over four accumulation weeks', () => {
    let science = program(); science.program.targets.Petto = 14;
    const history = [];
    for (let week = 1; week <= 3; week++) {
      const range = scienceWeekRange(start, week);
      const w = workout(week, range.start + 1000, undefined, science.program.targets.Petto, 10 + week);
      annotate(science, w); history.push(w);
      science = closeScienceWeek(science, history, EXERCISES_DB, range.end);
      const allocation = science.program.recommendations.find(r => r.status === 'pending' && r.type === 'redistribution');
      if (allocation) science = respondScienceRecommendation(science, allocation.id, 'redistribute');
      expect(science.program.targets.Petto).toBe(14 + week * 2);
    }
    expect(science.program.currentWeek).toBe(4);
    expect(science.program.targets.Petto).toBe(20);
  });
  it('limits the beginner increment to one and does not demand a plateau', () => {
    let science = program({ experience: 'beginner' });
    const target = science.program.targets.Petto;
    const w = workout(1, start + 1000, undefined, target); annotate(science, w);
    science = closeScienceWeek(science, [w], EXERCISES_DB, scienceWeekRange(start, 1).end);
    expect(science.program.targets.Petto).toBe(target + 1);
  });
  it('can add three sets to an advanced priority with fully completed work, two exposures and consistently good quality', () => {
    const science = program();
    const target = science.program.targets.Petto;
    const ws = [workout(1, start + 1000, undefined, Math.ceil(target / 2)), workout(2, start + 86400000, undefined, Math.floor(target / 2))];
    ws.forEach(w => annotate(science, w));
    expect(closeScienceWeek(science, ws, EXERCISES_DB, scienceWeekRange(start, 1).end).program.targets.Petto).toBe(target + 3);
  });
  it('preserves targets during missing data and skipped weeks', () => {
    const science = program();
    const next = closeScienceWeek(science, [], EXERCISES_DB, scienceWeekRange(start, 1).end);
    expect(next.program.targets).toEqual(science.program.targets);
    expect(next.program.recommendations).toEqual([]);
    expect(closeScienceWeek(science, [], EXERCISES_DB, start)).toBe(science);
  });
  it('does not increase unknown-RIR or poor-quality work', () => {
    const science = program(); const w = workout(1, start + 1000, undefined, 15);
    annotate(science, w); science.feedback[1].muscles.Petto.quality = 'poor';
    const next = closeScienceWeek(science, [w], EXERCISES_DB, scienceWeekRange(start, 1).end);
    expect(next.program.targets.Petto).toBe(science.program.targets.Petto);
    science.annotations = {};
    expect(closeScienceWeek(science, [w], EXERCISES_DB, scienceWeekRange(start, 1).end).program.targets).toEqual(science.program.targets);
  });
  it('offers systemic recovery without automatically reducing or pausing', () => {
    const science = program();
    const ws = [workout(1, start + 1000, undefined, 8), workout(2, start + 86400000, undefined, 8)];
    ws.forEach(w => { annotate(science, w); science.feedback[w.id].systemicFatigue = true; });
    const next = closeScienceWeek(science, ws, EXERCISES_DB, scienceWeekRange(start, 1).end);
    expect(next.program.targets).toEqual(science.program.targets);
    expect(next.program.recommendations[0]).toMatchObject({ systemic: true, status: 'pending' });
    const rejected = respondScienceRecommendation(next, next.program.recommendations[0].id, 'reject');
    expect(rejected.program.targets).toEqual(science.program.targets);
    expect(rejected.program.pauses).toEqual({});
  });
  it('reduces by 25% only on acceptance and cannot apply a decision twice', () => {
    const science = program(); science.program.targets.Petto = 10;
    science.program.recommendations = [{ id: 'r', status: 'pending', type: 'recovery', muscles: ['Petto'] }];
    const next = respondScienceRecommendation(science, 'r', 'reduce');
    expect(next.program.targets.Petto).toBe(7);
    expect(science.program.targets.Petto).toBe(10);
    expect(respondScienceRecommendation(next, 'r', 'reduce')).toBe(next);
  });
  it('offers a deload after the peak, without applying it', () => {
    const science = program(); science.program.currentWeek = 4;
    const next = closeScienceWeek(science, [], EXERCISES_DB, scienceWeekRange(start, 4).end);
    expect(next.program.currentWeek).toBe(5);
    expect(next.program.targets).toEqual(science.program.targets);
    const r = next.program.recommendations.find(r => r.type === 'deload');
    expect(r.status).toBe('pending');
    const global = respondScienceRecommendation(next, r.id, 'reduce-all');
    expect(global.program.targets.Petto).toBe(Math.floor(science.program.targets.Petto / 2));
    expect(global.program.targets.Dorso).toBe(Math.floor(science.program.targets.Dorso / 2));
    expect(respondScienceRecommendation(next, r.id, 'reject').program.targets).toEqual(science.program.targets);
  });
  it('offers a local deload without reducing other districts and supersedes prior advice', () => {
    const science = program(); science.program.currentWeek = 4;
    science.program.recommendations = [{ id: 'old', status: 'pending', type: 'recovery', muscles: ['Petto'] }];
    const range = scienceWeekRange(start, 4);
    const w = workout(1, range.start + 1000); annotate(science, w);
    science.feedback[1].muscles.Petto.recovery = 'poor';
    const next = closeScienceWeek(science, [w], EXERCISES_DB, range.end);
    expect(next.program.recommendations.find(r => r.id === 'old').status).toBe('superseded');
    const r = next.program.recommendations.find(r => r.type === 'deload');
    expect(r.muscles).toEqual(['Petto']);
    const local = respondScienceRecommendation(next, r.id, 'reduce');
    expect(local.program.targets.Petto).toBe(Math.floor(next.program.targets.Petto / 2));
    expect(local.program.targets.Dorso).toBe(next.program.targets.Dorso);
  });
  it('does not fabricate MRV from one bad week and restores an accepted temporary pause', () => {
    let science = program();
    const w = workout(1, start + 1000); annotate(science, w);
    science.feedback[1].muscles.Petto.recovery = 'poor';
    science = closeScienceWeek(science, [w], EXERCISES_DB, scienceWeekRange(start, 1).end);
    expect(science.program.landmarks.Petto.mrv).toBeNull();
    const rec = science.program.recommendations[0];
    science = respondScienceRecommendation(science, rec.id, 'pause');
    expect(science.program.targets.Petto).toBe(0);
    const resume = science.program.pauses.Petto.resumeTarget;
    science = closeScienceWeek(science, [w], EXERCISES_DB, scienceWeekRange(start, 2).end);
    expect(science.program.targets.Petto).toBe(resume);
    expect(science.program.weeks[1].recovery).toBe(true);
  });
  it('finishes at five weeks and retains the final summary and classifications', () => {
    const science = program(); science.program.currentWeek = 5;
    const next = closeScienceWeek(science, [], EXERCISES_DB, scienceWeekRange(start, 5).end);
    expect(next.program.status).toBe('completed');
    expect(next.program.weeks[0]).toHaveProperty('classifications');
    expect(closeScienceWeek(next, [], EXERCISES_DB, scienceWeekRange(start, 6).end)).toBe(next);
  });
  it('compares the same exercise and RIR, without inventing a decline from a different load/repetition tradeoff', () => {
    const science = program(); const ws = [workout(1, start + 1000), workout(2, start + 2000), workout(3, start + 3000)];
    ws.forEach(w => annotate(science, w));
    expect(sciencePerformance(ws, EXERCISES_DB, science, 'Petto', start + 4000).status).toBe('plateau');
    ws[2].exercises[0].sets.forEach(s => { s.kg = 70; s.reps = 8; });
    expect(sciencePerformance(ws, EXERCISES_DB, science, 'Petto', start + 4000).status).toBe('mixed');
  });
  it('shares one summary for dashboard/profile/recap and never duplicates closed weeks', () => {
    const science = program(); const w = workout(1, start + 1000); annotate(science, w);
    expect(currentScienceSummary([w], EXERCISES_DB, science, start + 2000).muscles.Petto.direct).toBe(4);
    const end = scienceWeekRange(start, 1).end;
    const next = closeScienceWeek(science, [w], EXERCISES_DB, end);
    expect(closeScienceWeek(next, [w], EXERCISES_DB, end)).toBe(next);
    expect(next.program.weeks).toHaveLength(1);
  });
});
