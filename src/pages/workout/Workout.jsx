import { machineHistory } from '../../utils/gymLocation';
import WorkoutGymLocation from '../../components/GymLocation';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, ChevronLeft, Trash2, Clock, FileText, Zap, Trophy, Dumbbell, TrendingUp } from 'lucide-react';
import { useStore, findLastBest1RMSet, getExercise1RMStats } from '../../store/useStore';
import { useRestTimer } from '../../hooks/useRestTimer';
import { ExerciseAutocomplete } from '../../components/ExerciseAutocomplete';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { ScienceSetControls, ScienceExerciseClassification } from '../../components/ScienceTraining';
import { normalizeName, EXERCISES_DB, getAllExercises, getWeightStep } from '../../data/exercises';
import { sanitizeDecimalInput } from '../../utils/number';
import { estimate1RM, getBodyweightLoad, resolveBodyweight } from '../../utils/oneRepMax';
import TrainingReminder from '../../components/TrainingReminder';
import './Workout.css';
import { tr, trc } from '../../i18n';

const round1 = (n) => Math.round(n * 10) / 10;

// Best completed working set of the session by estimated 1RM
const findSessionBest = (sets, bodyweightLoad) => (sets || [])
  .filter(s => s.done && !s.isDropset)
  .reduce((best, s) => {
    const rm = round1(estimate1RM(s.kg, s.reps, bodyweightLoad));
    return rm > (best?.rm || 0) ? { set: s, rm } : best;
  }, null);

