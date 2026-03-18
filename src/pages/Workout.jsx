import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, ChevronLeft, Trash2, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { requestNotificationPermission, notifyTimerComplete } from '../utils/notifications';

function Workout() {
  const navigate = useNavigate();
  const activeWorkout = useStore(state => state.activeWorkout);
  const finishStoreWorkout = useStore(state => state.finishWorkout);
  const updateSet = useStore(state => state.updateActiveWorkoutSet);
  const addExercise = useStore(state => state.addExerciseToActiveSession);
  const addSet = useStore(state => state.addSetToActiveExercise);
  const addDropset = useStore(state => state.addDropsetToActiveExercise);
  const deleteExercise = useStore(state => state.deleteExerciseFromActiveSession);
  const deleteSet = useStore(state => state.deleteSetFromActiveExercise);
  const cancelWorkout = useStore(state => state.cancelWorkout);

  const [sessionTimeStr, setSessionTimeStr] = useState('00:00');
  const isFinishing = useRef(false);
  const globalRestEndTime = useStore(state => state.globalRestEndTime);
  const setGlobalRestEndTime = useStore(state => state.setGlobalRestEndTime);
  const clearGlobalRestTimer = useStore(state => state.clearGlobalRestTimer);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [exerciseFatigue, setExerciseFatigue] = useState({});

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
    if (nowDone) updateSet(exerciseId, setId, 'fatigue', exerciseFatigue[exerciseId] || 'yellow');
    updateSet(exerciseId, setId, 'done', nowDone);
    if (nowDone) {
      const ex = activeWorkout.exercises.find(e => e.id === exerciseId);
      const secs = ex?.restTime !== undefined && ex.restTime !== '' ? parseInt(ex.restTime) : 60;
      if (secs > 0) { setGlobalRestEndTime(Date.now() + secs * 1000); setIsResting(true); }
    }
  };

  const cycleFatigue = (id) => {
    const cycle = { green: 'yellow', yellow: 'red', red: 'green' };
    setExerciseFatigue(p => ({ ...p, [id]: cycle[p[id] || 'yellow'] }));
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
      const pastWk = state.history.find(w => w.exercises.some(e => e.name === newName));
      const pastEx = pastWk?.exercises.find(e => e.name === newName);
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map(ex => {
            if (ex.id !== exerciseId) return ex;
            const sets = ex.sets.map((s, i) => {
              if (!s.kg && !s.reps && pastEx?.sets?.length > 0) {
                const ps = pastEx.sets[i] || pastEx.sets[pastEx.sets.length - 1];
                return { ...s, kg: ps.kg || '', reps: ps.reps || '' };
              }
              return s;
            });
            return { ...ex, name: newName, sets };
          })
        }
      };
    });
  };

  const doneSets = activeWorkout.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);
  const totalSets = activeWorkout.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const fmtRest = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const FATIGUE = { green: '#34c759', yellow: '#ff9500', red: '#ff3b30' };

  return (
    <div style={{ minHeight: '100vh', background: '#080c10', display: 'flex', flexDirection: 'column' }}>

      {/* ── STICKY HEADER ─────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,12,16,0.97)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(0,184,212,0.15)',
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
        <button onClick={handleFinishWorkout} style={{
          flexShrink: 0,
          background: 'linear-gradient(135deg, #00b8d4 0%, #0090b0 100%)',
          border: 'none', borderRadius: '10px', padding: '9px 16px',
          color: 'white', fontWeight: '800', fontSize: '0.88rem',
          boxShadow: '0 4px 14px rgba(0,184,212,0.3)', width: 'auto'
        }}>
          Termina
        </button>
      </div>

      {/* ── REST TIMER ────────────────────── */}
      {isResting && (
        <div style={{
          background: 'rgba(0,100,130,0.2)',
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
          const weightStep = (ex.name || '').toLowerCase().includes('manubri') ? 2 : 2.5;
          const fatigue = exerciseFatigue[ex.id] || 'yellow';
          const doneCount = ex.sets.filter(s => s.done).length;

          return (
            <div key={ex.id} style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', marginBottom: '10px', overflow: 'hidden'
            }}>
              {/* Exercise name row */}
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ minWidth: '24px', height: '24px', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255,255,255,0.4)' }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ExerciseAutocomplete value={ex.name} onChange={val => handleUpdateExerciseNameLocally(ex.id, val)} placeholder="Seleziona esercizio…" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>{doneCount}/{ex.sets.length}</span>
                  <button onClick={() => cycleFatigue(ex.id)} title="Fatica" style={{ width: '18px', height: '18px', borderRadius: '50%', background: FATIGUE[fatigue], border: 'none', cursor: 'pointer', boxShadow: `0 0 6px ${FATIGUE[fatigue]}80` }} />
                  <button onClick={() => { if (window.confirm('Eliminare?')) deleteExercise(ex.id); }} style={{ background: 'transparent', border: 'none', padding: '3px', color: 'rgba(255,59,48,0.5)', display: 'flex' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Sets */}
              <div style={{ padding: '8px 12px 10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 42px', gap: '6px', marginBottom: '6px', padding: '0 2px' }}>
                  {['#', 'kg', 'reps', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</span>
                  ))}
                </div>

                {ex.sets.map((set, sIdx) => (
                  <SwipeToDelete key={set.id} onDelete={() => deleteSet(ex.id, set.id)}>
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
