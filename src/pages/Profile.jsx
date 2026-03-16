import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Download, Upload, Calendar, Clock, Dumbbell, ChevronDown, ChevronUp, User, Settings as SettingsIcon } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { calculateLast7DaysVolume, getVolumeStatus, RP_LANDMARKS } from '../utils/rpVolume';
import { EXERCISES_DB } from '../data/exercises';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const history = useStore(state => state.history);
  const deleteWorkout = useStore(state => state.deleteWorkout);
  const [expandedSessions, setExpandedSessions] = useState({});
  const [visibleWeeks, setVisibleWeeks] = useState(2);

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
          style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: '#fff', zIndex: 10 }}
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
                              <div className="expand-icon" style={{ opacity: 0.5 }}>
                                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
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
      </main>
    </>
  );
}

export default Profile;
