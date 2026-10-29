// Sidecar identity: never add IDs or RIR to the original workout records.
export const scienceSetKey = (workout, exercise, set, exerciseIndex, setIndex) => JSON.stringify([
  workout.id ?? workout.startTime,
  exercise.id ?? `${exerciseIndex}:${exercise.name}`,
  set.id ?? `${setIndex}:${set.kg}:${set.reps}`,
]);
// Unknown effort remains metadata: a missing RIR never removes completed work.
// Imported sets are already included in unknown, so count them only once.
export const scienceCompletedSets = volume => (volume?.direct || 0) + Math.max(volume?.unknown || 0, volume?.imported || 0);
export const scienceUnconfirmedSets = volume => Math.max(0, (volume?.unknown || 0) - (volume?.imported || 0));
