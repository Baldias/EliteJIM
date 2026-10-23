import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Trophy, Clock, Zap, Target, Flame, ChevronRight, ChevronDown, ChevronUp, TrendingUp, Check, ShieldCheck, Download, CheckCircle2 } from 'lucide-react';
import { getRankByXp, getMuscleLevelByXp } from '../../utils/gamification';
import { getAllExercises, normalizeName } from '../../data/exercises';
import { getScienceTargetForMuscle, getActualSetsForScienceWeek, mapCategoryToScienceLandmark } from '../../utils/rpVolume';
import { hasLegacyScience } from '../../utils/scienceV3';
import { evolvedLegacyReport } from '../../utils/scienceEvolution';
import { exportDataBackup } from '../../utils/backup';
import { ScienceWorkoutFeedback } from '../../components/ScienceTraining';
import { ScienceVolumePanel } from '../../components/ScienceVolumePanel';
import './WorkoutRecap.css';

function WorkoutRecap() {
  const navigate = useNavigate();
  const recapData = useStore(state => state.recapData);
  const clearRecapData = useStore(state => state.clearRecapData);
  const rawScienceReport = useStore(state => state.scienceReport);
  const scienceState = useStore(state => state.scienceState);
  const scienceReport = useMemo(() => evolvedLegacyReport(rawScienceReport, scienceState), [rawScienceReport, scienceState]);
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
    if (!showScience || !recapData || !hasLegacyScience(scienceReport,scienceState) || !scienceReport || scienceReport.status === 'completed' || scienceReport.status === 'pending') {
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
  }, [showScience, scienceReport, scienceState, recapData, history, allKnownExercises]);


  if (!recapData) {
    return (
      <div className="ej-page rc-loading">
        <h2>Elaborazione in corso...</h2>
        <p>Se questa schermata rimane bloccata, c'è un errore nel salvataggio. Torna alla <a href="/">Home</a>.</p>
      </div>
    );
  }

  const { workout, score, xpGained, newTotalXp, streak } = recapData;
  const durationMs = workout.endTime - workout.startTime;
  const mm = Math.floor(durationMs / 60000);
  
  // Sets per hour: green in the 15-25 sweet spot, amber when slightly off, red when too slow
  const sph = parseFloat(score.setsPerHour);
  let sphTone = '';
  if (sph < 10) sphTone = 'is-bad';
  else if (sph < 15 || sph > 25) sphTone = 'is-warn';
  else sphTone = 'is-good';

  const headlines = {
    S: 'Sessione Leggendaria',
    A: 'Grande Progressione',
    B: 'Ottimo Lavoro',
    C: 'Sessione di Mantenimento',
    D: 'Stimolo Insufficiente'
  };

  const rank = getRankByXp(newTotalXp);

  return (
    <div className={`ej-page rc-page ${showAnimations ? 'is-visible' : ''}`} data-grade={score.grade}>
      <div className="ej-glow" aria-hidden="true" />

      <header className="rc-hero">
        <span className="rc-hero-icon"><CheckCircle2 size={32} /></span>
        <h1 className="rc-title">Allenamento Completato</h1>
        <p className="rc-subtitle">{workout.name} · {mm} min</p>
      </header>

      {/* Grade + explorable overload analysis */}
      <section className="ej-card rc-grade">
        <div className="rc-grade-row">
          <span className="rc-grade-badge">{score.grade}</span>
          <div className="rc-grade-info">
            <div className="rc-grade-tags">
              <span className="rc-grade-tag">{score.gradeLabel || 'Grado Sessione'}</span>
              {score.overloadCount > 0 && (
                <span className="rc-overload-chip">
                  <Flame size={11} fill="currentColor" /> {score.overloadCount}/{score.totalExercises || 1} Overload
                </span>
              )}
            </div>
            <h3 className="rc-grade-headline">{headlines[score.grade]}</h3>
            <p className="rc-grade-desc">{score.gradeDescription || 'Analisi dei parametri e del sovraccarico completata.'}</p>
          </div>
        </div>

        {score.exercisesAnalysis && score.exercisesAnalysis.length > 0 && (
          <button type="button" className="rc-expand" onClick={() => setShowGradeDetails(prev => !prev)}>
            <TrendingUp size={16} />
            <span>
              {showGradeDetails
                ? 'Nascondi analisi dettagliata'
                : `Perché Grado ${score.grade}? Sovraccarico per esercizio (${score.overloadCount || 0}/${score.totalExercises || score.exercisesAnalysis.length})`}
            </span>
            {showGradeDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}

        {showGradeDetails && score.exercisesAnalysis && (
          <div className="rc-analysis">
            {score.exercisesAnalysis.map((item, idx) => (
              <div key={idx} className={`rc-analysis-item ${item.overloaded ? 'is-overload' : ''}`}>
                <div className="rc-analysis-top">
                  <span className="rc-analysis-name">{item.name}</span>
                  <span
                    className="rc-analysis-badge"
                    style={{ color: item.badgeColor, background: `${item.badgeColor}1f` }}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className="rc-analysis-detail">{item.detail}</p>
                {item.pastMetric && item.currentMetric && (
                  <div className="rc-analysis-compare">
                    <span>Oggi <strong>{item.currentMetric}</strong></span>
                    <span>Prec. <em>{item.pastMetric}</em></span>
                  </div>
                )}
              </div>
            ))}

            {score.nextTip && (
              <div className="rc-tip">
                <span className="rc-tip-head"><Zap size={14} fill="currentColor" /> Consiglio per il prossimo workout</span>
                <p>{score.nextTip}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Core stats */}
      <div className="rc-stats">
        <div className="ej-card rc-stat">
          <Clock size={18} className="rc-stat-icon" />
          <span className="rc-stat-value">{mm}m</span>
          <span className="rc-stat-label">Durata</span>
        </div>
        <div className={`ej-card rc-stat ${sphTone}`}>
          <Target size={18} className="rc-stat-icon" />
          <span className="rc-stat-value">{score.setsPerHour}</span>
          <span className="rc-stat-label">Serie / Ora</span>
        </div>
        <div className="ej-card rc-stat is-streak">
          <Flame size={18} className="rc-stat-icon" />
          <span className="rc-stat-value">{streak}</span>
          <span className="rc-stat-label">Streak Week</span>
        </div>
      </div>

      <ScienceWorkoutFeedback workout={workout} />
      <ScienceVolumePanel compact workout={workout} />
      {/* Science weekly progression */}
      {scienceGoalsThisWeek.length > 0 && (
        <section className="ej-card rc-card">
          <h3 className="rc-card-title">Progressione Settimanale</h3>
          {scienceGoalsThisWeek.map(g => {
            const totalTarget = Math.max(1, g.target);
            const prevPct = Math.min(100, (g.previousDone / totalTarget) * 100);
            const newPct = Math.min(100, ((g.previousDone + g.addedNow) / totalTarget) * 100);
            const reached = g.previousDone + g.addedNow >= g.target && g.target > 0;
            return (
              <div key={g.muscle} className="rc-row">
                <div className="rc-row-head">
                  <span>{g.muscle}</span>
                  <span className={reached ? 'is-good' : ''}>{g.previousDone + g.addedNow} / {g.target}</span>
                </div>
                <div className="rc-track">
                  <span className="rc-track-prev" style={{ width: `${prevPct}%` }} />
                  <span
                    className={`rc-track-new ${reached ? 'is-good' : ''}`}
                    style={{ left: `${prevPct}%`, width: `${showAnimations ? Math.max(0, newPct - prevPct) : 0}%`, transitionDelay: '0.5s' }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Muscle levels */}
      {score.muscleXpGained && Object.keys(score.muscleXpGained).length > 0 && (
        <section className="ej-card rc-card">
          <h3 className="rc-card-title">Livelli Muscolari</h3>
          {Object.entries(score.muscleXpGained).map(([muscle, gained]) => {
            // muscleXP in the store already includes `gained` after finishWorkout
            const currentTotalXp = muscleXPState[muscle] || gained;
            const oldTotalXp = Math.max(0, currentTotalXp - gained);
            const oldData = getMuscleLevelByXp(oldTotalXp);
            const newData = getMuscleLevelByXp(currentTotalXp);
            const isLevelUp = newData.level > oldData.level;
            const startPct = isLevelUp ? 0 : oldData.progressPercent;
            const endPct = newData.progressPercent;

            return (
              <div key={muscle} className="rc-row">
                <div className="rc-row-head">
                  <span className="rc-level-name">
                    {muscle}
                    {isLevelUp && <span className="rc-levelup">Level up!</span>}
                  </span>
                  <span className="rc-level-meta">
                    <span className="rc-xp-gain">+{gained} XP</span>
                    <strong>Lv. {newData.level}</strong>
                  </span>
                </div>
                <div className="rc-track is-thin">
                  <span className="rc-track-prev is-xp" style={{ width: `${startPct}%` }} />
                  <span
                    className="rc-track-new is-xp"
                    style={{ left: `${startPct}%`, width: `${showAnimations ? Math.max(0, endPct - startPct) : 0}%`, transitionDelay: '0.7s' }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* XP & rank */}
      <section className="ej-card rc-xp" style={{ '--rank-color': rank.color }}>
        <div className="rc-xp-head">
          <span className="rc-xp-total">+{xpGained} XP</span>
          <span className="rc-rank"><Trophy size={16} /> {rank.title}</span>
        </div>
        <div className="rc-xp-list">
          {score.breakdown.map((item, i) => (
            <div key={i} className="rc-xp-item" style={{ animationDelay: `${0.8 + (i * 0.1)}s` }}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="rc-rank-progress">
          <div className="rc-track is-rank">
            <span className="rc-track-new" style={{ left: 0, width: `${showAnimations ? rank.progressPercent : 0}%`, transitionDelay: '1.2s' }} />
          </div>
          <div className="rc-rank-labels">
            <span>{rank.title}</span>
            <span>{rank.nextRank ? rank.nextRank.title : 'MAX'}</span>
          </div>
        </div>
      </section>

      {/* Quick backup */}
      <div className={`rc-backup ${backupSaved ? 'is-saved' : ''}`}>
        <span className="rc-backup-icon">{backupSaved ? <Check size={18} /> : <ShieldCheck size={18} />}</span>
        <div className="rc-backup-text">
          <p>{backupSaved ? 'Sessione salvata' : 'Metti al sicuro la sessione'}</p>
          <span>{backupSaved ? 'Copia offline aggiornata sul dispositivo' : 'Salva i record odierni e l\'XP guadagnato'}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            const res = exportDataBackup();
            if (res) setBackupSaved(true);
          }}
          disabled={backupSaved}
          className="rc-backup-btn"
        >
          {backupSaved ? <Check size={14} /> : <Download size={14} />}
          {backupSaved ? 'Salvato' : 'Salva'}
        </button>
      </div>

      <button type="button" className="rc-continue" onClick={handleClose}>
        Continua <ChevronRight size={18} />
      </button>
    </div>
  );
}

export default WorkoutRecap;
