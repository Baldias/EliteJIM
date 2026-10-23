import { useMemo } from 'react';
import { CalendarDays, Layers } from 'lucide-react';
import { useScienceStore } from '../store/scienceContext';
import { useScienceClock } from '../hooks/useScienceClock';
import { getAllExercises } from '../data/exercises';
import { scienceSessionGuidance } from '../utils/sciencePlanning';

export default function ScienceSessionPlanner() {
  const now = useScienceClock();
  const science = useScienceStore(s => s.scienceState);
  const history = useScienceStore(s => s.history);
  const custom = useScienceStore(s => s.customExercises);
  const overrides = useScienceStore(s => s.exerciseOverrides);
  const setSessions = useScienceStore(s => s.setScienceWeekSessions);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  if (science?.program?.status !== 'active') return null;
  const plan = scienceSessionGuidance(science, history, db, now);
  return <section className="ej-card sv3-session-planner"><div className="sv3-panel-heading"><span className="sv3-panel-icon"><CalendarDays size={18} /></span><div><h2>Quante serie per seduta?</h2><p>La tua distribuzione · settimana {science.program.currentWeek}</p></div></div><p>Quante sedute prevedi questa settimana?</p><div className="sv3-number-choices" role="group" aria-label="Sedute previste questa settimana">{[1, 2, 3, 4, 5, 6, 7].map(n => <button key={n} type="button" aria-pressed={plan.plannedSessions === n} onClick={() => setSessions(n)}><strong>{n}</strong></button>)}</div><div className="sv3-session-stats"><div><strong>~{Math.round(plan.average)}</strong><span>serie in media per seduta</span></div><div><Layers size={16} /><strong>{plan.total}</strong><span>serie nella settimana</span></div></div>
    <div className="sv3-session-remaining"><span>{plan.completedSessions} sedute registrate · {plan.sessionsLeft} previste rimanenti</span><p>{plan.remaining === 0 ? 'Target settimanali completati.' : plan.sessionsLeft ? <><strong>~{Math.ceil(plan.remainingAverage)} serie</strong> per ciascuna delle {plan.sessionsLeft} sedute rimanenti, con {plan.remaining} serie ancora da completare.</> : <>{plan.remaining} serie ancora da completare o verificare. Aggiorna le sedute previste se hai più disponibilità.</>}</p></div>
    {plan.unknown > 0 && <p className="sv3-inline-note">{plan.unknown} serie senza RIR: conferma lo sforzo prima di aggiungere lavoro per colmare il residuo.</p>}
    <p className="sv3-quiz-note">È una media organizzativa, senza split obbligatoria. Cambiare le sedute previste aggiorna la distribuzione, senza modificare gli obiettivi.</p>
  </section>;
}
