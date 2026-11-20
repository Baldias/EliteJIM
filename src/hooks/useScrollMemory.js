import { useEffect, useLayoutEffect } from 'react';

const PREFIX = 'ej-scroll:';

const read = (key) => {
  try {
    const value = Number(sessionStorage.getItem(PREFIX + key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const write = (key, value) => {
  try { sessionStorage.setItem(PREFIX + key, String(Math.round(value))); } catch { /* storage unavailable */ }
};

// Pages whose scroll position is remembered by useScrollMemory: ScrollToTop leaves them alone.
export const SCROLL_MEMORY_PATHS = new Set(['/workout']);

// Remembers the window scroll of a page under `key` and restores it when the page opens again,
// so leaving the workout (e.g. for an exercise's progress) and coming back keeps your place.
// A new key (a new workout) starts from the top.
export function useScrollMemory(key) {
  useLayoutEffect(() => {
    if (!key) return undefined;
    const target = read(key);
    window.scrollTo(0, target);
    if (!target) return undefined;
    // Content that settles after the first paint can leave the page too short: retry briefly.
    let frame = 0;
    let tries = 0;
    const retry = () => {
      if (Math.abs(window.scrollY - target) <= 1 || tries++ > 20) return;
      window.scrollTo(0, target);
      frame = requestAnimationFrame(retry);
    };
    frame = requestAnimationFrame(retry);
    const stop = () => cancelAnimationFrame(frame);
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    window.addEventListener('wheel', stop, { once: true, passive: true });
    return () => {
      stop();
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('wheel', stop);
    };
  }, [key]);

  useEffect(() => {
    if (!key) return undefined;
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => write(key, window.scrollY));
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', save);
    };
  }, [key]);
}
