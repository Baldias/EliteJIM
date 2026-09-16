import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, ChevronLeft, Trash2, Clock, FileText, Zap, Trophy } from 'lucide-react';
import { useStore, findLastBest1RMSet, getExercise1RMStats } from '../../store/useStore';
import { ExerciseAutocomplete } from '../../components/ExerciseAutocomplete';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { requestNotificationPermission, notifyTimerComplete } from '../../utils/notifications';
import { normalizeName, EXERCISES_DB, getAllExercises, getWeightStep } from '../../data/exercises';
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
      const pastWk = hist.find(w => w.exercises?.some(e => normalizeName(e.name) === norm));
      const pastEx = pastWk?.exercises?.find(e => normalizeName(e.name) === norm);

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
    <div style={{ minHeight: '100vh', background: '#080c10', display: 'flex', flexDirection: 'column' }}>

      {/* ── STICKY HEADER & TIMER ─────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'rgba(8,12,16,0.97)', backdropFilter: 'blur(24px)',
          borderBottom: isResting ? 'none' : '1px solid rgba(0,184,212,0.15)',
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
        {/* Back — fixed width */}
        <button onClick={() => navigate('/')} style={{
          flexShrink: 0,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          borderRadius: '10px', padding: '8px 10px',
          color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', width: 'auto'
        }}>
          <ChevronLeft size={20} />
        </button>

        {/* Centre — name + timer */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <p style={{
            margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)',
            fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {activeWorkout.name || 'SESSIONE LIBERA'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '2px' }}>
            <Clock size={11} color="#00b8d4" />
            <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'white', fontVariantNumeric: 'tabular-nums' }}>{sessionTimeStr}</span>
            <span style={{ background: 'rgba(0,184,212,0.15)', color: '#00b8d4', padding: '1px 7px', borderRadius: '7px', fontSize: '0.68rem', fontWeight: '700' }}>{doneSets}/{totalSets}</span>
          </div>
        </div>

        {/* Termina — fixed width */}
        <button 
          onClick={handleFinishWorkout} 
          style={{
            flexShrink: 0,
            background: 'linear-gradient(135deg, #00b8d4 0%, #00e5ff 100%)',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 16px',
            color: 'white',
            fontSize: '0.85rem',
            fontWeight: '800',
            boxShadow: '0 4px 12px rgba(0,184,212,0.3)',
            cursor: 'pointer',
            zIndex: 110
          }}
        >
          TERMINA
        </button>
        </div>

        {/* ── REST TIMER ────────────────────── */}
        {isResting && (
          <div style={{
            background: 'rgba(4, 25, 35, 0.95)', /* Darker, less transparent background so scrolled content isn't visible */
            backdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(0,184,212,0.2)',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.62rem', color: '#00b8d4', fontWeight: '800', letterSpacing: '1px' }}>⏱ RECUPERO</p>
              <p style={{ margin: '1px 0 0', fontWeight: '900', fontSize: '1.8rem', color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtRest(restTimeLeft)}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setGlobalRestEndTime(globalRestEndTime + 30000)} style={{ background: 'rgba(0,184,212,0.15)', border: '1px solid rgba(0,184,212,0.25)', borderRadius: '10px', padding: '7px 14px', color: '#00b8d4', fontWeight: '800', fontSize: '0.85rem' }}>+30s</button>
              <button onClick={() => clearGlobalRestTimer()} style={{ background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3b30' }}>
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── EXERCISES ─────────────────────── */}
      <div style={{ flex: 1, padding: '12px 14px 120px' }}>

        {/* Empty state */}
        {activeWorkout.exercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏋️</div>
            <p style={{ color: 'white', fontWeight: '700', fontSize: '1.1rem', margin: '0 0 6px' }}>Nessun esercizio</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', margin: '0 0 1.5rem' }}>Tocca "+ Esercizio" qui sotto per iniziare la sessione</p>
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
                  <FileText size={13} color="#00b8d4" style={{ flexShrink: 0 }} />
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
                          onChange={e => updateSet(ex.id, set.id, 'kg', e.target.value.replace(/[^0-9.]/g, ''))}
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

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => addExercise('')} style={{
            flex: 1, padding: '11px',
            background: 'rgba(0,184,212,0.07)', border: '1px dashed rgba(0,184,212,0.25)',
            borderRadius: '12px', color: '#00b8d4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            fontWeight: '700', fontSize: '0.9rem'
          }}>
            <Plus size={16} /> Esercizio
          </button>
          <button onClick={() => { if (window.confirm('Annullare senza salvare?')) { cancelWorkout(); navigate('/'); } }} style={{
            padding: '11px 18px',
            background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)',
            borderRadius: '12px', color: 'rgba(255,59,48,0.7)', fontWeight: '700', fontSize: '0.85rem'
          }}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

export default Workout;
