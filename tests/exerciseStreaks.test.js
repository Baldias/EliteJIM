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
    expect(stats.get('Croci').streak).toBe(2); // last done last week: still alive
    expect(stats.has('Mai fatto')).toBe(false);
  });

  it('puts streaks first, then the most recently used', () => {
    const order = sortExercisesByStreakAndRecency(['Croci', 'Dip', 'Squat', 'Panca Piana'], stats);
    expect(order).toEqual(['Panca Piana', 'Croci', 'Squat', 'Dip']);
  });

  it('keeps a once-a-week exercise alive when sessions are more than 7 days apart', () => {
    // Today is Wednesday: Monday three weeks ago, Saturday two weeks ago (12 days later), Saturday last week
    const gaps = getExerciseStats([workout(23, 'Military Press'), workout(11, 'Military Press'), workout(4, 'Military Press')], NOW);
    expect(gaps.get('Military Press').streak).toBe(3);
  });

  it('tolerates one skipped week, and loses the streak after two', () => {
    expect(getExerciseStats([workout(10, 'Military Press')], NOW).get('Military Press').streak).toBe(1);
    expect(getExerciseStats([workout(17, 'Military Press')], NOW).get('Military Press').streak).toBe(0);
    // weeks -1 and -3 (week -2 skipped): two weeks counted
    expect(getExerciseStats([workout(4, 'Military Press'), workout(23, 'Military Press')], NOW).get('Military Press').streak).toBe(2);
    // weeks -1 and -4 (two weeks skipped): only the last one counts
    expect(getExerciseStats([workout(4, 'Military Press'), workout(30, 'Military Press')], NOW).get('Military Press').streak).toBe(1);
  });

  it('shares the streak between spellings of the same name', () => {
    const mixed = getExerciseStats([workout(1, 'Military Press'), workout(8, 'military press ')], NOW);
    expect(mixed.get('Military Press').streak).toBe(2);
    expect(mixed.get('military press ').streak).toBe(2);
  });
});
