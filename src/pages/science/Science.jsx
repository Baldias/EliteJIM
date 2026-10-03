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
  Info 
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

  return (
    <div className="science-container">
      <div className="pending-start-container">
        <div className="pending-hero-card">
          <Zap size={36} color="var(--primary-color)" style={{ marginBottom: '8px' }} />
          <h2>Protocollo Generato! 🧬</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 auto 1.5rem', maxWidth: '340px' }}>
            Il tuo mesociclo di 12 settimane è pronto. Scegli quando farlo partire:
          </p>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: '20px', color: 'white' }}>
              Livello: <strong>{expLabel}</strong>
            </span>
            <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(0, 126, 167, 0.2)', borderRadius: '20px', color: 'var(--primary-color)' }}>
              Frequenza: <strong>{report.daysPerWeek} gg/sett</strong>
            </span>
            <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(255, 149, 0, 0.15)', borderRadius: '20px', color: '#ff9500' }}>
              Mese 1 Focus: <strong>{(report.focus1 || []).join(', ')}</strong>
            </span>
          </div>

          <div className="pending-options">
            <button 
              type="button"
              className={`pending-option-btn ${startChoice === 'today' ? 'selected' : ''}`}
              onClick={() => setStartChoice('today')}
            >
              <div>
                <strong style={{ display: 'block', color: 'var(--text-main)' }}>🚀 Inizia Subito (Oggi)</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Gli allenamenti di oggi conteranno per la W1</span>
              </div>
              {startChoice === 'today' && <CheckCircle2 size={20} color="var(--primary-color)" />}
            </button>

            <button 
              type="button"
              className={`pending-option-btn ${startChoice === 'next_monday' ? 'selected' : ''}`}
              onClick={() => setStartChoice('next_monday')}
            >
              <div>
                <strong style={{ display: 'block', color: 'var(--text-main)' }}>📅 Inizia Lunedì Prossimo</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {nextMonday.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
              </div>
              {startChoice === 'next_monday' && <CheckCircle2 size={20} color="var(--primary-color)" />}
            </button>

            <button 
              type="button"
              className={`pending-option-btn ${startChoice === 'custom' ? 'selected' : ''}`}
              onClick={() => setStartChoice('custom')}
            >
              <div>
                <strong style={{ display: 'block', color: 'var(--text-main)' }}>🗓️ Scegli Data di Inizio</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Seleziona un giorno specifico</span>
              </div>
              {startChoice === 'custom' && <CheckCircle2 size={20} color="var(--primary-color)" />}
            </button>
          </div>

          {startChoice === 'custom' && (
            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Data di Partenza:</label>
              <input 
                type="date" 
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="science-input"
                style={{ width: '100%' }}
              />
            </div>
          )}

          <button className="start-meso-btn" onClick={handleStart}>
            <Play size={20} /> Avvia Mesociclo W1
          </button>

          <button 
            type="button"
            className="reset-btn" 
            onClick={() => {
              if (window.confirm("Vuoi modificare i dati del quiz?")) reset();
            }}
            style={{ marginTop: '1.2rem' }}
          >
            <RefreshCw size={14} /> Modifica parametri quiz
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Schermata di mesociclo completato (dopo W12)
 */
function CompletedScreen({ reset }) {
  return (
    <div className="science-container">
      <div className="completed-container">
        <div className="completed-hero-card">
          <Trophy size={60} color="#ffcc00" style={{ filter: 'drop-shadow(0 0 16px rgba(255,204,0,0.5))' }} />
          <h2>Mesociclo Completato! 🎉</h2>
          <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.6, margin: '1rem 0 1.8rem' }}>
            Congratulazioni! Hai portato a termine tutte le <strong>12 settimane</strong> del protocollo Israetel.
            <br /><br />
            La fase di risensibilizzazione è terminata: i tuoi recettori muscolari sono ora al <strong>massimo potenziale</strong> di risposta ipertrofica. È il momento ideale per testare i nuovi massimali e avviare un nuovo ciclo!
          </p>

          <button 
            className="start-meso-btn" 
            style={{ background: '#ffcc00', color: 'black' }}
            onClick={reset}
          >
            <RefreshCw size={20} color="black" /> Ricalcola Massimali & Avvia Nuovo Ciclo
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard Principale della Sezione Scienza
 */
function Dashboard({ report, reset }) {
  if (!report) return null;

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

  // Ordina i muscoli: prima quelli in focus, poi il mantenimento
  const sortedMuscles = useMemo(() => {
    const all = Object.keys(report.baseLandmarks || {});
    return all.sort((a, b) => {
      const aFocus = focusMuscles.includes(a);
      const bFocus = focusMuscles.includes(b);
      if (aFocus && !bFocus) return -1;
      if (!aFocus && bFocus) return 1;
      return a.localeCompare(b);
    });
  }, [report.baseLandmarks, focusMuscles]);

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

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <h1>Scienza</h1>
          <p className="subtitle">Il tuo protocollo personalizzato</p>
        </div>
      </header>
      
      <main className="app-main" style={{ paddingBottom: '120px' }}>
        <div className="science-container" style={{ animation: 'none' }}>
          
          <div className="report-header">
            <h2>Mesociclo Israetel V2</h2>
            <p style={{ color: 'var(--text-muted)' }}>Status Coefficiente Forza: <strong>{expLabel}</strong></p>
            <button 
              className="reset-btn" 
              onClick={() => {
                if (window.confirm("Attenzione: reimpostare il quiz cancellerà il mesociclo attivo. Vuoi davvero procedere?")) {
                  reset();
                }
              }}
            >
              <RefreshCw size={14} /> Ricalcola parametri
            </button>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Settimana Attiva</span>
              <span className="summary-value" style={{ color: 'var(--primary-color)' }}>
                W{currentWeekNum} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 12</span>
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Mese in Corso</span>
              <span className="summary-value">
                Mese {realCurrentMonth} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 3</span>
              </span>
            </div>
          </div>

          {/* Card Regola Anti-Junk Volume & Frequenza (Consiglio 4) */}
          <div className="anti-junk-card">
            <Info size={22} color="var(--primary-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p className="anti-junk-title">Frequenza: {sessionsPerWeek} Giorni / Settimana</p>
              <p className="anti-junk-desc">
                Distribuisci il volume dei muscoli in focus su <strong>2 sedute settimanali (~{estimatedSetsPerSession} serie a seduta)</strong>.
                <br />
                💡 <em>Regola RP: Evita di superare 8-10 serie sullo stesso muscolo in un unico allenamento per non generare Junk Volume.</em>
              </p>
            </div>
          </div>

          {/* Pulsante Avanzamento Settimanale Manuale */}
          {selectedWeek === currentWeekNum && (
            <button className="advance-week-btn" onClick={handleAdvanceWeek}>
              <CheckCircle2 size={20} />
              {currentWeekNum >= 12 
                ? "🏆 Concludi Mesociclo (Settimana 12)" 
                : `Concludi Settimana ${currentWeekNum} & Passa alla W${currentWeekNum + 1}`}
            </button>
          )}

          {/* Selettore Proiezione Settimanale */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              onClick={() => setSelectedWeek(prev => Math.max(1, prev - 1))}
              disabled={selectedWeek === 1}
              style={{ background: 'transparent', border: 'none', color: selectedWeek === 1 ? 'var(--text-muted)' : 'var(--primary-color)', cursor: selectedWeek === 1 ? 'not-allowed' : 'pointer' }}>
              <ChevronLeft size={24} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {selectedWeek === currentWeekNum ? 'In Corso' : 'Proiezione'}
              </span>
              <strong style={{ fontSize: '1.2rem', color: selectedWeek === currentWeekNum ? 'var(--primary-color)' : 'var(--text-main)' }}>
                Settimana {selectedWeek} (Mese {displayedMonth})
              </strong>
            </div>
            <button 
              onClick={() => setSelectedWeek(prev => Math.min(12, prev + 1))}
              disabled={selectedWeek === 12}
              style={{ background: 'transparent', border: 'none', color: selectedWeek === 12 ? 'var(--text-muted)' : 'var(--primary-color)', cursor: selectedWeek === 12 ? 'not-allowed' : 'pointer' }}>
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Scheda Obiettivi Settimanali con Barre di Progresso (Consiglio 6) */}
          <div className={`card glass target-card ${isBossFight ? 'boss-fight' : ''}`} style={{ marginBottom: '2rem', borderColor: isBossFight ? '#ff3b30' : 'var(--border-color)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: isBossFight ? '#ff3b30' : 'var(--text-main)', fontSize: '1.1rem', fontWeight: '800' }}>
              <Target size={20} color={isBossFight ? '#ff3b30' : "var(--primary-color)"} />
              {isBossFight ? "BOSS FIGHT: Settimana MRV" : `Obiettivi Settimana ${selectedWeek}`}
            </h3>
            
            {isBossFight && (
              <p style={{ color: '#ff3b30', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: '600', animation: 'pulse 2s infinite' }}>
                <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>
                Raggiungi il Massimo Volume Recuperabile. Cedimento tecnico completo su ogni serie!
              </p>
            )}

            <div className="muscle-cards-list">
              {sortedMuscles.map(muscle => {
                const targetSets = getScienceTargetForMuscle(report, muscle, weekToDisplay);
                const actualSets = actualSetsForSelectedWeek[muscle] || 0;
                const isFocus = focusMuscles.includes(muscle);
                const badge = getSciencePhaseBadge(report, muscle, weekToDisplay, targetSets);
                const isCompleted = actualSets >= targetSets && targetSets > 0;
                const percent = Math.min(100, Math.round((actualSets / Math.max(1, targetSets)) * 100));

                let barColor = isCompleted ? '#34c759' : 'var(--primary-color)';
                if (isFocus) barColor = isCompleted ? '#34c759' : '#ff9500';

                return (
                  <div 
                    key={muscle} 
                    className={`muscle-target-card ${isFocus ? 'is-focus' : ''} ${isCompleted ? 'is-completed' : ''}`}
                  >
                    <div className="muscle-card-header">
                      <div className="muscle-card-name">
                        <span>{muscle}</span>
                        {isFocus && (
                          <span className="focus-flame-badge">
                            🔥 FOCUS
                          </span>
                        )}
                        {badge && (
                          <span 
                            className="target-badge"
                            style={{ color: badge.color, backgroundColor: badge.bg }}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                      
                      <div className="muscle-sets-counter">
                        <strong style={{ color: isCompleted ? '#34c759' : (isFocus ? '#ff9500' : 'var(--text-main)') }}>
                          {actualSets}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> / {targetSets} serie</span>
                      </div>
                    </div>

                    {/* Progress Bar Fluida */}
                    <div className="target-progress-bar">
                      <div 
                        className="target-progress-fill"
                        style={{ 
                          width: `${percent}%`, 
                          background: barColor 
                        }}
                      />
                    </div>

                    {isCompleted && (
                      <div className="target-reached-pill">
                        <CheckCircle2 size={13} /> Target Completato
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1.2rem', textAlign: 'center' }}>
              Questi obiettivi sono sincronizzati nel tuo Profilo e nel Workout Recap.
            </p>
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
              );
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
      const available = answers.legs === 'yes' ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !LEG_MUSCLES.includes(m));
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

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <h1>Scienza</h1>
          <p className="subtitle">L'algoritmo di Periodizzazione</p>
        </div>
      </header>

      <main className="app-main" style={{ paddingBottom: '120px' }}>
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
                {inputFields.map(f => (
                  <div className="input-field" key={f.id}>
                    <label>{f.label}</label>
                    <input 
                      type="number" 
                      inputMode="decimal"
                      placeholder={f.placeholder}
                      value={answers.stats[f.id] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, stats: { ...prev.stats, [f.id]: e.target.value } }))}
                      className="science-input"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="answers-grid">
                {(currentQ.options || (answers.legs === 'yes' ? MUSCLE_GROUPS : MUSCLE_GROUPS.filter(m => !LEG_MUSCLES.includes(m))).filter(m => currentQ.id === 'focus2' ? !(answers.focus1 || []).includes(m) : true).map(m => ({ value: m, label: m }))).map(opt => {
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
