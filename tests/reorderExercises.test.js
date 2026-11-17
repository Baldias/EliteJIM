import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';

const ids = () => useStore.getState().activeWorkout.exercises.map(ex => ex.id);

describe('moveExerciseInActiveSession', () => {
  beforeEach(() => {
    useStore.setState({ activeWorkout: { id: 1, startTime: 0, exercises: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id, sets: [] })) } });
  });

  it('moves an exercise down and up', () => {
    useStore.getState().moveExerciseInActiveSession('a', 2);
    expect(ids()).toEqual(['b', 'c', 'a', 'd']);
    useStore.getState().moveExerciseInActiveSession('d', 0);
    expect(ids()).toEqual(['d', 'b', 'c', 'a']);
  });

  it('clamps the target and ignores unknown exercises', () => {
    useStore.getState().moveExerciseInActiveSession('b', 99);
    expect(ids()).toEqual(['a', 'c', 'd', 'b']);
    const before = useStore.getState().activeWorkout;
    useStore.getState().moveExerciseInActiveSession('zzz', 0);
    expect(useStore.getState().activeWorkout).toBe(before);
  });
});
