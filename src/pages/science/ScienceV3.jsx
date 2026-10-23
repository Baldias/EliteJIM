import { useMemo, useState } from 'react';
import { Dna, TrendingUp, ChevronRight, RotateCcw, Clock3 } from 'lucide-react';
import { useScienceStore as useStore } from '../../store/scienceContext';
import { useScienceClock } from '../../hooks/useScienceClock';
import { getAllExercises } from '../../data/exercises';
import { scienceProgramWeekRange, scienceWeekTiming } from '../../utils/scienceCalendar';
import { getActualSetsForScienceWeek, getScienceTargetForMuscle } from '../../utils/rpVolume';
import { weightTrend, weeklyRate } from '../../utils/nutrition';
import './Science.css';
import './ScienceV3.css';
import ScienceSetup from './ScienceOnboarding';
import { ScienceVolumePanel } from '../../components/ScienceVolumePanel';
import { scienceCompletedSets } from '../../utils/scienceCarry';
import CalendarDateField from '../../components/CalendarDateField';
import { localScienceDate } from '../../utils/sciencePlanning';
import { useScienceAllocationPolicy } from '../../hooks/useScienceAllocationPolicy';
import ScienceSessionPlanner from '../../components/ScienceSessionPlanner';
import ScienceTutorialButton from './ScienceTutorial';

