import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { 
  RefreshCw, 
  Zap, 
  Target, 
  BookOpen, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Flame, 
  Trophy, 
  Info,
  Rocket,
  CalendarDays,
  Dna,
  Check
} from 'lucide-react';
import { getAllExercises, normalizeName } from '../../data/exercises';
import { 
  getScienceTargetForMuscle, 
  getSciencePhaseBadge, 
  getActualSetsForScienceWeek 
} from '../../utils/rpVolume';
import './Science.css';
import './BossFight.css';

const RP_BASE_LANDMARKS = {
  'Petto': { mev: 10, mav: 12, mrv: 20 },
  'Dorso': { mev: 10, mav: 14, mrv: 22 },
  'Quadricipiti': { mev: 8, mav: 12, mrv: 18 },
  'Femorali': { mev: 6, mav: 10, mrv: 16 },
  'Glutei': { mev: 0, mav: 8, mrv: 16 },
  'Polpacci': { mev: 8, mav: 12, mrv: 20 },
  'Spalle': { mev: 8, mav: 12, mrv: 22 },
  'Bicipiti': { mev: 8, mav: 10, mrv: 20 },
  'Tricipiti': { mev: 6, mav: 10, mrv: 18 },
  'Addome': { mev: 8, mav: 12, mrv: 20 }
};

const MUSCLE_GROUPS = Object.keys(RP_BASE_LANDMARKS);
const LEG_MUSCLES = ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'];

const QUESTIONS = [
  {
    id: 'gender',
    title: 'Qual è il tuo sesso biologico?',
    subtitle: 'Incide sulla tolleranza al volume (differenze SNC e tipi di fibre).',
    options: [
      { value: 'male', label: 'Uomo' },
      { value: 'female', label: 'Donna', desc: 'Le donne tollerano e necessitano di volumi leggermente superiori.' }
    ]
  },
  {
    id: 'legs',
    title: 'Vuoi allenare la parte inferiore in questo mesociclo?',
    subtitle: 'Include Quadricipiti, Femorali, Glutei e Polpacci.',
    options: [
      { value: 'yes', label: 'Sì, allena tutto il corpo (Full / Upper-Lower)' },
      { value: 'no', label: 'No, solo Upper Body', desc: 'Esclude carichi e obiettivi per le gambe.' }
    ]
  },
  {
    id: 'stats',
    title: 'Dati Corporei & Forza',
    subtitle: 'Usa massimali (1RM) reali o stimati.',
    type: 'inputs'
  },
  {
    id: 'focus1',
    title: 'Mese 1: Scegli fino a 3 muscoli per l\'Overreaching',
    subtitle: 'Quali muscoli vuoi far IMPLODERE nel primo mese?',
    isMulti: true,
    maxSelection: 3
  },
  {
    id: 'focus2',
    title: 'Mese 2: Scegli fino a 3 gruppi muscolari',
    subtitle: 'Dopo il primo mese, su cosa vuoi spingere? (Scegline max 3 diversi)',
    isMulti: true,
    maxSelection: 3
  },
  {
    id: 'daysPerWeek',
    title: 'Frequenza di Allenamento',
    subtitle: 'Quanti giorni ti alleni a settimana?',
    options: [
      { value: '2', label: '2 Giorni' },
      { value: '3', label: '3 Giorni' },
      { value: '4', label: '4 Giorni' },
      { value: '5', label: '5 Giorni' },
      { value: '6', label: '6 Giorni' }
    ]
  }
];

