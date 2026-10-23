import { useEffect, useState } from 'react';
import { createPressGesture } from '../../utils/pressGesture';

export default function RoutineCard({ template, onStart, onActions }) {
  const [gesture] = useState(() => createPressGesture({ onTap: onStart, onHold: onActions }));
  useEffect(() => { gesture.updateCallbacks({ onTap: onStart, onHold: onActions }); }, [gesture, onStart, onActions]);
  useEffect(() => () => gesture.dispose(), [gesture]);
  const exercises = template.exercises || [];
  const title = (template.name || 'Scheda').match(/^(.*?)\s*\(([^)]+)\)$/);
  const name = title?.[1]?.trim() || template.name;
  const detail = title?.[2]?.replace(/\//g, ' · ');
  const sets = exercises.reduce((sum, ex) => sum + (Number(ex.setsCount) || 0), 0);
  return <button type="button" className="ej-card home-routine" aria-label={`Inizia ${template.name}`} aria-describedby="routine-gesture-hint" aria-haspopup="dialog" aria-keyshortcuts="Shift+F10" onPointerDown={e => { if (e.button !== 0 || !e.isPrimary) return; e.currentTarget.setPointerCapture?.(e.pointerId); gesture.down(e.clientX, e.clientY); }} onPointerMove={e => gesture.move(e.clientX, e.clientY)} onPointerUp={e => { if (gesture.up()) e.preventDefault(); }} onPointerCancel={() => gesture.cancel()} onContextMenu={e => { e.preventDefault(); gesture.context(); }} onKeyDown={e => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); gesture.context(true); } }} onClick={e => gesture.click(e.detail === 0)}>
    <strong>{name}{detail && <small>{detail}</small>}</strong><span className="home-routine-meta">{exercises.length} esercizi <i aria-hidden="true">·</i> {sets} serie</span>
  </button>;
}
