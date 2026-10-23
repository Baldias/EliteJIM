import { scienceCompletedSets, scienceUnconfirmedSets } from '../utils/scienceCarry';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Flame, Info, Target } from 'lucide-react';
import { useScienceStore as useStore } from '../store/scienceContext';
import { useScienceClock } from '../hooks/useScienceClock';
import { getAllExercises } from '../data/exercises';
import { Sheet } from '../pages/monitoring/Sheet';
import { classifyScienceExercise, hasLegacyScience } from '../utils/scienceV3';
import '../pages/science/ScienceV3.css';
import { scienceWeekPreview, scienceLandmarkBand } from '../utils/sciencePlanning';

function TargetEditor({ muscle, target, ceiling }) {
  const save = useStore(s => s.setScienceTarget);
  const [values, setValues] = useState({ target, ceiling });
  const [saved, setSaved] = useState(false);
  return <form className="sv3-target-editor" onSubmit={e => { e.preventDefault(); save(muscle, values.target, values.ceiling); setSaved(true); }}>
    <label>Serie a settimana<input aria-label={`Target ${muscle}`} type="number" min="0" max="100" value={values.target} onChange={e => { setSaved(false); setValues(v => ({ ...v, target: e.target.value })); }} /></label>
    <label>Soglia da rivalutare<input aria-label={`Soglia ${muscle}`} type="number" min="0" max="100" value={values.ceiling} onChange={e => { setSaved(false); setValues(v => ({ ...v, ceiling: e.target.value })); }} /></label>
    <button className="ej-btn ej-btn--primary" type="submit">{saved ? <><Check size={16} />Salvato</> : 'Aggiorna obiettivo'}</button>
  </form>;
}