function determineStrengthLevel(bw, bench, squat, deadlift, gender, legsIncluded) {
  const mult = gender === 'female' ? 0.7 : 1.0;
  const bwVal = parseFloat(bw) || 80;
  const benchVal = parseFloat(bench) || 0;
  const benchRatio = bwVal > 0 ? benchVal / bwVal : 0;

  let points = 0;
  let liftsCount = 1;

  if (benchRatio >= 1.5 * mult) points += 2;
  else if (benchRatio >= 1.0 * mult) points += 1;

  if (legsIncluded) {
    const squatVal = parseFloat(squat) || 0;
    const dlVal = parseFloat(deadlift) || 0;

    if (squatVal > 0) {
      liftsCount++;
      const squatRatio = squatVal / bwVal;
      if (squatRatio >= 1.8 * mult) points += 2;
      else if (squatRatio >= 1.2 * mult) points += 1;
    }

    if (dlVal > 0) {
      liftsCount++;
      const dlRatio = dlVal / bwVal;
      if (dlRatio >= 2.0 * mult) points += 2;
      else if (dlRatio >= 1.5 * mult) points += 1;
    }
  }

  const avg = points / liftsCount;
  if (avg < 0.6) return 'beginner';
  if (avg < 1.5) return 'intermediate';
  return 'advanced';
}

/**
 * Schermata di attesa avvio: permette di scegliere quando far partire il mesociclo
 */
function PendingStartScreen({ report, reset }) {
  const startScienceMesocycle = useStore(state => state.startScienceMesocycle);
  const [startChoice, setStartChoice] = useState('today');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

  // Calcola prossimo lunedì
  const nextMonday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = (day === 0 ? 1 : 8 - day);
    d.setDate(d.getDate() + diff);
    return d;
  }, []);

  const handleStart = () => {
    let startTimestamp = Date.now();
    if (startChoice === 'next_monday') {
      startTimestamp = nextMonday.getTime();
    } else if (startChoice === 'custom' && customDate) {
      const parts = customDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      startTimestamp = d.getTime();
    }
    startScienceMesocycle(startTimestamp);
  };

  const expLabel = { 
    'beginner': 'Principiante', 
    'intermediate': 'Intermedio', 
    'advanced': 'Avanzato' 
  }[report.experienceLevel];

  const options = [
    { key: 'today', icon: Rocket, title: 'Inizia Subito (Oggi)', sub: 'Gli allenamenti di oggi conteranno per la W1' },
    { key: 'next_monday', icon: Calendar, title: 'Inizia Lunedì Prossimo', sub: nextMonday.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' }) },
    { key: 'custom', icon: CalendarDays, title: 'Scegli Data di Inizio', sub: 'Seleziona un giorno specifico' }
  ];

  return (
    <div className="ej-page sci-page">
      <div className="ej-glow" aria-hidden="true" />
      <header>
        <h1 className="ej-title">Scienza</h1>
        <p className="ej-eyebrow">Il tuo protocollo personalizzato</p>
      </header>

      <section className="ej-card sci-hero">
        <span className="sci-hero-icon"><Dna size={28} /></span>
        <h2 className="sci-hero-title">Protocollo Generato!</h2>
        <p className="sci-muted">Il tuo mesociclo di 12 settimane è pronto. Scegli quando farlo partire:</p>

        <div className="sci-chips">
          <span className="sci-chip">Livello: <strong>{expLabel}</strong></span>
          <span className="sci-chip is-primary">Frequenza: <strong>{report.daysPerWeek} gg/sett</strong></span>
          <span className="sci-chip is-streak">Mese 1 Focus: <strong>{(report.focus1 || []).join(', ')}</strong></span>
        </div>
      </section>

      <div className="sci-start-options">
        {options.map(({ key, icon, title, sub }) => {
          const Icon = icon;
          return (
          <button
            key={key}
            type="button"
            className={`sci-option ${startChoice === key ? 'is-selected' : ''}`}
            onClick={() => setStartChoice(key)}
          >
            <span className="sci-option-icon"><Icon size={18} /></span>
            <span className="sci-option-text">
              <strong>{title}</strong>
              <span>{sub}</span>
            </span>
            <span className="sci-option-check">{startChoice === key && <Check size={14} strokeWidth={3} />}</span>
          </button>
          );
        })}
      </div>

      {startChoice === 'custom' && (
        <label className="sci-field">
          <span className="sci-label">Data di partenza</span>
          <input
            type="date"
            value={customDate}
            onChange={e => setCustomDate(e.target.value)}
            className="sci-input"
          />
        </label>
      )}

      <button type="button" className="sci-cta" onClick={handleStart}>
        <Play size={18} fill="currentColor" /> Avvia Mesociclo W1
      </button>

      <button
        type="button"
        className="sci-link"
        onClick={() => {
          if (window.confirm("Vuoi modificare i dati del quiz?")) reset();
        }}
      >
        <RefreshCw size={14} /> Modifica parametri quiz
      </button>
    </div>
  );
}

