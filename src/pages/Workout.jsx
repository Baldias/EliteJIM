import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Play, Pause, X, Link } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
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
  const toggleSuperset = useStore(state => state.toggleSupersetWithPrevious);
  const cancelWorkout = useStore(state => state.cancelWorkout);

  const [sessionTime, setSessionTime] = useState('00:00');

  // Rest Timer State
  const [restEndTime, setRestEndTime] = useState(null);
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
      setSessionTime(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  // Rest timer
  useEffect(() => {
    if (!isResting || !restEndTime) return;

    // Check immediately to set the right value without 1sec delay
    const updateTimer = () => {
      const remaining = Math.ceil((restEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setIsResting(false);
        setRestTimeLeft(0);
        setRestEndTime(null);
        notifyTimerComplete(); // Web Audio Beep + Push Notification
      } else {
        setRestTimeLeft(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isResting, restEndTime]);

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
        setRestEndTime(Date.now() + restSeconds * 1000);
        setRestTimeLeft(restSeconds);
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

  let currentNum = 0;
  let currentLetterCode = 65; // 'A'
  let lastSupersetId = null;

  const numberedExercises = activeWorkout.exercises.map((ex, index) => {
    const prevEx = index > 0 ? activeWorkout.exercises[index - 1] : null;
    const nextEx = index < activeWorkout.exercises.length - 1 ? activeWorkout.exercises[index + 1] : null;

    const isTrueSuperset = ex.supersetId && ((prevEx && prevEx.supersetId === ex.supersetId) || (nextEx && nextEx.supersetId === ex.supersetId));

    if (isTrueSuperset && ex.supersetId === lastSupersetId) {
      currentLetterCode++;
    } else {
      currentNum++;
      currentLetterCode = 65;
    }
    lastSupersetId = ex.supersetId;

    const displayNum = isTrueSuperset ? `${currentNum}${String.fromCharCode(currentLetterCode)}` : `${currentNum}`;

    const isLinkedToPrev = index > 0 && ex.supersetId && ex.supersetId === activeWorkout.exercises[index - 1].supersetId;

    return { ...ex, displayNum, index, isLinkedToPrev, isTrueSuperset };
  });

  return (
    <div className="workout-container">
      <header className="workout-header">
        <div className="workout-timer">{sessionTime}</div>
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
            <button className="icon-btn-small" onClick={() => setRestEndTime(prev => prev + 30000)}>+30s</button>
            <button className="icon-btn-small finish-rest-btn" onClick={() => setIsResting(false)}><X size={20} /></button>
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
            <div key={ex.id} className="exercise-card" style={{ position: 'relative', marginTop: ex.isLinkedToPrev ? '-0.5rem' : '0' }}>
              {ex.isLinkedToPrev && (
                <div style={{ position: 'absolute', top: '-15px', left: '20px', width: '2px', height: '15px', backgroundColor: 'var(--primary-color)' }} />
              )}
              <div className="exercise-header" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="ex-number" style={{ display: 'inline-flex', marginRight: '8px', backgroundColor: ex.isTrueSuperset ? 'var(--primary-color)' : '', color: ex.isTrueSuperset ? '#000' : '' }}>
                  {ex.displayNum}
                </span>
                <div style={{ flex: 1 }}>
                  <ExerciseAutocomplete
                    value={ex.name}
                    onChange={(val) => handleUpdateExerciseNameLocally(ex.id, val)}
                    placeholder="Seleziona Esercizio"
                  />
                </div>
                {ex.index > 0 && (
                  <button
                    className="icon-btn-small"
                    onClick={() => toggleSuperset(ex.index)}
                    style={{
                      marginLeft: '8px',
                      backgroundColor: ex.isLinkedToPrev ? 'var(--primary-color)' : 'transparent',
                      color: ex.isLinkedToPrev ? '#000' : 'var(--text-muted)'
                    }}
                    title="Collega al precedente (Superserie)"
                  >
                    <Link size={18} />
                  </button>
                )}
                <div
                  className={`fatigue-dot-header ${exerciseFatigue[ex.id] || 'yellow'}`}
                  onClick={() => cycleFatigue(ex.id)}
                  title="Fatica (click per cambiare)"
                />
              </div>

              <div className="sets-header" style={{ marginTop: '12px' }}>
                <span>Set</span>
                <span>kg</span>
                <span>Reps</span>
                <span></span>
              </div>

              {ex.sets.map((set, setIdx) => (
                <React.Fragment key={set.id}>
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
                </React.Fragment>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button className="add-set-btn" style={{ flex: 1 }} onClick={() => addSet(ex.id)}>+ Set</button>
                <button className="add-set-btn" style={{ flex: 1, backgroundColor: 'var(--surface-color-elevated)', color: 'var(--text-muted)' }} onClick={() => addDropset(ex.id)}>+ Drop</button>
              </div>
            </div>
          )
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
