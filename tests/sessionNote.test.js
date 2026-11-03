import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { getSessionNote, withSessionNote } from '../src/utils/sessionNote';

const plan = { id: 'a', name: 'A', exercises: [{ name: 'Squat con Bilanciere', setsCount: 1, targetReps: '8', restTime: 90 }] };

describe('session note stays with its session', () => {
  beforeEach(() => {
    useStore.setState({ templates: [plan], history: [], activeWorkout: null, exerciseNotes: {} });
  });

  it('is saved in the history with the finished session only', () => {
    useStore.getState().startWorkout(plan);
    useStore.getState().updateActiveWorkoutSessionNote('  Dormito poco  ');
    useStore.getState().finishWorkout();
    expect(useStore.getState().history[0].sessionNote).toBe('Dormito poco');

    useStore.getState().startWorkout(plan);
    expect(useStore.getState().activeWorkout.sessionNote).toBeUndefined();
    useStore.getState().finishWorkout();
    expect('sessionNote' in useStore.getState().history[0]).toBe(false);
    expect(useStore.getState().exerciseNotes).toEqual({});
    expect(useStore.getState().templates[0]).toEqual(plan);
  });

  it('drops a blank note', () => {
    useStore.getState().startWorkout(plan);
    useStore.getState().updateActiveWorkoutSessionNote('   ');
    useStore.getState().finishWorkout();
    expect('sessionNote' in useStore.getState().history[0]).toBe(false);
  });

  it('can be edited or removed from the history', () => {
    useStore.getState().startWorkout(plan);
    useStore.getState().updateActiveWorkoutSessionNote('Spalla dolorante');
    useStore.getState().finishWorkout();
    const id = useStore.getState().history[0].id;
    useStore.getState().updateHistoryWorkout(id, { sessionNote: undefined });
    expect(getSessionNote(JSON.parse(JSON.stringify(useStore.getState().history[0])))).toBe('');
  });

  it('helpers trim and drop empty notes', () => {
    expect(getSessionNote({ sessionNote: ' ok ' })).toBe('ok');
    expect(getSessionNote({})).toBe('');
    expect(withSessionNote({ id: 1, sessionNote: 'x' }, '')).toEqual({ id: 1 });
    expect(withSessionNote({ id: 1 }, ' y ')).toEqual({ id: 1, sessionNote: 'y' });
  });
});
