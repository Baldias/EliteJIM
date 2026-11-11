import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { applyNoteImport, legacyExerciseNotes, planNoteImport, resolveExerciseNotes } from '../src/utils/exerciseNotes';
import { formatTemplatesForExport } from '../src/utils/aiRoutineHelper';

const plan = (name, exercises) => ({ name, exercises: exercises.map(([n, notes]) => ({ name: n, setsCount: 2, targetReps: '8-10', restTime: 90, ...(notes !== undefined ? { notes } : {}) })) });

describe('exercise notes belong to the exercise', () => {
  beforeEach(() => {
    useStore.setState({ templates: [], history: [], activeWorkout: null, exerciseNotes: { 'panca piana bilanciere': 'Gomiti a 45°' } });
  });

  it('shows the same note in every plan that has the exercise', () => {
    useStore.setState({ templates: [{ id: 'a', ...plan('A', [['Panca Piana Bilanciere']]) }, { id: 'b', ...plan('B', [['panca piana bilanciere', '']]) }] });
    useStore.getState().startWorkout(useStore.getState().templates[1]);
    expect(useStore.getState().activeWorkout.exercises[0].notes).toBe('Gomiti a 45°');
  });

  it('saves a note edited during the session for the next sessions', () => {
    useStore.setState({ templates: [{ id: 'a', ...plan('A', [['Squat con Bilanciere']]) }] });
    useStore.getState().startWorkout(useStore.getState().templates[0]);
    const ex = useStore.getState().activeWorkout.exercises[0];
    useStore.getState().updateActiveWorkoutExerciseNotes(ex.id, 'Talloni rialzati');
    expect(useStore.getState().exerciseNotes['squat con bilanciere']).toBe('Talloni rialzati');
    useStore.setState({ activeWorkout: null });
    useStore.getState().startWorkout(useStore.getState().templates[0]);
    expect(useStore.getState().activeWorkout.exercises[0].notes).toBe('Talloni rialzati');
  });

  it('keeps the saved note when the import has an empty or missing note', () => {
    useStore.getState().importTemplates([plan('ChatGPT', [['Panca Piana Bilanciere', ''], ['Military Press']])]);
    const s = useStore.getState();
    expect(s.exerciseNotes['panca piana bilanciere']).toBe('Gomiti a 45°');
    expect(s.templates[0].exercises.every(e => e.notes === undefined)).toBe(true);
  });

  it('adds an imported note only where the exercise has none, and replaces only when chosen', () => {
    const imported = [plan('ChatGPT', [['Panca Piana Bilanciere', 'Fermo al petto'], ['Military Press', 'Glutei contratti']])];
    useStore.getState().importTemplates(imported);
    expect(useStore.getState().exerciseNotes).toEqual({ 'panca piana bilanciere': 'Gomiti a 45°', 'military press': 'Glutei contratti' });
    useStore.getState().importTemplates(imported, { replaceNoteKeys: ['panca piana bilanciere'] });
    expect(useStore.getState().exerciseNotes['panca piana bilanciere']).toBe('Fermo al petto');
  });

  it('lists as conflicts only different notes on exercises that already have one', () => {
    const { additions, conflicts } = planNoteImport([plan('X', [['Panca Piana Bilanciere', 'Fermo al petto'], ['Leg Curl', 'Lento'], ['Military Press', ' ']])], { 'panca piana bilanciere': 'Gomiti a 45°', 'leg curl': 'Lento' });
    expect(additions).toEqual({});
    expect(conflicts).toEqual([{ key: 'panca piana bilanciere', name: 'Panca Piana Bilanciere', current: 'Gomiti a 45°', incoming: 'Fermo al petto' }]);
    expect(applyNoteImport({}, [plan('X', [['Leg Curl', 'Lento']])])).toEqual({ 'leg curl': 'Lento' });
  });

  it('recovers notes saved before, newest session first, then plans', () => {
    const saved = {
      history: [
        { exercises: [{ name: 'Panca Piana Bilanciere', notes: '' }] },
        { exercises: [{ name: 'Panca Piana Bilanciere', notes: 'Vecchia nota' }, { name: 'Leg Curl', notes: 'Lento' }] }
      ],
      templates: [{ exercises: [{ name: 'Leg Curl', notes: 'Dalla scheda' }, { name: 'Military Press', notes: 'Core' }] }]
    };
    expect(legacyExerciseNotes(saved)).toEqual({ 'panca piana bilanciere': 'Vecchia nota', 'leg curl': 'Lento', 'military press': 'Core' });
    expect(resolveExerciseNotes({ ...saved, exerciseNotes: {} })).toEqual({});
  });

  it('moves the note when an exercise is renamed', () => {
    useStore.setState({ customExercises: [{ id: 'c1', name: 'Panca Piana Bilanciere', category: 'Petto', secondaryCategories: [], equipmentType: 'barbell' }] });
    useStore.getState().updateExercise({ id: 'c1', name: 'Panca Piana', category: 'Petto', equipmentType: 'barbell' });
    expect(useStore.getState().exerciseNotes).toEqual({ 'panca piana': 'Gomiti a 45°' });
  });

  it('exports the saved note with the plan', () => {
    const json = JSON.parse(formatTemplatesForExport([plan('A', [['Panca Piana Bilanciere']])], { 'panca piana bilanciere': 'Gomiti a 45°' }));
    expect(json[0].exercises[0].notes).toBe('Gomiti a 45°');
  });
});

describe('markNoteChanges', () => {
  it('flags the first session that carries each note', async () => {
    const { markNoteChanges } = await import('../src/utils/exerciseNotes.js');
    const out = markNoteChanges([
      { time: 1 },
      { time: 2, note: ' Spalla dolorante ' },
      { time: 3, note: 'Spalla dolorante' },
      { time: 4, note: 'Presa larga' },
      { time: 5, note: '' },
      { time: 6, note: 'Presa larga' },
    ]);
    expect(out.map(s => s.note)).toEqual(['', 'Spalla dolorante', 'Spalla dolorante', 'Presa larga', '', 'Presa larga']);
    expect(out.map(s => s.noteChanged)).toEqual([false, true, false, true, false, true]);
  });
});
