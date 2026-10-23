import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { getAllExercises } from '../src/data/exercises';
import { currentScienceSummary, emptyScienceState } from '../src/utils/scienceV3';
import { scienceBackfillWorkouts } from '../src/utils/scienceBackfill';

const original = useStore.getInitialState();
const start = new Date(2026, 9, 19).getTime(), now = new Date(2026, 9, 22, 12).getTime();
const workout = (id, time) => ({ id, name: 'Spinta', startTime: time, exercises: [{ id: 'ex', name: 'Panca Piana Bilanciere', sets: [{ id: 'known', done: true, kg: 60, reps: 10 }, { id: 'unknown', done: true, kg: 60, reps: 8 }, { id: 'warm', done: true, reps: 10, isWarmup: true }, { id: 'drop', done: true, reps: 10, isDropset: true }, { id: 'rp', done: true, reps: 10, isRestPause: true }, { id: 'skipped', done: false, reps: 10 }, { id: 'excluded', done: true, reps: 10 }] }] });
const profile = { experience: 'advanced', goal: 'balanced', daysPerWeek: 5, minutesPerSession: 90, priorities: [], startDate: start };
const protectedData = () => structuredClone(Object.fromEntries(['history', 'templates', 'userXP', 'muscleXP', 'currentStreak', 'highestStreak', 'bodyweight', 'scienceReport'].map(k => [k, useStore.getState()[k]])));
beforeEach(() => {
  const science = emptyScienceState();
  science.annotations[2] = { ex: { known: { rir: 1 }, excluded: { excluded: true } } };
  useStore.setState({ ...original, history: [workout(1, start - 1), workout(2, start), workout(3, now + 1)], scienceState: science, userXP: 5000, muscleXP: { Petto: 300 }, currentStreak: 3, highestStreak: 7 }, true);
});

describe('backdated mesocycle', () => {
  it('includes earlier sessions from the chosen local date while preserving unknown effort and protected data', () => {
    const before = protectedData();
    useStore.getState().startScienceV3(profile, now);
    const state = useStore.getState(), summary = currentScienceSummary(state.history, getAllExercises([], {}), state.scienceState, now);
    expect(summary.muscles.Petto).toMatchObject({ direct: 1, unknown: 1, ordinary: 2 });
    expect(state.scienceState.exerciseSnapshots[2].ex.primary).toBe('Petto');
    expect(protectedData()).toEqual(before);
  });
  it('only applies explicitly confirmed RIR to eligible historical ordinary sets, without affecting XP or overwriting known effort', () => {
    const before = protectedData();
    const choices = Object.fromEntries([1, 2, 3].map(id => [id, { ex: Object.fromEntries(['known', 'unknown', 'warm', 'drop', 'rp', 'skipped', 'excluded'].map(set => [set, 0])) }]));
    useStore.getState().startScienceV3({ ...profile, historicalRir: choices }, now);
    const state = useStore.getState(), summary = currentScienceSummary(state.history, getAllExercises([], {}), state.scienceState, now);
    expect(summary.muscles.Petto).toMatchObject({ direct: 2, unknown: 0, ordinary: 2 });
    expect(state.scienceState.annotations[2].ex).toEqual({ known: { rir: 1 }, excluded: { excluded: true }, unknown: { rir: 0 } });
    expect(state.scienceState.annotations[1]).toBeUndefined();
    expect(state.scienceState.annotations[3]).toBeUndefined();
    expect(state.scienceState.profile).not.toHaveProperty('historicalRir');
    expect(protectedData()).toEqual(before);
  });
  it('keeps old starts on week one until the athlete chooses to advance, without fabricated catch-up weeks', () => {
    useStore.getState().startScienceV3({ ...profile, startDate: start - 35 * 86400000 }, now);
    expect(useStore.getState().scienceState.program).toMatchObject({ currentWeek: 1, weeks: [] });
  });
  it('keeps unrecognized exercises visible for classification without inventing a muscle', () => {
    const state = useStore.getState(), history = [workout(2, start)];
    history[0].exercises[0].name = 'Chest press sconosciuta';
    const result = scienceBackfillWorkouts(history, getAllExercises([], {}), state.scienceState, start, now);
    expect(result[0].exercises[0].primary).toBeNull();
  });
});
