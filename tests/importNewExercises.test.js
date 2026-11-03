import { describe, expect, it } from 'vitest';
import { EXERCISE_CATEGORIES as C, EQUIPMENT_TYPES as E, getAllExercises } from '../src/data/exercises';
import { describeNewExercise, guessCategory, parseAndValidateWorkoutJson } from '../src/utils/aiRoutineHelper';
import { useStore } from '../src/store/useStore';

const db = getAllExercises([], {});

describe('import: exercises not in the database', () => {
  it('lists new exercises with their muscles, from the JSON when given', () => {
    const json = JSON.stringify([{ name: 'Push', exercises: [
      { name: 'Panca Piana Bilanciere', setsCount: 3 },
      { name: 'Landmine Press', category: 'Shoulders', secondaryCategories: ['triceps', 'Spalle'], equipmentType: 'barbell' },
      { name: 'Cable Lateral Raise' },
      { name: 'cable lateral raise' },
      { name: 'Zercher Carry' }
    ] }]);
    const result = parseAndValidateWorkoutJson(json, db);
    expect(result.success).toBe(true);
    expect(result.stats.matchedCount).toBe(1);
    expect(result.stats.newExercises).toEqual([
      { name: 'Landmine Press', category: C.SHOULDERS, secondaryCategories: [C.TRICEPS], equipmentType: E.BARBELL, source: 'json' },
      { name: 'Cable Lateral Raise', category: C.SHOULDERS, secondaryCategories: [], equipmentType: E.MACHINE, source: 'guess' },
      { name: 'Zercher Carry', category: null, secondaryCategories: [], equipmentType: E.BARBELL, source: null }
    ]);
  });

  it('guesses the main muscle from common Italian and English names', () => {
    expect(guessCategory('Leg Curl Sdraiato')).toBe(C.HAMSTRINGS);
    expect(guessCategory('Incline Dumbbell Curl')).toBe(C.BICEPS);
    expect(guessCategory('Croci ai Cavi Bassi')).toBe(C.CHEST);
    expect(guessCategory('Chest Supported Row')).toBe(C.CHEST);
    expect(guessCategory('Seated Calf Raise')).toBe(C.CALVES);
    expect(guessCategory('Glute Kickback')).toBe(C.GLUTES);
    expect(guessCategory('Overhead Triceps Extension')).toBe(C.TRICEPS);
    expect(describeNewExercise('Rematore Manubrio Su Panca').equipmentType).toBe(E.DUMBBELL);
  });

  it('adds only confirmed exercises with a muscle and skips duplicates', () => {
    useStore.setState({ customExercises: [] });
    const added = useStore.getState().addCustomExercises([
      { name: 'Landmine Press', category: C.SHOULDERS, secondaryCategories: [C.SHOULDERS, C.TRICEPS], equipmentType: E.BARBELL },
      { name: 'landmine press', category: C.SHOULDERS },
      { name: 'Panca Piana Bilanciere', category: C.CHEST },
      { name: 'Zercher Carry', category: null }
    ]);
    expect(added).toBe(1);
    const [ex] = useStore.getState().customExercises;
    expect(ex).toMatchObject({ name: 'Landmine Press', category: C.SHOULDERS, secondaryCategories: [C.TRICEPS], isCustom: true });
  });
});
