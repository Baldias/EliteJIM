import { describe, it, expect } from 'vitest';
import { getExerciseStats, sortExercisesByStreakAndRecency } from '../src/utils/exerciseStreaks';

const DAY = 24 * 60 * 60 * 1000;
// Wednesday noon, so day offsets stay inside predictable weeks
const NOW = new Date(2026, 9, 28, 12).getTime();
const workout = (daysAgo, ...names) => ({
  startTime: NOW - daysAgo * DAY,
  exercises: names.map(name => ({ name, sets: [{ done: true }] })),
});

describe('per-exercise streak and ordering', () => {
  const history = [
    workout(1, 'Panca Piana'),
    workout(8, 'Panca Piana', 'Croci'),
    workout(15, 'Panca Piana'),
    workout(2, 'Squat'),
    workout(10, 'Croci'),
    workout(3, 'Dip'),
    { startTime: NOW - DAY, exercises: [{ name: 'Mai fatto', sets: [{ done: false }] }] },
  ];
  const stats = getExerciseStats(history, NOW);

  it('counts consecutive weeks like the global streak', () => {
    expect(stats.get('Panca Piana').streak).toBe(3);
    expect(stats.get('Squat').streak).toBe(1);
    expect(stats.get('Croci').streak).toBe(0); // last done 8 days ago: streak lost
    expect(stats.has('Mai fatto')).toBe(false);
  });

  it('puts streaks first, then the most recently used', () => {
    const order = sortExercisesByStreakAndRecency(['Croci', 'Dip', 'Squat', 'Panca Piana'], stats);
    expect(order).toEqual(['Panca Piana', 'Squat', 'Dip', 'Croci']);
  });
});
