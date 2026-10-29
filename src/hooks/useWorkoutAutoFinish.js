import { useEffect } from 'react';
import { useStore } from '../store/useStore';

const INACTIVITY_MS = 60 * 60 * 1000;

// Browser timers can pause in the background; recheck the persisted timestamp
// on focus and visibility changes, and after every activity update.
export function useWorkoutAutoFinish() {
  const workout = useStore(s => s.activeWorkout);
  const finish = useStore(s => s.finishWorkout);
  const initialize = useStore(s => s.initializeWorkoutActivity);
  useEffect(() => {
    if (!workout) return;
    if (!Number.isFinite(workout.lastActivityAt)) { initialize(); return; }
    const { id, lastActivityAt } = workout;
    let timer;
    const check = () => {
      clearTimeout(timer);
      const remaining = lastActivityAt + INACTIVITY_MS - Date.now();
      if (remaining <= 0) finish({ auto: true, workoutId: id, lastActivityAt, now: Date.now() });
      else timer = setTimeout(check, remaining);
    };
    check();
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(timer); window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); document.removeEventListener('visibilitychange', check); };
  }, [workout, finish, initialize]);
}
