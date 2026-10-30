import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, ArrowRight, Check, Dna, History, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { useScienceStore as useStore } from '../../store/scienceContext';
import { getAllExercises } from '../../data/exercises';
import { legacyDynamicProposal, legacyEvolutionFor, needsScienceEvolution } from '../../utils/scienceEvolution';
import MicroLoading from '../../components/MicroLoading';
import './ScienceEvolution.css';
import { tr } from '../../i18n';

const STEPS = [
  { icon: Sparkles, tag: 'L’evoluzione del tuo allenamento', title: 'Scienza V3.0 è finalmente fuori!', body: 'Un nuovo modo di leggere il tuo allenamento. Più personale, più chiaro, sempre al tuo fianco.' },
  { icon: ShieldCheck, tag: 'Ripartiamo da te', title: 'Il tuo percorso è al sicuro.', body: 'Nessun nuovo inizio obbligato. Passi subito alla nuova dashboard con priorità e progressi della settimana corrente. Le basi del volume si aggiornano alla nuova tabella di riferimento. Il protocollo precedente rimane nell’archivio. Log, record, XP e livelli restano intatti.' },
  { icon: Waves, tag: 'Ti presentiamo Scienza V3.0', title: 'La dose giusta cambia con te.', body: 'Le settimane già completate aiutano a stimare il tuo volume. Le serie a 0–1 RIR e i nuovi check di recupero rendono le proposte successive più personali.' },
  { icon: Activity, tag: 'Il controllo resta tuo', title: 'Più ascolto. Nessuna forzatura.', body: 'Da ora usi Scienza V3.0: target, check e progressione seguono il nuovo motore. Le serie già fatte restano nel conteggio della settimana. Nessun taglio o blocco automatico per la fatica.' },
];

