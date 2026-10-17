import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { calculateWeeklyStreak } from '../utils/gamification';

/**
 * Weekly streak derived from the history on every render that needs it.
 * The `currentStreak` saved in the store is only refreshed when a workout is
 * finished/edited/deleted, so it would never expire after a period of inactivity.
 */
export function useWeeklyStreak() {
  const history = useStore(state => state.history);
  return useMemo(() => calculateWeeklyStreak(history || []), [history]);
}
