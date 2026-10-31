import { useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, EyeOff, Moon, Plus, Sparkles } from 'lucide-react';
import { useScienceStore as useStore } from '../store/scienceContext';
import { getAllExercises } from '../data/exercises';
import { Sheet } from '../pages/monitoring/Sheet';
import { annotationFor, classifyScienceExercise, SCIENCE_MUSCLES } from '../utils/scienceV3';
import { scienceTrackingEnabled } from '../utils/scienceEvolution';
import './ScienceTraining.css';
import { tr } from '../i18n';

export function ScienceChoices({ label, options, value, onChange }) {
  return <div className="science-choice-group" role="group" aria-label={label}>
    {options.map(([id, text]) => <button type="button" key={id} aria-pressed={value === id}
      className={value === id ? 'is-selected' : ''} onClick={() => onChange(value === id ? null : id)}>
      {text}{value === id && <Check size={13} strokeWidth={2.5} />}
    </button>)}
  </div>;
}

export function ScienceSwitch({ label, description, checked, onChange, icon: Icon }) {
  return <button type="button" className="science-switch-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
    {Icon && <span className="science-switch-icon"><Icon size={17} /></span>}
    <span className="science-switch-copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>
    <span className="science-switch-track" aria-hidden="true"><span /></span>
  </button>;
}

const RIR_OPTIONS = () => [[0, tr('Cedimento')], [1, tr('1 rep in riserva')]];

// Outside Scienza the effort is an optional field of the set itself.
function RirSelector({ value, onChange }) {
  return <div className="science-set-controls" aria-label={tr('Sforzo della serie')}>
    <span className="science-rir-label">RIR</span>
    <div className="science-rir-segments">
      {RIR_OPTIONS().map(([rir, label]) => <button key={rir} type="button" aria-label={`${rir} RIR`} aria-pressed={value === rir}
        onClick={() => onChange(value === rir ? null : rir)}>
        <strong>{rir}</strong><span>{label}</span>
      </button>)}
    </div>
  </div>;
}

export function WorkoutSetEffort({ workoutId, exerciseId, set, onChange }) {
  const science = useStore(s => s.showScience && scienceTrackingEnabled(s));
  const showRir = useStore(s => s.showRirSelector ?? true);
  const technique = Boolean(set.isDropset || set.isRestPause || set.isWarmup);
  if (science) return <ScienceSetControls workoutId={workoutId} exerciseId={exerciseId} setId={set.id} disabled={technique} hideRir={!showRir} />;
  if (!showRir || technique) return null;
  return <RirSelector value={set.rir === 0 || set.rir === 1 ? set.rir : null} onChange={onChange} />;
}

export function ScienceSetControls({ workoutId, exerciseId, setId, disabled = false, hideRir = false }) {
  const science = useStore(s => s.scienceState);
  const enabled = useStore(s => s.showScience && scienceTrackingEnabled(s));
  const annotate = useStore(s => s.annotateScienceSet);
  if (!enabled) return null;
  if (workoutId == null || exerciseId == null || setId == null) return <p className="sci-muted">{tr('RIR non registrato')}</p>;
  const annotation = annotationFor(science, workoutId, exerciseId, setId);
  if (disabled) return <div className="science-set-controls is-excluded"><EyeOff size={12} /><span>{tr('Fuori dal volume Scienza')}</span></div>;
  if (hideRir) return <div className={`science-set-controls is-compact ${annotation.excluded ? 'is-excluded' : ''}`}>
    <span className="science-rir-auto">{annotation.excluded ? tr('Fuori dal volume Scienza') : annotation.rir === 1 ? '1 RIR' : annotation.rir === 0 ? tr('0 RIR · segnato in automatico') : tr('0 RIR al completamento')}</span>
    <button type="button" className="science-exclude" aria-label={annotation.excluded ? tr('Includi in Scienza') : tr('Escludi da Scienza')} aria-pressed={Boolean(annotation.excluded)}
      title={annotation.excluded ? tr('Includi in Scienza') : tr('Escludi da Scienza')} onClick={() => annotate(workoutId, exerciseId, setId, { excluded: !annotation.excluded })}>
      {annotation.excluded ? <Plus size={15} /> : <EyeOff size={15} />}
    </button>
  </div>;
  return <div className={`science-set-controls ${annotation.excluded ? 'is-excluded' : ''}`} aria-label={tr('Sforzo della serie')}>
    <span className="science-rir-label">RIR</span>
    <div className="science-rir-segments">
      {RIR_OPTIONS().map(([rir, label]) => <button key={rir} type="button" aria-label={`${rir} RIR`} aria-pressed={annotation.rir === rir && !annotation.excluded}
        disabled={annotation.excluded} onClick={() => annotate(workoutId, exerciseId, setId, { rir: annotation.rir === rir ? null : rir })}>
        <strong>{rir}</strong><span>{label}</span>
      </button>)}
    </div>
    <button type="button" className="science-exclude" aria-label={annotation.excluded ? tr('Includi in Scienza') : tr('Escludi da Scienza')} aria-pressed={Boolean(annotation.excluded)}
      title={annotation.excluded ? tr('Includi in Scienza') : tr('Escludi da Scienza')} onClick={() => annotate(workoutId, exerciseId, setId, { excluded: !annotation.excluded })}>
      {annotation.excluded ? <Plus size={15} /> : <EyeOff size={15} />}
    </button>
  </div>;
}

