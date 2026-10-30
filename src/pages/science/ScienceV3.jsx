import { useMemo, useState } from 'react';
import { Dna, TrendingUp, ChevronRight, RotateCcw } from 'lucide-react';
import { useScienceStore as useStore } from '../../store/scienceContext';
import { useScienceClock } from '../../hooks/useScienceClock';
import { getAllExercises } from '../../data/exercises';
import { scienceProgramWeekRange, scienceCountdown } from '../../utils/scienceCalendar';
import { getActualSetsForScienceWeek, getScienceTargetForMuscle } from '../../utils/rpVolume';
import { weightTrend, weeklyRate } from '../../utils/nutrition';
import './Science.css';
import './ScienceV3.css';
import ScienceSetup from './ScienceOnboarding';
import { ScienceVolumePanel } from '../../components/ScienceVolumePanel';
import { scienceCompletedSets } from '../../utils/scienceCarry';
import CalendarDateField from '../../components/CalendarDateField';
import { localScienceDate, scienceSessionGuidance } from '../../utils/sciencePlanning';
import { useScienceAllocationPolicy } from '../../hooks/useScienceAllocationPolicy';
import ScienceSessionPlanner from '../../components/ScienceSessionPlanner';
import ScienceTutorialButton from './ScienceTutorial';
import { ProgressRing } from '../monitoring/ProgressRing';
import { locale, tr } from '../../i18n';