/**
 * Schermata di mesociclo completato (dopo W12)
 */
function CompletedScreen({ reset }) {
  return (
    <div className="ej-page sci-page">
      <div className="ej-glow" aria-hidden="true" />
      <header>
        <h1 className="ej-title">Scienza</h1>
        <p className="ej-eyebrow">Il tuo protocollo personalizzato</p>
      </header>

      <section className="ej-card sci-hero sci-hero--done">
        <span className="sci-hero-icon is-gold"><Trophy size={30} /></span>
        <h2 className="sci-hero-title">Mesociclo Completato!</h2>
        <p className="sci-muted">
          Congratulazioni! Hai portato a termine tutte le <strong>12 settimane</strong> del protocollo Israetel.
        </p>
        <p className="sci-muted">
          La fase di risensibilizzazione è terminata: i tuoi recettori muscolari sono ora al <strong>massimo potenziale</strong> di risposta ipertrofica. È il momento ideale per testare i nuovi massimali e avviare un nuovo ciclo!
        </p>
        <button type="button" className="sci-cta is-gold" onClick={reset}>
          <RefreshCw size={18} /> Ricalcola Massimali &amp; Avvia Nuovo Ciclo
        </button>
      </section>
    </div>
  );
}

/**
 * Dashboard Principale della Sezione Scienza
 */
