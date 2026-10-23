// Shared pointer state prevents a held or scrolled card from also being tapped.
export function createPressGesture({ onTap, onHold, delay = 500, slop = 10 }) {
  let timer, origin, suppressed = false, held = false;
  const clear = () => { clearTimeout(timer); timer = null; };
  const hold = () => { clear(); suppressed = true; if (!held) { held = true; onHold(); } };
  return {
    updateCallbacks(callbacks) { onTap = callbacks.onTap; onHold = callbacks.onHold; },
    down(x, y) { clear(); origin = { x, y }; suppressed = false; held = false; timer = setTimeout(hold, delay); },
    move(x, y) { if (origin && Math.hypot(x - origin.x, y - origin.y) > slop) { clear(); suppressed = true; } },
    up() { clear(); origin = null; return suppressed; },
    cancel() { clear(); origin = null; suppressed = true; },
    click(keyboard = false) { if (suppressed && !keyboard) { suppressed = false; return; } suppressed = false; onTap(); },
    context(keyboard = false) { if (keyboard) held = false; hold(); },
    dispose() { clear(); origin = null; },
  };
}
