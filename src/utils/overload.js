import { calculate1RM } from '../store/useStore';
import { normalizeName } from '../data/exercises';

/**
 * Walks the history chronologically and tracks, per exercise, the best
 * estimated 1RM of each session.
 *
 * - prCount: how many times an exercise beat its previous all-time best 1RM
 * - overloadRate: % of sessions (that had at least one exercise to compare
 *   against) where at least one exercise beat the 1RM of its previous session.
 *   null when there is nothing to compare yet.
 */
export const computeOverloadStats = (history = []) => {
  const sorted = [...history].sort((a, b) => a.startTime - b.startTime);
  const lastBest = {};
  const allTimeBest = {};
  let prCount = 0;
  let comparableSessions = 0;
  let overloadSessions = 0;

  sorted.forEach(workout => {
    let comparable = false;
    let overloaded = false;

    (workout.exercises || []).forEach(ex => {
      const key = normalizeName(ex.name || '');
      if (!key) return;
      const best = (ex.sets || [])
        .filter(s => s.done)
        .reduce((max, s) => Math.max(max, calculate1RM(s.kg, s.reps)), 0);
      if (!best) return;

      if (lastBest[key] != null) {
        comparable = true;
        if (best > lastBest[key]) overloaded = true;
      }
      if (allTimeBest[key] != null && best > allTimeBest[key]) prCount++;

      allTimeBest[key] = Math.max(allTimeBest[key] || 0, best);
      lastBest[key] = best;
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
