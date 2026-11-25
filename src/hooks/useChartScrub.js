import { useEffect, useRef, useState } from 'react';

// One-finger horizontal drag on a chart ("scrub"): while the finger slides,
// onPick(time) is called with the data point closest to it. Points are found
// by their `data-time` attribute, so the scrub snaps exactly to the dots
// drawn on screen whatever the axis scale.
// A drag that starts vertically is left to the page, so it still scrolls;
// once a drag is horizontal the page is locked until the finger lifts.
// Two fingers are ignored here (pinch is handled by usePinchSteps).
export function useChartScrub(onPick, { slop = 6 } = {}) {
  // Callback ref: the element can mount later (the chart only shows with data).
  const [el, setEl] = useState(null);
  const pickRef = useRef(onPick);
  useEffect(() => { pickRef.current = onPick; });

  useEffect(() => {
    if (!el) return undefined;
    let startX = 0;
    let startY = 0;
    let mode = null; // null = undecided, 'scrub' or 'scroll'
    let points = [];
    let last = null;
    let frame = 0;
    let pendingX = 0;

    const readPoints = () => {
      points = [...el.querySelectorAll('[data-time]')].map(node => {
        const r = node.getBoundingClientRect();
        return { x: r.left + r.width / 2, time: Number(node.getAttribute('data-time')) };
      }).filter(p => Number.isFinite(p.time));
    };
    const pickAt = (x) => {
      if (!points.length) return;
      let best = points[0];
      for (const p of points) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
      if (best.time === last) return;
      last = best.time;
      pickRef.current(best.time);
    };
    // One update per frame: smooth on 120 Hz screens without extra renders
    const schedule = (x) => {
      pendingX = x;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; pickAt(pendingX); });
    };

    const start = (e) => {
      if (e.touches.length !== 1) { mode = 'scroll'; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      mode = null;
      last = null;
      readPoints();
    };
    const move = (e) => {
      if (e.touches.length !== 1 || mode === 'scroll') return;
      const t = e.touches[0];
      if (mode == null) {
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (dx < slop && dy < slop) return;
        mode = dx > dy ? 'scrub' : 'scroll';
        if (mode === 'scroll') return;
      }
      if (e.cancelable) e.preventDefault();
      schedule(t.clientX);
    };
    const end = () => { mode = null; };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [el, slop]);

  return setEl;
}
