import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { cancelWorkoutReminder, scheduleWorkoutReminder } from '../utils/workoutPush';

// While a workout is open and the app is in the background, a push notification is
// scheduled for 20 minutes after the last activity; coming back cancels it.
export function useWorkoutPushReminder() {
  const enabled = useStore(s => s.workoutPushEnabled ?? false);
  const workoutId = useStore(s => s.activeWorkout?.id);

  useEffect(() => {
    if (!enabled || !workoutId) {
      cancelWorkoutReminder();
      return undefined;
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const lastActivityAt = useStore.getState().activeWorkout?.lastActivityAt;
        if (Number.isFinite(lastActivityAt)) scheduleWorkoutReminder(lastActivityAt).catch(() => {});
      } else {
        cancelWorkoutReminder();
      }
    };
    cancelWorkoutReminder();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, workoutId]);
}
