import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Calendar, Clock, Dumbbell, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';
import './History.css';

function History() {
  const history = useStore(state => state.history);
  // Optional: add a delete history record function to the store
  const setStore = useStore.setState;
  const [expandedSessions, setExpandedSessions] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', time: '', duration: 0 });

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
    setEditingId(workout.id);
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
          endTime: newEnd
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
      <header className="app-header">
        <h1>Storico</h1>
        <p className="subtitle">I tuoi allenamenti passati</p>
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
                  {workout.exercises.map((ex, exIdx) => {
                    const doneSets = ex.sets.filter(s => s.done);
                    if (doneSets.length === 0) return null; // Skip if no set was marked as done
                    
                    // Find the best set (highest estimated 1RM)
                    let bestSetId = null;
                    let max1Rm = 0;
                    doneSets.forEach(s => {
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
                          <span className="h-ex-details">
                            {doneSets.length} set completati
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="history-ex-sets-table">
                            <div className="history-set-thead">
                              <span>Set</span>
                              <span>kg</span>
                              <span>Reps</span>
                              <span style={{ textAlign: 'right' }}>1RM Est.</span>
                            </div>
                            {doneSets.map((set, setIdx) => {
                              const est1rm = calculateOneRepMax(set.kg, set.reps);
                              const isBest = set.id === bestSetId && max1Rm > 0;
                              return (
                                <div key={set.id} className={`history-set-trow ${isBest ? 'best-set' : ''} ${set.isDropset ? 'drop-set' : ''}`}>
                                  <span className="set-col-num">
                                    {set.isDropset ? <span className="drop-badge">Drop</span> : setIdx + 1}
                                  </span>
                                  <span className="set-col-data">{set.kg || '-'}</span>
                                  <span className="set-col-data">{set.reps || '-'}</span>
                                  <span className="set-col-1rm">
                                    {est1rm ? est1rm.toFixed(1) : '-'}
                                    {isBest && <span className="best-badge" title="Miglior Set">🏆</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
