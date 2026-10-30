import { useMemo, useState } from 'react';
import { CalendarDays, Layers, CircleHelp } from 'lucide-react';
import { useScienceStore } from '../store/scienceContext';
import { useScienceClock } from '../hooks/useScienceClock';
import { getAllExercises } from '../data/exercises';
import { Sheet } from '../pages/monitoring/Sheet';
import { scienceSessionGuidance } from '../utils/sciencePlanning';
import { tr } from '../i18n';

export default function ScienceSessionPlanner() {
  const now = useScienceClock();
  const [showHelp, setShowHelp] = useState(false);
  const science = useScienceStore(s => s.scienceState);
  const history = useScienceStore(s => s.history);
  const custom = useScienceStore(s => s.customExercises);
  const overrides = useScienceStore(s => s.exerciseOverrides);
  const setSessions = useScienceStore(s => s.setScienceWeekSessions);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  if (science?.program?.status !== 'active') return null;
  const plan = scienceSessionGuidance(science, history, db, now);
  return <><section className="ej-card sv3-session-planner"><div className="sv3-panel-heading"><span className="sv3-panel-icon"><CalendarDays size={18} /></span><div><h2>{tr('Quante serie per seduta?')}</h2><p>{tr('La tua distribuzione · settimana {week}', { week: science.program.currentWeek })}</p></div><button type="button" className="sv3-planner-help" aria-label={tr('Come funziona la distribuzione delle serie')} onClick={() => setShowHelp(true)}><CircleHelp size={19} /></button></div><p>{tr('Quante sedute prevedi questa settimana?')}</p><div className="sv3-number-choices" role="group" aria-label={tr('Sedute previste questa settimana')}>{[1, 2, 3, 4, 5, 6, 7].map(n => <button key={n} type="button" aria-pressed={plan.plannedSessions === n} onClick={() => setSessions(n)}><strong>{n}</strong></button>)}</div><div className="sv3-session-stats"><div><strong>~{Math.round(plan.average)}</strong><span>{tr('serie in media per seduta')}</span></div><div><Layers size={16} /><strong>{plan.total}</strong><span>{tr('serie nella settimana')}</span></div></div>
    <div className="sv3-session-remaining"><span>{tr('{done} sedute registrate · {left} previste rimanenti', { done: plan.completedSessions, left: plan.sessionsLeft })}</span><p>{plan.remaining === 0 ? tr('Target settimanali completati.') : plan.sessionsLeft && science.profile.goal === 'balanced' && plan.remainingAverage > 20 ? <>{tr('Restano {n} serie: servono almeno {sessions} sedute da non oltre 20 serie. Aggiorna le sedute previste se hai più disponibilità.', { n: plan.remaining, sessions: Math.ceil(plan.remaining / 20) })}</> : plan.sessionsLeft ? <><strong>{tr('~{n} serie', { n: Math.ceil(plan.remainingAverage) })}</strong> {tr('per ciascuna delle {left} sedute rimanenti, con {n} serie ancora da completare.', { left: plan.sessionsLeft, n: plan.remaining })}</> : <>{tr('{n} serie ancora da completare. Aggiorna le sedute previste se hai più disponibilità.', { n: plan.remaining })}</>}</p></div>
  </section>
    {showHelp && <Sheet title={tr(tr('Quante serie per seduta?'))} onClose={() => setShowHelp(false)}>
      <p className="science-sheet-intro">{tr('Dividiamo gli obiettivi settimanali per le sedute previste: è una guida per organizzarti, senza una split obbligatoria.')}</p>
      <p className="science-sheet-intro">{tr('Il residuo tiene conto delle serie già completate e delle sedute ancora disponibili. Le serie senza RIR sono già conteggiate.')}</p>
      <p className="science-sheet-intro">{science.profile.goal === 'balanced' ? tr('Nel percorso su tutto il corpo il tetto è di 20 serie per seduta. Cambiare le sedute previste può ridurre gli obiettivi per rispettare questo limite. Con poco tempo il volume viene ridotto prima su polpacci, addome e femorali, anche sotto MEV se necessario.') : tr('Cambiare le sedute previste aggiorna la media, mantenendo gli obiettivi del percorso di specializzazione.')}</p>
    </Sheet>}
  </>;
}
