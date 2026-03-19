import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Dumbbell, ChevronDown, ChevronUp, User, Settings as SettingsIcon, Target, Zap, Edit2, Trash2, X, Flame, Trophy, Plus, PlusCircle, Trash, Check } from 'lucide-react';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { calculateLast7DaysVolume, getVolumeStatus, RP_LANDMARKS } from '../utils/rpVolume';
import { EXERCISES_DB, EXERCISE_CATEGORIES, getExerciseCategories } from '../data/exercises';
import { getRankByXp, getMuscleLevelByXp } from '../utils/gamification';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const history = useStore(state => state.history);
  const scienceReport = useStore(state => state.scienceReport);
  const deleteWorkout = useStore(state => state.deleteWorkout);
  const userXP = useStore(state => state.userXP);
  const currentStreak = useStore(state => state.currentStreak);
  const muscleXP = useStore(state => state.muscleXP) || {};
  const showScience = useStore(state => state.showScience);

  const [expandedSessions, setExpandedSessions] = useState({});
  const [visibleWeeks, setVisibleWeeks] = useState(2);
  const [editingWorkout, setEditingWorkout] = useState(null);

  const saveEditedWorkout = () => {
    if (!editingWorkout) return;
    useStore.setState(state => {
      const newHistory = state.history.map(w => w.id === editingWorkout.id ? editingWorkout : w);
      return { history: newHistory };
    });
    // Trigger gamification sync after history change
    useStore.getState().syncGamificationWithHistory();
    setEditingWorkout(null);
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
    const customExercises = useStore.getState().customExercises || [];
    return calculateLast7DaysVolume(history, [...EXERCISES_DB, ...customExercises]);
  }, [history, useStore.getState().customExercises]);

  const welcomePhrase = useMemo(() => {
    if (history.length === 0) return "Inizia la tua sfida";
    if (history.length < 5) return "Ottimo inizio, Campione";
    if (history.length < 20) return "Sei sulla strada giusta";
    return "Atleta d'Elite";
  }, [history.length]);

  const rank = getRankByXp(userXP || 0);
  const isBossFight = scienceReport && (() => {
    const wElapsed = Math.floor((Date.now() - scienceReport.timestamp) / (7 * 24 * 60 * 60 * 1000));
    const cw = Math.min(Math.max(1, wElapsed + 1), 12);
    return cw === 4 || cw === 8;
  })();

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
    const customExercises = useStore.getState().customExercises || [];
    const allEx = [...EXERCISES_DB, ...customExercises];

    const setsDoneThisWeek = {};
    history.forEach(w => {
      if (w.startTime >= startOfCurrentWeek) {
        w.exercises.forEach(ex => {
          const searchName = (ex.name || "").toLowerCase().trim();
          const foundEx = allEx.find(e => e.name.toLowerCase().trim() === searchName);
          const muscles = foundEx ? getExerciseCategories(foundEx) : [];
          
          muscles.forEach(muscle => {
            // Robust Science Key Matching
            let normalized = muscle;
            if (muscle === 'Gambe') normalized = 'Quadricipiti';
            
            const landmarks = scienceReport.baseLandmarks || {};
            const scienceKey = Object.keys(landmarks).find(k => 
                k.toLowerCase() === normalized.toLowerCase() ||
                k.toLowerCase().includes(normalized.toLowerCase()) || 
                normalized.toLowerCase().includes(k.toLowerCase())
            );

            if (scienceKey) {
              setsDoneThisWeek[scienceKey] = (setsDoneThisWeek[scienceKey] || 0) + ex.sets.filter(s => s.done && !s.isDropset).length;
            }
          });
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
  }, [scienceReport, history, useStore.getState().customExercises]);

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
          border: `1px solid ${isBossFight ? '#ff3b30' : rank.color}`,
          background: isBossFight ? 'linear-gradient(135deg, rgba(255, 59, 48, 0.1), rgba(0,0,0,0.4))' : 'rgba(255,255,255,0.03)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {isBossFight && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#ff3b30', color: '#fff', fontSize: '0.75rem', fontWeight: '800', textAlign: 'center', padding: '4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ⚠️ MRV Boss Fight Week ⚠️
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isBossFight ? '1rem' : '0', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${rank.color}` }}>
                <Trophy size={24} color={rank.color} />
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: rank.color, textTransform: 'uppercase' }}>{rank.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{userXP || 0} XP</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff9500', fontWeight: '800', fontSize: '1.2rem' }}>
                {currentStreak > 0 ? currentStreak : '-'} <Flame size={20} fill={currentStreak >= 3 ? "#ff9500" : "none"} />
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


        {/* Science Mesocycle Sync Section */}
        {showScience && scienceGoals && (
          <div style={{ marginTop: '2rem' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={24} color="var(--primary-color)" />
              <h2 className="section-title-premium" style={{ margin: 0, color: isBossFight ? '#ff3b30' : 'var(--text-main)' }}>
                Obiettivi W{scienceGoals.currentWeek} {isBossFight && "💀"}
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



        {/* Edit Workout Modal */}
        {editingWorkout && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            zIndex: 9999, padding: '1rem',
            overflowY: 'auto'
          }}>
            <div className="card glass" style={{ maxWidth: '600px', margin: '2rem auto', border: '1px solid var(--primary-color)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem' }}>Dettagli Allenamento</h3>
                <button onClick={() => setEditingWorkout(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={24} /></button>
              </div>

              {/* General Workout Info */}
              <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                <div className="input-field">
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '4px', display: 'block' }}>Nome Sessione</label>
                  <input
                    type="text"
                    value={editingWorkout.name}
                    onChange={(e) => setEditingWorkout({ ...editingWorkout, name: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
                <div className="input-field">
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '4px', display: 'block' }}>Data e Ora Inizio</label>
                  <input
                    type="datetime-local"
                    value={new Date(editingWorkout.startTime - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}
                    onChange={(e) => {
                      const newTs = new Date(e.target.value).getTime();
                      if (!isNaN(newTs)) {
                        setEditingWorkout({ ...editingWorkout, startTime: newTs });
                      }
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
              </div>

              {/* Exercises Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Esercizi</h4>
                <button 
                  onClick={() => {
                    const w = { ...editingWorkout };
                    w.exercises.push({
                      id: Date.now().toString(),
                      name: '',
                      sets: [{ id: `s-${Date.now()}`, kg: '', reps: '', done: true }]
                    });
                    setEditingWorkout(w);
                  }}
                  className="btn-add-exercise"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--primary-color)', background: 'none', border: 'none', fontWeight: '700' }}
                >
                  <PlusCircle size={16} /> Aggiungi
                </button>
              </div>

              {editingWorkout.exercises.map((ex, exIdx) => (
                <div key={ex.id} style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, marginRight: '1rem' }}>
                      <ExerciseAutocomplete
                        value={ex.name}
                        onChange={(newName) => {
                          const w = { ...editingWorkout };
                          w.exercises[exIdx].name = newName;
                          setEditingWorkout(w);
                        }}
                        placeholder="Nome esercizio"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const w = { ...editingWorkout };
                        w.exercises = w.exercises.filter((_, i) => i !== exIdx);
                        setEditingWorkout(w);
                      }}
                      style={{ background: 'none', border: 'none', color: '#ff453a', opacity: 0.6 }}
                    >
                      <Trash size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {ex.sets.map((set, setIdx) => (
                      <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '24px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>S{setIdx + 1}</span>
                        <input
                          type="number"
                          value={set.kg}
                          onChange={(e) => {
                            const w = { ...editingWorkout };
                            w.exercises[exIdx].sets[setIdx].kg = e.target.value;
                            setEditingWorkout(w);
                          }}
                          style={{ width: '60px', padding: '8px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textAlign: 'center' }}
                          placeholder="kg"
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>x</span>
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) => {
                            const w = { ...editingWorkout };
                            w.exercises[exIdx].sets[setIdx].reps = e.target.value;
                            setEditingWorkout(w);
                          }}
                          style={{ width: '60px', padding: '8px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textAlign: 'center' }}
                          placeholder="reps"
                        />
                        
                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={() => {
                              const w = { ...editingWorkout };
                              w.exercises[exIdx].sets[setIdx].done = !w.exercises[exIdx].sets[setIdx].done;
                              setEditingWorkout(w);
                            }}
                            style={{
                              width: '32px', height: '32px', borderRadius: '10px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: set.done ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: set.done ? '#34c759' : 'var(--text-muted)'
                            }}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => {
                              const w = { ...editingWorkout };
                              w.exercises[exIdx].sets = w.exercises[exIdx].sets.filter((_, i) => i !== setIdx);
                              setEditingWorkout(w);
                            }}
                            style={{ width: '32px', height: '32px', borderRadius: '10px', border: 'none', background: 'rgba(255, 69, 58, 0.1)', color: '#ff453a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const w = { ...editingWorkout };
                        w.exercises[exIdx].sets.push({
                          id: `s-${Date.now()}-${Math.random()}`,
                          kg: '',
                          reps: '',
                          done: true
                        });
                        setEditingWorkout(w);
                      }}
                      style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Plus size={14} /> Aggiungi Serie
                    </button>
                  </div>
                </div>
              ))}

              <button
                className="btn-primary"
                onClick={saveEditedWorkout}
                style={{ width: '100%', marginTop: '1rem', height: '54px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: '800' }}
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