const dates = (start, end) => `${new Date(start).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} – ${new Date(end - 1).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;

function RecoveryAdvice({ program }) {
  const now = useScienceClock();
  const respond = useStore(s => s.respondScienceRecovery);
  if (program.status !== 'active') return null;
  return program.recommendations.filter(r => r.status === 'pending').map(r => r.type === 'redistribution' ? <section key={r.id} className="ej-card sv3-redistribution"><span className="sci-kicker">{tr('Più lavoro alle priorità')}</span><h3>{tr('Redistribuiamo le serie?')}</h3><p>{tr(r.reason)}</p><div className="sv3-redistribution-total"><span>{r.beforeTotal} → {r.afterTotal} {tr('serie totali')}</span></div><div className="sv3-redistribution-changes">{Object.entries(r.increases).map(([m, n]) => <span key={m}>{tr(m)}<strong>+{n}</strong></span>)}{Object.entries(r.reductions).map(([m, n]) => <span key={m}>{tr(m)}<strong>−{n}</strong></span>)}</div><div className="sv3-advice-actions"><button type="button" className="ej-btn ej-btn--primary" onClick={() => respond(r.id, 'redistribute', now)}>{tr('Accetta redistribuzione')}</button><button type="button" className="science-feedback-skip" onClick={() => respond(r.id, 'reject', now)}>{tr('Mantieni gli obiettivi attuali')}</button></div></section> : <section key={r.id} className="ej-card sv3-advice"><span className="sci-kicker">{tr('Un consiglio, la decisione è tua')}</span><h3>{r.type === 'deload' ? tr('È il momento di valutare lo scarico') : r.systemic ? tr('Valutiamo il recupero generale') : tr('Più recupero per questi distretti?')}</h3><p>{tr(r.reason)}</p><p className="sci-muted">{r.muscles.map(m => tr(m)).join(', ')}. {tr('Nessuna riduzione viene applicata senza la tua scelta. Le eventuali serie restano a 0–1 RIR.')}</p><div className="sv3-advice-actions">
    {r.type === 'deload' ? <><button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'reduce-all', now)}>{tr('Scarica tutto (−50%)')}</button><button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'reduce', now)}>{tr('Solo distretti segnalati (−50%)')}</button></> : <button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'reduce', now)}>{tr('Accetta −25% serie')}</button>}
    <button type="button" className="sci-small-btn" onClick={() => respond(r.id, 'pause', now)}>{tr('Pausa dei distretti')}</button><button type="button" className="sci-link" onClick={() => respond(r.id, 'reject', now)}>{r.type === 'deload' ? tr('Rimanda') : tr('Rifiuta')}</button></div></section>);
}

function ScienceArchives({ science, legacy, history, db }) {
  const programs = [...(science?.archives || []), ...(science?.program?.status === 'completed' ? [science.program] : [])];
  if (!programs.length && !legacy) return null;
  return <details className="ej-card sv3-archives"><summary>{tr('Mesocicli e decisioni precedenti')}</summary>
    {programs.map(p => <details key={p.id}><summary>{tr('Scienza V3')} · {new Date(p.startDate).toLocaleDateString(locale())}</summary>{p.weeks.map(w => <details key={w.week}><summary>W{w.week} · {dates(w.start, w.end)}{w.recovery ? ` · ${tr('recupero accettato')}` : ''}</summary>{Object.entries(w.targets).map(([m, target]) => <p key={m}><strong>{tr(m)}</strong>: {scienceCompletedSets(w.volumes.muscles[m])}/{target} · {tr(w.decisions[m])}</p>)}</details>)}{p.recommendations.map(r => <p key={r.id}>W{r.week} · {tr(r.reason)} · {r.status === 'accepted' ? tr('Accettato') : r.status === 'rejected' ? tr('Rifiutato / rimandato') : tr('Non applicato')}</p>)}</details>)}
    {legacy && <details><summary>{tr('Protocollo precedente')} · {science.legacyMigration ? tr('Trasferito a Scienza V3.0') : legacy.status === 'completed' ? tr('Completato') : tr('In corso')}</summary>{Object.keys(Object.keys(science.legacyMigration?.snapshots || {}).length ? science.legacyMigration.snapshots : legacy.weekHistory || {}).map(w => { const snapshot = science.legacyMigration?.snapshots?.[w]; const sets = snapshot?.counts || getActualSetsForScienceWeek(history, db, legacy, Number(w)); return <details key={w}><summary>{tr('Settimana {n}', { n: w })}</summary>{Object.keys(legacy.baseLandmarks || {}).map(m => <p key={m}>{tr(m)}: {sets[m] || 0}/{snapshot?.targets?.[m] ?? getScienceTargetForMuscle(legacy, m, Number(w))} {tr('serie')}</p>)}</details>; })}</details>}
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
  const countdown = p?.status === 'active' ? scienceCountdown(range.end, now) : null;
  const guidance = p?.status === 'active' ? scienceSessionGuidance(science, history, db, now) : null;
  const due = p?.status === 'active' && now >= range.end;
  const rate = science?.profile?.useWeight ? weeklyRate(weightTrend(weightLog || [])) : null;
  return <div className="ej-page sci-page sv3-page"><div className="ej-glow" aria-hidden="true" /><header><p className="ej-eyebrow">{tr('ALLENA IL TUO POTENZIALE')}</p><h1 className="ej-title">{tr('Scienza')}</h1><p className="sv3-page-subtitle">{tr('Il volume cresce con la tua capacità di recuperare.')}</p></header>
    {!p ? <div className="sv3-intro-wrap"><ScienceTutorialButton /><ScienceSetup onStarted={() => setRestart(false)} /></div> : <>
      <section className="ej-card sv3-dashboard-hero">
        <ScienceTutorialButton />
        <span className="sv3-status"><Dna size={14} />{tr('Il tuo percorso')}</span>
        {p.status === 'active' ? <div className="sv3-week-dashboard">
          <div className="sv3-countdown" aria-label={tr('Tempo rimanente: {d} giorni, {h} ore, {m} minuti', { d: countdown.days, h: countdown.hours, m: countdown.minutes })}>
            <p className="sv3-countdown-label">{due ? tr('Settimana scaduta') : now < range.start ? tr('Fine della prima settimana') : tr('Alla fine della settimana')}</p>
            <div className="sv3-countdown-values">{[[countdown.days, 'giorni'], [countdown.hours, 'ore'], [countdown.minutes, 'minuti']].map(([value, label]) => <div key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{tr(label)}</span></div>)}</div>
            <p className="sv3-countdown-date">{due ? tr('La settimana resta aperta finché scegli di avanzare.') : tr('Termina il {date}', { date: new Date(range.end).toLocaleDateString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>
          </div>
          <div className="sv3-ring-wrap" role="img" aria-label={tr('{remaining} serie mancanti su {total} previste per la settimana corrente', { remaining: guidance.remaining, total: guidance.total })}>
            <ProgressRing size={122} stroke={10} progress={guidance.total ? (guidance.total - guidance.remaining) / guidance.total : 0}>
              <strong>{guidance.remaining}</strong><span>{tr('serie mancanti')}</span>
            </ProgressRing>
            <span className="sv3-ring-caption">{guidance.total ? tr('{done} / {total} completate', { done: guidance.total - guidance.remaining, total: guidance.total }) : tr('Nessun obiettivo')}</span>
          </div>
        </div> : <><h2>{p.status === 'pending' ? tr('Il tuo protocollo è pronto.') : tr('Un blocco di esperienza in più.')}</h2><p>{p.status === 'completed' ? tr('Rivaluta le priorità e riparti dai dati raccolti.') : tr('Scegli quando iniziare il tuo percorso.')}</p></>}
        <div className="sv3-week-strip" role="group" aria-label={tr('Settimane del mesociclo')}>{[1, 2, 3, 4, 5].map(w => <button type="button" key={w} aria-pressed={w === (viewWeek ?? Math.min(p.currentWeek, 5))} className={w === (viewWeek ?? Math.min(p.currentWeek, 5)) ? 'is-active' : ''} onClick={() => setViewWeek(w)}><strong>{`W${w}`}</strong><small>{tr(p.weeks.some(saved => saved.week === w) ? 'Registrata' : w === p.currentWeek ? now < p.startDate ? 'Partenza' : 'Attuale' : w === 5 ? 'Proposta' : 'Stima')}</small></button>)}</div>
        <button type="button" className="sv3-repeat-quiz" onClick={() => setRestart(true)}><RotateCcw size={13} />{tr('Ripeti il quiz da capo')}</button>
        {p.status === 'completed' && <button type="button" className="sci-cta" onClick={() => setRestart(true)}>{tr('Scegli il prossimo mesociclo')} <ChevronRight size={18} /></button>}
      </section>
      {p.status === 'pending' && <section className="ej-card sv3-week-check"><h3>{tr('Il tuo protocollo è pronto')}</h3><p>{tr('Scegli quando iniziare con gli obiettivi importati.')}</p><CalendarDateField value={importStart} onChange={setImportStart} /><button type="button" className="ej-btn ej-btn--primary" disabled={!importStart} onClick={() => startImported(new Date(`${importStart}T00:00:00`).getTime(),now)}>{tr('Avvia il mesociclo')}</button></section>}
      {p.allocationNotice && <p className="sv3-allocation-note">{tr(p.allocationNotice)}</p>}
      {due && <section className="ej-card sv3-week-check"><h3><TrendingUp size={18} /> {tr('Check della settimana {n}', { n: p.currentWeek })}</h3><p>{tr('Chiudi la settimana per aggiornare gli obiettivi. Gli aumenti e la distribuzione seguono i tuoi check. Le proposte di scarico e pausa si applicano solo se le accetti.')}</p><button type="button" className="sci-cta" disabled={hasWorkout} onClick={() => { closeWeek(now); setViewWeek(null); }}>{p.currentWeek === 5 ? tr('Concludi il mesociclo') : tr('Chiudi settimana e aggiorna obiettivi')}</button>{hasWorkout && <p>{tr('Concludi la seduta in corso prima di passare alla settimana successiva.')}</p>}</section>}
      <RecoveryAdvice program={p} />
      <ScienceVolumePanel key={viewWeek ?? p.currentWeek} editable previewWeek={viewWeek ?? Math.min(p.currentWeek, 5)} />
      {science.profile.useWeight && <section className="ej-card sv3-weight"><h3>{tr('Peso · contesto per la massa')}</h3><p>{rate == null ? tr('Servono più pesate nel Diario per stimare una tendenza.') : tr('{rate} kg/settimana di tendenza.', { rate: `${rate > 0 ? '+' : ''}${rate.toFixed(2)}` })}</p><p className="sci-muted">{tr('Il peso non misura direttamente la crescita muscolare e non cambia automaticamente le serie.')}</p></section>}
    </>}
    {p?.status === 'active' && <ScienceSessionPlanner />}
    {p?.weeks.length > 0 && <details className="ej-card sv3-decisions"><summary>{tr('Ultimo aggiornamento · perché cambiano le serie')}</summary>{Object.entries(p.decisions).map(([m, reason]) => <p key={m}><strong>{tr(m)}</strong> · {tr(reason)}</p>)}</details>}
    <ScienceArchives science={science} legacy={legacy} history={history} db={db} />
    {restart && <ScienceSetup repeat onCancel={() => setRestart(false)} onStarted={() => { setRestart(false); setViewWeek(null); }} />}

  </div>;
}
