import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, ChevronLeft, Trash2, Clock, FileText, Zap, Trophy, Dumbbell } from 'lucide-react';
import { useStore, findLastBest1RMSet, getExercise1RMStats } from '../../store/useStore';
import { ExerciseAutocomplete } from '../../components/ExerciseAutocomplete';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { requestNotificationPermission, notifyTimerComplete } from '../../utils/notifications';
import { normalizeName, EXERCISES_DB, getAllExercises, getWeightStep } from '../../data/exercises';
import { sanitizeDecimalInput } from '../../utils/number';
import './Workout.css';

function Workout() {
  const navigate = useNavigate();
  const activeWorkout = useStore(state => state.activeWorkout);
  const finishStoreWorkout = useStore(state => state.finishWorkout);
  const updateSet = useStore(state => state.updateActiveWorkoutSet);
  const updateExerciseNotes = useStore(state => state.updateActiveWorkoutExerciseNotes);
  const addExercise = useStore(state => state.addExerciseToActiveSession);
  const addSet = useStore(state => state.addSetToActiveExercise);
  const addDropset = useStore(state => state.addDropsetToActiveExercise);
  const deleteExercise = useStore(state => state.deleteExerciseFromActiveSession);
  const deleteSet = useStore(state => state.deleteSetFromActiveExercise);
  const cancelWorkout = useStore(state => state.cancelWorkout);
  const history = useStore(state => state.history);
  const customExercises = useStore(state => state.customExercises || []);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
  const allDB = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);

  const [sessionTimeStr, setSessionTimeStr] = useState('00:00');
  const isFinishing = useRef(false);
  const globalRestEndTime = useStore(state => state.globalRestEndTime);
  const setGlobalRestEndTime = useStore(state => state.setGlobalRestEndTime);
  const clearGlobalRestTimer = useStore(state => state.clearGlobalRestTimer);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState({});

  const toggleNotes = (id) => setExpandedNotes(p => ({ ...p, [id]: !p[id] }));

  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
      setSessionTimeStr(`${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  useEffect(() => {
    if (!globalRestEndTime) {
      setIsResting(false);
      setRestTimeLeft(0);
      return;
    }
    const check = () => {
      const rem = Math.ceil((globalRestEndTime - Date.now()) / 1000);
      if (rem <= 0) {
        setIsResting(false);
        setRestTimeLeft(0);
        clearGlobalRestTimer();
        notifyTimerComplete();
      } else {
        setIsResting(true);
        setRestTimeLeft(rem);
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [globalRestEndTime, clearGlobalRestTimer]);

  useEffect(() => { if (!activeWorkout && !isFinishing.current) navigate('/'); }, [activeWorkout, navigate]);
  if (!activeWorkout) return null;

  const handleToggleSet = (exerciseId, setId, done) => {
    const nowDone = !done;
    updateSet(exerciseId, setId, 'done', nowDone);
    if (nowDone) {
      const ex = activeWorkout.exercises.find(e => e.id === exerciseId);
      const secs = ex?.restTime !== undefined && ex.restTime !== '' ? parseInt(ex.restTime) : 60;
      if (secs > 0) { setGlobalRestEndTime(Date.now() + secs * 1000); setIsResting(true); }
    }
  };

  const handleFinishWorkout = () => {
    if (window.confirm("Terminare e salvare l'allenamento?")) {
      isFinishing.current = true;
      try { finishStoreWorkout(); navigate('/recap'); }
      catch (err) { isFinishing.current = false; alert('Errore: ' + err.message); }
    }
  };

  const handleUpdateExerciseNameLocally = (exerciseId, newName) => {
    useStore.setState(state => {
      if (!state.activeWorkout) return state;
      const hist = state.history || [];
      const templates = state.templates || [];
      const targetEx = state.activeWorkout.exercises.find(e => e.id === exerciseId);
      const isAdded = targetEx?.isAdded;

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
          <button type="button" className="ej-icon-btn ej-icon-btn--round wk-back" onClick={() => navigate('/')} title="Torna alla Home">
            <ChevronLeft size={20} />
          </button>

          <div className="wk-header-center">
            <p className="wk-header-name">{activeWorkout.name || 'Sessione Libera'}</p>
            <div className="wk-header-time">
              <span className="wk-clock">{sessionTimeStr}</span>
              <span className="wk-sets-pill">{doneSets}/{totalSets}</span>
            </div>
          </div>

          <button type="button" className="ej-btn ej-btn--primary wk-finish" onClick={handleFinishWorkout}>
            Termina
          </button>
        </div>

        {/* ── REST TIMER ────────────────────── */}
        {isResting && (
          <div className="wk-rest">
            <Clock size={20} className="wk-rest-icon" />
            <div className="wk-rest-text">
              <span className="wk-rest-label">Recupero</span>
              <span className="wk-rest-time">{fmtRest(restTimeLeft)}</span>
            </div>
            <button type="button" className="wk-rest-add" onClick={() => setGlobalRestEndTime(globalRestEndTime + 30000)}>+30s</button>
            <button type="button" className="ej-icon-btn ej-icon-btn--danger wk-rest-stop" onClick={() => clearGlobalRestTimer()} title="Interrompi recupero">
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ── EXERCISES ─────────────────────── */}
      <div className="wk-body">

        {/* Empty state */}
        {activeWorkout.exercises.length === 0 && (
          <div className="wk-empty">
            <span className="wk-empty-icon"><Dumbbell size={28} /></span>
            <p className="wk-empty-title">Nessun esercizio</p>
            <p className="wk-empty-sub">Tocca "+ Esercizio" qui sotto per iniziare la sessione</p>
          </div>
        )}

        {activeWorkout.exercises.map((ex, idx) => {
          const weightStep = getWeightStep(ex, allDB);
          const doneCount = ex.sets.filter(s => s.done).length;
          const stats1RM = getExercise1RMStats(history, ex.name);
          const hasLast1RM = !!(stats1RM.lastSession?.set && stats1RM.lastSession.max1RM > 0);
          const hasAllTime1RM = !!(stats1RM.allTime?.set && stats1RM.allTime.max1RM > 0);
          const has1RM = hasLast1RM || hasAllTime1RM;

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
                    placeholder="Seleziona esercizio…" 
                  />
                </div>
              </div>

              {/* Workout Exercise Card */}
              <div className="workout-exercise-card">
                {/* Meta & actions toolbar */}
                <div className="workout-exercise-subbar">
                  <div className="workout-exercise-meta-left">
                    <span className={`workout-progress-pill ${doneCount === ex.sets.length && ex.sets.length > 0 ? 'all-done' : ''}`}>
                      {doneCount}/{ex.sets.length} {doneCount === ex.sets.length && ex.sets.length > 0 ? 'completate' : 'serie'}
                    </span>
                  </div>
                  <div className="workout-exercise-meta-right">
                    <button
                      type="button"
                      onClick={() => toggleNotes(ex.id)}
                      title={ex.notes ? "Modifica nota" : "Aggiungi nota"}
                      className={`workout-note-btn ${ex.notes ? 'has-note' : ''}`}
                    >
                      <FileText size={13} />
                      <span>{ex.notes ? 'Nota' : '+ Nota'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const exName = ex.name?.trim() ? `l'esercizio "${ex.name}"` : 'questo esercizio';
                        if (window.confirm(`Sei sicuro di voler eliminare ${exName} dalla sessione?`)) {
                          deleteExercise(ex.id);
                        }
                      }}
                      className="workout-delete-ex-btn"
                      title="Rimuovi esercizio"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Best 1RM reference row - visible for ALL exercises on the same line */}
                {has1RM && (
                  <div className="workout-1rm-banner">
                    {hasLast1RM && (
                      <div className="workout-1rm-item">
                        <div className="workout-1rm-label-group">
                          <Zap size={11} className="workout-1rm-icon-zap" />
                          <span className="workout-1rm-tag">Ult:</span>
                        </div>
                        <span className="workout-1rm-val">
                          {stats1RM.lastSession.set.kg}kg × {stats1RM.lastSession.set.reps}
                        </span>
                        <span className="workout-1rm-badge">
                          1RM {stats1RM.lastSession.max1RM}kg
                        </span>
                      </div>
                    )}

                    {hasLast1RM && hasAllTime1RM && (
                      <div className="workout-1rm-sep" />
                    )}

                    {hasAllTime1RM && (
                      <div className="workout-1rm-item">
                        <div className="workout-1rm-label-group">
                          <Trophy size={11} className="workout-1rm-icon-zap" />
                          <span className="workout-1rm-tag">PR:</span>
                        </div>
                        <span className="workout-1rm-val">
                          {stats1RM.allTime.set.kg}kg × {stats1RM.allTime.set.reps}
                        </span>
                        <span className="workout-1rm-badge">
                          1RM {stats1RM.allTime.max1RM}kg
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
                    placeholder="Aggiungi nota (es. presa larga, fermo al petto 1s)..."
                    value={ex.notes || ''}
                    onChange={e => updateExerciseNotes(ex.id, e.target.value)}
                    className="workout-notes-input"
                  />
                </div>
              )}

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
                      if (window.confirm(`Eliminare la serie ${set.isDropset ? 'Drop' : sIdx + 1}?`)) {
                        deleteSet(ex.id, set.id);
                      }
                    }}
                  >
                    <div className={`workout-set-row-item ${set.done ? 'is-completed' : ''}`}>
                      <span className={`workout-set-badge ${set.isDropset ? 'is-dropset' : ''}`}>
                        {set.isDropset ? 'D' : sIdx + 1}
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
                        title={set.done ? "Segna come da completare" : "Completa serie"}
                      >
                        <Check size={17} strokeWidth={set.done ? 3 : 2} />
                      </button>
                    </div>
                  </SwipeToDelete>
                ))}

                <div className="workout-card-actions">
                  <button 
                    type="button"
                    onClick={() => addSet(ex.id)} 
                    className="workout-add-set-btn"
                  >
                    + Serie
                  </button>
                  <button 
                    type="button"
                    onClick={() => addDropset(ex.id)} 
                    className="workout-add-drop-btn"
                  >
                    + Drop
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

        <div className="wk-footer">
          <button type="button" className="wk-add-exercise" onClick={() => addExercise('')}>
            <Plus size={16} /> Esercizio
          </button>
          <button type="button" className="wk-cancel" onClick={() => { if (window.confirm('Annullare senza salvare?')) { cancelWorkout(); navigate('/'); } }}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

export default Workout;
