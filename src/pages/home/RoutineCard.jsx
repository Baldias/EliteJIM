import { useEffect, useState } from 'react';
import { Check, Dna } from 'lucide-react';
import { createPressGesture } from '../../utils/pressGesture';
import { tr } from '../../i18n';

export default function RoutineCard({ template, completedThisWeek = false, onStart, onActions }) {
  const [gesture] = useState(() => createPressGesture({ onTap: onStart, onHold: onActions }));
  useEffect(() => { gesture.updateCallbacks({ onTap: onStart, onHold: onActions }); }, [gesture, onStart, onActions]);
  useEffect(() => () => gesture.dispose(), [gesture]);
  const exercises = template.exercises || [];
  const title = (template.name || 'Scheda').match(/^(.*?)\s*\(([^)]+)\)$/);
  const name = title?.[1]?.trim() || template.name;
  const detail = title?.[2]?.replace(/\//g, ' · ');
  const sets = exercises.reduce((sum, ex) => sum + (Number(ex.setsCount) || 0), 0);
  return <button type="button" className={`ej-card home-routine ${completedThisWeek ? 'is-completed-week' : ''}`} aria-label={`Inizia ${template.name}`} aria-describedby="routine-gesture-hint" aria-haspopup="dialog" aria-keyshortcuts="Shift+F10" onPointerDown={e => { if (e.button !== 0 || !e.isPrimary) return; e.currentTarget.setPointerCapture?.(e.pointerId); gesture.down(e.clientX, e.clientY); }} onPointerMove={e => gesture.move(e.clientX, e.clientY)} onPointerUp={e => { if (gesture.up()) e.preventDefault(); }} onPointerCancel={() => gesture.cancel()} onContextMenu={e => { e.preventDefault(); gesture.context(); }} onKeyDown={e => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); gesture.context(true); } }} onClick={e => gesture.click(e.detail === 0)}>
    <div className="home-routine-top">
      <strong>{name}{detail && <small>{detail}</small>}</strong>
      {completedThisWeek && (
        <span className="home-routine-done" title={tr('Completata questa settimana')}>
          <Check size={12} strokeWidth={3} /> {tr('Fatta')}
        </span>
      )}
    </div>
    <span className="home-routine-meta">
      {exercises.length} {tr('esercizi')} <i aria-hidden="true">·</i> {sets} {tr('serie')}
      {template.scienceSync && (
        <span className="home-routine-science"><Dna size={11} /> {tr('Scienza')}</span>
      )}
    </span>
  </button>;
}
