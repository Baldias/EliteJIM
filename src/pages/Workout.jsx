import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Play, Pause, X } from 'lucide-react';
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
  const cancelWorkout = useStore(state => state.cancelWorkout);

  const [sessionTime, setSessionTime] = useState('00:00');

  // Rest Timer State
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isResting, setIsResting] = useState(false);

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
    if (!isResting || restTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setRestTimeLeft(prev => {
        if (prev <= 1) {
          setIsResting(false);
          notifyTimerComplete(); // Web Audio Beep + Push Notification
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isResting, restTimeLeft]);

  // Protection if user reloads without active session
  useEffect(() => {
    if (!activeWorkout) {
      navigate('/');
    }
  }, [activeWorkout, navigate]);

  if (!activeWorkout) return null;

  const handleToggleSet = (exerciseId, setId, currentDoneStatus) => {
    const isNowDone = !currentDoneStatus;
    updateSet(exerciseId, setId, 'done', isNowDone);

    // Start rest timer automatically if just finished a set
    if (isNowDone) {
      const exercise = activeWorkout.exercises.find(ex => ex.id === exerciseId);
      const restSeconds = exercise && exercise.restTime !== undefined && exercise.restTime !== '' ? parseInt(exercise.restTime) : 60;
      if (restSeconds > 0) {
        setRestTimeLeft(restSeconds);
        setIsResting(true);
      }
    }
  };

  const handleFinishWorkout = () => {
    if (window.confirm("Sei sicuro di voler terminare l'allenamento?")) {
      finishStoreWorkout();
      navigate('/history');
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
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map(ex =>
            ex.id === exerciseId ? { ...ex, name: newName } : ex
          )
        }
      }
    })
  }

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
            <button className="icon-btn-small" onClick={() => setRestTimeLeft(prev => prev + 30)}>+30s</button>
            <button className="icon-btn-small finish-rest-btn" onClick={() => setIsResting(false)}><X size={20} /></button>
          </div>
        </div>
      )}

      <div className="workout-content">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
          {activeWorkout.name}
        </h2>

        {activeWorkout.exercises.map((ex, exIdx) => (
          <div key={ex.id} className="exercise-card">
            <div className="exercise-header">
              <span className="ex-number" style={{ display: 'inline-flex', marginRight: '8px', verticalAlign: 'middle' }}>{exIdx + 1}</span>
              <div style={{ display: 'inline-block', width: 'calc(100% - 40px)', verticalAlign: 'middle' }}>
                <ExerciseAutocomplete
                  value={ex.name}
                  onChange={(val) => handleUpdateExerciseNameLocally(ex.id, val)}
                  placeholder="Seleziona Esercizio"
                />
              </div>
            </div>

            <div className="sets-header" style={{ marginTop: '12px' }}>
              <span>Set</span>
              <span>kg</span>
              <span>Reps</span>
              <span><Check size={16} /></span>
            </div>

            {ex.sets.map((set, setIdx) => (
              <div key={set.id} className={`set-row ${set.done ? 'done' : ''}`}>
                <div className="set-number">{setIdx + 1}</div>
                <div className="workout-input-group">
                  <button
                    className="workout-num-btn"
                    onClick={() => {
                      const currentVal = parseFloat(set.kg) || 0;
                      updateSet(ex.id, set.id, 'kg', Math.max(0, currentVal - 2.5).toString());
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
                      updateSet(ex.id, set.id, 'kg', (currentVal + 2.5).toString());
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
            ))}
            <button className="add-set-btn" onClick={() => addSet(ex.id)}>+ Aggiungi Set</button>
          </div>
        ))}

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
