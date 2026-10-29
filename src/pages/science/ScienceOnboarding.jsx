import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CalendarCheck, CalendarClock, History, Check, Dna, Layers, Target, TrendingUp } from 'lucide-react';
import { useScienceStore as useStore } from '../../store/scienceContext';
import { Sheet } from '../monitoring/Sheet';
import { ScienceSwitch } from '../../components/ScienceTraining';
import { SCIENCE_MUSCLES, OPTIONAL_MUSCLES, createScienceProgram, emptyScienceState } from '../../utils/scienceV3';
import { getAllExercises } from '../../data/exercises';
import { useScienceClock } from '../../hooks/useScienceClock';
import CalendarDateField from '../../components/CalendarDateField';
import ScienceHistoryReview from './ScienceHistoryReview';
import { scienceBackfillWorkouts } from '../../utils/scienceBackfill';
import MicroLoading from '../../components/MicroLoading';
import { useMicroTransition } from '../../hooks/useMicroTransition';
import { localScienceDate, nextScienceMonday } from '../../utils/sciencePlanning';

const LEVELS = [['beginner', 'Principiante', 'Costruiamo una base solida, su tutto il corpo.'], ['intermediate', 'Intermedio', 'Volume progressivo e priorità più precise.'], ['advanced', 'Avanzato', 'Accumulo verso la fascia alta, se recuperi bene.']];

