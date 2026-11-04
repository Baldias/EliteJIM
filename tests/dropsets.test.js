import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { muscleSessions } from '../src/utils/muscleFatigue';
import { formatElapsed } from '../src/utils/duration';
import { EXERCISES_DB } from '../src/data/exercises';

const original = useStore.getInitialState();
afterEach(() => useStore.setState(original, true));

describe('optional drop sets', () => {
  it('are off by default, also for existing installs, and can be switched on in Settings', () => {
    expect(original.showDropsets).toBe(false);
    const merge = useStore.persist.getOptions().merge;
    expect(merge({ history: [{ id: 1 }] }, original).showDropsets).toBe(false);
    useStore.getState().toggleDropsets();
    expect(useStore.getState().showDropsets).toBe(true);
  });

  it('adds a drop set that starts from the last set and is flagged apart', () => {
    useStore.setState({ activeWorkout: { id: 1, startTime: 0, exercises: [{ id: 'ex', name: 'Curl Bilanciere', sets: [{ id: 'a', kg: '30', reps: '10', targetReps: '8-10', done: true }] }] } });
    useStore.getState().addDropsetToActiveExercise('ex');
    const sets = useStore.getState().activeWorkout.exercises[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[1]).toMatchObject({ kg: '30', reps: '10', targetReps: '', done: false, isDropset: true });
    useStore.getState().addDropsetToActiveExercise('missing');
    expect(useStore.getState().activeWorkout.exercises[0].sets).toHaveLength(2);
  });

  it('never count toward fatigue', () => {
    const now = Date.now();
    const history = [{ id: 1, startTime: now - 3600000, exercises: [{ name: 'Curl Bilanciere', sets: [{ done: true, reps: 10, isDropset: true }] }] }];
    expect(Object.values(muscleSessions(history, EXERCISES_DB, now)).flat()).toEqual([]);
  });

  it('formats the workout clock in hours past 60 minutes', () => {
    expect(formatElapsed(59 * 60 + 5)).toBe('59:05');
    expect(formatElapsed(80 * 60)).toBe('1:20:00');
    expect(formatElapsed(2 * 3600 + 61)).toBe('2:01:01');
  });
});
