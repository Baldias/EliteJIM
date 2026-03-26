import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ChevronLeft, Check, Plus, Trash2, X } from 'lucide-react';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
import './EditWorkout.css';

function EditWorkout() {
  const navigate = useNavigate();
  const { workoutId } = useParams();
  const history = useStore(state => state.history);
  const updateHistoryWorkout = useStore(state => state.updateHistoryWorkout);

  const workout = useMemo(() => history.find(w => String(w.id) === workoutId), [history, workoutId]);

  const [editForm, setEditForm] = useState({ date: '', time: '', duration: 0 });
  const [draftExercises, setDraftExercises] = useState([]);
  const [showAddEx, setShowAddEx] = useState(false);

  useEffect(() => {
    if (!workout) return;
    const startDate = new Date(workout.startTime);
    const tzOffset = startDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(startDate.getTime() - tzOffset)).toISOString().slice(0, -1);
    const dateStr = localISOTime.split('T')[0];
    const timeStr = localISOTime.split('T')[1].slice(0, 5);
    const duration = workout.endTime ? Math.floor((workout.endTime - workout.startTime) / 1000 / 60) : 0;
    setEditForm({ date: dateStr, time: timeStr, duration });
    setDraftExercises(JSON.parse(JSON.stringify(workout.exercises)));
  }, [workout]);

  if (!workout) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Allenamento non trovato.
        <br />
        <button onClick={() => navigate(-1)} style={{ marginTop: '1rem', color: 'var(--primary-color)', background: 'none', border: 'none', fontSize: '1rem' }}>Torna indietro</button>
      </div>
    );
  }

  const hndUpdSet = (exId, setId, field, val) => {
    setDraftExercises(p => p.map(ex => ex.id === exId ? {
      ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: val } : s)
    } : ex));
  };

  const hndAddSet = (exId) => {
    setDraftExercises(p => p.map(ex => {
      if (ex.id !== exId) return ex;
      const lastSet = ex.sets[ex.sets.length - 1] || { kg: '', reps: '' };
      return { ...ex, sets: [...ex.sets, { id: Date.now(), kg: lastSet.kg, reps: lastSet.reps, done: true }] };
    }));
  };

  const hndRmSet = (exId, setId) => {
    setDraftExercises(p => p.map(ex => ex.id === exId ? {
      ...ex, sets: ex.sets.filter(s => s.id !== setId)
    } : ex));
  };

  const hndRmEx = (exId) => {
    if (window.confirm("Eliminare intero esercizio?")) {
      setDraftExercises(p => p.filter(ex => ex.id !== exId));
    }
  };

  const hndAddEx = (name) => {
    setDraftExercises(p => [
      ...p,
      { id: Date.now(), name, sets: [{ id: Date.now() + 1, kg: '', reps: '', done: true }] }
    ]);
    setShowAddEx(false);
  };

  const handleSave = () => {
    try {
      const [year, month, day] = editForm.date.split('-');
      const [hours, minutes] = editForm.time.split(':');
      const newStart = new Date(year, month - 1, day, hours, minutes).getTime();
      const newEnd = newStart + (editForm.duration * 60 * 1000);
      if (!isNaN(newStart) && !isNaN(newEnd)) {
        updateHistoryWorkout(workout.id, {
          startTime: newStart,
          endTime: newEnd,
          exercises: draftExercises
        });
      }
    } catch (err) {
      console.error(err);
    }
    navigate(-1);
  };

  return (
    <div className="edit-workout-page">
      {/* Header */}
      <div className="edit-workout-header">
        <button onClick={() => navigate(-1)} className="edit-workout-back">
          <ChevronLeft size={22} />
        </button>
        <h2>Modifica Sessione</h2>
        <button onClick={handleSave} className="edit-workout-save">
          <Check size={20} />
          <span>Salva</span>
        </button>
      </div>

      {/* Session Info */}
      <div className="edit-workout-content">
        <div className="edit-section">
          <label className="edit-label">Data e Ora</label>
          <div className="edit-row">
            <input
              type="date"
              value={editForm.date}
              onChange={e => setEditForm({ ...editForm, date: e.target.value })}
              className="edit-input"
            />
            <input
              type="time"
              value={editForm.time}
              onChange={e => setEditForm({ ...editForm, time: e.target.value })}
              className="edit-input"
              style={{ maxWidth: '120px' }}
            />
          </div>
        </div>

        <div className="edit-section">
          <label className="edit-label">Durata (minuti)</label>
          <input
            type="number"
            min="1"
            value={editForm.duration}
            onChange={e => setEditForm({ ...editForm, duration: parseInt(e.target.value) || 0 })}
            className="edit-input"
            style={{ maxWidth: '100px' }}
          />
        </div>

        {/* Exercises */}
        <div className="edit-exercises-list">
          {draftExercises.map((ex, exIdx) => (
            <div key={ex.id} className="edit-exercise-card">
              <div className="edit-exercise-header">
                <div className="edit-exercise-title">
                  <span className="edit-exercise-num">{exIdx + 1}</span>
                  <span className="edit-exercise-name">{ex.name}</span>
                </div>
                <button onClick={() => hndRmEx(ex.id)} className="edit-delete-btn">
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Sets Table */}
              <div className="edit-sets-table">
                <div className="edit-sets-header">
                  <span>Set</span>
                  <span>Kg</span>
                  <span>Reps</span>
                  <span></span>
                </div>
                {ex.sets.map((set, setIdx) => (
                  <div key={set.id} className="edit-set-row">
                    <span className="edit-set-num">
                      {set.isDropset ? <span className="drop-badge">Drop</span> : setIdx + 1}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={set.kg || ''}
                      onChange={e => hndUpdSet(ex.id, set.id, 'kg', e.target.value.replace(/[^0-9.]/g, ''))}
                      className="edit-set-input"
                      placeholder="kg"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={set.reps || ''}
                      onChange={e => hndUpdSet(ex.id, set.id, 'reps', e.target.value.replace(/[^0-9]/g, ''))}
                      className="edit-set-input"
                      placeholder="reps"
                    />
                    <button onClick={() => hndRmSet(ex.id, set.id)} className="edit-set-delete">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => hndAddSet(ex.id)} className="edit-add-set-btn">
                <Plus size={14} /> Aggiungi Set
              </button>
            </div>
          ))}
        </div>

        {/* Add Exercise */}
        <div className="edit-add-exercise-area">
          {showAddEx ? (
            <div>
              <ExerciseAutocomplete onChange={(name) => hndAddEx(name)} placeholder="Cerca esercizio..." />
              <button onClick={() => setShowAddEx(false)} className="edit-cancel-add">Annulla</button>
            </div>
          ) : (
            <button onClick={() => setShowAddEx(true)} className="edit-add-exercise-btn">
              <Plus size={18} /> Nuovo Esercizio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditWorkout;
