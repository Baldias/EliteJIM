import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { getAllExercises } from '../src/data/exercises';
import { currentScienceSummary, emptyScienceState } from '../src/utils/scienceV3';

const original = useStore.getInitialState();
const start = new Date(2026, 9, 19).getTime(), now = new Date(2026, 9, 22, 12).getTime();
const profile = { experience: 'advanced', goal: 'balanced', daysPerWeek: 5, minutesPerSession: 90, priorities: [], startDate: start };
const active = () => ({ id: 7, name: 'Spinta', startTime: now, exercises: [{ id: 'ex', name: 'Panca Piana Bilanciere', sets: [
  { id: 'a', kg: 60, reps: 10, done: false }, { id: 'b', kg: 60, reps: 8, done: false }, { id: 'warm', reps: 10, done: false, isWarmup: true }, { id: 'c', kg: 60, reps: 8, done: false },
] }] });
const annotations = () => useStore.getState().scienceState.annotations[7]?.ex || {};

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ ...original, history: [], scienceState: emptyScienceState() }, true);
});

describe('RIR selector', () => {
  it('is on by default and can be switched off in Settings', () => {
    expect(useStore.getState().showRirSelector).toBe(true);
    useStore.getState().toggleRirSelector();
    expect(useStore.getState().showRirSelector).toBe(false);
  });

  it('stores the effort on the set outside Scienza', () => {
    useStore.setState({ activeWorkout: active() });
    useStore.getState().updateActiveWorkoutSet('ex', 'a', 'rir', 1);
    expect(useStore.getState().activeWorkout.exercises[0].sets[0].rir).toBe(1);
    useStore.getState().markScienceSetCompleted(7, 'ex', 'a');
    expect(useStore.getState().scienceState.annotations[7]).toBeUndefined();
  });

  it('marks completed ordinary sets as 0 RIR in Scienza, never overriding a choice or exclusion', () => {
    useStore.setState({ showScience: true });
    useStore.getState().startScienceV3(profile, now);
    useStore.setState({ activeWorkout: active() });
    const s = useStore.getState();
    s.annotateScienceSet(7, 'ex', 'b', { rir: 1 });
    s.annotateScienceSet(7, 'ex', 'c', { excluded: true });
    for (const id of ['a', 'b', 'warm', 'c']) useStore.getState().markScienceSetCompleted(7, 'ex', id);
    expect(annotations()).toEqual({ a: { rir: 0 }, b: { rir: 1 }, c: { excluded: true } });
  });

  it('turns RIR logged before Scienza into confirmed effort when a backdated mesocycle starts', () => {
    const logged = { id: 2, name: 'Spinta', startTime: start, exercises: [{ id: 'ex', name: 'Panca Piana Bilanciere', sets: [{ id: 'x', kg: 60, reps: 10, done: true, rir: 0 }, { id: 'y', kg: 60, reps: 8, done: true }] }] };
    useStore.setState({ history: [logged] });
    useStore.getState().startScienceV3(profile, now);
    const state = useStore.getState();
    expect(state.scienceState.annotations[2].ex).toEqual({ x: { rir: 0 } });
    expect(currentScienceSummary(state.history, getAllExercises([], {}), state.scienceState, now).muscles.Petto).toMatchObject({ direct: 1, unknown: 1 });
  });
});
