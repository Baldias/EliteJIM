import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Play, Pause, X, ChevronLeft } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { requestNotificationPermission, notifyTimerComplete } from '../utils/notifications';
import './Workout.css';

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

  const sessionTime = useState('00:00')[0]; // kept logic below but removed duplicate set
  const [sessionTimeStr, setSessionTimeStr] = useState('00:00');

  // Rest Timer State
  const globalRestEndTime = useStore(state => state.globalRestEndTime);
  const setGlobalRestEndTime = useStore(state => state.setGlobalRestEndTime);
  const clearGlobalRestTimer = useStore(state => state.clearGlobalRestTimer);
  
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [exerciseFatigue, setExerciseFatigue] = useState({});

  // Ask for notification permission when they start a workout
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // General session timer
  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setSessionTimeStr(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  // Rest timer sync with global store
  useEffect(() => {
    if (!globalRestEndTime) {
      setIsResting(false);
      setRestTimeLeft(0);
      return;
    }

    setIsResting(true);

    const checkTimer = () => {
      const remaining = Math.ceil((globalRestEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setIsResting(false);
        setRestTimeLeft(0);
        clearGlobalRestTimer();
        notifyTimerComplete(); // Web Audio Beep + Push Notification
      } else {
        setRestTimeLeft(remaining);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [globalRestEndTime, clearGlobalRestTimer]);

  // Protection if user reloads without active session
  useEffect(() => {
    if (!activeWorkout) {
      navigate('/');
    }
  }, [activeWorkout, navigate]);

  if (!activeWorkout) return null;

  const handleToggleSet = (exerciseId, setId, currentDoneStatus) => {
    const isNowDone = !currentDoneStatus;
    // Save the exercise-level fatigue to the set when marking done
    if (isNowDone) {
      const color = exerciseFatigue[exerciseId] || 'yellow';
      updateSet(exerciseId, setId, 'fatigue', color);
    }
    updateSet(exerciseId, setId, 'done', isNowDone);

    // Start rest timer automatically if just finished a set
    if (isNowDone) {
      const exercise = activeWorkout.exercises.find(ex => ex.id === exerciseId);
      const restSeconds = exercise && exercise.restTime !== undefined && exercise.restTime !== '' ? parseInt(exercise.restTime) : 60;
      if (restSeconds > 0) {
        setGlobalRestEndTime(Date.now() + restSeconds * 1000);
        setIsResting(true);
      }
    }
  };

  const cycleFatigue = (exerciseId) => {
    const cycle = { green: 'yellow', yellow: 'red', red: 'green' };
    const current = exerciseFatigue[exerciseId] || 'yellow';
    setExerciseFatigue(prev => ({ ...prev, [exerciseId]: cycle[current] }));
  };

  const handleFinishWorkout = () => {
    if (window.confirm("Sei sicuro di voler terminare l'allenamento?")) {
      finishStoreWorkout();
      navigate('/profile');
    }
  };

  const handleCancelWorkout = () => {
    if (window.confirm("Vuoi davvero annullare questo allenamento senza salvarlo?")) {
      cancelWorkout();
      navigate('/');
    }
  };

  const handleDeleteExercise = (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo esercizio?")) {
      deleteExercise(id);
    }
  };

  const formatRestTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // We need a helper to update the *name* of an exercise in the active workout
  // This requires a new store action, but for now we can rely on a local workaround,
  // or better, update the store. We'll add the store logic in a separate step or just 
  // bypass it if it's already in the template. If it's a new exercise, we want to name it.
  const handleUpdateExerciseNameLocally = (exerciseId, newName) => {
    useStore.setState(state => {
      if (!state.activeWorkout) return state;

      const pastWorkout = state.history.find(w => w.exercises.some(e => e.name === newName));
      const pastEx = pastWorkout ? pastWorkout.exercises.find(e => e.name === newName) : null;

      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map(ex => {
            if (ex.id !== exerciseId) return ex;

            const updatedSets = ex.sets.map((set, i) => {
              if (!set.kg && !set.reps && pastEx && pastEx.sets && pastEx.sets.length > 0) {
                const pastSet = pastEx.sets[i] || pastEx.sets[pastEx.sets.length - 1];
                return {
                  ...set,
                  kg: pastSet.kg || '',
                  reps: pastSet.reps || ''
                };
              }
              return set;
            });

            return { ...ex, name: newName, sets: updatedSets };
          })
        }
      };
    });
  };

  const numberedExercises = activeWorkout.exercises.map((ex, index) => {
    return { ...ex, displayNum: `${index + 1}`, index };
  });

  return (
    <div className="workout-container">
      <header className="workout-header">
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-main)', 
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer'
          }}
          aria-label="Torna alla Home"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="workout-timer" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>{sessionTimeStr}</div>
        <button className="finish-btn" onClick={handleFinishWorkout}>Termina</button>
      </header>

      {/* Rest Timer Overlay */}
      {isResting && (
        <div className="rest-timer-bar">
          <div className="rest-info">
            <span className="rest-label">Recupero</span>
            <span className="rest-clock">{formatRestTime(restTimeLeft)}</span>
          </div>
          <div className="rest-controls">
            <button className="icon-btn-small" onClick={() => setGlobalRestEndTime(globalRestEndTime + 30000)}>+30s</button>
            <button className="icon-btn-small finish-rest-btn" onClick={() => clearGlobalRestTimer()}><X size={20} /></button>
          </div>
        </div>
      )}

      <div className="workout-content">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
          {activeWorkout.name}
        </h2>
        {numberedExercises.map((ex) => {
          const weightStep = (ex.name || '').toLowerCase().includes('manubri') ? 2 : 2.5;
          return (
            <div key={ex.id} className="exercise-card" style={{ position: 'relative' }}>
              <SwipeToDelete onDelete={() => handleDeleteExercise(ex.id)}>
                <div className="exercise-header" style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="ex-number" style={{ display: 'inline-flex', marginRight: '8px' }}>
                    {ex.displayNum}
                  </span>
                  <div style={{ flex: 1 }}>
                    <ExerciseAutocomplete
                      value={ex.name}
                      onChange={(val) => handleUpdateExerciseNameLocally(ex.id, val)}
                      placeholder="Seleziona Esercizio"
                    />
                  </div>
                  <div
                    className={`fatigue-dot-header ${exerciseFatigue[ex.id] || 'yellow'}`}
                    onClick={() => cycleFatigue(ex.id)}
                    title="Fatica (click per cambiare)"
                  />
                </div>
              </SwipeToDelete>

              <div className="sets-header" style={{ marginTop: '12px' }}>
                <span>Set</span>
                <span>kg</span>
                <span>Reps</span>
                <span></span>
              </div>

              {ex.sets.map((set, setIdx) => (
                <SwipeToDelete key={set.id} onDelete={() => deleteSet(ex.id, set.id)}>
                  <div className={`set-row ${set.done ? 'done' : ''} ${set.isDropset ? 'is-dropset' : ''}`}>
                    <div className="set-number" style={{ fontSize: set.isDropset ? '0.75rem' : '1rem', color: set.isDropset ? 'var(--primary-color)' : '' }}>
                      {set.isDropset ? 'Drop' : setIdx + 1}
                    </div>
                    <div className="workout-input-group">
                      <button
                        className="workout-num-btn"
                        onClick={() => {
                          const currentVal = parseFloat(set.kg) || 0;
                          updateSet(ex.id, set.id, 'kg', Math.max(0, currentVal - weightStep).toString());
                        }}
                      >-</button>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="-"
                        value={set.kg || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          updateSet(ex.id, set.id, 'kg', val);
                        }}
                      />
                      <button
                        className="workout-num-btn"
                        onClick={() => {
                          const currentVal = parseFloat(set.kg) || 0;
                          updateSet(ex.id, set.id, 'kg', (currentVal + weightStep).toString());
                        }}
                      >+</button>
                    </div>
                    <div className="workout-input-group">
                      <button
                        className="workout-num-btn"
                        onClick={() => {
                          const currentVal = parseFloat(set.reps) || 0;
                          updateSet(ex.id, set.id, 'reps', Math.max(0, currentVal - 1).toString());
                        }}
                      >-</button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={set.targetReps || "-"}
                        value={set.reps || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          updateSet(ex.id, set.id, 'reps', val);
                        }}
                      />
                      <button
                        className="workout-num-btn"
                        onClick={() => {
                          const currentVal = parseFloat(set.reps) || 0;
                          updateSet(ex.id, set.id, 'reps', (currentVal + 1).toString());
                        }}
                      >+</button>
                    </div>
                    <button
                      className={`check-btn ${set.done ? 'checked' : ''}`}
                      onClick={() => handleToggleSet(ex.id, set.id, set.done)}
                    >
                      <Check size={18} />
                    </button>
                  </div>
                </SwipeToDelete>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button className="add-set-btn" style={{ flex: 1 }} onClick={() => addSet(ex.id)}>+ Set</button>
                <button className="add-set-btn" style={{ flex: 1, backgroundColor: 'var(--surface-color-elevated)', color: 'var(--text-muted)' }} onClick={() => addDropset(ex.id)}>+ Drop</button>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="add-exercise-btn" style={{ flex: 1 }} onClick={() => addExercise('')}>
            <Plus size={20} /> Esercizio
          </button>
          <button
            className="add-exercise-btn"
            style={{ flex: 1, backgroundColor: 'rgba(255,69,58,0.15)', color: 'var(--error-color)' }}
            onClick={handleCancelWorkout}
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

export default Workout;
