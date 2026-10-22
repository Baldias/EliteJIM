import { annotationFor, captureScienceExercises, classifyScienceExercise } from './scienceV3';

export function scienceBackfillWorkouts(history, db, science, start, now) {
  return (history || []).filter(w => Number(w.startTime) >= start && Number(w.startTime) <= now).slice().sort((a, b) => a.startTime - b.startTime).map(workout => ({
    id: workout.id, name: workout.name || 'Allenamento', startTime: workout.startTime,
    exercises: (workout.exercises || []).map(ex => ({
      id: ex.id, name: ex.name, primary: classifyScienceExercise(ex, db, science, workout.id).primary,
      sets: (ex.sets || []).filter(set => set.id != null && set.done && Number(set.reps) > 0 && !set.isWarmup && !set.isDropset && !set.isRestPause && !annotationFor(science, workout.id, ex.id, set.id).excluded).map(set => ({ id: set.id, kg: set.kg, reps: set.reps, rir: annotationFor(science, workout.id, ex.id, set.id).rir ?? null })),
    })).filter(ex => ex.sets.length && ex.id != null),
  })).filter(w => w.exercises.length && w.id != null);
}

// Only explicit choices for still-unknown historical series are applied. All
// performance data, existing effort/exclusions and archived summaries are kept.
export function applyScienceBackfill(science, history, db, start, now, choices = {}) {
  let next = { ...science, annotations: { ...science.annotations } };
  const workouts = scienceBackfillWorkouts(history, db, science, start, now);
  for (const workout of workouts) {
    for (const ex of workout.exercises) for (const set of ex.sets) {
      const rir = choices?.[workout.id]?.[ex.id]?.[set.id];
      if (!ex.primary || (set.rir === 0 || set.rir === 1) || (rir !== 0 && rir !== 1)) continue;
      const perWorkout = next.annotations[workout.id] || {}, perExercise = perWorkout[ex.id] || {};
      next.annotations[workout.id] = { ...perWorkout, [ex.id]: { ...perExercise, [set.id]: { ...perExercise[set.id], rir } } };
    }
    const original = history.find(w => String(w.id) === String(workout.id));
    next = captureScienceExercises(next, original, db);
  }
  return next;
}