const dates = (start, end) => `${new Date(start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${new Date(end - 1).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;

function RecoveryAdvice({ program }) {
  const now = useScienceClock();
  const respond = useStore(s => s.respondScienceRecovery);
  if (program.status !== 'active') return null;
  return program.recommendations.filter(r => r.status === 'pending').map(r => r.type === 'redistribution' ? <section key={r.id} className="ej-card sv3-redistribution"><span className="sci-kicker">Più lavoro alle priorità</span><h3>Redistribuiamo le serie?</h3><p>{r.reason}</p><div className="sv3-redistribution-total"><span>{r.beforeTotal} → {r.afterTotal} serie totali</span></div><div className="sv3-redistribution-changes">{Object.entries(r.increases).map(([m, n]) => <span key={m}>{m}<strong>+{n}</strong></span>)}{Object.entries(r.reductions).map(([m, n]) => <span key={m}>{m}<strong>−{n}</strong></span>)}</div><div className="sv3-advice-actions"><button type="button" className="ej-btn ej-btn--primary" onClick={() => respond(r.id, 'redistribute', now)}>Accetta redistribuzione</button><button type="button" className="science-feedback-skip" onClick={() => respond(r.id, 'reject', now)}>Mantieni gli obiettivi attuali</button></div></section> : <section key={r.id} className="ej-card sv3-advice"><span className="sci-kicker">Un consiglio, la decisione è tua</span><h3>{r.type === 'deload' ? 'È il momento di valutare lo scarico' : r.systemic ? 'Valutiamo il recupero generale' : 'Più recupero per questi distretti?'}</h3><p>{r.reason}</p><p className="sci-muted">{r.muscles.join(', ')}. Nessuna riduzione viene applicata senza la tua scelta. Le eventuali serie restano a 0–1 RIR.</p><div className="sv3-advice-actions">
    {r.type === 'deload' ? <><button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'reduce-all', now)}>Scarica tutto (−50%)</button><button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'reduce', now)}>Solo distretti segnalati (−50%)</button></> : <button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'reduce', now)}>Accetta −25% serie</button>}
    <button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'pause', now)}>Pausa dei distretti</button><button type="button" className="sci-link" onClick={() => respond(r.id, 'reject', now)}>{r.type === 'deload' ? 'Rimanda' : 'Rifiuta'}</button></div></section>);
}

function ScienceArchives({ science, legacy, history, db }) {
  const programs = [...(science?.archives || []), ...(science?.program?.status === 'completed' ? [science.program] : [])];
  if (!programs.length && !legacy) return null;
  return <details className="ej-card sv3-archives"><summary>Mesocicli e decisioni precedenti</summary>
    {programs.map(p => <details key={p.id}><summary>Scienza V3 · {new Date(p.startDate).toLocaleDateString('it-IT')}</summary>{p.weeks.map(w => <details key={w.week}><summary>W{w.week} · {dates(w.start, w.end)}{w.recovery ? ' · recupero accettato' : ''}</summary>{Object.entries(w.targets).map(([m, target]) => <p key={m}><strong>{m}</strong>: {scienceCompletedSets(w.volumes.muscles[m])}/{target} · {w.decisions[m]}</p>)}</details>)}{p.recommendations.map(r => <p key={r.id}>W{r.week} · {r.reason} · {r.status === 'accepted' ? 'Accettato' : r.status === 'rejected' ? 'Rifiutato / rimandato' : 'Non applicato'}</p>)}</details>)}
    {legacy && <details><summary>Protocollo precedente · {science.legacyMigration ? 'Trasferito a Scienza V3.0' : legacy.status === 'completed' ? 'Completato' : 'In corso'}</summary>{Object.keys(Object.keys(science.legacyMigration?.snapshots || {}).length ? science.legacyMigration.snapshots : legacy.weekHistory || {}).map(w => { const snapshot = science.legacyMigration?.snapshots?.[w]; const sets = snapshot?.counts || getActualSetsForScienceWeek(history, db, legacy, Number(w)); return <details key={w}><summary>Settimana {w}</summary>{Object.keys(legacy.baseLandmarks || {}).map(m => <p key={m}>{m}: {sets[m] || 0}/{snapshot?.targets?.[m] ?? getScienceTargetForMuscle(legacy, m, Number(w))} serie</p>)}</details>; })}</details>}
  </details>;
}

export default function ScienceV3() {
  const now = useScienceClock();
  useScienceAllocationPolicy(now);
  const science = useStore(s => s.scienceState);
  const legacy = useStore(s => s.scienceReport);
  const history = useStore(s => s.history);
  const custom = useStore(s => s.customExercises);
  const overrides = useStore(s => s.exerciseOverrides);
  const weightLog = useStore(s => s.weightLog);
  const closeWeek = useStore(s => s.closeScienceV3Week);
  const hasWorkout = useStore(s => Boolean(s.activeWorkout));
  const [restart, setRestart] = useState(false);
  const [viewWeek, setViewWeek] = useState(null);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  const startImported = useStore(s => s.startImportedScience);
  const [importStart, setImportStart] = useState(() => localScienceDate(now));
  const p = science?.program;
  const range = p && scienceProgramWeekRange(p);
  const timing = p && scienceWeekTiming(p, now);
  const due = p?.status === 'active' && now >= range.end;
  const rate = science?.profile?.useWeight ? weeklyRate(weightTrend(weightLog || [])) : null;
  return <div className="ej-page sci-page sv3-page"><div className="ej-glow" aria-hidden="true" /><header><p className="ej-eyebrow">ALLENA IL TUO POTENZIALE</p><h1 className="ej-title">Scienza</h1></header>
    {!p ? <div className="sv3-intro-wrap"><ScienceTutorialButton /><ScienceSetup onStarted={() => setRestart(false)} /></div> : <>
      <section className="ej-card sv3-dashboard-hero"><ScienceTutorialButton /><span className="sv3-status"><Dna size={14} />Il tuo percorso</span><h2>{p.status === 'pending' ? 'Il tuo protocollo è pronto.' : p.status === 'completed' ? 'Un blocco di esperienza in più.' : now < p.startDate ? 'Il tuo mesociclo.' : p.currentWeek === 5 ? 'Recupero da concordare.' : p.currentWeek === 4 ? 'Costruisci il tuo picco.' : 'Sfida il tuo limite.'}</h2><p>{p.status === 'completed' ? 'Rivaluta le priorità e riparti dai dati raccolti.' : now < p.startDate ? `Partenza ${new Date(p.startDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}. Nel frattempo esplora le stime delle settimane.` : 'Il volume cresce con la tua capacità di recuperare.'}</p>{p.status === 'active' && <div className={`sv3-week-timing ${timing.overdue ? 'is-overdue' : ''}`}><Clock3 size={14} /><span>{timing.label}</span><small>{new Date(timing.end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>}<div className="sv3-week-strip" role="group" aria-label="Settimane del mesociclo">{[1, 2, 3, 4, 5].map(w => <button type="button" key={w} aria-pressed={w === (viewWeek ?? Math.min(p.currentWeek, 5))} className={w === (viewWeek ?? Math.min(p.currentWeek, 5)) ? 'is-active' : ''} onClick={() => setViewWeek(w)}><strong>{`W${w}`}</strong><small>{p.weeks.some(saved => saved.week === w) ? 'Registrata' : w === p.currentWeek ? now < p.startDate ? 'Partenza' : 'Attuale' : w === 5 ? 'Proposta' : 'Stima'}</small></button>)}</div><button type="button" className="sv3-repeat-quiz" onClick={() => setRestart(true)}><RotateCcw size={13} />Ripeti il quiz da capo</button>
        {p.status === 'completed' && <button type="button" className="sci-cta" onClick={() => setRestart(true)}>Scegli il prossimo mesociclo <ChevronRight size={18} /></button>}
      </section>
      {p.migration && <p className="sv3-notice">Scienza V3.0 · la tua settimana {p.migration.sourceWeek} continua qui come W{p.migration.currentWeek}. Progressi riportati, senza inventare il RIR. Il protocollo precedente è nell’archivio.</p>}
      {p.referenceUpdate && <p className="sv3-notice">Obiettivi aggiornati ai nuovi riferimenti. Settimana e incrementi già maturati sono conservati.</p>}
      {p.status === 'pending' && <section className="ej-card sv3-week-check"><h3>Il tuo protocollo è pronto</h3><p>Scegli quando iniziare con gli obiettivi importati.</p><CalendarDateField value={importStart} onChange={setImportStart} /><button type="button" className="ej-btn ej-btn--primary" disabled={!importStart} onClick={() => startImported(new Date(`${importStart}T00:00:00`).getTime(),now)}>Avvia il mesociclo</button></section>}
      {p.allocationNotice && <p className="sv3-allocation-note">{p.allocationNotice}</p>}
      {p.timeWarning && <p className="sv3-notice">{p.timeWarning}</p>}
      {due && <section className="ej-card sv3-week-check"><h3><TrendingUp size={18} /> Check della settimana {p.currentWeek}</h3><p>Chiudi la settimana per aggiornare gli obiettivi. Gli aumenti ordinari sono automatici; recupero e riduzioni si applicano solo se li accetti.</p><button type="button" className="sci-cta" disabled={hasWorkout} onClick={() => { closeWeek(now); setViewWeek(null); }}>{p.currentWeek === 5 ? 'Concludi il mesociclo' : 'Chiudi settimana e aggiorna obiettivi'}</button>{hasWorkout && <p>Concludi la seduta in corso prima di passare alla settimana successiva.</p>}</section>}
      <RecoveryAdvice program={p} />
      <ScienceVolumePanel key={viewWeek ?? p.currentWeek} editable previewWeek={viewWeek ?? Math.min(p.currentWeek, 5)} />
      {science.profile.useWeight && <section className="ej-card sv3-weight"><h3>Peso · contesto per la massa</h3><p>{rate == null ? 'Servono più pesate nel Diario per stimare una tendenza.' : `${rate > 0 ? '+' : ''}${rate.toFixed(2)} kg/settimana di tendenza.`}</p><p className="sci-muted">Il peso non misura direttamente la crescita muscolare e non cambia automaticamente le serie.</p></section>}
      {p.weeks.length > 0 && <details className="ej-card sv3-decisions"><summary>Ultimo aggiornamento · perché cambiano le serie</summary>{Object.entries(p.decisions).map(([m, reason]) => <p key={m}><strong>{m}</strong> · {reason}</p>)}</details>}
    </>}
    <ScienceArchives science={science} legacy={legacy} history={history} db={db} />
    {p?.status === 'active' && <ScienceSessionPlanner />}
    {restart && <ScienceSetup repeat onCancel={() => setRestart(false)} onStarted={() => { setRestart(false); setViewWeek(null); }} />}

  </div>;
}
