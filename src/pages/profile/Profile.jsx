import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Calendar, Clock, Dumbbell, ChevronDown, ChevronUp, User, Settings as SettingsIcon, Zap, Trash2, X, Flame, Trophy, Check, Edit2 } from 'lucide-react';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { calculateLast7DaysVolume, getVolumeStatus, RP_LANDMARKS } from '../../utils/rpVolume';
import { EXERCISES_DB, getAllExercises, getExerciseCategories, normalizeName } from '../../data/exercises';
import { getRankByXp } from '../../utils/gamification';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const history = useStore(state => state.history);
  const deleteWorkout = useStore(state => state.deleteWorkout);
  const userXP = useStore(state => state.userXP);
  const currentStreak = useStore(state => state.currentStreak);
  const showScience = useStore(state => state.showScience);
  const _customExercises = useStore(state => state.customExercises);
  const customExercises = useMemo(() => _customExercises || [], [_customExercises]);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
  const allKnownExercises = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);

  const [expandedSessions, setExpandedSessions] = useState({});
  const [visibleWeeks, setVisibleWeeks] = useState(2);

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
    return calculateLast7DaysVolume(history, allKnownExercises);
  }, [history, allKnownExercises]);

  const welcomePhrase = useMemo(() => {
    if (history.length === 0) return "Inizia la tua sfida";
    if (history.length < 5) return "Ottimo inizio, Campione";
    if (history.length < 20) return "Sei sulla strada giusta";
    return "Atleta d'Elite";
  }, [history.length]);

  const rank = getRankByXp(userXP || 0);

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
    today.setHours(0, 0, 0, 0);

    // Get this week's monday
    const currentDay = today.getDay();
    const currentDiff = today.getDate() - (currentDay === 0 ? 6 : currentDay - 1);
    const thisMonday = new Date(new Date().setDate(currentDiff));
    thisMonday.setHours(0, 0, 0, 0);

    const diffWeeks = Math.round((thisMonday - monday) / (7 * 24 * 60 * 60 * 1000));

    if (diffWeeks === 0) return "Questa Settimana";
    if (diffWeeks === 1) return "Settimana Scorsa";

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return `${monday.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
  };

  return (
    <>
      <header className="app-header profile-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="header-content">
          <h1>Profilo</h1>
          <p className="subtitle">{welcomePhrase}</p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          style={{ background: 'transparent', position: 'absolute', top: '40px', right: '40px', borderRadius: '10px', padding: '8px', color: 'hsla(0, 0%, 100%, 1.00)', marginTop: '4px', flexShrink: 0 }}
        >
          <SettingsIcon size={20} />
        </button>
      </header>

      <main className="app-main" style={{ paddingBottom: '2rem' }}>

        {/* Gamification Dashboard */}
        <div className="card glass gamification-dash" style={{
          marginBottom: '2rem',
          borderRadius: '24px',
          border: `1px solid ${rank.color}`,
          background: 'rgba(255,255,255,0.03)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${rank.color}` }}>
                <Trophy size={24} color={rank.color} />
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: rank.color, textTransform: 'uppercase' }}>{rank.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{userXP || 0} XP</div>
              </div>
            </div>

            <div 
              onClick={() => navigate('/activity')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer' }}
              title="Apri pagina attività e streak"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff9500', fontWeight: '800', fontSize: '1.2rem' }}>
                {currentStreak > 0 ? `${currentStreak} sett.` : '0 sett.'} <Flame size={20} fill={currentStreak >= 1 ? "#ff9500" : "none"} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Streak</div>
            </div>
          </div>

          <div className="rank-progress-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '700' }}>
              <span>Progresso Rank</span>
              <span>{rank.nextRank ? rank.nextRank.title : 'MAX'}</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${rank.progressPercent}%`, background: rank.color, borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
            </div>
          </div>
        </div>

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

        {/* Muscle Levels Button */}
        {showScience && (
          <div style={{ marginTop: '2.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => navigate('/levels')}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '1.2rem',
                fontSize: '1.2rem',
                background: 'linear-gradient(135deg, #ffcc00 0%, #ff9500 100%)',
                color: 'black',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 8px 32px rgba(255,204,0,0.3)'
              }}
            >
              <Zap size={24} color="black" fill="black" />
              <span style={{ fontWeight: '800' }}>I Tuoi Livelli Muscolari</span>
            </button>
          </div>
        )}



        {/* RP Volume Section */}
        {showScience && rpVolumes && (
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
                                <button className="edit-workout-btn" onClick={(e) => { e.stopPropagation(); navigate(`/edit-workout/${workout.id}`); }}>
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
              
              <button
                onClick={() => navigate('/history')}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'var(--primary-color-dim)',
                  border: 'none',
                  borderRadius: '16px',
                  color: 'var(--primary-color)',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  marginTop: '1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                Vai a tutto lo Storico →
              </button>
            </div>
          )}
        </div>


      </main>
    </>
  );
}

export default Profile;
