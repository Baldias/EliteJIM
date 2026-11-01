import { getMondayTimestamp, MS_PER_DAY } from './gamification';
import { normalizeName } from '../data/exercises';

// Whole calendar weeks that can be skipped without losing the streak (skipped weeks don't count)
export const MAX_SKIPPED_WEEKS = 1;

const weeksBetween = (laterMonday, earlierMonday) => Math.round((laterMonday - earlierMonday) / (7 * MS_PER_DAY));

/**
 * Per-exercise usage stats from the workout history, keyed by every spelling of
 * the name found in the history (spellings that differ only in case/spaces share stats).
 * `lastUsed`: time of the most recent workout with at least one completed set.
 * `streak`: calendar weeks (Mon-Sun) with the exercise in a row, where up to
 * MAX_SKIPPED_WEEKS weeks in between can be skipped. It stays alive while no more
 * than MAX_SKIPPED_WEEKS whole weeks have passed since the last week with the exercise.
 */
export function getExerciseStats(history = [], referenceDate = Date.now()) {
  const groups = new Map();
  (history || []).forEach(workout => {
    const time = Number(workout?.startTime || workout?.endTime);
    if (!time) return;
    (workout.exercises || []).forEach(ex => {
      if (!ex?.name || !(ex.sets || []).some(s => s.done)) return;
      const key = normalizeName(ex.name);
      if (!groups.has(key)) groups.set(key, { names: new Set(), times: [] });
      const group = groups.get(key);
      group.names.add(ex.name);
      group.times.push(time);
    });
  });

  const currentMonday = getMondayTimestamp(referenceDate);
  const stats = new Map();
  groups.forEach(({ names, times }) => {
    const lastUsed = Math.max(...times);
    const mondays = [...new Set(times.map(getMondayTimestamp))].sort((a, b) => b - a);
    let streak = 0;
    const maxGap = MAX_SKIPPED_WEEKS + 1;
    if (weeksBetween(currentMonday, mondays[0]) <= maxGap) {
      streak = 1;
      while (streak < mondays.length && weeksBetween(mondays[streak - 1], mondays[streak]) <= maxGap) streak++;
    }
    names.forEach(name => stats.set(name, { lastUsed, streak }));
  });
  return stats;
}

/** Exercises with an active streak first (longest first), then the most recently used. */
export function sortExercisesByStreakAndRecency(names, stats) {
  const info = name => stats.get(name) || { lastUsed: 0, streak: 0 };
  return [...names].sort((a, b) => {
    const A = info(a);
    const B = info(b);
    return (B.streak - A.streak) || (B.lastUsed - A.lastUsed) || a.localeCompare(b);
  });
}
