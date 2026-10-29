import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useScienceStore } from '../store/scienceContext';
import { useScienceClock } from '../hooks/useScienceClock';
import { useScienceAllocationPolicy } from '../hooks/useScienceAllocationPolicy';
import { scienceWeekTiming } from '../utils/scienceCalendar';
import { hasLegacyScience } from '../utils/scienceV3';
import { getAllExercises } from '../data/exercises';
import { localScienceDate, scienceSessionGuidance } from '../utils/sciencePlanning';
import { Sheet } from '../pages/monitoring/Sheet';
import '../pages/science/ScienceV3.css';

export default function ScienceWeekPrompt() {
  const now = useScienceClock();
  useScienceAllocationPolicy(now);
  const science = useScienceStore(s => s.scienceState);
  const program = science?.program;
  const history = useScienceStore(s => s.history);
  const custom = useScienceStore(s => s.customExercises);
  const overrides = useScienceStore(s => s.exerciseOverrides);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  const legacy = useScienceStore(s => s.scienceReport);
  const enabled = useScienceStore(s => s.showScience);
  const activeWorkout = useScienceStore(s => s.activeWorkout);
  const advance = useScienceStore(s => s.closeScienceV3Week);
  const defer = useScienceStore(s => s.deferScienceWeek);
  const markShown = useScienceStore(s => s.markScienceWeekPromptShown);
  const [openKey, setOpenKey] = useState(null);
  const eligible = enabled && !hasLegacyScience(legacy, science) && program?.status === 'active' && scienceWeekTiming(program, now).overdue;
  const key = eligible ? `${program.id}:${program.currentWeek}` : null;
  const date = localScienceDate(now);
  const shownDate = science?.weekPromptShownDate;
  useEffect(() => {
    if (!key || openKey === key || shownDate === date) return;
    const timer = setTimeout(() => { setOpenKey(key); markShown(date); }, 0);
    return () => clearTimeout(timer);
  }, [key, openKey, shownDate, date, markShown]);
  if (!key || openKey !== key) return null;
  const outstanding = scienceSessionGuidance(science, history, db, now);
  const keep = () => { defer(now); setOpenKey(null); };
  return <Sheet title={`Settimana ${program.currentWeek} · scegli tu`} className="science-week-dialog" onClose={keep} footer={<div className="science-week-prompt-actions"><button type="button" className="ej-btn ej-btn--primary sv3-wide-button" disabled={Boolean(activeWorkout)} onClick={() => { advance(now); setOpenKey(null); }}>{program.currentWeek === 5 ? 'Concludi il mesociclo' : 'Passa alla prossima settimana'}<ArrowRight size={16} /></button><button type="button" className="science-feedback-skip" onClick={keep}>Continuo questa settimana</button></div>}>
    <div className="science-week-prompt"><span className="science-quiz-icon"><CalendarClock size={25} /></span><h3 className="science-quiz-question">Il tempo è scaduto.<br />Come proseguiamo?</h3><section className={`science-week-outstanding ${outstanding.remaining === 0 ? 'is-complete' : ''}`} aria-label="Serie ancora da completare"><h4>{outstanding.remaining === 0 ? 'Obiettivi settimanali completati' : `${outstanding.remaining} serie ${outstanding.unknown ? 'ancora da completare' : 'ancora da completare'}`}</h4>{outstanding.missingMuscles.length > 0 && <ul>{outstanding.missingMuscles.map(({ muscle, remaining, unknown }) => <li key={muscle}><span><strong>{muscle}</strong>{unknown > 0 && <small>{unknown} registrate senza RIR</small>}</span><b>{remaining} serie</b></li>)}</ul>}{outstanding.unknown > 0 && <p>Ci sono {outstanding.unknown} serie senza RIR: sono già incluse nel conteggio.</p>}</section><p>Puoi continuare a completare le serie: le nuove sedute resteranno nella settimana {program.currentWeek}, anche in ritardo.</p><p>Se avanzi, chiudiamo questo periodo e apriamo sette giorni nuovi da questo momento. Le serie mancanti non diventano un debito della prossima settimana.</p><p>Te lo ricorderemo al massimo una volta al giorno finché scegli di continuare qui. Nessun cambio automatico e nessuna penalizzazione di XP o livelli.</p>{activeWorkout && <p className="sv3-notice">Concludi la seduta in corso prima di passare alla settimana successiva.</p>}</div>
  </Sheet>;
}
