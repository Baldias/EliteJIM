import React, { useEffect, useMemo, useRef } from 'react';
import { Calendar, Clock, Layers, MapPin, MessageSquareDashed, StickyNote, Trophy } from 'lucide-react';
import { Sheet } from '../pages/monitoring/Sheet';
import { useStore } from '../store/useStore';
import { getAllExercises, normalizeName } from '../data/exercises';
import { getSessionNote } from '../utils/sessionNote';
import { gymLabel } from '../utils/gymLocation';
import { estimate1RM, getBodyweightLoad, resolveBodyweight } from '../utils/oneRepMax';
import { locale, tr } from '../i18n';
import './WorkoutDetailSheet.css';

const fmtDate = (t) => new Date(t).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (t) => new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const fmtDuration = (start, end) => {
  if (!start || !end) return null;
  const min = Math.floor((end - start) / 60000);
  return min < 1 ? '< 1 min' : `${min} min`;
};

// Allenamento salvato in sola lettura, aperto sopra la pagina corrente.
// `focusExercise` viene evidenziato e portato in vista all'apertura.
export function WorkoutDetailSheet({ workout, focusExercise, footer, onClose }) {
  const customExercises = useStore(state => state.customExercises);
  const exerciseOverrides = useStore(state => state.exerciseOverrides);
  const aliases = useStore(state => state.gymLocationAliases);
  const bodyweight = useStore(resolveBodyweight);
  const db = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);
  const focusRef = useRef(null);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const sessionNote = getSessionNote(workout);
  const duration = fmtDuration(workout.startTime, workout.endTime);
  const exercises = (workout.exercises || [])
    .map(ex => ({ ...ex, done: (ex.sets || []).filter(s => s.done) }))
    .filter(ex => ex.done.length > 0);
  const totalSets = exercises.reduce((a, ex) => a + ex.done.length, 0);

  return (
    <Sheet title={workout.name || tr('Allenamento')} onClose={onClose} footer={footer} className="wd-backdrop">
      <div className="wd">
        <div className="hs-meta wd-meta">
          <span><Calendar size={12} /> {fmtDate(workout.startTime)} · {fmtTime(workout.startTime)}</span>
          {duration && <span><Clock size={12} /> {duration}</span>}
          <span><Layers size={12} /> {totalSets} Set</span>
          {workout.gymLocation && <span><MapPin size={12} /> {gymLabel(workout.gymLocation, aliases)}</span>}
        </div>

        {sessionNote && (
          <div className="hs-session-note">
            <MessageSquareDashed size={13} className="hs-session-note-icon" />
            <p className="hs-session-note-text is-full">{sessionNote}</p>
          </div>
        )}

        {exercises.map(ex => {
          const focused = Boolean(focusExercise) && normalizeName(ex.name) === normalizeName(focusExercise);
          const dimmed = Boolean(focusExercise) && !focused;
          const bodyweightLoad = getBodyweightLoad(ex.name, db, bodyweight);
          let bestId = null;
          let bestRm = 0;
          ex.done.forEach(s => {
            const rm = estimate1RM(s.kg, s.reps, bodyweightLoad);
            if (!s.isDropset && rm && rm > bestRm) { bestRm = rm; bestId = s.id; }
          });
          let setNumber = 0;
          return (
            <section key={ex.id} ref={focused ? focusRef : null} className={`wd-ex ${focused ? 'is-focus' : ''} ${dimmed ? 'is-dimmed' : ''}`}>
              <div className="hs-ex-head">
                <span className="hs-ex-name">{ex.name}</span>
                <span className="hs-ex-count">{ex.done.length} {tr('set completati')}</span>
              </div>
              {ex.notes && (
                <p className="wd-ex-note"><StickyNote size={12} /> <span>{ex.notes}</span></p>
              )}
              <div className="hs-table">
                <div className="hs-thead">
                  <span>Set</span>
                  <span>Kg</span>
                  <span>Reps</span>
                  <span>{tr('1RM Est.')}</span>
                </div>
                {ex.done.map(set => {
                  const rm = estimate1RM(set.kg, set.reps, bodyweightLoad);
                  const isBest = set.id === bestId && bestRm > 0;
                  if (!set.isDropset) setNumber += 1;
                  return (
                    <div key={set.id} className={`hs-row ${isBest ? 'is-best' : ''}`}>
                      <span className="hs-row-num">{set.isDropset ? <span className="hs-drop">Drop</span> : setNumber}</span>
                      <span>{set.kg || '-'}</span>
                      <span>{set.reps || '-'}</span>
                      <span className="hs-row-rm">
                        {isBest && <Trophy size={11} />}
                        {rm > 0 ? `${bodyweightLoad > 0 ? '+' : ''}${rm.toFixed(1)}` : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}

export default WorkoutDetailSheet;
