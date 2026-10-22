import { useEffect, useState } from 'react';
import { useScienceStore } from '../store/scienceContext';

export function useScienceClock() {
  const simulated = useScienceStore(s => s.scienceDebugNow);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  return simulated ?? now;
}
