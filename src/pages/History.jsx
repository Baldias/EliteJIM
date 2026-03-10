import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Calendar, Clock, Dumbbell, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
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
              <div key={workout.id} className="history-card" onClick={() => toggleSession(workout.id)} style={{ cursor: 'pointer' }}>
                <div className="history-header">
                  <div>
                    <h3 className="history-title">{workout.name}</h3>
                    <div className="history-date">
                      <Calendar size={14} /> {formatDate(workout.startTime)} alle {formatTime(workout.startTime)}
                    </div>
                  </div>
                  <button className="icon-btn-small delete-btn" onClick={(e) => handleDelete(e, workout.id)} style={{ padding: '4px', margin: '-8px -8px 0 0' }}>
                    <Trash2 size={14} />
                  </button>
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
                    
                    return (
                      <div key={ex.id} className="history-ex-container">
                        <div className="history-ex-row">
                          <span className="h-ex-name">{exIdx + 1}. {ex.name}</span>
                          <span className="h-ex-details">
                            {doneSets.length} set completati
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="history-ex-sets">
                            {doneSets.map((set, setIdx) => {
                              const est1rm = calculateOneRepMax(set.kg, set.reps);
                              return (
                              <div key={set.id} className="history-set-row">
                                <span className="set-number">Set {setIdx + 1}</span>
                                <div className="set-metrics" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <span className="set-data">{set.kg} kg × {set.reps} reps</span>
                                  {est1rm && (
                                    <span className="set-1rm" style={{ fontSize: '0.75rem', color: 'var(--primary-color)', backgroundColor: 'var(--primary-color-dim)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                      1RM Est. {est1rm.toFixed(1)} kg
                                    </span>
                                  )}
                                </div>
                              </div>
                            )})}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )})}
          </div>
        )}
      </main>
    </>
  );
}

export default History;