function ReleaseTour({ report, animate, onComplete, onReveal }) {
  const [phase, setPhase] = useState(animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'transform' : 'tour');
  const [step, setStep] = useState(0);
  const dialog = useRef(null);
  const skip = useRef(null);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skip.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (phase !== 'transform') { onReveal(); dialog.current?.focus(); return; }
    const timer = window.setTimeout(() => setPhase('tour'), 4600);
    return () => window.clearTimeout(timer);
  }, [phase, onReveal]);
  useEffect(() => {
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (phase === 'transform') setPhase('tour'); else completeRef.current(); }
      if (event.key === 'Tab') {
        const root = phase === 'tour' ? dialog.current : skip.current?.parentElement;
        const nodes = root?.querySelectorAll('button:not([disabled]), [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase]);
  const active = STEPS[step], Icon = active.icon, week = report.currentWeek || 1;
  return createPortal(<div className={`science-release-overlay is-${phase}`}>
    {phase === 'transform' ? <div className="science-release-loading" role="status"><span className="science-release-orb"><Dna size={44} /></span><strong>{tr('Il tuo percorso sta evolvendo.')}</strong><span>{tr('La tua esperienza, al centro.')}</span><button type="button" ref={skip} onClick={() => setPhase('tour')}>{tr('Salta animazione')}</button></div> :
      <section className="science-release-dialog" role="dialog" aria-modal="true" aria-labelledby="science-release-title" aria-describedby="science-release-description" ref={dialog} tabIndex={-1}>
        <div className="science-release-dots" aria-label={tr('Novità {n} di {total}', { n: step + 1, total: STEPS.length })}>{STEPS.map((_, i) => <span key={i} className={i <= step ? 'is-done' : ''} />)}</div>
        <div key={step} className="science-release-slide">
          <div className="science-release-art" aria-hidden="true"><span className="science-release-ring" /><span className="science-release-emblem"><Icon size={52} strokeWidth={1.6} /></span><i /><i /><i /></div>
          <span className="science-release-tag">{tr(active.tag)}</span><h2 id="science-release-title">{tr(active.title)}</h2><p id="science-release-description">{tr(active.body)}</p>
          {step === 0 && <div className="science-release-version"><span>{tr('SCIENZA')}</span><strong>V3.0</strong><span>{tr('Su misura per te')}</span></div>}
          {step === 1 && <div className="science-release-kept"><Check size={20} /><span>{report.status === 'pending' ? tr('Il protocollo che hai preparato ti aspetta.') : tr('Continui dalla settimana {week}, con i tuoi progressi.', { week })}</span></div>}
          {step === 2 && <><div className="science-release-formula"><span><History size={18} />{tr('Storico')}</span><b>+</b><span><Activity size={18} />{tr('Qualità')}</span><b>+</b><span><Waves size={18} />{tr('Recupero')}</span></div><small className="science-release-disclaimer">{tr('Le serie già svolte vengono riportate come progressi del protocollo precedente. Lo sforzo non registrato resta sconosciuto: nessun RIR viene inventato.')}</small></>}
          {step === 3 && <div className="science-release-kept"><ShieldCheck size={20} /><span>{tr('Accetta o rifiuta. Le tue schede restano tue.')}</span></div>}
        </div>
        <footer><button type="button" className="science-release-primary" onClick={() => step < STEPS.length - 1 ? setStep(n => n + 1) : onComplete()}>{step < STEPS.length - 1 ? tr('Scopri cosa cambia') : report.status === 'pending' ? tr('Torna al tuo protocollo') : tr('Continua dalla settimana {week}', { week })}<ArrowRight size={18} /></button><div className="science-release-secondary">{step > 0 && <button type="button" onClick={() => setStep(n => n - 1)}>{tr('Indietro')}</button>}<button type="button" onClick={onComplete}>{tr('Vai al mio protocollo')}</button></div></footer>
      </section>}
  </div>, document.body);
}

export function ScienceEvolution({ report, children }) {
  const science = useStore(s => s.scienceState);
  const complete = useStore(s => s.completeScienceEvolution);
  const [revealed, setRevealed] = useState(false);
  const [initial] = useState(() => needsScienceEvolution(report, science));
  const open = initial && needsScienceEvolution(report, science);
  useEffect(() => { if (!open) complete(); }, [open, complete]);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const evolving = open && !revealed && !reduced;
  // A stable callback keeps the reveal effect independent of store updates.
  const reveal = useMemo(() => () => setRevealed(true), []);
  if (!open) return <div className="ej-page"><MicroLoading title={tr('Passo a Scienza V3.0')} description={tr('Porto con te obiettivi e progressi della settimana.')} /></div>;
  return <><div className={`science-evolution-stage ${evolving ? 'is-evolving' : revealed ? 'is-revealed' : ''}`} inert={open ? true : undefined}>{children}</div>
    {open && <ReleaseTour report={report} animate={!reduced} onReveal={reveal} onComplete={() => complete()} />}</>;
}

export function LegacyDynamicVolume({ report }) {
  const science = useStore(s => s.scienceState), history = useStore(s => s.history);
  const custom = useStore(s => s.customExercises), overrides = useStore(s => s.exerciseOverrides);
  const decide = useStore(s => s.decideLegacyDynamicVolume);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  const proposal = useMemo(() => legacyDynamicProposal(report, history, db, science), [report, history, db, science]);
  const evolution = legacyEvolutionFor(report, science);
  if (!evolution || !proposal) return null;
  const decision = evolution.decisions?.[proposal.id];
  const shown = decision || proposal;
  return <section className="ej-card science-dynamic-panel"><div className="science-dynamic-heading"><span><Waves size={19} /></span><div><small>{tr('IL PROSSIMO PASSO')}</small><h2>{tr('Scienza V3.0')}</h2></div><span className="science-dynamic-week">W{shown.week}</span></div>
    <p>{decision ? decision.choice === 'accept' ? tr('Proposta accettata. Si applicherà quando passerai alla prossima settimana.') : tr('Hai scelto il programma originale per questa settimana. Puoi continuare ad allenarti come previsto.') : tr(shown.reason)}</p>
    {shown.changes.length > 0 && <div className="science-dynamic-changes">{shown.changes.map(c => <div key={c.muscle}><span><strong>{tr(c.muscle)}</strong><small>{tr(c.reason)}</small></span><b>{c.before}<ArrowRight size={13} />{c.after}</b></div>)}</div>}
    {!decision && shown.changes.length > 0 && <div className="science-dynamic-actions"><button type="button" className="ej-btn ej-btn--primary" onClick={() => decide('accept')}>{tr('Accetta per W{week}', { week: shown.week })}<Check size={16} /></button><button type="button" className="science-release-text" onClick={() => decide('reject')}>{tr('Mantieni il programma')}</button></div>}
    <small className="science-dynamic-note">{tr('La settimana attuale non cambia. {n} settimane rappresentative disponibili. Segna 0–1 RIR e completa il check dopo la seduta per migliorare le prossime stime.', { n: shown.evidence.length })}</small>
  </section>;
}