export function ScienceExerciseClassification({ workout, exercise }) {
  const [open, setOpen] = useState(false);
  const science = useStore(s => s.scienceState);
  const enabled = useStore(s => s.showScience && scienceTrackingEnabled(s));
  const custom = useStore(s => s.customExercises);
  const overrides = useStore(s => s.exerciseOverrides);
  const classify = useStore(s => s.classifyScienceExercise);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  if (!enabled || !exercise.name || classifyScienceExercise(exercise, db, science, workout.id).primary) return null;
  return <>
    <button type="button" className="science-classify" onClick={() => setOpen(true)}><Plus size={14} />{tr('Assegna un muscolo per Scienza')}<ChevronRight size={14} /></button>
    {open && <Sheet title={tr('Quale muscolo alleni?')} onClose={() => setOpen(false)}>
      <p className="science-sheet-intro">{exercise.name}</p>
      <div className="science-muscle-options">{SCIENCE_MUSCLES.map(m => <button type="button" key={m} onClick={() => { classify(workout.id, exercise.id, m); setOpen(false); }}>{tr(m)}<ChevronRight size={14} /></button>)}</div>
    </Sheet>}
  </>;
}

function FeedbackForm({ workout, muscles, initial, onSave }) {
  const [feedback, setFeedback] = useState(initial || { sleep: '', systemicFatigue: false, muscles: {} });
  const [saved, setSaved] = useState(Boolean(initial));
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const total = 2 + muscles.length * 3;
  const muscle = step >= 2 ? muscles[Math.floor((step - 2) / 3)] : null;
  const type = step >= 2 ? (step - 2) % 3 : null;
  const updateMuscle = change => {
    setSaved(false);
    setFeedback(f => ({ ...f, muscles: { ...f.muscles, [muscle]: { ...f.muscles[muscle], ...change } } }));
  };
  const finish = () => { onSave(workout.id, feedback); setSaved(true); setOpen(false); };
  const next = () => step < total - 1 ? setStep(s => s + 1) : finish();
  const question = step === 0 ? tr('Come hai dormito?') : step === 1 ? tr('Senti fatica generale?') : type === 0 ? tr('Eri pronto ad allenarlo?') : type === 1 ? tr('Com’erano le serie?') : tr('Fastidi o dolore?');
  const description = step === 0 ? tr('Pensa al sonno prima di questa seduta.') : step === 1 ? tr('Distingui la normale stanchezza da una fatica che compromette le sedute.') : type === 0 ? tr('Il recupero dalla seduta precedente. Prima esposizione? Puoi saltare.') : type === 1 ? tr('La qualità delle esecuzioni di oggi.') : tr('Un lieve fastidio non blocca l’aumento. Segnala se il dolore limita il movimento.');
  const options = step === 0 ? [['good', tr('Ho dormito bene')], ['fair', tr('Così così')], ['poor', tr('Ho dormito male')]] : step === 1 ? [[false, tr('No, tutto nella norma')], ['mild', tr('Un po’, ma riesco ad allenarmi')], [true, tr('Marcata, compromette l’allenamento')]] : type === 0 ? [['good', tr('Pronto e recuperato')], ['fair', tr('Solo in parte')], ['poor', tr('Non avevo recuperato')]] : type === 1 ? [['good', tr('Pulite e costanti')], ['fair', tr('Qualche serie meno pulita')], ['poor', tr('Qualità in calo marcato')]] : [[false, tr('Nessun fastidio')], ['mild', tr('Lieve fastidio, movimento normale')], [true, tr('Dolore che limita il movimento')]];
  const value = step === 0 ? feedback.sleep : step === 1 ? feedback.systemicFatigue : type === 0 ? feedback.muscles[muscle]?.recovery : type === 1 ? feedback.muscles[muscle]?.quality : feedback.muscles[muscle]?.pain;
  const choose = answer => {
    setSaved(false);
    if (step === 0) setFeedback(f => ({ ...f, sleep: answer }));
    else if (step === 1) setFeedback(f => ({ ...f, systemicFatigue: answer }));
    else updateMuscle({ [type === 0 ? 'recovery' : type === 1 ? 'quality' : 'pain']: answer });
  };
  return <>
    <button type="button" className={`ej-card science-feedback-entry ${saved ? 'is-saved' : ''}`} onClick={() => { setStep(0); setOpen(true); }}>
      <span className="science-feedback-icon">{saved ? <CheckCheck size={21} /> : <Activity size={21} />}</span>
      <span className="science-feedback-copy"><strong>{saved ? tr('Check recupero salvato') : tr('Come ti senti?')}</strong><span>{saved ? tr('Il tuo feedback per il prossimo allenamento') : tr('Apri il quiz di recupero · circa 30 secondi')}</span></span>
      <ChevronRight size={18} className="science-entry-arrow" />
    </button>
    {open && <Sheet title={tr('Quiz recupero')} onClose={() => setOpen(false)} footer={<div className="science-feedback-footer">
      <button type="button" className="science-feedback-skip" onClick={next}>{tr('Salta')}</button>
      <button type="button" className="ej-btn ej-btn--primary" onClick={next}>{step < total - 1 ? tr('Continua') : tr('Salva check')}{step < total - 1 ? <ArrowRight size={16} /> : <Check size={16} />}</button>
    </div>}>
      <div className="science-quiz-topline"><span>{muscle ? tr('Recupero muscolare') : tr('Il tuo recupero')}</span><span>{step + 1} / {total}</span></div>
      <div className="science-feedback-progress"><span style={{ width: `${(step + 1) / total * 100}%` }} /></div>
      <div className={muscle ? 'science-quiz-muscle' : 'science-quiz-icon'}>{muscle ? <><span className="science-quiz-muscle-icon"><Sparkles size={24} /></span><div><small>{tr('IL MUSCOLO DI QUESTA DOMANDA')}</small><strong>{tr(muscle)}</strong></div></> : step === 0 ? <Moon size={25} /> : <Activity size={25} />}</div>
      <h3 className="science-quiz-question">{question}</h3><p className="science-sheet-intro">{description}</p>
      <div className="science-quiz-answers">{options.map(([id, text]) => <button type="button" key={String(id)} aria-pressed={value === id} className={value === id ? 'is-selected' : ''} onClick={() => choose(id)}><span>{text}</span><span className="science-answer-check">{value === id && <Check size={15} />}</span></button>)}</div>
      {step > 0 && <button type="button" className="science-quiz-back" onClick={() => setStep(s => s - 1)}><ArrowLeft size={14} />{tr('Domanda precedente')}</button>}
    </Sheet>}
  </>;
}

export function ScienceWorkoutFeedback({ workout }) {
  const science = useStore(s => s.scienceState);
  const enabled = useStore(s => s.showScience && scienceTrackingEnabled(s));
  const custom = useStore(s => s.customExercises);
  const overrides = useStore(s => s.exerciseOverrides);
  const save = useStore(s => s.saveScienceFeedback);
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  if (!enabled || !workout) return null;
  const muscles = [...new Set((workout.exercises || []).filter(e => e.sets?.some(s => s.done)).map(ex => classifyScienceExercise(ex, db, science, workout.id).primary).filter(Boolean))];
  return <FeedbackForm key={workout.id} workout={workout} muscles={muscles} initial={science.feedback?.[workout.id]} onSave={save} />;
}
