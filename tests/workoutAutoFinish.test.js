import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../src/store/useStore';
import { emptyScienceState } from '../src/utils/scienceV3';

const original = useStore.getInitialState();
const start = new Date(2026, 9, 29, 10).getTime();
const hour = 3600000;
const template = { id: 'test', name: 'Test', exercises: [{ name: 'Panca Piana Bilanciere', setsCount: 1 }] };

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(start);
  useStore.setState({ ...original, history: [], scienceState: emptyScienceState(), activeWorkout: null, userXP: 0, muscleXP: {} }, true);
});
afterEach(() => vi.useRealTimers());

function startSession() {
  useStore.getState().startWorkout(template);
  const w = useStore.getState().activeWorkout;
  return { workoutId: w.id, exerciseId: w.exercises[0].id, setId: w.exercises[0].sets[0].id };
}

describe('automatic workout finish', () => {
  it('updates activity for working-set edits and saves the exact last activity after one hour', () => {
    const { workoutId, exerciseId, setId } = startSession();
    vi.setSystemTime(start + 10 * 60000);
    useStore.getState().updateActiveWorkoutSet(exerciseId, setId, 'reps', 10);
    useStore.getState().updateActiveWorkoutSet(exerciseId, setId, 'done', true);
    const lastActivityAt = start + 10 * 60000;
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(lastActivityAt);
    useStore.getState().finishWorkout({ auto: true, workoutId, lastActivityAt, now: lastActivityAt + hour - 1 });
    expect(useStore.getState().history).toHaveLength(0);
    useStore.getState().finishWorkout({ auto: true, workoutId, lastActivityAt, now: lastActivityAt + hour + 10000 });
    const state = useStore.getState();
    expect(state.activeWorkout).toBeNull();
    expect(state.history).toHaveLength(1);
    expect(state.history[0].endTime).toBe(lastActivityAt);
    expect(state.lastWorkoutDate).toBe(lastActivityAt);
    expect(state.recapData.workout.id).toBe(workoutId);
    const xp = state.userXP;
    useStore.getState().finishWorkout({ auto: true, workoutId, lastActivityAt, now: lastActivityAt + 2 * hour });
    expect(useStore.getState().history).toHaveLength(1);
    expect(useStore.getState().userXP).toBe(xp);
  });
  it('ignores stale deadlines after new activity or a different workout', () => {
    const { workoutId, exerciseId, setId } = startSession();
    vi.setSystemTime(start + 30 * 60000);
    useStore.getState().updateActiveWorkoutSet(exerciseId, setId, 'kg', 30);
    useStore.getState().finishWorkout({ auto: true, workoutId, lastActivityAt: start, now: start + hour });
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 30 * 60000);
    useStore.getState().finishWorkout({ auto: true, workoutId: 'other', lastActivityAt: start + 30 * 60000, now: start + 2 * hour });
    expect(useStore.getState().history).toHaveLength(0);
  });
  it('records additions, deletions, notes and RIR changes as activity, but ignores invalid and unchanged edits', () => {
    const ids = startSession();
    vi.setSystemTime(start + 1000);
    useStore.getState().addExerciseToActiveSession('Curl Bilanciere');
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 1000);
    vi.setSystemTime(start + 2000);
    useStore.getState().addSetToActiveExercise(ids.exerciseId);
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 2000);
    vi.setSystemTime(start + 3000);
    useStore.getState().updateActiveWorkoutExerciseNotes(ids.exerciseId, 'Nota');
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 3000);
    vi.setSystemTime(start + 4000);
    useStore.getState().annotateScienceSet(ids.workoutId, ids.exerciseId, ids.setId, { rir: 1 });
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 4000);
    vi.setSystemTime(start + 5000);
    useStore.getState().deleteSetFromActiveExercise(ids.exerciseId, ids.setId);
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 5000);
    vi.setSystemTime(start + 6000);
    useStore.getState().deleteExerciseFromActiveSession(ids.exerciseId);
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 6000);
    vi.setSystemTime(start + 7000);
    useStore.getState().deleteExerciseFromActiveSession('missing');
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + 6000);
  });
  it('restores the activity timestamp after reopening and closes at the recorded time', async () => {
    const { workoutId, exerciseId, setId } = startSession();
    vi.setSystemTime(start + 15 * 60000);
    useStore.getState().updateActiveWorkoutSet(exerciseId, setId, 'reps', 12);
    const lastActivityAt = useStore.getState().activeWorkout.lastActivityAt;
    const saved = localStorage.getItem('elitejim-storage');
    useStore.setState({ activeWorkout: null });
    localStorage.setItem('elitejim-storage', saved);
    await useStore.persist.rehydrate();
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(lastActivityAt);
    useStore.getState().finishWorkout({ auto: true, workoutId, lastActivityAt, now: lastActivityAt + 3 * hour });
    expect(useStore.getState().history[0].endTime).toBe(lastActivityAt);
  });
  it('gives older active sessions without activity timestamps an hour from their first opening', () => {
    const ids = startSession();
    const workout = { ...useStore.getState().activeWorkout }; delete workout.lastActivityAt;
    useStore.setState({ activeWorkout: workout });
    useStore.getState().initializeWorkoutActivity(start + hour);
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + hour);
    useStore.getState().initializeWorkoutActivity(start + 2 * hour);
    expect(useStore.getState().activeWorkout.lastActivityAt).toBe(start + hour);
    useStore.getState().finishWorkout({ auto: true, workoutId: ids.workoutId, lastActivityAt: start + hour, now: start + 2 * hour });
    expect(useStore.getState().history[0].endTime).toBe(start + hour);
  });
  it('keeps the normal manual finish time and clears the rest timer', () => {
    startSession(); useStore.setState({ globalRestEndTime: start + 50000 });
    vi.setSystemTime(start + 20000); useStore.getState().finishWorkout();
    expect(useStore.getState().history[0].endTime).toBe(start + 20000);
    expect(useStore.getState().globalRestEndTime).toBeNull();
  });
});
