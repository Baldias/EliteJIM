import { useEffect, useRef, useState } from 'react';

// Short UI handoff, not simulated network progress. Unmounting cancels the
// pending action; repeated taps cannot submit the same transition twice.
export function useMicroTransition(duration = 700) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const timer = useRef(null);
  useEffect(() => () => { clearTimeout(timer.current); timer.current = null; }, []);
  const run = action => {
    if (timer.current != null) return;
    setBusy(true); setError('');
    timer.current = setTimeout(() => {
      timer.current = null;
      try { action(); } catch (reason) { setError(reason.message || 'Riprova tra un momento.'); }
      finally { setBusy(false); }
    },duration);
  };
  return {busy,error,run};
}