export function ScienceVolumePanel({ compact = false, editable = false, workout, previewWeek }) {
  const now = useScienceClock();
  const [selected, setSelected] = useState(null);
  const science = useStore(s => s.scienceState);
  const legacy = useStore(s => s.scienceReport);
  const enabled = useStore(s => s.showScience);
  const history = useStore(s => s.history);
  const custom = useStore(s => s.customExercises);
  const overrides = useStore(s => s.exerciseOverrides);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  if (!enabled || hasLegacyScience(legacy, science) || !science?.program) return null;
  const p = science.program;
  const summary = scienceWeekPreview(science, history, db, previewWeek ?? Math.min(p.currentWeek, 5), now);
  const estimated = summary.kind === 'estimate' || summary.kind === 'deload-estimate';
  const canEdit = editable && p.status === 'active' && summary.kind === 'current';
  if (!summary?.muscles && !summary?.volumes) return null;
  const muscles = summary.muscles || summary.volumes.muscles;
  const targets = summary.targets;
  const trained = workout ? new Set((workout.exercises || []).filter(ex => ex.sets?.some(s => s.done)).map(ex => classifyScienceExercise(ex, db, science, workout.id).primary)) : null;
  const names = Object.keys(targets).filter(m => trained ? trained.has(m) : targets[m] > 0 || muscles[m]?.direct || muscles[m]?.unknown).sort((a, b) => Number(science.profile.priorities.includes(b)) - Number(science.profile.priorities.includes(a)) || a.localeCompare(b));
  const visible = names;
  const missing = names.reduce((n, m) => n + scienceUnconfirmedSets(muscles[m]), 0);
  const lm = selected && (summary.landmarks || p.landmarks)[selected];
  return <>
    <section className={`ej-card sv3-volumes ${compact ? 'is-compact' : ''}`}>
      <div className="sv3-panel-heading"><span className="sv3-panel-icon"><Target size={17} /></span><div><h2>{workout ? 'Il lavoro di oggi, nel tuo percorso' : estimated ? `Stima settimana ${summary.week}` : summary.kind === 'archive' ? `Settimana ${summary.week} · registrata` : `Obiettivi Settimana ${summary.week}`}</h2><p>{new Date(summary.start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – {new Date(summary.end - 1).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</p></div></div>
      {estimated && <p className="sv3-estimate-note">{summary.kind === 'deload-estimate' ? 'Proposta di scarico completo al 50%: si applica solo se la accetti. Puoi scegliere anche uno scarico locale o rimandare.' : summary.redistribution ? 'Stima favorevole con redistribuzione accettata: parte delle serie fuori priorità passa alle priorità, mantenendo il totale contenuto. Non è ancora applicata.' : 'Stima in uno scenario favorevole: target completati, recupero buono e serie pulite. Gli aumenti reali dipenderanno dai tuoi dati; nessuna modifica è già applicata.'}</p>}
      <div className="sv3-volume-list">{visible.map(muscle => {
        const v = muscles[muscle], target = targets[muscle], completed = scienceCompletedSets(v), unknown = scienceUnconfirmedSets(v);
        const focus = science.profile.priorities.includes(muscle);
        const done = !estimated && target > 0 && completed >= target;
        const band = scienceLandmarkBand((summary.landmarks || p.landmarks)[muscle], target, summary.roles[muscle]);
        return <button type="button" key={muscle} className={`sv3-volume-row landmark--${band} ${focus ? 'is-priority' : ''} ${done ? 'is-done' : ''}`} onClick={() => setSelected(muscle)} aria-label={estimated ? `${muscle}: ${target} serie stimate. Dettagli obiettivo` : `${muscle}: ${completed} su ${target} serie. Dettagli obiettivo`}>
          <span className="sv3-volume-top"><span className="sv3-volume-name">{muscle}{focus && <span className="sv3-focus-badge"><Flame size={11} fill="currentColor" />FOCUS</span>}</span><span className="sv3-volume-number">{done && <Check size={13} />}<strong>{estimated ? target : completed}</strong><span>{estimated ? 'serie stimate' : `/ ${target} serie`}</span><ChevronRight size={13} /></span></span>
          <span className="sv3-volume-bar"><span style={{ width: `${estimated ? Math.min(100, target / Math.max(target, p.ceilings[muscle]) * 100) : target ? Math.min(100, completed / target * 100) : 0}%` }} /></span>
          {(v.indirect > 0 || v.unknown > 0 || v.imported > 0) && <span className="sv3-volume-subline">{v.indirect > 0 && <span>+{v.indirect} indirette</span>}{v.imported > 0 && <span>{v.imported} {v.imported === 1 ? 'riportata' : 'riportate'} da V2</span>}{unknown > 0 && <span>{unknown} senza RIR</span>}</span>}

        </button>;
      })}</div>
      {missing > 0 && <p className="sv3-inline-note"><Info size={13} /><span>{missing} serie da confermare con il RIR.</span></p>}
      {workout && <Link className="sv3-program-link" to="/science">Vai al programma completo<ArrowRight size={14} /></Link>}
      {!compact && summary.unclassified?.length > 0 && <p className="sv3-inline-note"><Info size={13} /><span>{summary.unclassified.length} esercizi da classificare nel check delle sedute.</span></p>}
    </section>
    {selected && lm && <Sheet title={selected} onClose={() => setSelected(null)}>
      <div className="sv3-goal-summary"><span>{estimated ? 'STIMA · ' : ''}SETTIMANA {summary.week}</span><p><strong>{estimated ? targets[selected] : scienceCompletedSets(muscles[selected])}</strong><span>{estimated ? 'serie stimate' : `/ ${targets[selected]} serie`}</span></p><small>Serie dirette a 0–1 RIR{muscles[selected].imported > 0 ? ` + ${muscles[selected].imported} riportate da V2 con sforzo non registrato` : ''}</small></div>
      <p className="science-sheet-intro">{(estimated ? 'Scenario illustrativo, aggiornato dai prossimi check. Non è un target già applicato.' : summary.decisions?.[selected] || p.decisions[selected]) || (lm.source === 'history-estimate' ? 'La partenza tiene conto delle tue settimane di allenamento precedenti.' : 'Una base stimata per il tuo livello, che segue qualità e recupero.')}</p>
      <div className="sv3-landmark-grid">{[['mv', 'Mantenimento stimato', `${lm.mvEstimate} serie`], ['mev', 'Partenza per crescere', lm.mevEstimate == null ? 'Da valutare' : `${lm.mevEstimate} serie`], ['mav', 'Intervallo produttivo', lm.productiveRange ? `${lm.productiveRange.join('–')} osservate` : lm.referenceMav ? `${lm.referenceMav.join('–')} di riferimento` : 'Da osservare'], ['mrv', 'Limite di recupero stimato', lm.mrv ? `${lm.mrv.lower}–${lm.mrv.upper} osservate` : lm.mrvEstimate ? `~${lm.mrvEstimate} di riferimento` : 'Da determinare']].map(([band, label, value]) => <div className={`landmark--${band}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p className="sv3-quiz-note">La tabella orienta le stime iniziali; la tua risposta le personalizza. Un limite di riferimento non è un MRV misurato. Il lavoro indiretto resta separato.</p>
      {canEdit && <><h3 className="sv3-edit-heading">Personalizza l’obiettivo</h3><TargetEditor key={`${selected}-${targets[selected]}-${p.ceilings[selected]}`} muscle={selected} target={targets[selected]} ceiling={p.ceilings[selected]} /></>}
    </Sheet>}
  </>;
}
