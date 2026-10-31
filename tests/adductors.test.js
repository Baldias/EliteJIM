import { describe, expect, it } from 'vitest';
import { EXERCISES_DB, EXERCISE_CATEGORIES } from '../src/data/exercises';
import { calculateLast7DaysVolume, RP_LANDMARKS } from '../src/utils/rpVolume';
import { exerciseMuscleWeights } from '../src/utils/muscleFatigue';
import { SCIENCE_VOLUME_REFERENCES, scienceReference } from '../src/utils/scienceReferences';
import { createScienceProgram, emptyScienceState, OPTIONAL_MUSCLES } from '../src/utils/scienceV3';

const done = n => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, done: true, reps: 10, kg: 40 }));

describe('Adduttori district', () => {
  it('maps only the adductor machine to Adduttori', () => {
    expect(EXERCISE_CATEGORIES.ADDUCTORS).toBe('Adduttori');
    const mapped = EXERCISES_DB.filter(e => e.category === 'Adduttori' || e.secondaryCategories?.includes('Adduttori'));
    expect(mapped.map(e => e.name)).toEqual(['Adductor Machine']);
  });

  it('counts adductor machine sets in the weekly volume, not as quads', () => {
    const history = [{ id: 1, startTime: Date.now(), exercises: [{ name: 'Adductor Machine', sets: done(3) }] }];
    const volumes = calculateLast7DaysVolume(history, EXERCISES_DB);
    expect(volumes.Adduttori).toBe(3);
    expect(volumes.Quadricipiti).toBe(0);
    expect(RP_LANDMARKS.Adduttori).toEqual({ MEV: 0, MAV_MIN: 4, MAV_MAX: 12, MRV: 16 });
  });

  it('loads the inner thigh on the body and fatigue maps', () => {
    expect(exerciseMuscleWeights('Adductor Machine', EXERCISES_DB)).toEqual({ adductor: 1 });
  });

  it('is an optional Science district with low landmarks', () => {
    expect(OPTIONAL_MUSCLES).toContain('Adduttori');
    expect(SCIENCE_VOLUME_REFERENCES.Adduttori).toEqual({ mv: 0, mev: 0, mav: [4, 12], mrv: 16 });
    expect(scienceReference('Adduttori').start).toBe(4);
    const base = { experience: 'beginner', gender: 'male', daysPerWeek: 4, minutesPerSession: 60, goal: 'balanced', priorities: [], startDate: Date.now() };
    const off = createScienceProgram({ ...base, optionalMuscles: [] }, [], EXERCISES_DB, emptyScienceState(), null);
    const on = createScienceProgram({ ...base, optionalMuscles: ['Adduttori'] }, [], EXERCISES_DB, emptyScienceState(), null);
    expect(off.program.targets.Adduttori).toBeUndefined();
    expect(on.program.targets.Adduttori).toBeGreaterThan(0);
    expect(on.program.targets.Adduttori).toBeLessThanOrEqual(4);
  });
});
