import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { countSets, setVolumeValue } from '../src/utils/setCounting';
import { calculateVolumeForDateRange } from '../src/utils/rpVolume';
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

  it('count as half a set in weekly volume, warm-ups and skipped sets as zero', () => {
    expect(setVolumeValue({ done: true })).toBe(1);
    expect(setVolumeValue({ done: true, isDropset: true })).toBe(0.5);
    expect(setVolumeValue({ done: true, isWarmup: true })).toBe(0);
    expect(setVolumeValue({ done: false, isDropset: true })).toBe(0);
    expect(countSets([{ done: true }, { done: true, isDropset: true }, { done: true, isDropset: true }])).toBe(2);
    const history = [{ id: 1, startTime: 10, exercises: [{ name: 'Curl Bilanciere', sets: [{ done: true }, { done: true }, { done: true, isDropset: true }] }] }];
    expect(calculateVolumeForDateRange(history, EXERCISES_DB, 0, 100).Bicipiti).toBe(2.5);
  });
});
