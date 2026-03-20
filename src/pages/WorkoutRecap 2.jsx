import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Trophy, Clock, Zap, Target, Flame, ChevronRight, Check } from 'lucide-react';
import { getRankByXp, getMuscleLevelByXp } from '../utils/gamification';
import { EXERCISES_DB } from '../data/exercises';
import { RP_LANDMARKS } from '../utils/rpVolume';
import './WorkoutRecap.css';

function WorkoutRecap() {
  const navigate = useNavigate();
  const recapData = useStore(state => state.recapData);
  const clearRecapData = useStore(state => state.clearRecapData);
  const scienceReport = useStore(state => state.scienceReport);
  const history = useStore(state => state.history);
  const muscleXPState = useStore(state => state.muscleXP) || {};

  const [showAnimations, setShowAnimations] = useState(false);

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
    if (!recapData) return [];

    const now = Date.now();
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    
    // Se c'è un scienceReport, usa la sua data di inizio per la settimana
    let startOfCurrentWeek = now - MS_PER_WEEK; 
    let currentWeek = 1;
    let currentMonth = 1;

    if (scienceReport) {
      const weeksElapsed = Math.floor((now - scienceReport.timestamp) / MS_PER_WEEK);
      currentWeek = Math.min(Math.max(1, weeksElapsed + 1), 12);
      startOfCurrentWeek = scienceReport.timestamp + (currentWeek - 1) * MS_PER_WEEK;
      if (currentWeek > 4 && currentWeek <= 8) currentMonth = 2;
      if (currentWeek > 8) currentMonth = 3;
    }

    // 1. Trova i muscoli allenati in QUESTA sessione
    const setsDoneInWorkout = {};
    recapData.workout.exercises.forEach(ex => {
      const foundEx = EXERCISES_DB.find(e => e.name === ex.name);
      const muscle = foundEx ? foundEx.category : null;
      if (muscle) {
        setsDoneInWorkout[muscle] = (setsDoneInWorkout[muscle] || 0) + ex.sets.filter(s => s.done && !s.isDropset).length;
      }
    });

    const trainingMuscles = Object.keys(setsDoneInWorkout);
    if (trainingMuscles.length === 0) return [];

    // 2. Trova le serie fatte per questi stessi muscoli negli ultimi 7 giorni (escluso questo workout)
    const setsDoneBeforeWorkout = {};
    trainingMuscles.forEach(m => setsDoneBeforeWorkout[m] = 0);

    history.forEach(w => {
      if (w.id !== recapData.workout.id && w.startTime >= startOfCurrentWeek) {
        w.exercises.forEach(ex => {
          const foundEx = EXERCISES_DB.find(e => e.name === ex.name);
          const muscle = foundEx ? foundEx.category : null;
          if (muscle && setsDoneBeforeWorkout[muscle] !== undefined) {
            setsDoneBeforeWorkout[muscle] += ex.sets.filter(s => s.done && !s.isDropset).length;
          }
        });
      }
    });

    const getTargetForMuscle = (muscle) => {
      // Mapping from DB categories to Science Report landmarks if needed
      const mapping = {
        'Petto': 'Petto', 'Dorso': 'Schiena', 'Gambe': 'Quadricipiti',
        'Spalle': 'Spalle (Deltoidi)', 'Bicipiti': 'Bicipiti', 
        'Tricipiti': 'Tricipiti', 'Addome': 'Addome', 'Avambracci': 'Avambracci', 'Collo': 'Collo'
      };

      const scienceKey = mapping[muscle];
      
      // Target dal Science Report (se disponibile e valido)
      if (scienceReport && scienceKey && scienceReport.baseLandmarks[scienceKey]) {
        const lm = scienceReport.baseLandmarks[scienceKey];
        if (currentMonth === 3 && (currentWeek === 9 || currentWeek === 10)) return Math.max(0, lm.mev - 2);
        
        const isFocus = (currentMonth === 1 && (scienceReport.focus1 || []).includes(scienceKey)) || 
                        (currentMonth === 2 && (scienceReport.focus2 || []).includes(scienceKey));
        
        if (!isFocus) return lm.mev;

        const relativeWeek = currentWeek - ((currentMonth - 1) * 4);
        const gap = lm.mrv - lm.mav;
        const weeklyIncrement = gap / 3;
        return Math.round(lm.mav + (weeklyIncrement * (relativeWeek - 1)));
      }

      // Fallback a RP_LANDMARKS generici se non c'è Science Report!
      if (RP_LANDMARKS[muscle]) {
        return RP_LANDMARKS[muscle].MAV_MIN || 12;
      }

      return 10; // Fallback generico
    };

    const goals = [];
    trainingMuscles.forEach(muscle => {
      goals.push({
        muscle,
        target: getTargetForMuscle(muscle),
        previousDone: setsDoneBeforeWorkout[muscle],
        addedNow: setsDoneInWorkout[muscle]
      });
    });

    return goals;
  }, [scienceReport, recapData, history]);


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
        {/* Grade Banner */}
        <div className="recap-card grade-card glass">
          <div className="grade-badge" data-grade={score.grade}>
            {score.grade}
          </div>
          <div className="grade-info">
            <h3>Grado Sessione</h3>
            <p>Ottimo lavoro, hai rispettato i parametri.</p>
          </div>
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
