import { calculateWeeklyStreak } from './gamification';

/**
 * Per-exercise usage stats from the workout history.
 * `lastUsed`: time of the most recent workout with at least one completed set.
 * `streak`: consecutive weeks (Monday based) with the exercise, using the same
 * rules as the global weekly streak: it is lost after 7 days without doing it.
 */
export function getExerciseStats(history = [], referenceDate = Date.now()) {
  const workoutsByExercise = new Map();
  (history || []).forEach(workout => {
    const time = Number(workout?.startTime || workout?.endTime);
    if (!time) return;
    (workout.exercises || []).forEach(ex => {
      if (!ex?.name || !(ex.sets || []).some(s => s.done)) return;
      if (!workoutsByExercise.has(ex.name)) workoutsByExercise.set(ex.name, []);
      workoutsByExercise.get(ex.name).push({ startTime: time });
    });
  });

  const stats = new Map();
  workoutsByExercise.forEach((workouts, name) => {
    const lastUsed = Math.max(...workouts.map(w => w.startTime));
    const { currentStreak } = calculateWeeklyStreak(workouts, referenceDate);
    stats.set(name, { lastUsed, streak: currentStreak });
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
