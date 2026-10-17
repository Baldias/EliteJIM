import { normalizeName } from '../data/exercises';
import { estimate1RM, getBodyweightLoad } from './oneRepMax';
import { evaluateExerciseOverload } from './gamification';

const workingSets = (exercise) => (exercise?.sets || []).filter(s => s.done && !s.isDropset);

/**
 * Walks the history chronologically and compares every exercise with its
 * previous session, using the same rule as the post-session grade
 * (estimated 1RM and top set, never volume).
 *
 * - prCount: how many times an exercise beat its previous all-time best 1RM
 * - overloadRate: % of sessions (that had at least one exercise to compare
 *   against) where at least one exercise got a progressive overload.
 *   null when there is nothing to compare yet.
 */
export const computeOverloadStats = (history = [], { exercisesDb = [], bodyweight = null } = {}) => {
  const sorted = [...history].sort((a, b) => a.startTime - b.startTime);
  const lastSets = {};
  const allTimeBest = {};
  const bodyweightLoads = {};
  let prCount = 0;
  let comparableSessions = 0;
  let overloadSessions = 0;

  sorted.forEach(workout => {
    let comparable = false;
    let overloaded = false;

    (workout.exercises || []).forEach(ex => {
      const key = normalizeName(ex.name || '');
      const sets = workingSets(ex);
      if (!key || sets.length === 0) return;

      if (bodyweightLoads[key] == null) bodyweightLoads[key] = getBodyweightLoad(ex.name, exercisesDb, bodyweight);
      const bodyweightLoad = bodyweightLoads[key];

      if (lastSets[key]) {
        const result = evaluateExerciseOverload(sets, lastSets[key], bodyweightLoad);
        if (result) {
          comparable = true;
          if (result.overloaded) overloaded = true;
        }
      }

      // Rounded to 0.1 kg so float noise never counts as a PR
      const best = Math.round(Math.max(...sets.map(s => estimate1RM(s.kg, s.reps, bodyweightLoad))) * 10) / 10;
      if (best > 0) {
        if (allTimeBest[key] != null && best > allTimeBest[key]) prCount++;
        allTimeBest[key] = Math.max(allTimeBest[key] || 0, best);
      }
      lastSets[key] = sets;
    });

    if (comparable) {
      comparableSessions++;
      if (overloaded) overloadSessions++;
    }
  });

  return {
    prCount,
    overloadRate: comparableSessions > 0 ? Math.round((overloadSessions / comparableSessions) * 100) : null
  };
};