function Dashboard({ report, reset }) {
  const currentWeekNum = report.currentWeek || 1;
  const advanceScienceWeek = useStore(state => state.advanceScienceWeek);

  // Forecasting State
  const [selectedWeek, setSelectedWeek] = useState(currentWeekNum);
  const weekToDisplay = selectedWeek;

  // Carica storico ed esercizi
  const history = useStore(state => state.history);
  const customExercises = useStore(state => state.customExercises || []);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
  const allExercisesDB = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);

  // Calcola serie reali per la settimana selezionata usando l'helper centralizzato (zero overlap)
  const actualSetsForSelectedWeek = useMemo(() => {
    return getActualSetsForScienceWeek(history, allExercisesDB, report, weekToDisplay);
  }, [history, allExercisesDB, report, weekToDisplay]);

  // Mese della settimana visualizzata
  const displayedMonth = weekToDisplay <= 4 ? 1 : (weekToDisplay <= 8 ? 2 : 3);
  // Mese reale attivo
  const realCurrentMonth = currentWeekNum <= 4 ? 1 : (currentWeekNum <= 8 ? 2 : 3);

  const isBossFight = weekToDisplay === 4 || weekToDisplay === 8;

  const expLabel = { 
    'beginner': 'Principiante', 
    'intermediate': 'Intermedio', 
    'advanced': 'Avanzato' 
  }[report.experienceLevel];

  // Identifica i muscoli in focus per la settimana visualizzata
  const focusMuscles = displayedMonth === 1 ? (report.focus1 || []) : (displayedMonth === 2 ? (report.focus2 || []) : []);

  // Ordina i muscoli: prima quelli in focus, poi il mantenimento.
  // Esclude i muscoli che hanno 0 serie da fare (es. Glutei per gli uomini) a meno che non vi siano serie registrate
  const visibleMuscles = useMemo(() => {
    const all = Object.keys(report.baseLandmarks || {});
    return all.filter(muscle => {
      const targetSets = getScienceTargetForMuscle(report, muscle, weekToDisplay);
      const actualSets = actualSetsForSelectedWeek[muscle] || 0;
      return targetSets > 0 || actualSets > 0;
    }).sort((a, b) => {
      const aFocus = focusMuscles.includes(a);
      const bFocus = focusMuscles.includes(b);
      if (aFocus && !bFocus) return -1;
      if (!aFocus && bFocus) return 1;
      return a.localeCompare(b);
    });
  }, [report.baseLandmarks, focusMuscles, report, weekToDisplay, actualSetsForSelectedWeek]);

  const handleAdvanceWeek = () => {
    const msg = currentWeekNum >= 12
      ? "Sei alla Settimana 12. Concludere il mesociclo archivierà le 12 settimane e completerà il programma. Confermi?"
      : `Sei sicuro di voler concludere la Settimana ${currentWeekNum} e passare alla Settimana ${currentWeekNum + 1}? I volumi di questa settimana verranno archiviati.`;

    if (window.confirm(msg)) {
      advanceScienceWeek();
      if (currentWeekNum < 12) {
        setSelectedWeek(currentWeekNum + 1);
      }
    }
  };

  const getWeekLabels = () => {
    const arr = [];
    for (let i = 1; i <= 12; i++) arr.push(i);
    return arr;
  };

  // Stima serie medie per seduta sui muscoli focus (Anti-Junk Volume rule)
  const focusTargetSample = focusMuscles.length > 0 ? getScienceTargetForMuscle(report, focusMuscles[0], weekToDisplay) : 12;
  const sessionsPerWeek = report.daysPerWeek || 4;
  const estimatedSetsPerSession = Math.round(focusTargetSample / (sessionsPerWeek > 3 ? 2 : 1));

  const phaseOf = (w) => {
    if (w >= 9 && w <= 10) return { cls: 'deload', label: 'Deload' };
    if (w >= 11) return { cls: 'resens', label: 'Mant.' };
    if (w === 4 || w === 8) return { cls: 'bossfight', label: 'Boss' };
    return { cls: 'overreaching', label: 'Focus' };
  };

  return (
    <div className="ej-page sci-page">
      <div className="ej-glow" aria-hidden="true" />
      <header>
        <h1 className="ej-title">Scienza</h1>
        <p className="ej-eyebrow">Il tuo protocollo personalizzato</p>
      </header>

      {/* Report header */}
      <section className="ej-card sci-report">
        <h2 className="sci-report-title">Mesociclo Israetel V2</h2>
        <p className="sci-muted">Status Coefficiente Forza: <strong>{expLabel}</strong></p>
        <button
          type="button"
          className="sci-small-btn"
          onClick={() => {
            if (window.confirm("Attenzione: reimpostare il quiz cancellerà il mesociclo attivo. Vuoi davvero procedere?")) {
              reset();
            }
          }}
        >
          <RefreshCw size={14} /> Ricalcola parametri
        </button>
      </section>

      {/* Summary */}
      <div className="sci-summary">
        <div className="ej-card sci-summary-card">
          <span className="sci-kicker">Settimana attiva</span>
          <span className="sci-summary-value is-primary">W{currentWeekNum} <small>/ 12</small></span>
        </div>
        <div className="ej-card sci-summary-card">
          <span className="sci-kicker">Mese in corso</span>
          <span className="sci-summary-value">Mese {realCurrentMonth} <small>/ 3</small></span>
        </div>
      </div>

      {/* Manual week progression */}
      {selectedWeek === currentWeekNum && (
        <button type="button" className="sci-advance" onClick={handleAdvanceWeek}>
          <CheckCircle2 size={18} />
          {currentWeekNum >= 12
            ? 'Concludi Mesociclo (Settimana 12)'
            : `Concludi Settimana ${currentWeekNum} & Passa alla W${currentWeekNum + 1}`}
        </button>
      )}

      {/* Week selector */}
      <div className="sci-week-nav">
        <button
          type="button"
          className="sci-week-arrow"
          onClick={() => setSelectedWeek(prev => Math.max(1, prev - 1))}
          disabled={selectedWeek === 1}
          aria-label="Settimana precedente"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="sci-week-center">
          <span className="sci-kicker">{selectedWeek === currentWeekNum ? 'In corso' : 'Proiezione'}</span>
          <strong className={selectedWeek === currentWeekNum ? 'is-current' : ''}>Settimana {selectedWeek} · Mese {displayedMonth}</strong>
        </div>
        <button
          type="button"
          className="sci-week-arrow"
          onClick={() => setSelectedWeek(prev => Math.min(12, prev + 1))}
          disabled={selectedWeek === 12}
          aria-label="Settimana successiva"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Weekly targets */}
      <section className={`ej-card sci-targets ${isBossFight ? 'is-boss' : ''}`}>
        <h3 className="sci-targets-title">
          <Target size={18} />
          {isBossFight ? 'Boss Fight: Settimana MRV' : `Obiettivi Settimana ${selectedWeek}`}
        </h3>

        {isBossFight && (
          <p className="sci-boss-note">
            <AlertTriangle size={14} /> Raggiungi il Massimo Volume Recuperabile. Cedimento tecnico completo su ogni serie!
          </p>
        )}

        <div className="sci-muscles">
          {visibleMuscles.map(muscle => {
            const targetSets = getScienceTargetForMuscle(report, muscle, weekToDisplay);
            const actualSets = actualSetsForSelectedWeek[muscle] || 0;
            const isFocus = focusMuscles.includes(muscle);
            const badge = getSciencePhaseBadge(report, muscle, weekToDisplay, targetSets);
            const isCompleted = actualSets >= targetSets && targetSets > 0;
            const percent = Math.min(100, Math.round((actualSets / Math.max(1, targetSets)) * 100));

            return (
              <div
                key={muscle}
                className={`sci-muscle ${isFocus ? 'is-focus' : ''} ${isCompleted ? 'is-done' : ''}`}
              >
                <div className="sci-muscle-head">
                  <div className="sci-muscle-name">
                    <span>{muscle}</span>
                    {isFocus && <span className="sci-badge is-focus"><Flame size={10} fill="currentColor" /> Focus</span>}
                    {badge && (
                      <span className="sci-badge" style={{ color: badge.color, backgroundColor: badge.bg }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="sci-muscle-count">
                    <strong>{actualSets}</strong>
                    <span> / {targetSets} serie</span>
                  </div>
                </div>

                <div className="sci-track">
                  <span style={{ width: `${percent}%` }} />
                </div>

                {isCompleted && (
                  <span className="sci-done-pill"><CheckCircle2 size={12} /> Target completato</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="sci-footnote">Questi obiettivi sono sincronizzati nel Workout Recap.</p>
      </section>

      {/* Periodization calendar */}
      <section className="sci-section">
        <h2 className="ej-section-title">Calendario Periodizzazione</h2>
        <div className="sci-calendar">
          {getWeekLabels().map(w => {
            const isPast = w < currentWeekNum;
            const isCurrent = w === currentWeekNum;
            const isSelected = w === selectedWeek;
            const phase = phaseOf(w);

            return (
              <button
                type="button"
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`sci-cal-week ${phase.cls} ${isCurrent ? 'is-current' : ''} ${isPast ? 'is-past' : ''} ${isSelected ? 'is-selected' : ''}`}
              >
                <span className="sci-cal-num">W{w}</span>
                <span className="sci-cal-phase">{phase.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sci-legend">
          <span><i className="overreaching" /> Overreaching Focus</span>
          <span><i className="bossfight" /> Boss Fight (MRV)</span>
          <span><i className="deload" /> Deload (Scarico)</span>
          <span><i className="resens" /> Mantenimento Basso</span>
        </div>
      </section>

      {/* Glossary */}
      <section className="ej-card sci-glossary">
        <h3 className="sci-glossary-title"><BookOpen size={18} /> Pillole RP &amp; Consigli</h3>
        <dl>
          <dt>MEV</dt>
          <dd>Minimum Effective Volume. Le serie minime per crescere. Target del mantenimento.</dd>
          <dt>MAV</dt>
          <dd>Maximum Adaptive Volume. Sweet Spot. Iniziamo il mese Focus qua e saliamo gradualmente.</dd>
          <dt>MRV</dt>
          <dd>Maximum Recoverable Volume. Il limite di recupero. Si tocca a fine mese e poi si cambia target.</dd>
          <dt>Anti-Junk</dt>
          <dd>Con {sessionsPerWeek} giorni a settimana, distribuisci i muscoli in focus su 2 sedute (~{estimatedSetsPerSession} serie a seduta). Evita di superare 8-10 serie sullo stesso muscolo in una singola sessione per massimizzare la qualità dello stimolo.</dd>
        </dl>
      </section>
    </div>
  );
}

function Science() {
  const scienceReport = useStore(state => state.scienceReport);
  const saveScienceReport = useStore(state => state.saveScienceReport);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    gender: null,
    legs: null,
    stats: { bw: '', bench: '', squat: '', deadlift: '' },
    focus1: [],
    focus2: [],
    daysPerWeek: null
  });

  const history = useStore(state => state.history);

  // Auto-fill 1RM stats from history con matching robusto
  useEffect(() => {
    if (step === 2 && history.length > 0) {
      const best1RMs = {
        bench: 0,
        squat: 0,
        deadlift: 0
      };

      const calculate1RM = (w, r) => {
        const weight = parseFloat(w);
        const reps = parseInt(r, 10);
        if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
        if (reps === 1) return weight;
        return weight * (1 + reps / 30);
      };

      history.forEach(workout => {
        (workout.exercises || []).forEach(ex => {
          const norm = normalizeName(ex.name);
          let type = '';
          if (norm.includes('panca piana') && norm.includes('bilanciere')) type = 'bench';
          else if (norm.includes('squat') && (norm.includes('bilanciere') || norm.includes('back squat'))) type = 'squat';
          else if (norm.includes('stacc') && norm.includes('terra')) type = 'deadlift';

          if (type) {
            (ex.sets || []).forEach(s => {
              if (s.done) {
                const rm = calculate1RM(s.kg, s.reps);
                if (rm > best1RMs[type]) {
                  best1RMs[type] = rm;
                }
              }
            });
          }
        });
      });

      setAnswers(prev => {
        const newStats = { ...prev.stats };
        let changed = false;

        if (!newStats.bench && best1RMs.bench > 0) {
          newStats.bench = Math.round(best1RMs.bench).toString();
          changed = true;
        }
        if (prev.legs === 'yes') {
          if (!newStats.squat && best1RMs.squat > 0) {
            newStats.squat = Math.round(best1RMs.squat).toString();
            changed = true;
          }
          if (!newStats.deadlift && best1RMs.deadlift > 0) {
            newStats.deadlift = Math.round(best1RMs.deadlift).toString();
            changed = true;
          }
        }

        return changed ? { ...prev, stats: newStats } : prev;
      });
    }
  }, [step, history]);

  const handleSelect = (qId, value, isMulti, maxSelection) => {
    if (isMulti) {
      setAnswers(prev => {
        const current = prev[qId] || [];
        if (current.includes(value)) {
          return { ...prev, [qId]: current.filter(v => v !== value) };
        } else if (current.length < maxSelection) {
          return { ...prev, [qId]: [...current, value] };
        }
        return prev;
      });
    } else {
      setAnswers(prev => ({ ...prev, [qId]: value }));
    }
  };

  const handleNext = () => {
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      generateReport();
    }
  };

  const generateReport = () => {
    const bw = parseFloat(answers.stats.bw) || 80;
    const bench = parseFloat(answers.stats.bench) || 0;
    const squat = parseFloat(answers.stats.squat) || 0;
    const deadlift = parseFloat(answers.stats.deadlift) || 0;
    const legsIncluded = answers.legs === 'yes';
    
    const level = determineStrengthLevel(bw, bench, squat, deadlift, answers.gender, legsIncluded);

    const availableMuscles = legsIncluded ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !LEG_MUSCLES.includes(m));

    const finalLandmarks = availableMuscles.reduce((acc, m) => {
      const b = RP_BASE_LANDMARKS[m];
      if (!b) return acc;
      
      let mev = b.mev;
      let mav = b.mav;
      let mrv = b.mrv;

      if (answers.gender === 'female') {
        mev += 1;
        mrv += 2;
        mav += 1;
      }

      if (level === 'beginner') {
        mav -= 2;
        mrv += 1;
      } else if (level === 'advanced') {
        mav += 2;
        mrv -= 2;
      }

      acc[m] = { 
        mev: Math.max(0, mev), 
        mav: Math.max(0, mav), 
        mrv: Math.max(0, mrv) 
      };
      return acc;
    }, {});

    const cleanFocus1 = (answers.focus1 || []).filter(m => finalLandmarks[m]);
    const cleanFocus2 = (answers.focus2 || []).filter(m => finalLandmarks[m]);

    // Se l'utente è uomo e non ha inserito i Glutei tra i focus, rimuovili dai landmarks
    if (answers.gender === 'male' && !cleanFocus1.includes('Glutei') && !cleanFocus2.includes('Glutei')) {
      delete finalLandmarks['Glutei'];
    }

    const report = {
      id: `meso-${Date.now()}`,
      timestamp: Date.now(),
      startDate: null,
      status: 'pending', // In attesa che l'utente scelga quando iniziare!
      currentWeek: 1,
      currentWeekStartDate: null,
      weekHistory: {},
      gender: answers.gender,
      inputStats: answers.stats,
      experienceLevel: level,
      legsIncluded,
      focus1: cleanFocus1,
      focus2: cleanFocus2,
      baseLandmarks: finalLandmarks,
      daysPerWeek: parseInt(answers.daysPerWeek, 10) || 4
    };

    saveScienceReport(report);
  };

  const resetQuiz = () => {
    saveScienceReport(null);
    setStep(0);
    setAnswers({
      gender: null,
      legs: null,
      stats: { bw: '', bench: '', squat: '', deadlift: '' },
      focus1: [],
      focus2: [],
      daysPerWeek: null
    });
  };

  // Se c'è un report:
  if (scienceReport) {
    if (scienceReport.status === 'pending') {
      return <PendingStartScreen report={scienceReport} reset={resetQuiz} />;
    }
    if (scienceReport.status === 'completed') {
      return <CompletedScreen reset={resetQuiz} />;
    }
    return <Dashboard report={scienceReport} reset={resetQuiz} />;
  }

  // Quiz Form
  const currentQ = QUESTIONS[step] || QUESTIONS[0];
  
  let isNextDisabled = false;
  
  if (currentQ.type === 'inputs') {
    const s = answers.stats;
    if (answers.legs === 'no') {
      isNextDisabled = !s.bw || !s.bench;
    } else {
      isNextDisabled = !s.bw || !s.bench || !s.squat || !s.deadlift;
    }
  } else {
    let displayOptions = currentQ.options;
    if (!displayOptions) {
      let available = answers.legs === 'yes' ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !LEG_MUSCLES.includes(m));
      // Se l'utente è uomo, escludi i Glutei dalle opzioni dei focus (MEV = 0)
      if (answers.gender === 'male') {
        available = available.filter(m => m !== 'Glutei');
      }
      const filtered = currentQ.id === 'focus2' ? available.filter(m => !(answers.focus1 || []).includes(m)) : available;
      displayOptions = filtered.map(m => ({ value: m, label: m, desc: '' }));
    }

    const currentAnswer = answers[currentQ.id];
    isNextDisabled = currentQ.isMulti 
      ? (currentAnswer ? currentAnswer.length : 0) === 0 
      : !currentAnswer;
  }

  // Campi per la domanda 3 (stats)
  const inputFields = [
    { id: 'bw', label: 'Peso Corporeo (kg)', placeholder: 'Es. 80' },
    { id: 'bench', label: 'Massimale Panca Piana (kg)', placeholder: 'Es. 100' }
  ];

  if (answers.legs === 'yes') {
    inputFields.push(
      { id: 'squat', label: 'Massimale Squat (kg)', placeholder: 'Es. 140' },
      { id: 'deadlift', label: 'Massimale Stacco (kg)', placeholder: 'Es. 160' }
    );
  }

  const quizOptions = currentQ.options || (answers.legs === 'yes' ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !LEG_MUSCLES.includes(m)))
    .filter(m => currentQ.id === 'focus2' ? !(answers.focus1 || []).includes(m) : true)
    .map(m => ({ value: m, label: m }));
  const selectedCount = currentQ.isMulti ? (answers[currentQ.id] || []).length : 0;

  return (
    <div className="ej-page sci-page">
      <div className="ej-glow" aria-hidden="true" />
      <header>
        <h1 className="ej-title">Scienza</h1>
        <p className="ej-eyebrow">L'algoritmo di Periodizzazione</p>
      </header>

      <div className="sci-quiz-progress">
        <div className="sci-quiz-progress-head">
          <span>Domanda {step + 1} di {QUESTIONS.length}</span>
          <span>{Math.round(((step + 1) / QUESTIONS.length) * 100)}%</span>
        </div>
        <div className="sci-quiz-segments">
          {QUESTIONS.map((q, i) => <span key={q.id} className={i <= step ? 'is-on' : ''} />)}
        </div>
      </div>

      <div className="sci-quiz-step" key={step}>
        <div className="sci-question">
          <h2>{currentQ.title}</h2>
          {currentQ.subtitle && <p>{currentQ.subtitle}</p>}
        </div>

        {currentQ.isMulti && (
          <span className="sci-count-pill">{selectedCount} / {currentQ.maxSelection} selezionati</span>
        )}

        {currentQ.type === 'inputs' ? (
          <div className="sci-inputs">
            {inputFields.map(f => (
              <label className="sci-field" key={f.id}>
                <span className="sci-label">{f.label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={f.placeholder}
                  value={answers.stats[f.id] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, stats: { ...prev.stats, [f.id]: e.target.value } }))}
                  className="sci-input"
                />
              </label>
            ))}
          </div>
        ) : (
          <div className={`sci-answers ${currentQ.isMulti ? 'is-grid' : ''}`}>
            {quizOptions.map(opt => {
              const isSelected = currentQ.isMulti
                ? (answers[currentQ.id] || []).includes(opt.value)
                : answers[currentQ.id] === opt.value;
              const isLocked = currentQ.isMulti && !isSelected && selectedCount >= currentQ.maxSelection;

              return (
                <button
                  type="button"
                  key={opt.value}
                  className={`sci-answer ${isSelected ? 'is-selected' : ''} ${isLocked ? 'is-locked' : ''}`}
                  onClick={() => handleSelect(currentQ.id, opt.value, currentQ.isMulti, currentQ.maxSelection)}
                >
                  <span className="sci-answer-text">
                    <strong>{opt.label}</strong>
                    {opt.desc && <span>{opt.desc}</span>}
                  </span>
                  <span className="sci-answer-check">{isSelected && <Check size={14} strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="sci-quiz-controls">
          {step > 0 && (
            <button type="button" className="sci-quiz-btn is-back" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={16} /> Indietro
            </button>
          )}
          <button
            type="button"
            className="sci-quiz-btn is-next"
            disabled={isNextDisabled}
            onClick={handleNext}
          >
            {step === QUESTIONS.length - 1 ? 'Genera Programma' : 'Avanti'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Science;
