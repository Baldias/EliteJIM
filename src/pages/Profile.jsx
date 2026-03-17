import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Download, Upload, Calendar, Clock, Dumbbell, ChevronDown, ChevronUp, User, Settings as SettingsIcon, Target, Zap, Edit2, Trash2, X, Check } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { calculateLast7DaysVolume, getVolumeStatus, RP_LANDMARKS } from '../utils/rpVolume';
import { EXERCISES_DB } from '../data/exercises';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const history = useStore(state => state.history);
  const scienceReport = useStore(state => state.scienceReport);
  const deleteWorkout = useStore(state => state.deleteWorkout);
  const [expandedSessions, setExpandedSessions] = useState({});
  const [visibleWeeks, setVisibleWeeks] = useState(2);
  const [editingWorkout, setEditingWorkout] = useState(null);

  const saveEditedWorkout = () => {
    if (!editingWorkout) return;
    useStore.setState(state => ({
      history: state.history.map(w => w.id === editingWorkout.id ? editingWorkout : w)
    }));
    setEditingWorkout(null);
  };

  const handleExport = () => {
    const data = localStorage.getItem('elitejim-storage');
    if (!data) {
      alert("Nessun dato trovato da esportare.");
      return;
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EliteJIM_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsed = JSON.parse(content);
        if (!parsed.state) {
          alert("Il file non sembra essere un backup di EliteJIM valido.");
          return;
        }
        if (window.confirm("Attenzione: Importare questo file sovrascriverà tutte le tue schede e la cronologia attuali. Sei sicuro di voler procedere?")) {
          localStorage.setItem('elitejim-storage', JSON.stringify(parsed));
          window.location.reload();
        }
      } catch (err) {
        alert("Errore durante la lettura del file: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- History Logic ---
  const handleDelete = (e, workoutId) => {
    e.stopPropagation();
    if (window.confirm("Eliminare questa sessione?")) {
      deleteWorkout(workoutId);
    }
  };

  const toggleSession = (id) => {
    setExpandedSessions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatDuration = (start, end) => {
    if (!end) return '-';
    const diff = Math.round((end - start) / 60000);
    return `${diff} min`;
  };

  const calculateCompletedSets = (exercises) => {
    let sets = 0;
    exercises.forEach(ex => {
      ex.sets.forEach(s => { if (s.done) sets++; });
    });
    return sets;
  };

  const calculateOneRepMax = (weight, reps) => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    if (r === 1) return w;
    return w * (1 + r / 30);
  };

  const loadTestData = () => {
    if (!window.confirm("Attenzione: questo sovrascriverà il tuo storico attuale con dati di test. Sei sicuro?")) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Generate 12 workouts over the last 30 days (multiple weeks)
    const mockHistory = Array.from({ length: 15 }).map((_, i) => {
      const workoutTime = now - (30 - i * 2) * day; // Spread across several weeks
      const progressFactor = i * 2;

      return {
        id: `mock-w-${i}`,
        name: i % 2 === 0 ? 'Push Day' : 'Pull Day',
        startTime: workoutTime,
        endTime: workoutTime + 60 * 60 * 1000,
        exercises: [
          {
            id: `mock-ex-${i}`,
            name: i % 2 === 0 ? 'Panca Piana' : 'Trazioni',
            sets: [
              { id: 1, kg: String(60 + progressFactor), reps: '8', done: true }
            ]
          }
        ]
      };
    });

    useStore.setState({ history: mockHistory.reverse() });
    alert("Dati di test caricati!");
  };

  // --- Statistics Logic ---
  const stats = useMemo(() => {
    let totalWeight = 0;
    let totalSets = 0;
    
    history.forEach(workout => {
      workout.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          if (s.done) {
            totalSets++;
            totalWeight += (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0);
          }
        });
      });
    });

    return {
      workouts: history.length,
      volume: totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(1)}t` : `${totalWeight}kg`,
      sets: totalSets
    };
  }, [history]);

  // --- RP Volume Logic ---
  const rpVolumes = useMemo(() => {
    if (!history || history.length === 0) return null;
    return calculateLast7DaysVolume(history, EXERCISES_DB);
  }, [history]);

  const welcomePhrase = useMemo(() => {
    if (history.length === 0) return "Inizia la tua sfida";
    if (history.length < 5) return "Ottimo inizio, Campione";
    if (history.length < 20) return "Sei sulla strada giusta";
    return "Atleta d'Elite";
  }, [history.length]);

  // --- Scienza V2: Weekly Goals Logic ---
  const scienceGoals = useMemo(() => {
    if (!scienceReport) return null;

    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const weeksElapsed = Math.floor((now - scienceReport.timestamp) / MS_PER_WEEK);
    const currentWeek = Math.min(Math.max(1, weeksElapsed + 1), 12);
    
    // Calculate start of THIS biological week
    const startOfCurrentWeek = scienceReport.timestamp + (currentWeek - 1) * MS_PER_WEEK;

    let currentMonth = 1;
    if (currentWeek > 4 && currentWeek <= 8) currentMonth = 2;
    if (currentWeek > 8) currentMonth = 3;

    // Helper to calc target
    const getTargetForMuscle = (muscle) => {
      const lm = scienceReport.baseLandmarks[muscle];
      if (!lm) return null;

      if (currentMonth === 3) {
        if (currentWeek === 9 || currentWeek === 10) return Math.max(0, lm.mev - 2);
        return lm.mev;
      }

      const isFocus = (currentMonth === 1 && (scienceReport.focus1 || []).includes(muscle)) || 
                      (currentMonth === 2 && (scienceReport.focus2 || []).includes(muscle));
      
      if (!isFocus) return lm.mev;

      const relativeWeek = currentWeek - ((currentMonth - 1) * 4);
      const gap = lm.mrv - lm.mav;
      const weeklyIncrement = gap / 3;
      return Math.round(lm.mav + (weeklyIncrement * (relativeWeek - 1)));
    };

    // Gather sets done THIS week
    const setsDoneThisWeek = {};
    history.forEach(w => {
      if (w.startTime >= startOfCurrentWeek) {
        w.exercises.forEach(ex => {
          const foundEx = EXERCISES_DB.find(e => e.name === ex.name);
          const muscle = foundEx ? foundEx.category : null;
          
          if (muscle && scienceReport.baseLandmarks[muscle]) {
            setsDoneThisWeek[muscle] = (setsDoneThisWeek[muscle] || 0) + ex.sets.filter(s => s.done && !s.isDropset).length;
          }
        });
      }
    });

    // Build the goals array
    const goals = Object.keys(scienceReport.baseLandmarks).map(muscle => {
      const target = getTargetForMuscle(muscle);
      const done = setsDoneThisWeek[muscle] || 0;
      const isFocus = (currentMonth === 1 && (scienceReport.focus1 || []).includes(muscle)) || 
                      (currentMonth === 2 && (scienceReport.focus2 || []).includes(muscle));
      
      const lm = scienceReport.baseLandmarks[muscle];
      let badge = null;
      if (lm && target !== null) {
        if (currentMonth === 3 && (currentWeek === 9 || currentWeek === 10)) {
          badge = { label: 'Deload', color: '#34c759', bg: 'rgba(52, 199, 89, 0.15)' };
        } else if (target <= lm.mev) {
          badge = { label: 'MEV', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
        } else if (target >= lm.mrv) {
          badge = { label: 'MRV', color: '#ff3b30', bg: 'rgba(255, 59, 48, 0.15)' };
        } else {
          if (Math.abs(target - lm.mav) < Math.abs(target - lm.mrv)) {
            badge = { label: 'MAV', color: '#ff9500', bg: 'rgba(255, 149, 0, 0.15)' };
          } else {
            badge = { label: 'Overreach', color: '#ff2d55', bg: 'rgba(255, 45, 85, 0.15)' };
          }
        }
      }

      return { muscle, target, done, isFocus, badge };
    }).filter(g => g.target !== null).sort((a, b) => (b.isFocus ? 1 : 0) - (a.isFocus ? 1 : 0));

    return {
      currentWeek,
      startOfCurrentWeek,
      goals
    };
  }, [scienceReport, history]);

  // --- Journey Logic (Weekly Grouping) ---
  const groupedHistory = useMemo(() => {
    if (!history || history.length === 0) return [];

    const sorted = [...history].sort((a, b) => b.startTime - a.startTime);
    const groups = [];

    sorted.forEach(workout => {
      const date = new Date(workout.startTime);
      const day = date.getDay();
      const diff = date.getDate() - (day === 0 ? 6 : day - 1);
      const monday = new Date(new Date(workout.startTime).setDate(diff));
      monday.setHours(0, 0, 0, 0);

      const weekKey = monday.toISOString().split('T')[0];
      let group = groups.find(g => g.weekKey === weekKey);
      
      if (!group) {
        group = { 
          weekKey, 
          monday,
          workouts: [] 
        };
        groups.push(group);
      }
      group.workouts.push(workout);
    });

    return groups;
  }, [history]);

  const displayedGroups = groupedHistory.slice(0, visibleWeeks);

  const getWeekLabel = (monday) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Get this week's monday
    const currentDay = today.getDay();
    const currentDiff = today.getDate() - (currentDay === 0 ? 6 : currentDay - 1);
    const thisMonday = new Date(new Date().setDate(currentDiff));
    thisMonday.setHours(0,0,0,0);

    const diffWeeks = Math.round((thisMonday - monday) / (7 * 24 * 60 * 60 * 1000));

    if (diffWeeks === 0) return "Questa Settimana";
    if (diffWeeks === 1) return "Settimana Scorsa";
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return `${monday.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
  };

  return (
    <>
      <header className="app-header profile-header">
        <button 
          className="icon-btn settings-btn" 
          onClick={() => navigate('/settings')}
          style={{ position: 'absolute', top: 'max(1.5rem, env(safe-area-inset-top))', right: '1.5rem', color: '#fff', zIndex: 10 }}
        >
          <SettingsIcon size={24} />
        </button>
        <div className="header-content">
          <h1>Profilo</h1>
          <p className="subtitle">{welcomePhrase}</p>
        </div>
      </header>

      <main className="app-main" style={{ paddingBottom: '2rem' }}>
        {/* Stats Dashboard */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{stats.workouts}</span>
            <span className="stat-label">Workout</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.volume}</span>
            <span className="stat-label">Volume</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.sets}</span>
            <span className="stat-label">Serie</span>
          </div>
        </div>

        {/* Science Mesocycle Sync Section */}
        {scienceGoals && (
          <div style={{ marginTop: '2rem' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={24} color="var(--primary-color)" />
              <h2 className="section-title-premium" style={{ margin: 0 }}>
                Obiettivi W{scienceGoals.currentWeek}
              </h2>
            </div>
            
            <div className="card glass" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--primary-color)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                Progresso delle serie in base al tuo mesociclo scientifico.
              </p>
              
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {scienceGoals.goals.map(g => {
                  const percent = Math.min(100, Math.round((g.done / g.target) * 100)) || 0;
                  const isCompleted = g.done >= g.target;
                  let color = isCompleted ? '#34c759' : 'var(--primary-color)';
                  if (!g.isFocus) color = 'var(--text-muted)';
                  if (g.isFocus && isCompleted) color = '#34c759';

                  return (
                    <div key={g.muscle} style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      padding: '1rem', 
                      borderRadius: '16px',
                      border: `1px solid ${isCompleted ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255,255,255,0.05)'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', color: g.isFocus ? 'var(--text-main)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {g.muscle} 
                          {g.badge && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', color: g.badge.color, backgroundColor: g.badge.bg, textTransform: 'uppercase' }}>
                              {g.badge.label}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: color }}>
                          {g.done} / {g.target}
                        </span>
                      </div>
                      
                      <div style={{ width: '100%', height: '8px', background: 'var(--surface-color)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${percent}%`, 
                          background: color,
                          borderRadius: '4px',
                          transition: 'width 0.5s ease-out'
                        }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* RP Volume Section */}
        {rpVolumes && (
          <div style={{ marginTop: '2rem' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
              <h2 className="section-title-premium">
                Volume RP (Ultimi 7 Giorni)
              </h2>
            </div>
            <div className="card glass rp-volume-container" style={{ borderRadius: '24px', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                Serie completate negli ultimi 7 giorni rispetto ai landmark di Dr. Mike Israetel (MEV, MAV, MRV).
              </p>
              
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {Object.entries(rpVolumes).map(([category, sets]) => {
                  if (sets === 0) return null; // Nascondi muscoli non allenati
                  const status = getVolumeStatus(sets, category);
                  const landmarks = RP_LANDMARKS[category];
                  
                  // Calculate raw percentage for visual bar (cap at 120%)
                  const maxTarget = landmarks.MRV || landmarks.MAV_MAX || sets || 1;
                  const visualPercent = Math.min(120, (sets / maxTarget) * 100);

                  return (
                    <div key={category} className="rp-item" style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      padding: '1rem', 
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{category}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: status.color, background: `${status.color}20`, padding: '2px 8px', borderRadius: '12px' }}>
                          {sets} serie
                        </span>
                      </div>
                      
                      <div style={{ width: '100%', height: '8px', background: 'var(--surface-color)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${visualPercent}%`, 
                          background: status.color,
                          borderRadius: '4px',
                          transition: 'width 0.5s ease-out'
                        }}></div>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Stato: <strong style={{ color: status.color }}>{status.status}</strong></span>
                        <span>MRV: {landmarks.MRV}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {Object.values(rpVolumes).every(v => v === 0) && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', margin: '2rem 0' }}>
                  Nessuna serie registrata negli ultimi 7 giorni.
                </p>
              )}
            </div>
          </div>
        )}

        {/* History Section */}
        <div style={{ marginTop: '3rem' }}>
          <div className="section-header" style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-title-premium">
              Il Tuo Percorso
            </h2>
          </div>

          {(!history || history.length === 0) ? (
            <div className="card glass" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 2rem', borderRadius: '24px' }}>
              <p style={{ fontStyle: 'italic' }}>Ancora nessun passo registrato nel tuo percorso.</p>
            </div>
          ) : (
            <div className="journey-feed">
              {displayedGroups.map(group => (
                <div key={group.weekKey} className="week-group" style={{ marginBottom: '2.5rem' }}>
                  <div className="week-header" style={{ 
                    fontSize: '0.75rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.15em', 
                    color: 'var(--primary-color)', 
                    fontWeight: '800',
                    marginBottom: '1rem',
                    paddingLeft: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary-color)' }}></div>
                    {getWeekLabel(group.monday)}
                  </div>

                  <div className="history-container">
                    {group.workouts.map(workout => {
                      const isExpanded = expandedSessions[workout.id];
                      return (
                        <SwipeToDelete key={workout.id} onDelete={(e) => handleDelete(e, workout.id)}>
                          <div className={`history-card ${isExpanded ? 'active' : ''}`} onClick={() => toggleSession(workout.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div className="workout-title">{workout.name || 'Sessione Elite'}</div>
                                <div className="workout-date">
                                  {formatDate(workout.startTime)} • {formatDuration(workout.startTime, workout.endTime)}
                                </div>
                              </div>
                              <div className="expand-icon" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button className="edit-workout-btn" onClick={(e) => { e.stopPropagation(); setEditingWorkout(JSON.parse(JSON.stringify(workout))); }}>
                                  <Edit2 size={18} />
                                </button>
                                <button className="delete-workout-btn" onClick={(e) => handleDelete(e, workout.id)}>
                                  <Trash2 size={18} />
                                </button>
                                <div style={{ opacity: 0.5, display: 'flex' }}>
                                  {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                </div>
                              </div>
                            </div>

                            <div className="workout-pills">
                              <span className="stat-pill">{calculateCompletedSets(workout.exercises)} Serie Completate</span>
                            </div>

                            {isExpanded && (
                              <div className="history-details">
                                {workout.exercises.map(exercise => {
                                  const doneSets = exercise.sets.filter(s => s.done);
                                  if (doneSets.length === 0) return null;
                                  return (
                                    <div key={exercise.id} className="exercise-detail" style={{ marginBottom: '1rem' }}>
                                      <div className="ex-name">{exercise.name}</div>
                                      <div className="sets-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {doneSets.map((set, setIdx) => {
                                          const est1rm = calculateOneRepMax(set.kg, set.reps);
                                          return (
                                            <div key={set.id} className="set-item">
                                              <span className="set-num">S{setIdx + 1}</span>
                                              <span className="set-data">{set.kg}kg × {set.reps}</span>
                                              {est1rm && (
                                                <span className="set-rm">{est1rm.toFixed(0)}</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </SwipeToDelete>
                      );
                    })}
                  </div>
                </div>
              ))}

              {groupedHistory.length > visibleWeeks && (
                <button 
                  className="btn-show-more"
                  onClick={() => setVisibleWeeks(prev => prev + 1)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    color: 'var(--primary-color)',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    marginTop: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Mostra settimana precedente
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sync & Backup Section */}
        <div className="card glass data-management" style={{ borderRadius: '28px', marginTop: '2rem' }}>
          <h2 className="section-title-premium" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Sicurezza Dati</h2>
          <p className="description" style={{ marginBottom: '1.5rem', opacity: 0.7 }}>
            Mantieni i tuoi progressi al sicuro esportando il backup o sincronizzando un file esistente.
          </p>

          <div className="action-buttons" style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={handleExport} style={{ flex: 1, height: '54px', borderRadius: '16px' }}>
              <Upload size={20} /> Esporta
            </button>

            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, height: '54px', borderRadius: '16px' }}>
              <Download size={20} /> Importa
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>

          <button className="btn-ghost" onClick={loadTestData} style={{ marginTop: '1rem', height: '44px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
            Carica Dati Demo
          </button>
        </div>

        {/* Edit Workout Modal */}
        {editingWorkout && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            zIndex: 9999, padding: '1rem',
            overflowY: 'auto'
          }}>
            <div className="card glass" style={{ maxWidth: '600px', margin: '2rem auto', border: '1px solid var(--primary-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem' }}>Modifica {editingWorkout.name}</h3>
                <button onClick={() => setEditingWorkout(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={24} /></button>
              </div>

              {editingWorkout.exercises.map((ex, exIdx) => (
                <div key={ex.id} style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px' }}>
                  <div style={{ fontWeight: '600', color: 'var(--primary-color)', marginBottom: '0.75rem' }}>{ex.name}</div>
                  
                  {ex.sets.map((set, setIdx) => (
                    <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ width: '30px', color: 'var(--text-muted)' }}>S{setIdx + 1}</span>
                      <input 
                        type="number" 
                        value={set.kg} 
                        onChange={(e) => {
                          const w = { ...editingWorkout };
                          w.exercises[exIdx].sets[setIdx].kg = e.target.value;
                          setEditingWorkout(w);
                        }}
                        style={{ width: '60px', padding: '6px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                        placeholder="kg"
                      />
                      <span style={{ color: 'var(--text-muted)' }}>x</span>
                      <input 
                        type="number" 
                        value={set.reps} 
                        onChange={(e) => {
                          const w = { ...editingWorkout };
                          w.exercises[exIdx].sets[setIdx].reps = e.target.value;
                          setEditingWorkout(w);
                        }}
                        style={{ width: '60px', padding: '6px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                        placeholder="reps"
                      />
                      <button 
                        onClick={() => {
                          const w = { ...editingWorkout };
                          w.exercises[exIdx].sets[setIdx].done = !w.exercises[exIdx].sets[setIdx].done;
                          setEditingWorkout(w);
                        }}
                        style={{ 
                          width: '32px', height: '32px', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginLeft: 'auto',
                          background: set.done ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.05)',
                          color: set.done ? '#34c759' : 'var(--text-muted)'
                        }}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}

              <button 
                className="btn-primary" 
                onClick={saveEditedWorkout}
                style={{ width: '100%', marginTop: '1rem', height: '54px', borderRadius: '16px' }}
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}

export default Profile;
