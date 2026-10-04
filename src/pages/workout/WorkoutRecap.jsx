import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Trophy, Clock, Zap, Target, Flame, ChevronRight, ChevronDown, ChevronUp, TrendingUp, Check, ShieldCheck, Download } from 'lucide-react';
import { getRankByXp, getMuscleLevelByXp } from '../../utils/gamification';
import { EXERCISES_DB, getAllExercises, normalizeName } from '../../data/exercises';
import { RP_LANDMARKS, getScienceTargetForMuscle, getActualSetsForScienceWeek, mapCategoryToScienceLandmark } from '../../utils/rpVolume';
import { exportDataBackup } from '../../utils/backup';
import './WorkoutRecap.css';

function WorkoutRecap() {
  const navigate = useNavigate();
  const recapData = useStore(state => state.recapData);
  const clearRecapData = useStore(state => state.clearRecapData);
  const scienceReport = useStore(state => state.scienceReport);
  const showScience = useStore(state => state.showScience);
  const history = useStore(state => state.history);
  const muscleXPState = useStore(state => state.muscleXP) || {};
  const customExercises = useStore(state => state.customExercises || []);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});

  const allKnownExercises = useMemo(() => {
    return getAllExercises(customExercises, exerciseOverrides);
  }, [customExercises, exerciseOverrides]);

  const [showAnimations, setShowAnimations] = useState(false);
  const [backupSaved, setBackupSaved] = useState(false);
  const [showGradeDetails, setShowGradeDetails] = useState(false);

  useEffect(() => {
    if (!recapData) {
      navigate('/');
      return;
    }
    // Trigger entrance animations after mount
    setTimeout(() => setShowAnimations(true), 100);
  }, [recapData, navigate]);

  // Handle back button / close
  const handleClose = () => {
    clearRecapData();
    navigate('/profile');
  };

  const scienceGoalsThisWeek = useMemo(() => {
    if (!showScience || !recapData || !scienceReport || scienceReport.status === 'completed' || scienceReport.status === 'pending') {
      return [];
    }

    const cw = scienceReport.currentWeek || 1;
    const currentWeekTotalSets = getActualSetsForScienceWeek(history, allKnownExercises, scienceReport, cw);

    // 1. Trova i muscoli allenati in QUESTA sessione associati ai landmarks di scienza
    const setsDoneInWorkout = {};
    (recapData.workout.exercises || []).forEach(ex => {
      const foundEx = allKnownExercises.find(e => normalizeName(e.name) === normalizeName(ex.name));
      const muscle = mapCategoryToScienceLandmark(foundEx?.category, scienceReport.baseLandmarks);
      if (muscle) {
        const completedSets = (ex.sets || []).filter(s => s.done && !s.isDropset).length;
        setsDoneInWorkout[muscle] = (setsDoneInWorkout[muscle] || 0) + completedSets;
      }
    });

    const trainingMuscles = Object.keys(setsDoneInWorkout);
    if (trainingMuscles.length === 0) return [];

    const goals = [];
    trainingMuscles.forEach(muscle => {
      const target = getScienceTargetForMuscle(scienceReport, muscle, cw);
      const totalDone = currentWeekTotalSets[muscle] || 0;
      const addedNow = setsDoneInWorkout[muscle] || 0;
      const previousDone = Math.max(0, totalDone - addedNow);

      if (target > 0 || addedNow > 0) {
        goals.push({
          muscle,
          target,
          previousDone,
          addedNow
        });
      }
    });

    return goals;
  }, [showScience, scienceReport, recapData, history, allKnownExercises]);


  if (!recapData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-main)', marginTop: '20vh' }}>
        <h2>Elaborazione in corso...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Se questa schermata rimane bloccata, c'è un errore nel salvataggio. Torna alla <a href="/">Home</a>.</p>
      </div>
    );
  }

  const { workout, score, xpGained, newTotalXp, streak } = recapData;
  const durationMs = workout.endTime - workout.startTime;
  const mm = Math.floor(durationMs / 60000);
  
  // Sets per hour color logic
  const sph = parseFloat(score.setsPerHour);
  let sphColor = 'var(--text-main)';
  if (sph < 10) sphColor = '#ff3b30'; // Red
  else if (sph >= 10 && sph < 15) sphColor = '#ff9500'; // Yellow
  else if (sph >= 15 && sph <= 25) sphColor = '#34c759'; // Green
  else if (sph > 25) sphColor = '#ff9500'; // Yellow (too fast)

  const rank = getRankByXp(newTotalXp);

  return (
    <div className={`recap-container ${showAnimations ? 'visible' : ''}`}>
      <div className="recap-header">
        <h1 className="recap-title">Allenamento Completato</h1>
        <div className="recap-subtitle">{workout.name}</div>
      </div>

      <div className="recap-content">
        {/* Grade Banner & Interactive Diagnostics */}
        <div className="recap-card grade-card-enhanced glass" data-grade={score.grade}>
          <div className="grade-main-row">
            <div className="grade-badge" data-grade={score.grade}>
              {score.grade}
            </div>
            <div className="grade-info">
              <div className="grade-tag-row">
                <span className="grade-tag" data-grade={score.grade}>
                  {score.gradeLabel || 'Grado Sessione'}
                </span>
                {score.overloadCount > 0 && (
                  <span className="grade-overload-chip">
                    🔥 {score.overloadCount}/{score.totalExercises || 1} Overload
                  </span>
                )}
              </div>
              <h3 className="grade-headline">
                {score.grade === 'S' && 'Sessione Leggendaria 🔥'}
                {score.grade === 'A' && 'Grande Progressione ⚡'}
                {score.grade === 'B' && 'Ottimo Lavoro 👍'}
                {score.grade === 'C' && 'Sessione di Mantenimento ⚖️'}
                {score.grade === 'D' && 'Stimolo Insufficiente ⚠️'}
              </h3>
              <p className="grade-description">
                {score.gradeDescription || 'Analisi dei parametri e del sovraccarico completata.'}
              </p>
            </div>
          </div>

          {/* Toggle Button for Explorable Analysis */}
          {score.exercisesAnalysis && score.exercisesAnalysis.length > 0 && (
            <button 
              type="button" 
              className="grade-expand-btn"
              onClick={() => setShowGradeDetails(prev => !prev)}
            >
              <div className="expand-btn-left">
                <TrendingUp size={16} color="var(--primary-color)" />
                <span>
                  {showGradeDetails ? 'Nascondi analisi dettagliata' : `Perché Grado ${score.grade}? Mostra analisi (${score.overloadCount || 0}/${score.totalExercises || score.exercisesAnalysis.length} overload)`}
                </span>
              </div>
              {showGradeDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          )}

          {/* Collapsible / Explorable Breakdown Section */}
          {showGradeDetails && score.exercisesAnalysis && (
            <div className="grade-details-dropdown">
              <div className="exercises-analysis-list">
                {score.exercisesAnalysis.map((item, idx) => (
                  <div key={idx} className={`exercise-analysis-card ${item.overloaded ? 'is-overload' : ''}`}>
                    <div className="ex-analysis-top">
                      <span className="ex-analysis-name">{item.name}</span>
                      <span 
                        className="ex-analysis-badge" 
                        style={{ 
                          color: item.badgeColor, 
                          background: `${item.badgeColor}18`, 
                          borderColor: `${item.badgeColor}40` 
                        }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <div className="ex-analysis-detail">
                      {item.detail}
                    </div>
                    {item.pastMetric && item.currentMetric && (
                      <div className="ex-analysis-compare">
                        <span>Oggi: <strong>{item.currentMetric}</strong></span>
                        <span className="compare-sep">•</span>
                        <span>Prec: <span className="past-val">{item.pastMetric}</span></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Actionable Next Workout Tip */}
              {score.nextTip && (
                <div className="grade-pro-tip">
                  <div className="tip-header">
                    <Zap size={16} color="#ffcc00" fill="#ffcc00" />
                    <span>Consiglio per il prossimo workout</span>
                  </div>
                  <p className="tip-text">{score.nextTip}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Core Stats */}
        <div className="recap-stats-grid">
          <div className="recap-stat-box glass">
            <Clock size={24} color="#3b82f6" />
            <span className="stat-val">{mm} min</span>
            <span className="stat-lbl">Durata</span>
          </div>
          <div className="recap-stat-box glass">
            <Target size={24} color={sphColor} />
            <span className="stat-val" style={{ color: sphColor }}>{score.setsPerHour}</span>
            <span className="stat-lbl">Serie / Ora</span>
          </div>
          <div className="recap-stat-box glass">
            <Flame size={24} color="#ff9500" />
            <span className="stat-val">{streak}</span>
            <span className="stat-lbl">Streak Week</span>
          </div>
        </div>

        {/* Science Goals Progression */}
        {scienceGoalsThisWeek.length > 0 && (
          <div className="recap-card glass">
            <h3 className="card-title">Progressione Settimanale</h3>
            <div className="goals-list">
              {scienceGoalsThisWeek.map(g => {
                const totalTarget = Math.max(1, g.target); // Prevent Div by 0
                const prevVisualPcnt = Math.min(100, (g.previousDone / totalTarget) * 100);
                const newVisualPcnt = Math.min(100, ((g.previousDone + g.addedNow) / totalTarget) * 100);
                
                return (
                  <div key={g.muscle} className="goal-item">
                    <div className="goal-header">
                      <span>{g.muscle}</span>
                      <span>{g.previousDone + g.addedNow} / {g.target}</span>
                    </div>
                    <div className="recap-progress-bg">
                      <div className="recap-progress-fill prev" style={{ width: `${prevVisualPcnt}%` }}></div>
                      <div className="recap-progress-fill new" style={{ 
                        left: `${prevVisualPcnt}%`, 
                        width: `${showAnimations ? Math.max(0, newVisualPcnt - prevVisualPcnt) : 0}%`,
                        transitionDelay: '0.5s'
                      }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Livelli Muscolari */}
        {score.muscleXpGained && Object.keys(score.muscleXpGained).length > 0 && (
          <div className="recap-card glass">
            <h3 className="card-title">Livelli Muscolari</h3>
            <div className="goals-list">
              {Object.entries(score.muscleXpGained).map(([muscle, gained]) => {
                const currentTotalXp = muscleXPState[muscle] || gained; 
                // Because muscleXPState is already updated with `gained` when we hit finishWorkout
                const oldTotalXp = Math.max(0, currentTotalXp - gained);
                
                const oldData = getMuscleLevelByXp(oldTotalXp);
                const newData = getMuscleLevelByXp(currentTotalXp);
                const isLevelUp = newData.level > oldData.level;

                const prevLvlPcnt = oldData.progressPercent;
                // If we leveled up, visually we might just fill the bar from 0 for the new level 
                // or show the new level's percentage. Let's just show the new level progress.
                // A true multi-bar animation is complex, so we'll just animate the current level's bar 
                // starting from 0 if level up, else from old percentage.
                const startPcnt = isLevelUp ? 0 : prevLvlPcnt;
                const endPcnt = newData.progressPercent;

                return (
                  <div key={muscle} className="goal-item">
                    <div className="goal-header" style={{ alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{muscle}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>+{gained} XP</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isLevelUp && <span style={{ color: '#ffcc00', fontWeight: 'bold', fontSize: '0.9rem', animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>LEVEL UP!</span>}
                        <span>Lv. {newData.level}</span>
                      </div>
                    </div>
                    <div className="recap-progress-bg">
                      <div className="recap-progress-fill prev" style={{ width: `${startPcnt}%` }}></div>
                      <div className="recap-progress-fill new" style={{ 
                        left: `${startPcnt}%`, 
                        width: `${showAnimations ? Math.max(0, endPcnt - startPcnt) : 0}%`,
                        background: isLevelUp ? '#ffcc00' : 'var(--primary-color)',
                        transitionDelay: '0.7s'
                      }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* XP and Rank */}
        <div className="recap-card xp-card glass">
          <div className="xp-header">
            <h3>+{xpGained} XP</h3>
            <span className="rank-badge" style={{ color: rank.color, borderColor: rank.color }}>
              {rank.title}
            </span>
          </div>
          
          <div className="xp-breakdown">
            {score.breakdown.map((item, i) => (
              <div key={i} className="xp-item" style={{ animationDelay: `${0.8 + (i * 0.1)}s` }}>
                <span>{item.label}</span>
                <span className="xp-val">{item.value}</span>
              </div>
            ))}
          </div>
          
          <div className="rank-progress-container" style={{ marginTop: '1.5rem' }}>
            <div className="rank-labels">
              <span>{rank.title}</span>
              <span>{rank.nextRank ? rank.nextRank.title : 'MAX'}</span>
            </div>
            <div className="recap-progress-bg" style={{ height: '12px' }}>
              <div className="recap-progress-fill" style={{ 
                width: `${showAnimations ? rank.progressPercent : 0}%`, 
                background: rank.color,
                transitionDelay: '1.2s'
              }}></div>
            </div>
          </div>
        </div>

        {/* Quick Backup Card */}
        <div className={`recap-card glass recap-backup-card ${backupSaved ? 'is-saved' : ''}`}>
          <div className="recap-backup-info">
            <div className="recap-backup-icon-box">
              {backupSaved ? <Check size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div className="recap-backup-text">
              <p className="recap-backup-title">
                {backupSaved ? 'Sessione salvata' : 'Metti al sicuro la sessione'}
              </p>
              <p className="recap-backup-desc">
                {backupSaved ? 'Copia offline aggiornata sul dispositivo' : 'Salva i record odierni e l\'XP guadagnato'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              const res = exportDataBackup();
              if (res) setBackupSaved(true);
            }}
            disabled={backupSaved}
            className={`recap-backup-btn ${backupSaved ? 'is-saved' : ''}`}
          >
            {backupSaved ? <Check size={16} /> : <Download size={16} />}
            {backupSaved ? 'Salvato' : 'Salva'}
          </button>
        </div>

      </div>

      <div className="recap-footer">
        <button className="btn-primary" onClick={handleClose}>
          Continua <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default WorkoutRecap;
