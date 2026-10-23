import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useWeeklyStreak } from '../../hooks/useWeeklyStreak';
import { ChevronDown, ChevronUp, ChevronRight, Settings as SettingsIcon, Zap, Trash2, Flame, Trophy, Edit2 } from 'lucide-react';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { calculateLast7DaysVolume, getVolumeStatus, RP_LANDMARKS } from '../../utils/rpVolume';
import { getAllExercises } from '../../data/exercises';
import { getRankByXp } from '../../utils/gamification';
import { computeOverloadStats } from '../../utils/overload';
import { estimate1RM, getBodyweightLoad, resolveBodyweight } from '../../utils/oneRepMax';
import './Profile.css';
import { ProfileThemePicker } from '../../components/ThemePicker';
import ProgressShare from '../../components/ProgressShare';
import { ScienceVolumePanel } from '../../components/ScienceVolumePanel';
import { hasLegacyScience } from '../../utils/scienceV3';

function Profile() {
  const navigate = useNavigate();
  const history = useStore(state => state.history);
  const deleteWorkout = useStore(state => state.deleteWorkout);
  const userXP = useStore(state => state.userXP);
  const { currentStreak } = useWeeklyStreak();
  const showScience = useStore(state => state.showScience);
  const useLegacyVolume = useStore(state => hasLegacyScience(state.scienceReport));
  const _customExercises = useStore(state => state.customExercises);
  const customExercises = useMemo(() => _customExercises || [], [_customExercises]);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
  const allKnownExercises = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);
  const bodyweight = useStore(resolveBodyweight);

  const [expandedSessions, setExpandedSessions] = useState({});
  const [visibleWeeks, setVisibleWeeks] = useState(2);

  // --- History Logic ---
  // e is undefined when called from SwipeToDelete
  const handleDelete = (e, workoutId) => {
    e?.stopPropagation();
    if (window.confirm("Eliminare questa sessione?")) {
      deleteWorkout(workoutId);
    }
  };

  const toggleSession = (id) => {
    setExpandedSessions(prev => ({ ...prev, [id]: !prev[id] }));
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


  // --- Statistics Logic (progressive overload, not volume) ---
  const stats = useMemo(() => {
    const { prCount, overloadRate } = computeOverloadStats(history, { exercisesDb: allKnownExercises, bodyweight });
    return {
      workouts: history.length,
      prs: prCount,
      overload: overloadRate == null ? '—' : `${overloadRate}%`
    };
  }, [history, allKnownExercises, bodyweight]);

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

  const formatWeekday = (ts) => new Date(ts).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });

  return (
    <div className="ej-page pf-page">
      <div className="ej-glow" aria-hidden="true" />

      {/* ── HEADER ─────────────────────────────────── */}
      <header className="pf-header">
        <div>
          <h1 className="ej-title">Profilo</h1>
          <p className="ej-eyebrow">{welcomePhrase}</p>
        </div>
        <button type="button" className="ej-icon-btn ej-icon-btn--round pf-settings" onClick={() => navigate('/settings')} title="Impostazioni">
          <SettingsIcon size={20} />
        </button>
      </header>

      {/* ── RANK ───────────────────────────────────── */}
      <section className="ej-card pf-rank" style={{ '--rank-color': rank.color }}>
        <div className="pf-rank-row">
          <span className="pf-rank-icon"><Trophy size={26} /></span>
          <div className="pf-rank-text">
            <span className="pf-kicker">Rank</span>
            <span className="pf-rank-title">{rank.title}</span>
          </div>
          <button type="button" className="pf-streak" onClick={() => navigate('/activity')} title="Apri pagina attività e streak">
            <span className="pf-streak-value">
              {currentStreak || 0} sett. <Flame size={18} fill={currentStreak >= 1 ? 'currentColor' : 'none'} />
            </span>
            <span className="pf-streak-label">Streak</span>
          </button>
        </div>
        <div className="pf-rank-progress">
          <div className="pf-rank-progress-label">
            <span>Progresso Rank</span>
            <span>{(userXP || 0).toLocaleString('it-IT')}{rank.nextRank ? ` / ${rank.nextRank.minXp.toLocaleString('it-IT')} XP` : ' XP · MAX'}</span>
          </div>
          <div className="pf-rank-track"><span style={{ width: `${rank.progressPercent}%` }} /></div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────── */}
      <div className="pf-stats">
        <div className="ej-card pf-stat">
          <span className="pf-stat-value">{stats.workouts}</span>
          <span className="pf-stat-label">Workout</span>
        </div>
        <div className="ej-card pf-stat">
          <span className="pf-stat-value">{stats.prs}</span>
          <span className="pf-stat-label">PR battuti</span>
        </div>
        <div className="ej-card pf-stat">
          <span className="pf-stat-value">{stats.overload}</span>
          <span className="pf-stat-label">Overload</span>
        </div>
      </div>

      <ProfileThemePicker />
      <ProgressShare />

      {/* ── MUSCLE LEVELS ──────────────────────────── */}
      {showScience && (
        <button type="button" className="pf-levels" onClick={() => navigate('/levels')}>
          <span className="pf-levels-icon"><Zap size={18} fill="currentColor" /></span>
          <span className="pf-levels-label">I Tuoi Livelli Muscolari</span>
          <ChevronRight size={18} />
        </button>
      )}

      {/* ── RP VOLUME ──────────────────────────────── */}
      <ScienceVolumePanel compact />
      {showScience && useLegacyVolume && rpVolumes && (
        <section className="pf-section">
          <h2 className="ej-section-title">Volume RP (Ultimi 7 Giorni)</h2>
          <div className="ej-card pf-rp">
            <p className="pf-muted">Serie completate negli ultimi 7 giorni rispetto ai landmark di Dr. Mike Israetel (MEV, MAV, MRV).</p>

            {Object.entries(rpVolumes).map(([category, sets]) => {
              if (sets === 0) return null;
              const status = getVolumeStatus(sets, category);
              const landmarks = RP_LANDMARKS[category];
              const maxTarget = landmarks.MRV || landmarks.MAV_MAX || sets || 1;
              const visualPercent = Math.min(100, (sets / maxTarget) * 100);

              return (
                <div key={category} className="pf-rp-item">
                  <div className="pf-rp-head">
                    <span className="pf-rp-name">{category}</span>
                    <span className="pf-rp-sets">{sets} serie</span>
                  </div>
                  <div className="pf-track"><span style={{ width: `${visualPercent}%`, background: status.color }} /></div>
                  <div className="pf-rp-foot">
                    <span>Stato: <strong style={{ color: status.color }}>{status.status}</strong></span>
                    <span>MRV: {landmarks.MRV}</span>
                  </div>
                </div>
              );
            })}

            {Object.values(rpVolumes).every(v => v === 0) && (
              <p className="pf-empty-inline">Nessuna serie registrata negli ultimi 7 giorni.</p>
            )}
          </div>
        </section>
      )}

      {/* ── HISTORY ────────────────────────────────── */}
      <section className="pf-section">
        <h2 className="ej-section-title">Il Tuo Percorso</h2>

        {(!history || history.length === 0) ? (
          <div className="ej-card pf-empty">Ancora nessun passo registrato nel tuo percorso.</div>
        ) : (
          <>
            {displayedGroups.map(group => (
              <div key={group.weekKey} className="pf-week">
                <p className="pf-week-label">{getWeekLabel(group.monday)} · {group.workouts.length} {group.workouts.length === 1 ? 'sessione' : 'sessioni'}</p>

                {group.workouts.map(workout => {
                  const isExpanded = expandedSessions[workout.id];
                  return (
                    <SwipeToDelete key={workout.id} onDelete={(e) => handleDelete(e, workout.id)}>
                      <div className={`ej-card pf-session ${isExpanded ? 'is-open' : ''}`} onClick={() => toggleSession(workout.id)}>
                        <div className="pf-session-head">
                          <div className="pf-session-text">
                            <span className="pf-session-name">{workout.name || 'Sessione Elite'}</span>
                            <span className="pf-session-meta">
                              {formatWeekday(workout.startTime)} · {formatDuration(workout.startTime, workout.endTime)} · {calculateCompletedSets(workout.exercises)} serie
                            </span>
                          </div>
                          <button type="button" className="ej-icon-btn pf-session-btn" onClick={(e) => { e.stopPropagation(); navigate(`/edit-workout/${workout.id}`); }} title="Modifica sessione">
                            <Edit2 size={14} />
                          </button>
                          <button type="button" className="ej-icon-btn ej-icon-btn--danger pf-session-btn" onClick={(e) => handleDelete(e, workout.id)} title="Elimina sessione">
                            <Trash2 size={14} />
                          </button>
                          {isExpanded ? <ChevronUp size={20} className="pf-chevron" /> : <ChevronDown size={20} className="pf-chevron" />}
                        </div>

                        {isExpanded && (
                          <div className="pf-session-details">
                            {workout.exercises.map(exercise => {
                              const doneSets = exercise.sets.filter(s => s.done);
                              if (doneSets.length === 0) return null;
                              const bodyweightLoad = getBodyweightLoad(exercise.name, allKnownExercises, bodyweight);
                              return (
                                <div key={exercise.id} className="pf-ex">
                                  <span className="pf-ex-name">{exercise.name}</span>
                                  <div className="pf-ex-sets">
                                    {doneSets.map((set, setIdx) => {
                                      const est1rm = estimate1RM(set.kg, set.reps, bodyweightLoad);
                                      return (
                                        <span key={set.id} className={`pf-set ${set.isDropset ? 'is-drop' : ''}`}>
                                          <span className="pf-set-num">{set.isDropset ? 'D' : setIdx + 1}</span>
                                          {set.kg}kg × {set.reps}
                                          {est1rm > 0 && <span className="pf-set-rm">{bodyweightLoad > 0 ? '+' : ''}{est1rm.toFixed(0)}</span>}
                                        </span>
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
            ))}

            {groupedHistory.length > visibleWeeks && (
              <button type="button" className="pf-more" onClick={() => setVisibleWeeks(prev => prev + 1)}>
                Mostra settimana precedente
              </button>
            )}

            <button type="button" className="pf-all-history" onClick={() => navigate('/history')}>
              Vedi tutto lo storico <ChevronRight size={16} />
            </button>
          </>
        )}
      </section>
    </div>
  );
}

export default Profile;
