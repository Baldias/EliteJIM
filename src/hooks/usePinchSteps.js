import { useEffect, useRef, useState } from 'react';

// Two-finger pinch on an element, turned into discrete steps:
// spreading the fingers (zoom in) calls onStep(-1), pinching them together
// (zoom out) calls onStep(+1). A long pinch can step more than once.
export function usePinchSteps(onStep, { threshold = 1.3 } = {}) {
  // Callback ref: the element can mount later (the chart only shows with data).
  const [el, setEl] = useState(null);
  const stepRef = useRef(onStep);
  useEffect(() => { stepRef.current = onStep; });

  useEffect(() => {
    if (!el) return undefined;
    let base = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e) => { if (e.touches.length === 2) base = dist(e.touches); };
    const move = (e) => {
      if (e.touches.length !== 2 || !base) return;
      e.preventDefault();
      const ratio = dist(e.touches) / base;
      if (ratio >= threshold) { stepRef.current(-1); base = dist(e.touches); }
      else if (ratio <= 1 / threshold) { stepRef.current(1); base = dist(e.touches); }
    };
    const end = (e) => { if (e.touches.length < 2) base = 0; };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [el, threshold]);

  return setEl;
}
