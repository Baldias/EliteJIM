import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * Seconds left on the persistent rest timer (0 when not resting).
 * The timer is silent: when it reaches zero it simply clears itself.
 */
export function useRestTimer() {
  const globalRestEndTime = useStore(state => state.globalRestEndTime);
  const clearGlobalRestTimer = useStore(state => state.clearGlobalRestTimer);
  const [restTimeLeft, setRestTimeLeft] = useState(0);

  useEffect(() => {
    const tick = () => {
      const remaining = globalRestEndTime ? Math.ceil((globalRestEndTime - Date.now()) / 1000) : 0;
      if (remaining <= 0) {
        setRestTimeLeft(0);
        if (globalRestEndTime) clearGlobalRestTimer();
      } else {
        setRestTimeLeft(remaining);
      }
      return remaining > 0;
    };

    if (!tick()) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [globalRestEndTime, clearGlobalRestTimer]);

  return { restTimeLeft, isResting: restTimeLeft > 0 };
}
