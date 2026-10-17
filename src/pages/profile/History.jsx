import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Calendar, Clock, ChevronDown, ChevronUp, Edit2, ChevronLeft, Layers, Trophy } from 'lucide-react';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import './History.css';

function History() {
  const navigate = useNavigate();
  const location = useLocation();
  const history = useStore(state => state.history);
  const deleteWorkout = useStore(state => state.deleteWorkout);
  const [expandedSessions, setExpandedSessions] = useState({});

  // If navigated here with editWorkoutId, redirect to the dedicated edit page
  useEffect(() => {
    if (location.state?.editWorkoutId && history.length > 0) {
      const workoutToEdit = history.find(w => w.id === location.state.editWorkoutId);
      if (workoutToEdit) {
        navigate(`/edit-workout/${workoutToEdit.id}`, { replace: true });
      }
    }
  }, [location.state, history, navigate]);

  const toggleSession = (id) => {
    setExpandedSessions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleEdit = (e, workoutId) => {
    e.stopPropagation();
    navigate(`/edit-workout/${workoutId}`);
  };

  // e is undefined when called from SwipeToDelete
  const handleDelete = (e, id) => {
    e?.stopPropagation();
    if (window.confirm("Sei sicuro di voler eliminare questo allenamento dallo storico?")) {
      deleteWorkout(id);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
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
    const diff = Math.floor((end - start) / 1000 / 60);
    if (diff < 1) return '< 1 min';
    return `${diff} min`;
  };

  const calculateOneRepMax = (weight, reps) => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    if (r === 1) return w;
    return w * (1 + r / 30);
  };

  const calculateCompletedSets = (exercises) => {
    let sets = 0;
    exercises.forEach(ex => {
      sets += ex.sets.filter(s => s.done).length;
    });
    return sets;
  };

  // Newest first, grouped by calendar month
  const months = useMemo(() => {
    const groups = [];
    [...history].sort((a, b) => b.startTime - a.startTime).forEach(w => {
      const d = new Date(w.startTime);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups.find(x => x.key === key);
      if (!g) {
        g = { key, label: d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), workouts: [] };
        groups.push(g);
      }
      g.workouts.push(w);
    });
    return groups;
  }, [history]);

  return (
    <div className="ej-page hs-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="hs-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round hs-back" onClick={() => navigate(-1)} title="Indietro">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="hs-title">Storico</h1>
          <p className="ej-eyebrow">I tuoi allenamenti passati</p>
        </div>
      </header>

      {history.length === 0 ? (
        <div className="ej-card hs-empty">
          <span className="hs-empty-icon"><Calendar size={28} /></span>
          <p className="hs-empty-title">Non hai ancora registrato nessun allenamento.</p>
          <p className="hs-empty-sub">Esegui e termina una scheda per vederla qui.</p>
        </div>
      ) : (
        <>
          {months.map(month => (
            <section key={month.key} className="hs-month">
              <p className="hs-month-label">{month.label}</p>

              {month.workouts.map(workout => {
                const isExpanded = expandedSessions[workout.id];
                return (
                  <SwipeToDelete key={workout.id} onDelete={(e) => handleDelete(e, workout.id)}>
                    <div className={`ej-card hs-card ${isExpanded ? 'is-open' : ''}`} onClick={() => toggleSession(workout.id)}>
                      <div className="hs-card-head">
                        <div className="hs-card-text">
                          <div className="hs-card-title">
                            <h3>{workout.name}</h3>
                            <button type="button" className="ej-icon-btn hs-edit" onClick={(e) => handleEdit(e, workout.id)} title="Modifica sessione">
                              <Edit2 size={13} />
                            </button>
                          </div>
                          <div className="hs-meta">
                            <span><Calendar size={12} /> {formatDate(workout.startTime)} · {formatTime(workout.startTime)}</span>
                            <span><Clock size={12} /> {formatDuration(workout.startTime, workout.endTime)}</span>
                            <span><Layers size={12} /> {calculateCompletedSets(workout.exercises)} Set</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={20} className="hs-chevron" /> : <ChevronDown size={20} className="hs-chevron" />}
                      </div>

                      <div className="hs-exercises">
                        {workout.exercises.map(ex => {
                          const visibleSets = ex.sets.filter(s => s.done);
                          if (visibleSets.length === 0) return null;

                          let bestSetId = null;
                          let max1Rm = 0;
                          visibleSets.forEach(s => {
                            const est = calculateOneRepMax(s.kg, s.reps);
                            if (est && est > max1Rm) { max1Rm = est; bestSetId = s.id; }
                          });

                          return (
                            <div key={ex.id} className="hs-ex">
                              <div className="hs-ex-head">
                                <span className="hs-ex-name">{ex.name}</span>
                                <span className="hs-ex-count">{visibleSets.length} set completati</span>
                              </div>
                              {isExpanded && (
                                <div className="hs-table">
                                  <div className="hs-thead">
                                    <span>Set</span>
                                    <span>Kg</span>
                                    <span>Reps</span>
                                    <span>1RM Est.</span>
                                  </div>
                                  {visibleSets.map((set, setIdx) => {
                                    const est1rm = calculateOneRepMax(set.kg, set.reps);
                                    const isBest = set.id === bestSetId && max1Rm > 0;
                                    return (
                                      <div key={set.id} className={`hs-row ${isBest ? 'is-best' : ''}`}>
                                        <span className="hs-row-num">
                                          {set.isDropset ? <span className="hs-drop">Drop</span> : setIdx + 1}
                                        </span>
                                        <span>{set.kg || '-'}</span>
                                        <span>{set.reps || '-'}</span>
                                        <span className="hs-row-rm">
                                          {isBest && <Trophy size={11} />}
                                          {est1rm ? est1rm.toFixed(1) : '-'}
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
                );
              })}
            </section>
          ))}
          <p className="hs-hint">← Scorri una sessione verso sinistra per eliminarla</p>
        </>
      )}
    </div>
  );
}

export default History;
