import { describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../src/data/exercises';
import { computeMuscleFatigue, exerciseMuscleWeights, fatigueLevel, recoveryHours } from '../src/utils/muscleFatigue';

const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 9, 30, 18);
const sets = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: i, done: true, kg: 50, reps: 8, ...extra }));
const workout = (hoursAgo, exercises) => ({ id: hoursAgo, startTime: NOW - (hoursAgo + 1) * HOUR, endTime: NOW - hoursAgo * HOUR, exercises });
const byMuscle = list => Object.fromEntries(list.map(m => [m.muscle, m]));

describe('muscle fatigue', () => {
  it('counts direct sets fully and assisting muscles at half', () => {
    const w = exerciseMuscleWeights('Panca Piana Bilanciere', EXERCISES_DB);
    expect(w).toEqual({ chest: 1, triceps: 0.5, 'front-deltoids': 0.5 });
    expect(exerciseMuscleWeights('Leg Extension', EXERCISES_DB)).toEqual({ quadriceps: 1 });
    expect(exerciseMuscleWeights('Esercizio sconosciuto', EXERCISES_DB)).toEqual({});
  });

  it('scales recovery with the dose, longer for large lower-body muscles', () => {
    expect(recoveryHours('chest', 1)).toBe(30);
    expect(recoveryHours('chest', 4)).toBe(48);
    expect(recoveryHours('chest', 20)).toBe(72);
    expect(recoveryHours('quadriceps', 4)).toBeCloseTo(57.6);
  });

  it('starts high right after a hard session and fades to recovered', () => {
    const history = [workout(0, [{ name: 'Panca Piana Bilanciere', sets: sets(6) }])];
    const fresh = byMuscle(computeMuscleFatigue(history, EXERCISES_DB, NOW));
    expect(fresh.chest.fatigue).toBe(1);
    expect(fatigueLevel(fresh.chest.fatigue)).toBe(4);
    expect(fresh.triceps.fatigue).toBe(0.5);
    expect(fresh.chest.readyInHours).toBe(54);
    const later = byMuscle(computeMuscleFatigue(history, EXERCISES_DB, NOW + 60 * HOUR));
    expect(later.chest.fatigue).toBe(0);
    expect(fatigueLevel(later.chest.fatigue)).toBe(0);
  });

  it('ignores warmups, unfinished sets and sessions outside the window', () => {
    const history = [
      workout(1, [{ name: 'Curl Bilanciere', sets: [...sets(3, { isWarmup: true }), ...sets(2, { done: false })] }]),
      workout(120, [{ name: 'Squat con Bilanciere', sets: sets(5) }]),
    ];
    expect(computeMuscleFatigue(history, EXERCISES_DB, NOW)).toEqual([]);
  });

  it('adds up overlapping sessions and caps at 100%', () => {
    const history = [
      workout(30, [{ name: 'Curl Bilanciere', sets: sets(3) }]),
      workout(2, [{ name: 'Curl Bilanciere', sets: sets(3) }]),
    ];
    const one = byMuscle(computeMuscleFatigue(history.slice(1), EXERCISES_DB, NOW)).biceps.fatigue;
    const both = byMuscle(computeMuscleFatigue(history, EXERCISES_DB, NOW)).biceps;
    expect(both.fatigue).toBeGreaterThan(one);
    expect(both.fatigue).toBeLessThanOrEqual(1);
    expect(both.sets).toBe(6);
  });
});
