import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Drag-to-reorder for a vertical list, driven by a grip handle.
// Works with touch (PWA), mouse and pen through Pointer Events: the handle needs
// `touch-action: none` so the browser does not start scrolling the page instead.
// While dragging, the list collapses (see CSS) so long cards become short rows;
// the dragged row follows the finger and swaps with a neighbour once it passes
// the neighbour's middle. The page scrolls on its own near the screen edges.
// The handle also answers ArrowUp / ArrowDown for keyboard users.
export function useDragReorder({ ids, onMove, topInset = () => 0 }) {
  const [draggingId, setDraggingId] = useState(null);
  const nodes = useRef(new Map());
  const drag = useRef(null);
  const idsRef = useRef(ids);
  const onMoveRef = useRef(onMove);
  const insetRef = useRef(topInset);
  const frame = useRef(0);
  const settleRef = useRef(null);
  useLayoutEffect(() => { idsRef.current = ids; onMoveRef.current = onMove; insetRef.current = topInset; });

  const itemRef = useCallback(id => el => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  }, []);

  // Places the dragged row under the finger, whatever its place in the list is now.
  const place = useCallback(() => {
    const d = drag.current;
    const el = d && nodes.current.get(d.id);
    if (!el) return null;
    el.style.transform = '';
    const natural = el.getBoundingClientRect().top;
    const top = d.y - d.grab;
    el.style.transform = `translate3d(0, ${top - natural}px, 0)`;
    return { el, top };
  }, []);

  // One step at a time: the layout effect below runs again after each move.
  const maybeSwap = useCallback(() => {
    const d = drag.current;
    const placed = place();
    if (!d || !placed) return;
    const order = idsRef.current;
    const i = order.indexOf(d.id);
    if (i < 0) return;
    const bottom = placed.top + placed.el.offsetHeight;
    const prev = nodes.current.get(order[i - 1]);
    const next = nodes.current.get(order[i + 1]);
    if (prev) {
      const r = prev.getBoundingClientRect();
      if (placed.top < r.top + r.height / 2) { onMoveRef.current(d.id, i - 1); navigator.vibrate?.(8); return; }
    }
    if (next) {
      const r = next.getBoundingClientRect();
      if (bottom > r.top + r.height / 2) { onMoveRef.current(d.id, i + 1); navigator.vibrate?.(8); }
    }
  }, [place]);

  // After the store moved the row, re-place it and check whether it must move again.
  useLayoutEffect(() => {
    if (drag.current) maybeSwap();
  }, [ids, maybeSwap]);

  // Collapsing/expanding the list moves everything: scroll so the grabbed row
  // stays where the finger is.
  useLayoutEffect(() => {
    const keep = settleRef.current;
    if (!keep) return;
    settleRef.current = null;
    const el = nodes.current.get(keep.id);
    if (!el) return;
    el.style.transform = '';
    window.scrollBy(0, el.getBoundingClientRect().top - keep.top);
    const d = drag.current;
    if (d && d.id === keep.id) {
      // When the page is too short to scroll that far, start from where the row
      // really is: it follows the finger's movement, without jumping places.
      d.grab = d.y - el.getBoundingClientRect().top;
      place();
    }
  }, [draggingId, place]);

  const stop = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(frame.current);
    window.removeEventListener('pointermove', d.onMoveEvt);
    window.removeEventListener('pointerup', d.onEnd);
    window.removeEventListener('pointercancel', d.onEnd);
    const el = nodes.current.get(d.id);
    const top = el ? el.getBoundingClientRect().top : d.y - d.grab;
    if (el) el.style.transform = '';
    drag.current = null;
    settleRef.current = { id: d.id, top };
    setDraggingId(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const autoScrollRef = useRef(null);
  const autoScroll = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const edge = 70;
    const top = insetRef.current() + edge;
    const bottom = window.innerHeight - edge;
    let dy = 0;
    if (d.y < top) dy = -Math.min(18, (top - d.y) / 3 + 2);
    else if (d.y > bottom) dy = Math.min(18, (d.y - bottom) / 3 + 2);
    if (dy) {
      const before = window.scrollY;
      window.scrollBy(0, dy);
      if (window.scrollY !== before) maybeSwap();
    }
    frame.current = requestAnimationFrame(() => autoScrollRef.current?.());
  }, [maybeSwap]);
  useLayoutEffect(() => { autoScrollRef.current = autoScroll; }, [autoScroll]);

  const handleProps = useCallback(id => ({
    'data-reorder-handle': id,
    onPointerDown: e => {
      if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const el = nodes.current.get(id);
      if (!el) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const onMoveEvt = ev => {
        if (!drag.current || ev.pointerId !== drag.current.pointerId) return;
        ev.preventDefault();
        drag.current.y = ev.clientY;
        maybeSwap();
      };
      const onEnd = ev => { if (drag.current && ev.pointerId === drag.current.pointerId) stop(); };
      // Window listeners: the row's DOM node can be moved by React mid-drag,
      // which would drop pointer capture on the handle itself.
      drag.current = { id, pointerId: e.pointerId, y: e.clientY, grab: e.clientY - rect.top, onMoveEvt, onEnd };
      window.addEventListener('pointermove', onMoveEvt, { passive: false });
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      settleRef.current = { id, top: rect.top };
      setDraggingId(id);
      navigator.vibrate?.(12);
      frame.current = requestAnimationFrame(autoScroll);
    },
    onKeyDown: e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const i = idsRef.current.indexOf(id);
      const to = e.key === 'ArrowUp' ? i - 1 : i + 1;
      if (i < 0 || to < 0 || to >= idsRef.current.length) return;
      e.preventDefault();
      onMoveRef.current(id, to);
      requestAnimationFrame(() => document.querySelector(`[data-reorder-handle="${CSS.escape(String(id))}"]`)?.focus());
    },
  }), [autoScroll, maybeSwap, stop]);

  return { draggingId, itemRef, handleProps };
}
