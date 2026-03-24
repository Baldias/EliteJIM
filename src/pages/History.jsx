import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Calendar, Clock, Dumbbell, ChevronDown, ChevronUp, Edit2, Check, X, Plus, Trash2, ChevronLeft } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
import './History.css';

function History() {
  const navigate = useNavigate();
  const location = useLocation();
  const history = useStore(state => state.history);
  // Optional: add a delete history record function to the store
  const setStore = useStore.setState;
  const [expandedSessions, setExpandedSessions] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', time: '', duration: 0 });
  const [draftExercises, setDraftExercises] = useState([]);
  const [showAddEx, setShowAddEx] = useState(false);

  useEffect(() => {
    if (location.state?.editWorkoutId && history.length > 0) {
      const workoutToEdit = history.find(w => w.id === location.state.editWorkoutId);
      if (workoutToEdit && editingId !== workoutToEdit.id) {
        setExpandedSessions(prev => ({ ...prev, [workoutToEdit.id]: true }));
        
        const startDate = new Date(workoutToEdit.startTime);
        const tzOffset = startDate.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(startDate.getTime() - tzOffset)).toISOString().slice(0, -1);
        
        const dateStr = localISOTime.split('T')[0];
        const timeStr = localISOTime.split('T')[1].slice(0, 5);
        const duration = workoutToEdit.endTime ? Math.floor((workoutToEdit.endTime - workoutToEdit.startTime) / 1000 / 60) : 0;
        
        setEditForm({ date: dateStr, time: timeStr, duration });
        setDraftExercises(JSON.parse(JSON.stringify(workoutToEdit.exercises)));
        setShowAddEx(false);
        setEditingId(workoutToEdit.id);
        
        // Clear the state so it doesn't stay stuck on reload
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, history, editingId, navigate, location.pathname]);

  const toggleSession = (id) => {
    // Only toggle if not editing
    if (editingId === id) return;
    setExpandedSessions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const startEditing = (e, workout) => {
    e.stopPropagation();
    const startDate = new Date(workout.startTime);
    // Adjust to local time before ISO split
    const tzOffset = startDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(startDate.getTime() - tzOffset)).toISOString().slice(0, -1);
    
    const dateStr = localISOTime.split('T')[0]; // YYYY-MM-DD
    const timeStr = localISOTime.split('T')[1].slice(0, 5);  // HH:MM
    const duration = workout.endTime ? Math.floor((workout.endTime - workout.startTime) / 1000 / 60) : 0;
    
    setEditForm({ date: dateStr, time: timeStr, duration });
    setDraftExercises(JSON.parse(JSON.stringify(workout.exercises))); // Deep clone exercises
    setShowAddEx(false);
    setEditingId(workout.id);
  };

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

  const saveEdit = (e, workoutId) => {
    e.stopPropagation();
    try {
      const [year, month, day] = editForm.date.split('-');
      const [hours, minutes] = editForm.time.split(':');
      const newStart = new Date(year, month - 1, day, hours, minutes).getTime();
      const newEnd = newStart + (editForm.duration * 60 * 1000);

      if (!isNaN(newStart) && !isNaN(newEnd)) {
        useStore.getState().updateHistoryWorkout(workoutId, {
          startTime: newStart,
          endTime: newEnd,
          exercises: draftExercises
        });
      }
    } catch(err) {
      console.error(err);
    }
    setEditingId(null);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Sei sicuro di voler eliminare questo allenamento dallo storico?")) {
      setStore(state => ({
        history: state.history.filter(w => w.id !== id)
      }));
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('it-IT', {
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const formatDuration = (start, end) => {
    if (!start || !end) return '-';
    const diff = Math.floor((end - start) / 1000 / 60); // minutes
    if (diff < 1) return '< 1 min';
    return `${diff} min`;
  };

  const calculateOneRepMax = (weight, reps) => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    if (r === 1) return w;
    // Epley Formula
    return w * (1 + r / 30);
  };

  const calculateCompletedSets = (exercises) => {
    let sets = 0;
    exercises.forEach(ex => {
      sets += ex.sets.filter(s => s.done).length;
    });
    return sets;
  };

  return (
    <>
      <header className="app-header" style={{ position: 'relative' }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h1 style={{ marginLeft: '32px' }}>Storico</h1>
        <p className="subtitle" style={{ marginLeft: '32px' }}>I tuoi allenamenti passati</p>
      </header>
      
      <main className="app-main history-main">
        {history.length === 0 ? (
          <div className="card empty-history">
            <Calendar size={48} color="var(--primary-color-dim)" style={{ marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-muted)' }}>Non hai ancora registrato nessun allenamento.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Esegui e termina una scheda per vederla qui.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map(workout => {
              const isExpanded = expandedSessions[workout.id];
              return (
              <SwipeToDelete key={workout.id} onDelete={(e) => handleDelete(e, workout.id)}>
                <div className="history-card" onClick={() => toggleSession(workout.id)} style={{ cursor: 'pointer' }}>
                  <div className="history-header">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 className="history-title">{workout.name}</h3>
                        {editingId !== workout.id && (
                          <button onClick={(e) => startEditing(e, workout)} style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', padding: '4px' }}>
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>
                      
                      {editingId === workout.id ? (
                        <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface-color-elevated)', color: 'white', fontSize: '0.9rem' }} />
                            <input type="time" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} style={{ width: '100px', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface-color-elevated)', color: 'white', fontSize: '0.9rem' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Durata (min):</span>
                            <input type="number" min="1" value={editForm.duration} onChange={e => setEditForm({...editForm, duration: parseInt(e.target.value) || 0})} style={{ width: '70px', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface-color-elevated)', color: 'white', fontSize: '0.9rem' }} />
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                              <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
                              <button onClick={(e) => saveEdit(e, workout.id)} style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={18} /></button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="history-date">
                          <Calendar size={14} /> {formatDate(workout.startTime)} alle {formatTime(workout.startTime)}
                        </div>
                      )}
                    </div>
                  </div>

                <div className="history-stats">
                  <div className="stat-pill">
                    <Clock size={16} />
                    <span>{formatDuration(workout.startTime, workout.endTime)}</span>
                  </div>
                  <div className="stat-pill" style={{backgroundColor: 'var(--success-color-dim)', color: 'var(--success-color)'}}>
                    <span>{calculateCompletedSets(workout.exercises)} Set</span>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                <div className="history-exercises">
                  {(editingId === workout.id ? draftExercises : workout.exercises).map((ex, exIdx) => {
                    const isEditingWorkout = editingId === workout.id;
                    const visibleSets = isEditingWorkout ? ex.sets : ex.sets.filter(s => s.done);
                    if (visibleSets.length === 0 && !isEditingWorkout) return null; // Skip if no set was marked as done
                    
                    // Find the best set (highest estimated 1RM)
                    let bestSetId = null;
                    let max1Rm = 0;
                    visibleSets.forEach(s => {
                       if (!s.done && !isEditingWorkout) return;
                       const est = calculateOneRepMax(s.kg, s.reps);
                       if (est && est > max1Rm) { max1Rm = est; bestSetId = s.id; }
                    });

                    return (
                      <div key={ex.id} className="history-ex-container">
                        <div className="history-ex-header">
                          <div className="h-ex-title">
                            <span className="h-ex-num">{exIdx + 1}</span>
                            <span className="h-ex-name">{ex.name}</span>
                          </div>
                          {!isEditingWorkout ? (
                            <span className="h-ex-details">{visibleSets.length} set completati</span>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); hndRmEx(ex.id); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,59,48,0.7)', padding: '4px' }}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        {(isExpanded || isEditingWorkout) && (
                          <div className="history-ex-sets-table">
                            <div className="history-set-thead" style={{ gridTemplateColumns: isEditingWorkout ? '1fr 2fr 2fr 1fr' : '2fr 1.5fr 1.5fr 2fr' }}>
                              <span>Set</span>
                              <span>kg</span>
                              <span>Reps</span>
                              <span style={{ textAlign: isEditingWorkout ? 'center' : 'right' }}>{isEditingWorkout ? 'Azione' : '1RM Est.'}</span>
                            </div>
                            {visibleSets.map((set, setIdx) => {
                              const est1rm = calculateOneRepMax(set.kg, set.reps);
                              const isBest = set.id === bestSetId && max1Rm > 0;
                              return (
                                <div key={set.id} className={`history-set-trow ${isBest && !isEditingWorkout ? 'best-set' : ''} ${set.isDropset ? 'drop-set' : ''}`} style={{ gridTemplateColumns: isEditingWorkout ? '1fr 2fr 2fr 1fr' : '2fr 1.5fr 1.5fr 2fr' }}>
                                  <span className="set-col-num">
                                    {set.isDropset ? <span className="drop-badge">Drop</span> : setIdx + 1}
                                  </span>
                                  {isEditingWorkout ? (
                                    <>
                                      <input type="text" inputMode="decimal" value={set.kg || ''} onChange={e => hndUpdSet(ex.id, set.id, 'kg', e.target.value.replace(/[^0-9.]/g, ''))} onClick={e=>e.stopPropagation()} style={{ width: '90%', padding: '4px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', textAlign: 'center' }} placeholder="kg" />
                                      <input type="text" inputMode="numeric" value={set.reps || ''} onChange={e => hndUpdSet(ex.id, set.id, 'reps', e.target.value.replace(/[^0-9]/g, ''))} onClick={e=>e.stopPropagation()} style={{ width: '90%', padding: '4px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', textAlign: 'center' }} placeholder="reps" />
                                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        <button onClick={(e) => { e.stopPropagation(); hndRmSet(ex.id, set.id); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)' }}><X size={16} /></button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <span className="set-col-data">{set.kg || '-'}</span>
                                      <span className="set-col-data">{set.reps || '-'}</span>
                                      <span className="set-col-1rm">
                                        {est1rm ? est1rm.toFixed(1) : '-'}
                                        {isBest && <span className="best-badge" title="Miglior Set">🏆</span>}
                                      </span>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                            
                            {isEditingWorkout && (
                              <button onClick={(e) => { e.stopPropagation(); hndAddSet(ex.id); }} style={{ marginTop: '8px', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Plus size={14} /> Aggiungi Set
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {editingId === workout.id && (
                    <div style={{ marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                      {showAddEx ? (
                        <div style={{ padding: '4px 0' }}>
                          <ExerciseAutocomplete onChange={(name) => hndAddEx(name)} placeholder="Cerca esercizio..." />
                          <button onClick={() => setShowAddEx(false)} style={{ marginTop: '8px', padding: '6px', width: '100%', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>Annulla</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowAddEx(true)} style={{ width: '100%', padding: '8px', background: 'var(--primary-color-dim)', color: 'var(--primary-color)', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold' }}>
                          <Plus size={16} /> Nuovo Esercizio
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </SwipeToDelete>
            )})}
          </div>
        )}
      </main>
    </>
  );
}

export default History;
