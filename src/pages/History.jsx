import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Calendar, Clock, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';
import './History.css';

function History() {
  const history = useStore(state => state.history);
  // Optional: add a delete history record function to the store
  const setStore = useStore.setState;
  const [expandedSessions, setExpandedSessions] = useState({});

  const toggleSession = (id) => {
    setExpandedSessions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
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
                    <div>
                      <h3 className="history-title">{workout.name}</h3>
                      <div className="history-date">
                        <Calendar size={14} /> {formatDate(workout.startTime)} alle {formatTime(workout.startTime)}
                      </div>
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
