import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, ChevronLeft, Trash2, Clock, FileText, Zap } from 'lucide-react';
import { useStore, findLastBest1RMSet } from '../../store/useStore';
import { ExerciseAutocomplete } from '../../components/ExerciseAutocomplete';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { requestNotificationPermission, notifyTimerComplete } from '../../utils/notifications';
import { normalizeName, EXERCISES_DB, getAllExercises, getWeightStep } from '../../data/exercises';

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
    if (!globalRestEndTime) { setIsResting(false); setRestTimeLeft(0); return; }
    setIsResting(true);

    const check = () => {
      const rem = Math.ceil((globalRestEndTime - Date.now()) / 1000);
      if (rem <= 0) { setIsResting(false); setRestTimeLeft(0); clearGlobalRestTimer(); notifyTimerComplete(); }
      else setRestTimeLeft(rem);
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

      const bestData = isAdded ? findLastBest1RMSet(hist, newName) : null;
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
          const customExercises = useStore.getState().customExercises || [];
          const exerciseOverrides = useStore.getState().exerciseOverrides || {};
          const allDB = getAllExercises(customExercises, exerciseOverrides);
          const weightStep = getWeightStep(ex, allDB);
          const doneCount = ex.sets.filter(s => s.done).length;
          const best1RMData = findLastBest1RMSet(history, ex.name);

          return (
            <div key={ex.id} style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', marginBottom: '10px', 
              position: 'relative', zIndex: activeWorkout.exercises.length - idx
            }}>
              {/* Exercise name row */}
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ minWidth: '24px', height: '24px', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255,255,255,0.4)' }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ExerciseAutocomplete value={ex.name} onChange={val => handleUpdateExerciseNameLocally(ex.id, val)} placeholder="Seleziona esercizio…" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>{doneCount}/{ex.sets.length}</span>
                  <button
                    onClick={() => toggleNotes(ex.id)}
                    title={ex.notes ? "Modifica nota" : "Aggiungi nota"}
                    style={{
                      background: ex.notes ? 'rgba(0,184,212,0.15)' : 'rgba(255,255,255,0.06)',
                      border: ex.notes ? '1px solid rgba(0,184,212,0.35)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      color: ex.notes ? '#00e5ff' : 'rgba(255,255,255,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      fontSize: '0.72rem',
                      fontWeight: '700'
                    }}
                  >
                    <FileText size={13} />
                    <span>{ex.notes ? 'Nota' : '+ Nota'}</span>
                  </button>
                  <button
                    onClick={() => {
                      const exName = ex.name?.trim() ? `l'esercizio "${ex.name}"` : 'questo esercizio';
                      if (window.confirm(`Sei sicuro di voler eliminare ${exName} dalla sessione?`)) {
                        deleteExercise(ex.id);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', padding: '3px', color: 'rgba(255,59,48,0.5)', display: 'flex' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Best 1RM reference row - only for added exercises */}
              {ex.isAdded && best1RMData && best1RMData.set && (
                <div style={{
                  padding: '6px 12px',
                  background: 'rgba(0, 184, 212, 0.05)',
                  borderBottom: '1px solid rgba(0, 184, 212, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.72rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Zap size={12} color="#00e5ff" />
                    <span style={{ color: '#00e5ff', fontWeight: '700' }}>Ultimo max 1RM:</span>
                    <span style={{ fontWeight: '600' }}>{best1RMData.set.kg}kg × {best1RMData.set.reps} reps</span>
                  </span>
                  <span style={{ color: 'rgba(0, 229, 255, 0.95)', fontWeight: '800' }}>
                    1RM ~ {best1RMData.max1RM}kg
                  </span>
                </div>
              )}

              {/* Notes row */}
              {(expandedNotes[ex.id] || ex.notes) && (
                <div style={{
                  padding: '6px 12px',
                  background: 'rgba(0, 184, 212, 0.02)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FileText size={12} color="#00b8d4" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Aggiungi nota per questo esercizio (es. presa larga, fermo 1s)..."
                    value={ex.notes || ''}
                    onChange={e => updateExerciseNotes(ex.id, e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#e0f7fa',
                      fontSize: '0.78rem',
                      outline: 'none',
                      padding: 0
                    }}
                  />
                </div>
              )}

              {/* Sets */}
              <div style={{ padding: '8px 12px 10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 42px', gap: '6px', marginBottom: '6px', padding: '0 2px' }}>
                  {['#', 'kg', 'reps', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</span>
                  ))}
                </div>

                {ex.sets.map((set, sIdx) => (
                  <SwipeToDelete key={set.id} onDelete={() => {
                    if (window.confirm(`Eliminare la serie ${set.isDropset ? 'Drop' : sIdx + 1}?`)) {
                      deleteSet(ex.id, set.id);
                    }
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '24px 1fr 1fr 42px',
                      gap: '6px', alignItems: 'center', marginBottom: '5px',
                      padding: '4px 2px',
                      background: set.done ? 'rgba(52,199,89,0.07)' : 'transparent',
                      borderRadius: '8px', transition: 'background 0.2s'
                    }}>
                      <span style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: '700', color: set.isDropset ? '#00b8d4' : (set.done ? '#34c759' : 'rgba(255,255,255,0.3)') }}>
                        {set.isDropset ? 'D' : sIdx + 1}
                      </span>

                      {/* KG input */}
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', height: '36px' }}>
                        <button
                          onClick={() => updateSet(ex.id, set.id, 'kg', Math.max(0, (parseFloat(set.kg) || 0) - weightStep).toString())}
                          style={{ padding: '0 10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontWeight: '700', fontSize: '1rem', lineHeight: 1 }}
                        >−</button>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="—"
                          value={set.kg || ''}
                          onChange={e => updateSet(ex.id, set.id, 'kg', e.target.value.replace(/[^0-9.]/g, ''))}
                          style={{ flex: 1, textAlign: 'center', background: 'transparent', border: 'none', color: 'white', fontWeight: '700', fontSize: '0.9rem', minWidth: 0, outline: 'none', width: '100%' }}
                        />
                        <button
                          onClick={() => updateSet(ex.id, set.id, 'kg', ((parseFloat(set.kg) || 0) + weightStep).toString())}
                          style={{ padding: '0 10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontWeight: '700', fontSize: '1rem', lineHeight: 1 }}
                        >+</button>
                      </div>

                      {/* REPS input */}
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', height: '36px' }}>
                        <button
                          onClick={() => updateSet(ex.id, set.id, 'reps', Math.max(0, (parseFloat(set.reps) || 0) - 1).toString())}
                          style={{ padding: '0 10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontWeight: '700', fontSize: '1rem', lineHeight: 1 }}
                        >−</button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={set.targetReps || '—'}
                          value={set.reps || ''}
                          onChange={e => updateSet(ex.id, set.id, 'reps', e.target.value.replace(/[^0-9]/g, ''))}
                          style={{ flex: 1, textAlign: 'center', background: 'transparent', border: 'none', color: 'white', fontWeight: '700', fontSize: '0.9rem', minWidth: 0, outline: 'none', width: '100%' }}
                        />
                        <button
                          onClick={() => updateSet(ex.id, set.id, 'reps', ((parseFloat(set.reps) || 0) + 1).toString())}
                          style={{ padding: '0 10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontWeight: '700', fontSize: '1rem', lineHeight: 1 }}
                        >+</button>
                      </div>

                      <button onClick={() => handleToggleSet(ex.id, set.id, set.done)} style={{
                        width: '40px', height: '36px', borderRadius: '8px', border: 'none',
                        background: set.done ? '#34c759' : 'rgba(255,255,255,0.06)',
                        color: set.done ? 'white' : 'rgba(255,255,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.18s'
                      }}>
                        <Check size={16} strokeWidth={set.done ? 3 : 1.5} />
                      </button>
                    </div>
                  </SwipeToDelete>
                ))}

                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button onClick={() => addSet(ex.id)} style={{ flex: 1, padding: '7px', background: 'rgba(0,184,212,0.08)', border: '1px solid rgba(0,184,212,0.15)', borderRadius: '8px', color: '#00b8d4', fontWeight: '700', fontSize: '0.8rem' }}>
                    + Serie
                  </button>
                  <button onClick={() => addDropset(ex.id)} style={{ flex: 1, padding: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: '600', fontSize: '0.8rem' }}>
                    + Drop
                  </button>
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
