import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X, Check, Plus, Trash2 } from 'lucide-react';
import { ExerciseAutocomplete } from './ExerciseAutocomplete';
import { useStore } from '../store/useStore';

export function WorkoutEditorModal({ workout, onClose }) {
  const [editForm, setEditForm] = useState({ date: '', time: '', duration: 0 });
  const [draftExercises, setDraftExercises] = useState([]);
  const [showAddEx, setShowAddEx] = useState(false);

  useEffect(() => {
    if (workout) {
      const startDate = new Date(workout.startTime);
      const tzOffset = startDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(startDate.getTime() - tzOffset)).toISOString().slice(0, -1);
      
      const dateStr = localISOTime.split('T')[0];
      const timeStr = localISOTime.split('T')[1].slice(0, 5);
      const duration = workout.endTime ? Math.floor((workout.endTime - workout.startTime) / 1000 / 60) : 0;
      
      setEditForm({ date: dateStr, time: timeStr, duration });
      setDraftExercises(JSON.parse(JSON.stringify(workout.exercises)));
    }
  }, [workout]);

  const hndUpdSet = (exId, setId, field, val) => {
    setDraftExercises(p => p.map(ex => ex.id === exId ? { 
      ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: val } : s) 
    } : ex));
  };
  
  const hndAddSet = (exId) => {
    setDraftExercises(p => p.map(ex => {
      if(ex.id !== exId) return ex;
      const lastSet = ex.sets[ex.sets.length-1] || { kg: '', reps: '' };
      return { ...ex, sets: [...ex.sets, { id: Date.now(), kg: lastSet.kg, reps: lastSet.reps, done: true }] };
    }));
  };

  const hndRmSet = (exId, setId) => {
    setDraftExercises(p => p.map(ex => ex.id === exId ? {
      ...ex, sets: ex.sets.filter(s => s.id !== setId)
    } : ex));
  };

  const hndRmEx = (exId) => {
     if(window.confirm("Eliminare intero esercizio?")) setDraftExercises(p => p.filter(ex => ex.id !== exId));
  };

  const hndAddEx = (name) => {
    setDraftExercises(p => [
      ...p,
      { id: Date.now(), name, sets: [{ id: Date.now()+1, kg: '', reps: '', done: true }] }
    ]);
    setShowAddEx(false);
  };

  const saveEdit = () => {
    try {
      const [year, month, day] = editForm.date.split('-');
      const [hours, minutes] = editForm.time.split(':');
      const newStart = new Date(year, month - 1, day, hours, minutes).getTime();
      const newEnd = newStart + (editForm.duration * 60 * 1000);

      if (!isNaN(newStart) && !isNaN(newEnd)) {
        useStore.getState().updateHistoryWorkout(workout.id, {
          startTime: newStart,
          endTime: newEnd,
          exercises: draftExercises
        });
      }
    } catch(err) {
      console.error(err);
    }
    onClose();
  };

  if (!workout) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      zIndex: 9999, padding: '1rem', overflowY: 'auto'
    }}>
      <div className="card glass" style={{ maxWidth: '600px', margin: '2rem auto', border: '1px solid var(--primary-color)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem' }}>Modifica Sessione</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={24} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }} />
            <input type="time" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} style={{ width: '120px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Durata (min):</span>
            <input type="number" min="1" value={editForm.duration} onChange={e => setEditForm({...editForm, duration: parseInt(e.target.value) || 0})} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: '1rem' }} />
          </div>
        </div>

        {draftExercises.map((ex, exIdx) => (
          <div key={ex.id} style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: '600', color: 'var(--primary-color)', fontSize: '1.1rem' }}>{exIdx + 1}. {ex.name}</div>
              <button onClick={() => hndRmEx(ex.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,59,48,0.7)', padding: '4px' }}>
                <Trash2 size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ex.sets.map((set, setIdx) => (
                <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <span style={{ width: '30px', color: 'var(--text-muted)' }}>S{setIdx + 1}</span>
                  <input
                    type="text" inputMode="decimal"
                    value={set.kg || ''}
                    onChange={(e) => hndUpdSet(ex.id, set.id, 'kg', e.target.value.replace(/[^0-9.]/g, ''))}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textAlign: 'center' }}
                    placeholder="kg"
                  />
                  <span style={{ color: 'var(--text-muted)' }}>x</span>
                  <input
                    type="text" inputMode="numeric"
                    value={set.reps || ''}
                    onChange={(e) => hndUpdSet(ex.id, set.id, 'reps', e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textAlign: 'center' }}
                    placeholder="reps"
                  />
                  <button onClick={() => hndRmSet(ex.id, set.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '4px' }}>
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => hndAddSet(ex.id)} style={{ marginTop: '12px', width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Plus size={16} /> Aggiungi Set
            </button>
          </div>
        ))}

        {showAddEx ? (
          <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--primary-color)' }}>Cerca Esercizio</span>
              <button onClick={() => setShowAddEx(false)} style={{ background: 'none', border: 'none', color: 'white' }}><X size={20}/></button>
            </div>
            <ExerciseAutocomplete onSelect={ex => hndAddEx(ex.name)} placeholder="Es. Panca Piana..." autoFocus />
          </div>
        ) : (
          <button onClick={() => setShowAddEx(true)} className="btn-secondary" style={{ width: '100%', padding: '16px', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Plus size={20} /> Nuovo Esercizio
          </button>
        )}

        <button
          className="btn-primary"
          onClick={saveEdit}
          style={{ width: '100%', height: '56px', borderRadius: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Check size={24} /> Salva Modifiche
        </button>

      </div>
    </div>
  );
}