export default function ScienceSetup({ onStarted, onCancel, repeat = false }) {
  const transition = useMicroTransition(850);
  const science = useStore(s => s.scienceState);
  const previous = repeat ? null : science?.profile;
  const history = useStore(s => s.history);
  const legacy = useStore(s => s.scienceReport);
  const savedSex = useStore(s => s.nutritionGoals?.profile?.sex);
  const custom = useStore(s => s.customExercises);
  const overrides = useStore(s => s.exerciseOverrides);
  const now = useScienceClock();
  const db = useMemo(() => getAllExercises(custom, overrides), [custom, overrides]);
  const start = useStore(s => repeat ? s.restartScienceV3 : s.startScienceV3);
  const [open, setOpen] = useState(repeat);
  const [dateChoice, setDateChoice] = useState('today');
  const [historicalRir, setHistoricalRir] = useState({});
  const close = () => { if (!transition.busy) { setOpen(false); onCancel?.(); } };
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({ experience: 'beginner', gender: ['male','female'].includes(legacy?.gender) ? legacy.gender : ['male','female'].includes(savedSex) ? savedSex : '', daysPerWeek: 4, minutesPerSession: 60, goal: 'balanced', priorities: [], optionalMuscles: [], useWeight: false, ...previous, startDate: localScienceDate(now) }));
  const field = (key, value) => setForm(f => ({ ...f, [key]: value, ...(key === 'gender' && value === 'male' ? {priorities:f.priorities.filter(m=>m!=='Glutei')} : {}) }));
  const toggle = (key, muscle, max) => setForm(f => {
    const removing = f[key].includes(muscle);
    const selection = removing ? f[key].filter(m => m !== muscle) : f[key].length < max ? [...f[key], muscle] : f[key];
    const next = { ...f, [key]: selection };
    if (key === 'optionalMuscles' && removing) next.priorities = f.priorities.filter(m => m !== muscle);
    return next;
  });
  const specialization = form.goal === 'specialization';
  const activeMuscles = SCIENCE_MUSCLES.filter(m => (form.gender !== 'male' || m !== 'Glutei') && (!OPTIONAL_MUSCLES.includes(m) || form.optionalMuscles.includes(m)));
  const valid = step === 0 ? Boolean(form.gender) : step === 2 ? Number(form.minutesPerSession) >= 15 && Number(form.minutesPerSession) <= 240 : ![4, 7].includes(step) || !specialization || form.priorities.length > 0;
  const preview = useMemo(() => createScienceProgram({ ...form, priorities: form.goal === 'balanced' ? [] : form.priorities, startDate: new Date(`${form.startDate || localScienceDate(now)}T00:00:00`).getTime(), minutesPerSession: Math.min(240, Math.max(15, Math.round(Number(form.minutesPerSession) || 60))) }, history, db, science || emptyScienceState(), legacy, now).program, [form, history, db, science, legacy, now]);
  const selectedStart = new Date(`${form.startDate}T00:00:00`).getTime();
  const pastStart = form.startDate < localScienceDate(now);
  const previousWorkouts = useMemo(() => scienceBackfillWorkouts(history, db, science || emptyScienceState(), selectedStart, now), [history, db, science, selectedStart, now]);
  const titles = ['Da dove parti?', 'Quanti giorni ti alleni?', 'Quanto dura una seduta?', 'Qual è il tuo obiettivo?', specialization ? 'Su cosa vuoi puntare?' : 'Crescita su tutto il corpo.', 'Quando cominciamo?', 'Vuoi aggiungere qualcosa?', 'Il tuo prossimo blocco.'];
  const subtitles = ['Scegli il livello che descrive il tuo allenamento attuale.', 'La tua disponibilità reale, senza una split obbligatoria.', 'Il tempo ci aiuta a proporti un volume gestibile.', 'Scegli la direzione. Agli esercizi pensi tu.', specialization ? 'Fino a tre priorità. Gli altri distretti partono dalla base di crescita. Nelle ultime due settimane potrai ridistribuirne parte del lavoro.' : 'Partiamo dal MAV basso della tabella, adattato alle sedute disponibili: massimo 20 serie per seduta.', 'Il mesociclo segue settimane di calendario dalla data scelta.', 'Sono tutte opzioni facoltative.', 'Controlla la partenza prima di iniziare.'];
  const answers = (options, key) => <div className="science-quiz-answers">{options.map(([id, label, description]) => <button type="button" key={id} className={form[key] === id ? 'is-selected' : ''} aria-pressed={form[key] === id} onClick={() => field(key, id)}><span>{label}{description && <small>{description}</small>}</span><span className="science-answer-check">{form[key] === id && <Check size={15} />}</span></button>)}</div>;
  const finish = () => transition.run(() => { start({ ...form, historicalRir, startDate: new Date(`${form.startDate}T00:00:00`).getTime() }, now); setOpen(false); onStarted?.(); });
  return <>
    {!repeat && <section className="ej-card sv3-setup-intro">
      <span className="sv3-intro-icon"><Dna size={26} /></span>
      <p className="sv3-eyebrow">IL TUO PROSSIMO MESOCICLO</p>
      <h2>Sblocca il tuo potenziale.<br />E non tornerai più indietro.</h2>
      <p>Prova il coach di allenamento ingegnerizzato per raggiungere il tuo limite.</p>
      <div className="sv3-intro-facts"><span><Target size={15} /><strong>Fissa</strong><small>Obiettivi scientifici.</small></span><span><Layers size={15} /><strong>Sfida</strong><small>Il tuo limite.</small></span><span><TrendingUp size={15} /><strong>Cresci</strong><small>Come non mai</small></span></div>
      <button type="button" className="ej-btn ej-btn--primary sv3-start-quiz" onClick={() => { setStep(0); setOpen(true); }}>Crea il tuo programma<ArrowRight size={17} /></button>
      <small>Un breve quiz per scegliere il punto di partenza.</small>
    </section>}
    {open && <Sheet title="Il tuo programma" onClose={close} full footer={<div className="science-feedback-footer">
      <button type="button" className="science-feedback-skip" disabled={transition.busy} onClick={() => step > 0 ? setStep(s => s - 1) : close()}>{step > 0 ? <><ArrowLeft size={14} />Indietro</> : 'Più tardi'}</button>
      <button type="button" className="ej-btn ej-btn--primary" disabled={transition.busy || !valid || !form.startDate} onClick={() => step < 7 ? setStep(s => s + 1) : finish()}>{transition.busy ? 'Preparo il programma…' : step === 7 ? repeat ? 'Conferma nuovo blocco' : 'Inizia mesociclo' : 'Continua'}{step === 7 ? <Check size={16} /> : <ArrowRight size={16} />}</button>
    </div>}>
      {transition.error && <p role="alert">{transition.error}</p>}
      {transition.busy ? <MicroLoading title={repeat ? 'Ricalcolo il tuo protocollo' : 'Preparo il tuo primo mesociclo'} /> : <>
      <div className="science-quiz-topline"><span>Scienza · 0–1 RIR</span><span>{step + 1} / 8</span></div>
      <div className="science-feedback-progress"><span style={{ width: `${(step + 1) / 8 * 100}%` }} /></div>
      <h3 className="science-quiz-question">{titles[step]}</h3><p className="science-sheet-intro">{subtitles[step]}</p>
      {step === 0 && <>{answers(LEVELS, 'experience')}<h4>Il tuo profilo</h4>{answers([['male','Uomo','I glutei sono esclusi dal budget delle serie.'],['female','Donna','Include il lavoro diretto per i glutei.'],['unspecified','Preferisco non indicarlo','Include tutti i distretti.']], 'gender')}</>}
      {step === 1 && <div className="sv3-number-choices">{[1, 2, 3, 4, 5, 6, 7].map(n => <button type="button" key={n} aria-pressed={Number(form.daysPerWeek) === n} onClick={() => field('daysPerWeek', n)}><strong>{n}</strong><span>{n === 1 ? 'giorno' : 'giorni'}</span></button>)}</div>}
      {step === 2 && <><div className="sv3-duration-choices">{[30, 45, 60, 75, 90, 120].map(n => <button type="button" key={n} aria-pressed={Number(form.minutesPerSession) === n} onClick={() => field('minutesPerSession', n)}><strong>{n}</strong><span>minuti</span></button>)}</div><label className="sv3-quiz-field">Oppure indica i tuoi minuti<input aria-label="Minuti personalizzati" type="number" min="15" max="240" value={form.minutesPerSession} onChange={e => field('minutesPerSession', e.target.value)} /></label></>}
      {step === 3 && answers([['balanced', 'Crescita generale', form.experience === 'beginner' ? 'Consigliata per il tuo livello.' : 'Facciamo crescere tutti i distretti.'], ['specialization', 'Priorità mirate', 'Concentriamo il lavoro su alcuni muscoli.']], 'goal')}
      {step === 4 && (specialization ? <><div className="sv3-priority-picker">{activeMuscles.map(m => <button type="button" key={m} aria-pressed={form.priorities.includes(m)} disabled={!form.priorities.includes(m) && form.priorities.length >= 3} onClick={() => toggle('priorities', m, 3)}><span>{m}</span>{form.priorities.includes(m) ? <Check size={15} /> : <span className="sv3-priority-circle" />}</button>)}</div><p className="sv3-quiz-note">{form.priorities.length} / 3 selezionate</p></> : <div className="sv3-balanced-list">{activeMuscles.map(m => <span key={m}><Check size={13} />{m}</span>)}</div>)}
      {step === 5 && <>
        <div className="science-quiz-answers sv3-date-choices">{[
          ['today', 'Oggi', 'Partiamo subito.', CalendarCheck],
          ['monday', 'Prossimo lunedì', new Date(`${nextScienceMonday(now)}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }), CalendarClock],
          ['past', 'Ho già iniziato', 'Scegli un giorno passato e includi le serie già fatte.', History],
          ['custom', 'Un giorno specifico', 'Una data passata o futura.', CalendarDays],
        ].map(([id, label, description, icon]) => { const Icon = icon; return <button type="button" key={id} aria-pressed={dateChoice === id} className={dateChoice === id ? 'is-selected' : ''} onClick={() => { setDateChoice(id); if (id === 'past' && form.startDate > localScienceDate(now)) field('startDate', localScienceDate(now)); if (id === 'today' || id === 'monday') field('startDate', id === 'today' ? localScienceDate(now) : nextScienceMonday(now)); }}><Icon size={21} /><span>{label}<small>{description}</small></span><span className="science-answer-check">{dateChoice === id && <Check size={15} />}</span></button>; })}</div>
        {['custom', 'past'].includes(dateChoice) && <CalendarDateField value={form.startDate} max={dateChoice === 'past' ? localScienceDate(now) : undefined} onChange={value => field('startDate', value)} />}
        {pastStart && <p className="sv3-quiz-note">Includiamo le serie registrate da questa data. Le serie contano anche senza RIR; puoi aggiungere lo sforzo nel riepilogo finale. Se sono già passati sette giorni, la prima settimana resta aperta finché scegli tu di avanzare.</p>}
      </>}
      {step === 6 && <div className="sv3-extras">{OPTIONAL_MUSCLES.map(m => <ScienceSwitch key={m} label={`Allena anche ${m.toLowerCase()}`} checked={form.optionalMuscles.includes(m)} onChange={() => toggle('optionalMuscles', m, 2)} />)}<ScienceSwitch label="Tendenza del peso" description="Usa le pesate del Diario come contesto per la massa" checked={form.useWeight} onChange={value => field('useWeight', value)} /></div>}
      {step === 7 && <div className="sv3-quiz-recap">{repeat && <p className="sv3-quiz-note">Confermando inizierai un nuovo mesociclo. Quello attuale sarà archiviato; storico, annotazioni e XP vengono conservati.</p>}<p className="sv3-quiz-note">Partenza: {new Date(`${form.startDate}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>{specialization && !form.priorities.length && <p className="sv3-quiz-note">Torna alle priorità e seleziona almeno un distretto attivo.</p>}<div className="sv3-quiz-recap-stats"><span><strong>{LEVELS.find(l => l[0] === form.experience)?.[1]}</strong><small>Il tuo livello</small></span><span><strong>{form.daysPerWeek} × {form.minutesPerSession}′</strong><small>Alla settimana</small></span></div><ScienceHistoryReview workouts={previousWorkouts} choices={historicalRir} onChange={setHistoricalRir} /><h4>{specialization ? 'Le tue priorità' : 'La tua base di crescita'}</h4>{(specialization ? form.priorities : activeMuscles).map(m => <div className="sv3-quiz-dose" key={m}><span>{m}</span><strong>{preview.targets[m]}<small> serie</small></strong></div>)}{specialization && <p className="sv3-quiz-note">Base di crescita nelle prime due settimane: {activeMuscles.filter(m => !form.priorities.includes(m)).join(', ')}.</p>}{preview.timeWarning && <p className="sv3-quiz-note">{preview.timeWarning}</p>}<p className="sv3-quiz-note">{specialization ? 'I distretti fuori priorità conservano la base. Sui target la progressione prosegue anche con stanchezza lieve; i segnali marcati possono fermare gli aumenti.' : `Partenza dal MAV basso, entro ${Number(form.daysPerWeek) * 20} serie settimanali. Recupero e andamento dei carichi guidano gli aumenti e la distribuzione. Se il budget non basta, riduciamo prima polpacci, addome e femorali, anche sotto MEV se necessario.`}</p></div>}
    </>}
    </Sheet>}
  </>;
}