function Workout() {
  const navigate = useNavigate();
  const activeWorkout = useStore(state => state.activeWorkout);
  const finishStoreWorkout = useStore(state => state.finishWorkout);
  const updateSet = useStore(state => state.updateActiveWorkoutSet);
  const updateExerciseNotes = useStore(state => state.updateActiveWorkoutExerciseNotes);
  const addExercise = useStore(state => state.addExerciseToActiveSession);
  const addSet = useStore(state => state.addSetToActiveExercise);
  const deleteExercise = useStore(state => state.deleteExerciseFromActiveSession);
  const deleteSet = useStore(state => state.deleteSetFromActiveExercise);
  const cancelWorkout = useStore(state => state.cancelWorkout);
  const history = useStore(state => state.history);
  const customExercises = useStore(state => state.customExercises || []);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
  const allDB = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);
  const bodyweight = useStore(resolveBodyweight);

  const [sessionTimeStr, setSessionTimeStr] = useState('00:00');
  const isFinishing = useRef(false);
  const globalRestEndTime = useStore(state => state.globalRestEndTime);
  const setGlobalRestEndTime = useStore(state => state.setGlobalRestEndTime);
  const clearGlobalRestTimer = useStore(state => state.clearGlobalRestTimer);
  const { restTimeLeft, isResting } = useRestTimer();
  const [expandedNotes, setExpandedNotes] = useState({});
  // Set that just beat the all-time PR: drives a short celebration animation
  const [prCelebration, setPrCelebration] = useState(null);
  const prTimer = useRef(null);

  useEffect(() => () => clearTimeout(prTimer.current), []);

  const toggleNotes = (id) => setExpandedNotes(p => ({ ...p, [id]: !p[id] }));

  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
      setSessionTimeStr(`${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  useEffect(() => { if (!activeWorkout && !isFinishing.current) navigate('/'); }, [activeWorkout, navigate]);
  if (!activeWorkout) return null;

  const celebrateIfNewPR = (ex, set) => {
    if (!ex || !set || set.isDropset) return;
    const bodyweightLoad = getBodyweightLoad(ex.name, allDB, bodyweight);
    const previousPR = getExercise1RMStats(machineHistory(history, ex.name, allDB, activeWorkout), ex.name, bodyweightLoad).allTime?.max1RM || 0;
    if (previousPR <= 0) return; // first time on this exercise: nothing to beat yet
    const others = findSessionBest(ex.sets.filter(s => s.id !== set.id), bodyweightLoad);
    const rm = round1(estimate1RM(set.kg, set.reps, bodyweightLoad));
    if (rm <= Math.max(previousPR, others?.rm || 0)) return;

    clearTimeout(prTimer.current);
    setPrCelebration({ exerciseId: ex.id, setId: set.id, id: Date.now() });
    prTimer.current = setTimeout(() => setPrCelebration(null), 2400);
    try { navigator.vibrate?.([40, 60, 40]); } catch { /* vibration not supported */ }
  };

  const handleToggleSet = (exerciseId, setId, done) => {
    const nowDone = !done;
    updateSet(exerciseId, setId, 'done', nowDone);
    if (nowDone) {
      const ex = activeWorkout.exercises.find(e => e.id === exerciseId);
      celebrateIfNewPR(ex, ex?.sets.find(s => s.id === setId));
      const secs = ex?.restTime !== undefined && ex.restTime !== '' ? parseInt(ex.restTime) : 60;
      if (secs > 0) setGlobalRestEndTime(Date.now() + secs * 1000);
    }
  };

  const handleFinishWorkout = () => {
    if (window.confirm(tr("Terminare e salvare l'allenamento?"))) {
      isFinishing.current = true;
      try { finishStoreWorkout(); navigate('/recap'); }
      catch (err) { isFinishing.current = false; alert(tr('Errore: {message}', { message: err.message })); }
    }
  };

  const handleUpdateExerciseNameLocally = (exerciseId, newName) => {
    useStore.setState(state => {
      if (!state.activeWorkout) return state;
      const hist = machineHistory(state.history || [], newName, allDB, state.activeWorkout);
      const templates = state.templates || [];
      const targetEx = state.activeWorkout.exercises.find(e => e.id === exerciseId);
      if (!targetEx || targetEx.name === newName) return state;
      const isAdded = targetEx.isAdded;

      const norm = normalizeName(newName);
      // Most recent session with completed working sets for this exercise
      const isWorkingDone = s => s.done && !s.isDropset;
      const pastWk = hist.find(w => w.exercises?.some(e => normalizeName(e.name) === norm && e.sets?.some(isWorkingDone)));
      const pastExRaw = pastWk?.exercises?.find(e => normalizeName(e.name) === norm);
      const pastEx = pastExRaw ? { ...pastExRaw, sets: pastExRaw.sets.filter(isWorkingDone) } : null;

      const bestData = findLastBest1RMSet(hist, newName);
      const bestSet = bestData?.set;

      let initialNotes = bestData?.notes || pastEx?.notes || '';
      if (!initialNotes) {
        for (const tpl of templates) {
          const found = tpl.exercises?.find(e => normalizeName(e.name) === norm);
          if (found?.notes) {
            initialNotes = found.notes;
            break;
          }
        }
      }

      return {
        activeWorkout: {
          ...state.activeWorkout,
          lastActivityAt: Date.now(),
          exercises: state.activeWorkout.exercises.map(ex => {
            if (ex.id !== exerciseId) return ex;
            const sets = ex.sets.map((s, i) => {
              if (!s.kg && !s.reps) {
                if (isAdded && bestSet) {
                  return { ...s, kg: bestSet.kg || '', reps: bestSet.reps || '' };
                } else if (!isAdded && pastEx?.sets?.length > 0) {
                  const ps = pastEx.sets[i] || pastEx.sets[pastEx.sets.length - 1];
                  return { ...s, kg: ps.kg || '', reps: ps.reps || '' };
                }
              }
              return s;
            });
            return { ...ex, name: newName, notes: ex.notes || initialNotes, sets };
          })
        }
      };
    });
  };

  const doneSets = activeWorkout.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);
  const totalSets = activeWorkout.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const fmtRest = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="wk-page">
      <div className="ej-glow wk-glow" aria-hidden="true" />

      {/* ── STICKY HEADER & TIMER ─────────────────── */}
      <div className="wk-sticky">
        <div className="wk-header">
          <button type="button" className="ej-icon-btn ej-icon-btn--round wk-back" onClick={() => navigate('/')} title={tr('Torna alla Home')}>
            <ChevronLeft size={20} />
          </button>

          <div className="wk-header-center">
            <p className="wk-header-name">{activeWorkout.name || tr('Sessione Libera')}</p>
            <div className="wk-header-time">
              <span className="wk-clock">{sessionTimeStr}</span>
              <span className="wk-sets-pill">{doneSets}/{totalSets}</span>
            </div>
          </div>

          <button type="button" className="ej-btn ej-btn--primary wk-finish" onClick={handleFinishWorkout}>
            {tr('Termina')}
          </button>
        </div>

        {/* ── REST TIMER ────────────────────── */}
        {isResting && (
          <div className="wk-rest">
            <Clock size={20} className="wk-rest-icon" />
            <div className="wk-rest-text">
              <span className="wk-rest-label">{trc('rest', 'Recupero')}</span>
              <span className="wk-rest-time">{fmtRest(restTimeLeft)}</span>
            </div>
            <button type="button" className="wk-rest-add" onClick={() => setGlobalRestEndTime(globalRestEndTime + 30000)}>+30s</button>
            <button type="button" className="ej-icon-btn ej-icon-btn--danger wk-rest-stop" onClick={() => clearGlobalRestTimer()} title={tr('Interrompi recupero')}>
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ── EXERCISES ─────────────────────── */}
      <div className="wk-body">
        <WorkoutGymLocation key={activeWorkout.id} workout={activeWorkout} />
      <TrainingReminder key={activeWorkout.id} workout={activeWorkout} />

        {/* Empty state */}
        {activeWorkout.exercises.length === 0 && (
          <div className="wk-empty">
            <span className="wk-empty-icon"><Dumbbell size={28} /></span>
            <p className="wk-empty-title">{tr('Nessun esercizio')}</p>
            <p className="wk-empty-sub">{tr('Tocca "+ Esercizio" qui sotto per iniziare la sessione')}</p>
          </div>
        )}

        {activeWorkout.exercises.map((ex, idx) => {
          const weightStep = getWeightStep(ex, allDB);
          const doneCount = ex.sets.filter(s => s.done).length;
          const bodyweightLoad = getBodyweightLoad(ex.name, allDB, bodyweight);
          const stats1RM = getExercise1RMStats(machineHistory(history, ex.name, allDB, activeWorkout), ex.name, bodyweightLoad);
          const rmPrefix = bodyweightLoad > 0 ? '+' : '';
          const hasLast1RM = !!(stats1RM.lastSession?.set && stats1RM.lastSession.max1RM > 0);
          const hasAllTime1RM = !!(stats1RM.allTime?.set && stats1RM.allTime.max1RM > 0);
          const has1RM = hasLast1RM || hasAllTime1RM;
          // Live PR: a set of this session that beats the all-time best
          const sessionBest = findSessionBest(ex.sets, bodyweightLoad);
          const newPR = hasAllTime1RM && sessionBest && sessionBest.rm > stats1RM.allTime.max1RM ? sessionBest : null;
          const isCelebrating = !!newPR && prCelebration?.exerciseId === ex.id;

          return (
            <div 
              key={ex.id} 
              className="workout-exercise-group"
              style={{ zIndex: activeWorkout.exercises.length - idx }}
            >
              {/* Unified Exercise Title Bar ABOVE the card */}
              <div className="workout-exercise-title-bar">
                <span className="workout-exercise-idx-pill">
                  <span className="workout-exercise-idx-hash">#</span>
                  <span className="workout-exercise-idx-num">{idx + 1}</span>
                </span>
                <div className="workout-exercise-title-input-wrap">
                  <ExerciseAutocomplete 
                    value={ex.name} 
                    onChange={val => handleUpdateExerciseNameLocally(ex.id, val)} 
                    placeholder={tr('Seleziona esercizio…')} 
                  />
                </div>
              </div>

              {/* Workout Exercise Card */}
              <div className="workout-exercise-card">
                {/* Meta & actions toolbar */}
                <div className="workout-exercise-subbar">
                  <div className="workout-exercise-meta-left">
                    <span className={`workout-progress-pill ${doneCount === ex.sets.length && ex.sets.length > 0 ? 'all-done' : ''}`}>
                      {doneCount}/{ex.sets.length} {doneCount === ex.sets.length && ex.sets.length > 0 ? tr('completate') : tr('serie')}
                    </span>
                  </div>
                  <div className="workout-exercise-meta-right">
                    <button
                      type="button"
                      className="workout-exercise-progress-btn"
                      title={tr('Vedi progressi')}
                      aria-label={tr('Vedi progressi di {name}', { name: ex.name || tr('questo esercizio') })}
                      disabled={!ex.name?.trim()}
                      onClick={() => navigate(`/progress?exercise=${encodeURIComponent(ex.name.trim())}`)}
                    >
                      <TrendingUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleNotes(ex.id)}
                      title={ex.notes ? tr('Modifica nota') : tr('Aggiungi nota')}
                      className={`workout-note-btn ${ex.notes ? 'has-note' : ''}`}
                    >
                      <FileText size={13} />
                      <span>{ex.notes ? tr('Nota') : tr('+ Nota')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const exName = ex.name?.trim() ? tr('l\'esercizio "{name}"', { name: ex.name }) : tr('questo esercizio');
                        if (window.confirm(tr('Sei sicuro di voler eliminare {exercise} dalla sessione?', { exercise: exName }))) {
                          deleteExercise(ex.id);
                        }
                      }}
                      className="workout-delete-ex-btn"
                      title={tr('Rimuovi esercizio')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Best 1RM reference row - visible for ALL exercises on the same line */}
                {has1RM && (
                  <div
                    key={isCelebrating ? prCelebration.id : 'static'}
                    className={`workout-1rm-banner ${newPR ? 'has-new-pr' : ''} ${isCelebrating ? 'is-celebrating' : ''}`}
                  >
                    {hasLast1RM && (
                      <div className="workout-1rm-item">
                        <div className="workout-1rm-label-group">
                          <Zap size={11} className="workout-1rm-icon-zap" />
                          <span className="workout-1rm-tag">{tr('Ult:')}</span>
                        </div>
                        <span className="workout-1rm-val">
                          {stats1RM.lastSession.set.kg}kg × {stats1RM.lastSession.set.reps}
                        </span>
                        <span className="workout-1rm-badge">
                          1RM {rmPrefix}{stats1RM.lastSession.max1RM}kg
                        </span>
                      </div>
                    )}

                    {hasLast1RM && hasAllTime1RM && (
                      <div className="workout-1rm-sep" />
                    )}

                    {hasAllTime1RM && !newPR && (
                      <div className="workout-1rm-item">
                        <div className="workout-1rm-label-group">
                          <Trophy size={11} className="workout-1rm-icon-zap" />
                          <span className="workout-1rm-tag">PR:</span>
                        </div>
                        <span className="workout-1rm-val">
                          {stats1RM.allTime.set.kg}kg × {stats1RM.allTime.set.reps}
                        </span>
                        <span className="workout-1rm-badge">
                          1RM {rmPrefix}{stats1RM.allTime.max1RM}kg
                        </span>
                      </div>
                    )}

                    {newPR && (
                      <div className="workout-1rm-item is-new-pr">
                        <div className="workout-1rm-label-group">
                          <Trophy size={11} className="workout-1rm-icon-zap" />
                          <span className="workout-1rm-tag">PR:</span>
                        </div>
                        <span className="workout-1rm-val">
                          {newPR.set.kg || 0}kg × {newPR.set.reps}
                        </span>
                        <span className="workout-1rm-new">
                          {tr('Nuovo')} +{round1(newPR.rm - stats1RM.allTime.max1RM)}
                        </span>
                        <span className="workout-1rm-badge">
                          1RM {rmPrefix}{newPR.rm}kg
                        </span>
                      </div>
                    )}
                  </div>
                )}

              {/* Notes drawer */}
              {(expandedNotes[ex.id] || ex.notes) && (
                <div className="workout-notes-drawer">
                  <FileText size={13} className="workout-notes-icon" />
                  <input
                    type="text"
                    placeholder={tr('Aggiungi nota (es. presa larga, fermo al petto 1s)...')}
                    value={ex.notes || ''}
                    onChange={e => updateExerciseNotes(ex.id, e.target.value)}
                    className="workout-notes-input"
                  />
                </div>
              )}

              <ScienceExerciseClassification workout={activeWorkout} exercise={ex} />
              {/* Sets section */}
              <div className="workout-sets-section">
                <div className="workout-sets-header">
                  <span className="workout-sets-col-title">#</span>
                  <span className="workout-sets-col-title">KG</span>
                  <span className="workout-sets-col-title">REPS</span>
                  <span className="workout-sets-col-title">✓</span>
                </div>

                {ex.sets.map((set, sIdx) => (
                  <SwipeToDelete 
                    key={set.id} 
                    onDelete={() => {
                      if (window.confirm(tr('Eliminare la serie {n}?', { n: set.isDropset ? 'Drop' : sIdx + 1 }))) {
                        deleteSet(ex.id, set.id);
                      }
                    }}
                  >
                    <div className={`workout-set-row-item ${set.done ? 'is-completed' : ''} ${newPR?.set.id === set.id ? 'is-pr' : ''} ${isCelebrating && prCelebration.setId === set.id ? 'is-pr-pop' : ''}`}>
                      <span className={`workout-set-badge ${set.isDropset ? 'is-dropset' : ''}`}>
                        {set.isDropset ? 'D' : newPR?.set.id === set.id ? <Trophy size={13} /> : sIdx + 1}
                      </span>

                      {/* KG input */}
                      <div className="workout-stepper">
                        <button
                          type="button"
                          className="workout-stepper-btn"
                          onClick={() => updateSet(ex.id, set.id, 'kg', Math.max(0, (parseFloat(set.kg) || 0) - weightStep).toString())}
                        >−</button>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="—"
                          value={set.kg || ''}
                          onChange={e => updateSet(ex.id, set.id, 'kg', sanitizeDecimalInput(e.target.value))}
                          className="workout-stepper-input"
                        />
                        <button
                          type="button"
                          className="workout-stepper-btn"
                          onClick={() => updateSet(ex.id, set.id, 'kg', ((parseFloat(set.kg) || 0) + weightStep).toString())}
                        >+</button>
                      </div>

                      {/* REPS input */}
                      <div className="workout-stepper">
                        <button
                          type="button"
                          className="workout-stepper-btn"
                          onClick={() => updateSet(ex.id, set.id, 'reps', Math.max(0, (parseFloat(set.reps) || 0) - 1).toString())}
                        >−</button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={set.targetReps || '—'}
                          value={set.reps || ''}
                          onChange={e => updateSet(ex.id, set.id, 'reps', e.target.value.replace(/[^0-9]/g, ''))}
                          className="workout-stepper-input"
                        />
                        <button
                          type="button"
                          className="workout-stepper-btn"
                          onClick={() => updateSet(ex.id, set.id, 'reps', ((parseFloat(set.reps) || 0) + 1).toString())}
                        >+</button>
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleToggleSet(ex.id, set.id, set.done)} 
                        className={`workout-check-btn ${set.done ? 'checked' : ''}`}
                        title={set.done ? tr('Segna come da completare') : tr('Completa serie')}
                      >
                        <Check size={17} strokeWidth={set.done ? 3 : 2} />
                      </button>
                    </div>
                    <ScienceSetControls workoutId={activeWorkout.id} exerciseId={ex.id} setId={set.id} disabled={Boolean(set.isDropset || set.isRestPause || set.isWarmup)} />
                  </SwipeToDelete>
                ))}

                <div className="workout-card-actions">
                  <button 
                    type="button"
                    onClick={() => addSet(ex.id)} 
                    className="workout-add-set-btn"
                  >
                    {tr('+ Serie')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

        <div className="wk-footer">
          <button type="button" className="wk-add-exercise" onClick={() => addExercise('')}>
            <Plus size={16} /> {tr('Esercizio')}
          </button>
          <button type="button" className="wk-cancel" onClick={() => { if (window.confirm(tr('Annullare senza salvare?'))) { cancelWorkout(); navigate('/'); } }}>
            {tr('Annulla')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Workout;
