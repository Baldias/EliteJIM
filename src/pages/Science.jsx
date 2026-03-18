import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { RefreshCw, Zap, Target, BookOpen, Calendar, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import './Science.css';
import './BossFight.css';

const RP_BASE_LANDMARKS = {
  'Petto': { mev: 10, mav: 12, mrv: 20 },
  'Dorso': { mev: 10, mav: 14, mrv: 22 },
  'Quadricipiti': { mev: 8, mav: 12, mrv: 18 },
  'Femorali': { mev: 6, mav: 10, mrv: 16 },
  'Glutei': { mev: 0, mav: 8, mrv: 16 },
  'Spalle': { mev: 8, mav: 12, mrv: 22 },
  'Bicipiti': { mev: 8, mav: 10, mrv: 20 },
  'Tricipiti': { mev: 6, mav: 10, mrv: 18 },
  'Polpacci': { mev: 8, mav: 12, mrv: 20 }
};

const MUSCLE_GROUPS = Object.keys(RP_BASE_LANDMARKS);

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
    id: 'stats',
    title: 'Dati Corporei & Forza',
    subtitle: 'Usa massimali (1RM) reali o stimati.',
    type: 'inputs',
    fields: [
      { id: 'bw', label: 'Peso Corporeo (kg)', placeholder: 'Es. 80' },
      { id: 'bench', label: 'Massimale Panca Piana (kg)', placeholder: 'Es. 100' },
      { id: 'squat', label: 'Massimale Squat (kg)', placeholder: 'Es. 140' },
      { id: 'deadlift', label: 'Massimale Stacco (kg)', placeholder: 'Es. 160' }
    ]
  },
  {
    id: 'legs',
    title: 'Vuoi includere le GAMBE in questo mesociclo?',
    options: [
      { value: 'yes', label: 'Sì, voglio allenarle' },
      { value: 'no', label: 'No, solo Upper Body', desc: 'Esclude Glutei, Femorali, Quadricipiti e Polpacci.' }
    ]
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

function determineStrengthLevel(bw, bench, squat, deadlift, gender) {
  // Approximate strength standards ratios (Men)
  // Beginner: Bench < 1.0x, Squat < 1.2x, DL < 1.5x
  // Intermediate: Bench 1.0-1.5x, Squat 1.2-1.8x, DL 1.5-2.0x
  // Advanced: Bench > 1.5x, Squat > 1.8x, DL > 2.0x
  // Women standards are generally ~60-70% of men's ratios
  
  const mult = gender === 'female' ? 0.7 : 1.0;
  let points = 0; // 0=Beginner, 1=Intermediate, 2=Advanced

  const benchRatio = bench / bw;
  const squatRatio = squat / bw;
  const dlRatio = deadlift / bw;

  if (benchRatio >= 1.5 * mult) points += 2;
  else if (benchRatio >= 1.0 * mult) points += 1;

  if (squatRatio >= 1.8 * mult) points += 2;
  else if (squatRatio >= 1.2 * mult) points += 1;

  if (dlRatio >= 2.0 * mult) points += 2;
  else if (dlRatio >= 1.5 * mult) points += 1;

  const avg = points / 3;
  if (avg < 0.6) return 'beginner';
  if (avg < 1.5) return 'intermediate';
  return 'advanced';
}

function Dashboard({ report, reset }) {
  if (!report) return null;

  // Calculate current week (1 to 12)
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.floor((Date.now() - report.timestamp) / MS_PER_WEEK);
  const currentWeekNum = Math.min(Math.max(1, weeksElapsed + 1), 12); // Bound 1-12
  
  // Forecasting State
  const [selectedWeek, setSelectedWeek] = useState(currentWeekNum);
  const weekToDisplay = selectedWeek;

  let currentMonth = 1;
  if (weekToDisplay > 4 && weekToDisplay <= 8) currentMonth = 2;
  if (weekToDisplay > 8) currentMonth = 3;

  const isBossFight = weekToDisplay === 4 || weekToDisplay === 8;

  const expLabel = { 
    'beginner': 'Principiante', 
    'intermediate': 'Intermedio', 
    'advanced': 'Avanzato' 
  }[report.experienceLevel];

  // Helper to get exactly how many sets we need THIS week for a specific muscle
  const getTargetForMuscle = (muscle) => {
    const lm = report.baseLandmarks[muscle];
    if (!lm) return 0;
    
    // Mesocycle 3 (Weeks 9-12) is resensitization/deload
    if (currentMonth === 3) {
      if (weekToDisplay === 9 || weekToDisplay === 10) return Math.max(0, lm.mev - 2); // Deload
      return lm.mev; // Back to MEV to retain
    }

    // Determine if it's currently focused
    const isFocus = (currentMonth === 1 && report.focus1.includes(muscle)) || 
                    (currentMonth === 2 && report.focus2.includes(muscle));
    
    if (!isFocus) {
      // Maintenance
      return lm.mev;
    }

    // It's in focus. We span from MAV to MRV over 4 weeks.
    // Week relative to the month (1, 2, 3, 4)
    const relativeWeek = weekToDisplay - ((currentMonth - 1) * 4);
    
    // Total series to add across the 4 weeks
    // Target calc logic
    const gap = lm.mrv - lm.mav;
    const weeklyIncrement = gap / 3;
    let target = lm.mav + (weeklyIncrement * (relativeWeek - 1));
    return Math.round(target);
  };

  const getPhaseBadge = (muscle, targetSets) => {
    const lm = report.baseLandmarks[muscle];
    if (!lm) return null;

    if (currentMonth === 3 && (weekToDisplay === 9 || weekToDisplay === 10)) {
      return { label: 'Deload', color: '#34c759', bg: 'rgba(52, 199, 89, 0.15)' };
    }

    if (targetSets <= lm.mev) {
      return { label: 'MEV', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
    }
    if (targetSets >= lm.mrv) {
      return { label: 'MRV', color: '#ff3b30', bg: 'rgba(255, 59, 48, 0.15)' };
    }

    // Between MAV and MRV
    if (Math.abs(targetSets - lm.mav) < Math.abs(targetSets - lm.mrv)) {
      return { label: 'MAV', color: '#ff9500', bg: 'rgba(255, 149, 0, 0.15)' };
    } else {
      return { label: 'Overreach', color: '#ff2d55', bg: 'rgba(255, 45, 85, 0.15)' };
    }
  };

  const getWeekLabels = () => {
    const arr = [];
    for(let i = 1; i <= 12; i++) arr.push(i);
    return arr;
  };

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <h1>Scienza</h1>
          <p className="subtitle">Il tuo protocollo personalizzato</p>
        </div>
      </header>
      
      <main className="app-main">
        <div className="science-container" style={{ animation: 'none' }}>
          
          <div className="report-header">
            <h2>Il tuo Mesociclo V2</h2>
            <p style={{ color: 'var(--text-muted)' }}>Status Coefficiente Forza: <strong>{expLabel}</strong></p>
            <button className="reset-btn" onClick={() => reset()}>
              <RefreshCw size={14} /> Ricalcola parametri
            </button>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Mese Stimato</span>
              <span className="summary-value" style={{ fontSize: '1.4rem' }}>{currentMonth} <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>/ 3</span></span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Settimana Attuale</span>
              <span className="summary-value" style={{ fontSize: '1.4rem', color: 'var(--primary-color)' }}>{currentWeekNum} <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>/ 12</span></span>
            </div>
          </div>

          {/* Forecasting Week Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              onClick={() => setSelectedWeek(prev => Math.max(1, prev - 1))}
              disabled={selectedWeek === 1}
              style={{ background: 'transparent', border: 'none', color: selectedWeek === 1 ? 'var(--text-muted)' : 'var(--primary-color)', cursor: selectedWeek === 1 ? 'not-allowed' : 'pointer' }}>
              <ChevronLeft size={24} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proiezione</span>
              <strong style={{ fontSize: '1.2rem', color: selectedWeek === currentWeekNum ? 'var(--text-main)' : 'var(--primary-color)' }}>
                Settimana {selectedWeek}
              </strong>
            </div>
            <button 
              onClick={() => setSelectedWeek(prev => Math.min(12, prev + 1))}
              disabled={selectedWeek === 12}
              style={{ background: 'transparent', border: 'none', color: selectedWeek === 12 ? 'var(--text-muted)' : 'var(--primary-color)', cursor: selectedWeek === 12 ? 'not-allowed' : 'pointer' }}>
              <ChevronRight size={24} />
            </button>
          </div>

          <div className={`card glass target-card ${isBossFight ? 'boss-fight' : ''}`} style={{ marginBottom: '2rem', borderColor: isBossFight ? '#ff3b30' : 'var(--primary-color)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: isBossFight ? '#ff3b30' : 'var(--text-main)', fontSize: '1.1rem', fontWeight: '800' }}>
              <Target size={18} color={isBossFight ? '#ff3b30' : "var(--primary-color)"} />
              {isBossFight ? "BOSS FIGHT: Settimana MRV" : `Obiettivi Settimana ${selectedWeek}`}
            </h3>
            
            {isBossFight && (
              <p style={{ color: '#ff3b30', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: '600', animation: 'pulse 2s infinite' }}>
                <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>
                Raggiungi il Massimo Volume Recuperabile. Usa tutto lo sforzo che hai.
              </p>
            )}

            <div className="focus-list">
              {Object.keys(report.baseLandmarks).map(muscle => {
                const targetSets = getTargetForMuscle(muscle);
                const isFocus = (currentMonth === 1 && report.focus1.includes(muscle)) || 
                                (currentMonth === 2 && report.focus2.includes(muscle));
                const badge = getPhaseBadge(muscle, targetSets);
                                
                return (
                  <div key={muscle} className="focus-item" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px', alignItems: 'center' }}>
                    <span className="focus-item-label" style={{ color: isFocus ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: isFocus ? '600' : 'normal', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {muscle}
                      {badge && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', color: badge.color, backgroundColor: badge.bg, textTransform: 'uppercase' }}>
                          {badge.label}
                        </span>
                      )}
                    </span>
                    <span className="focus-item-value" style={{ color: isFocus ? 'var(--primary-color)' : 'var(--text-main)', fontSize: '1.1rem' }}>
                      {targetSets} serie
                    </span>
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
              Questi obiettivi sono sincronizzati nel tuo Profilo.
            </p>
          </div>

          <div className="card glass" style={{ marginBottom: '2rem', borderColor: 'rgba(255,255,255,0.05)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>
              I Tuoi Landmark Base (Limiti Scientifici)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {Object.entries(report.baseLandmarks).map(([muscle, lm]) => (
                <div key={muscle} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--primary-color)', textAlign: 'center' }}>{muscle}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '2px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}><span>MEV:</span> <strong>{lm.mev}</strong></div>
                    <div style={{display: 'flex', justifyContent: 'space-between', color: '#ff9500', paddingBottom: '2px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}><span>MAV:</span> <strong>{lm.mav}</strong></div>
                    <div style={{display: 'flex', justifyContent: 'space-between', color: '#ff3b30'}}><span>MRV:</span> <strong>{lm.mrv}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>


          <h3 style={{ margin: '1rem 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>Calendario Periodizzazione</h3>
          
          <div className="calendar-grid">
            {getWeekLabels().map(w => {
              const isPast = w < currentWeekNum;
              const isCurrent = w === currentWeekNum;
              const isSelected = w === selectedWeek;
              
              let typeClass = 'maintenance';
              if (w >= 9 && w <= 10) typeClass = 'deload';
              else if (w >= 11) typeClass = 'resens';
              else if (w === 4 || w === 8) typeClass = 'bossfight';
              else typeClass = 'overreaching';

              return (
                <div 
                  key={w} 
                  onClick={() => setSelectedWeek(w)}
                  className={`cal-week ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${typeClass} ${isSelected ? 'selected-week' : ''}`}
                  style={{ cursor: 'pointer', outline: isSelected ? '2px solid white' : 'none', outlineOffset: '2px' }}
                >
                  <span className="cal-week-num">W{w}</span>
                </div>
              )
            })}
          </div>

          <div className="calendar-legend">
            <div><span className="dot overreaching"></span> Overreaching Focus</div>
            <div><span className="dot bossfight"></span> Boss Fight (MRV)</div>
            <div><span className="dot deload"></span> Deload (Scarico)</div>
            <div><span className="dot resens"></span> Mantenimento Basso</div>
          </div>

          <div className="glossary-section" style={{ marginTop: '2rem' }}>
            <div className="glossary-title"><BookOpen size={18} /> Pillole RP</div>
            <div className="glossary-items">
              <div className="glossary-item">
                <span>MEV:</span>
                <span>Minimum Effective Volume. Le serie minime per crescere. Target del mantenimento.</span>
              </div>
              <div className="glossary-item">
                <span>MAV:</span>
                <span>Maximum Adaptive Volume. Sweet Spot. Iniziamo il mese Focus qua e saliamo gradualmente.</span>
              </div>
              <div className="glossary-item">
                <span>MRV:</span>
                <span>Maximum Recoverable Volume. Il limite di recupero. Si tocca a fine mese e poi si cambia target.</span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}

function Science() {
  const scienceReport = useStore(state => state.scienceReport);
  const saveScienceReport = useStore(state => state.saveScienceReport);
  const initializeMuscleXP = useStore(state => state.initializeMuscleXP);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    gender: null,
    stats: { bw: '', bench: '', squat: '', deadlift: '' },
    legs: null,
    focus1: [],
    focus2: [],
    daysPerWeek: null
  });

  const history = useStore(state => state.history);

  // Auto-fill 1RM stats from history
  useEffect(() => {
    if (step === 1 && history.length > 0) {
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
        workout.exercises.forEach(ex => {
          let type = '';
          if (ex.name === 'Panca Piana Bilanciere') type = 'bench';
          else if (ex.name === 'Squat con Bilanciere') type = 'squat';
          else if (ex.name === 'Stacchi da Terra (Deadlift)') type = 'deadlift';

          if (type) {
            ex.sets.forEach(s => {
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
        // Only update if current values are empty to avoid overwriting user manual tweaks
        const newStats = { ...prev.stats };
        let changed = false;

        if (!newStats.bench && best1RMs.bench > 0) {
          newStats.bench = Math.round(best1RMs.bench).toString();
          changed = true;
        }
        if (!newStats.squat && best1RMs.squat > 0) {
          newStats.squat = Math.round(best1RMs.squat).toString();
          changed = true;
        }
        if (!newStats.deadlift && best1RMs.deadlift > 0) {
          newStats.deadlift = Math.round(best1RMs.deadlift).toString();
          changed = true;
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
    // 1. Determine Level dynamically
    const bw = parseFloat(answers.stats.bw) || 80;
    const bench = parseFloat(answers.stats.bench) || 0;
    const squat = parseFloat(answers.stats.squat) || 0;
    const deadlift = parseFloat(answers.stats.deadlift) || 0;
    
    const level = determineStrengthLevel(bw, bench, squat, deadlift, answers.gender);

    // 2. Adjust MEV/MAV/MRV based on Level & Gender
    // Females generally need +1 MEV and can tolerate +2 MRV due to CNS fatigue differences
    // Beginners need less MAV, but MRV is higher relative to their MAV (they recover from total sets easier since load is absolutely lighter)
    // Advanced need more MAV to stimulate, but MRV ceiling is lower (loads are absolutely very high)
    
      const availableMuscles = answers.legs === 'yes' ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'].includes(m));

      const finalLandmarks = availableMuscles.reduce((acc, m) => {
        let b = RP_BASE_LANDMARKS[m];
        
        // Safety check if base landmarks unexpectedly fail
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
          mav -= 2; // Needs less to grow
          mrv += 1; // Can tolerate more sets because absolute load is low
        } else if (level === 'advanced') {
          mav += 2; // Needs more stimulus to grow
          mrv -= 2; // Can't tolerate as many sets because absolute load destroys CNS
        }

        acc[m] = { 
          mev: Math.max(0, mev), 
          mav: Math.max(0, mav), 
          mrv: Math.max(0, mrv) 
        };
        return acc;
      }, {});

      // Sanity check: Ensure if legs='no', they are ABSOLUTELY excluded from final focus arrays to prevent ghost targets
      const cleanFocus1 = answers.focus1.filter(m => finalLandmarks[m]);
      const cleanFocus2 = answers.focus2.filter(m => finalLandmarks[m]);

      const report = {
        timestamp: Date.now(),
        gender: answers.gender,
        inputStats: answers.stats,
        experienceLevel: level,
        legsIncluded: answers.legs === 'yes',
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
      stats: { bw: '', bench: '', squat: '', deadlift: '' },
      legs: null,
      focus1: [],
      focus2: [],
      daysPerWeek: null
    });
  };

  if (scienceReport) {
    return <Dashboard report={scienceReport} reset={resetQuiz} />;
  }

  const currentQ = QUESTIONS[step] || QUESTIONS[0];
  
  let isNextDisabled = false;
  
  if (currentQ.type === 'inputs') {
    // Validate inputs
    const s = answers.stats;
    isNextDisabled = !s.bw || !s.bench || !s.squat || !s.deadlift;
  } else {
    // Standard validation
    let displayOptions = currentQ.options;
    if (!displayOptions) {
      const available = answers.legs === 'yes' ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'].includes(m));
      const filtered = currentQ.id === 'focus2' ? available.filter(m => !(answers.focus1 || []).includes(m)) : available;
      displayOptions = filtered.map(m => ({ value: m, label: m, desc: '' }));
    }

    const currentAnswer = answers[currentQ.id];
    isNextDisabled = currentQ.isMulti 
      ? (currentAnswer ? currentAnswer.length : 0) === 0 // At least 1 to max N
      : !currentAnswer;
  }

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <h1>Scienza</h1>
          <p className="subtitle">L'algoritmo di Periodizzazione</p>
        </div>
      </header>

      <main className="app-main">
        <div className="science-container">
          <div className="quiz-header">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Passo {step + 1} di {QUESTIONS.length}</span>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="quiz-step" key={step}>
            <h2 className="question-text">{currentQ.title}</h2>
            {currentQ.subtitle && <p style={{ textAlign: 'center', color: '#ccc', marginBottom: '1rem', marginTop: '-0.5rem', fontSize: '0.9rem' }}>{currentQ.subtitle}</p>}

            {currentQ.type === 'inputs' ? (
              <div className="inputs-grid">
                {currentQ.fields.map(f => (
                  <div className="input-field" key={f.id}>
                    <label>{f.label}</label>
                    <input 
                      type="number" 
                      inputMode="decimal"
                      placeholder={f.placeholder}
                      value={answers.stats[f.id]}
                      onChange={(e) => setAnswers(prev => ({ ...prev, stats: { ...prev.stats, [f.id]: e.target.value } }))}
                      className="science-input"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="answers-grid">
                {(currentQ.options || (answers.legs === 'yes' ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'].includes(m))).filter(m => currentQ.id === 'focus2' ? !answers.focus1.includes(m) : true).map(m => ({ value: m, label: m }))).map(opt => {
                  const isSelected = currentQ.isMulti 
                    ? (answers[currentQ.id] || []).includes(opt.value)
                    : answers[currentQ.id] === opt.value;
                    
                  return (
                    <div 
                      key={opt.value}
                      className={`answer-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(currentQ.id, opt.value, currentQ.isMulti, currentQ.maxSelection)}
                    >
                      <div className="answer-title">
                        {opt.label}
                        {isSelected && <Zap size={18} color="var(--primary-color)" />}
                      </div>
                      {opt.desc && <div className="answer-desc">{opt.desc}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="quiz-controls">
              {step > 0 ? (
                <button className="quiz-btn back" onClick={() => setStep(step - 1)}>
                  Indietro
                </button>
              ) : <div></div>}
              
              <button 
                className="quiz-btn next" 
                disabled={isNextDisabled}
                onClick={handleNext}
              >
                {step === QUESTIONS.length - 1 ? 'Genera Programma' : 'Avanti'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default Science;
