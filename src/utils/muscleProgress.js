import { annotationFor, classifyScienceExercise } from './scienceV3';

export function progressRange(period, history, now, customStart, customEnd) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'custom') {
    const from = new Date(`${customStart}T00:00:00`);
    const to = new Date(`${customEnd}T00:00:00`);
    to.setDate(to.getDate() + 1);
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || from >= to) return null;
    return { start: +from, end: +to };
  }
  if (period === 'all') {
    const times = history.map(w => Number(w.startTime)).filter(t => Number.isFinite(t) && t <= now);
    start.setTime(times.length ? Math.min(...times) : now);
    start.setHours(0, 0, 0, 0);
  } else {
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() - Number(period));
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(day, lastDay));
  }
  return { start: +start, end: +end + 1 };
}

const weekStart = time => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return +date;
};

const isWorkingSet = (set, science, workout, exercise) => set.done && Number(set.reps) > 0
  && !set.isWarmup && !set.isDropset && !set.isRestPause
  && !annotationFor(science, workout.id, exercise.id, set.id).excluded;

export function weeklyMuscleProgress(history, db, science, muscle, range) {
  const empty = { weeks: [], total: 0, average: 0, best: 0, activeWeeks: 0 };
  if (!range) return empty;
  // Bound coverage by the user's entire training history, not just this muscle:
  // an untrained muscle inside an established history still has zero-set weeks.
  const recorded = history.filter(workout => Number.isFinite(Number(workout.startTime))
    && (workout.exercises || []).some(ex => (ex.sets || []).some(set => isWorkingSet(set, science, workout, ex))));
  if (!recorded.length) return empty;
  const firstWeek = weekStart(Math.min(...recorded.map(w => Number(w.startTime))));
  const lastWeekEnd = new Date(weekStart(Math.max(...recorded.map(w => Number(w.startTime)))));
  lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);
  const start = Math.max(range.start, firstWeek);
  const end = Math.min(range.end, +lastWeekEnd);
  if (start >= end) return empty;
  const buckets = new Map();
  const cursor = new Date(weekStart(start));
  while (+cursor < end) {
    buckets.set(+cursor, { time: +cursor, sets: 0 });
    cursor.setDate(cursor.getDate() + 7);
  }
  for (const workout of history) {
    const time = Number(workout.startTime);
    if (!(time >= range.start && time < range.end)) continue;
    const bucket = buckets.get(weekStart(time));
    if (!bucket) continue;
    for (const exercise of workout.exercises || []) {
      if (classifyScienceExercise(exercise, db, science, workout.id).primary !== muscle) continue;
      bucket.sets += (exercise.sets || []).filter(set => isWorkingSet(set, science, workout, exercise)).length;
    }
  }
  const weeks = [...buckets.values()];
  const total = weeks.reduce((sum, w) => sum + w.sets, 0);
  return { weeks, total, average: weeks.length ? total / weeks.length : 0,
    best: Math.max(0, ...weeks.map(w => w.sets)), activeWeeks: weeks.filter(w => w.sets > 0).length };
}
