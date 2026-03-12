import React, { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Download, Upload, Calendar, Clock, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';

function Profile() {
  const fileInputRef = useRef(null);
  const history = useStore(state => state.history);
  const deleteWorkout = useStore(state => state.deleteWorkout);
  const [expandedSessions, setExpandedSessions] = useState({});

  const handleExport = () => {
    const data = localStorage.getItem('elitejim-storage');
    if (!data) {
      alert("Nessun dato trovato da esportare.");
      return;
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EliteJIM_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsed = JSON.parse(content);
        if (!parsed.state) {
          alert("Il file non sembra essere un backup di EliteJIM valido.");
          return;
        }
        if (window.confirm("Attenzione: Importare questo file sovrascriverà tutte le tue schede e la cronologia attuali. Sei sicuro di voler procedere?")) {
          localStorage.setItem('elitejim-storage', JSON.stringify(parsed));
          window.location.reload();
        }
      } catch (err) {
        alert("Errore durante la lettura del file: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- History Logic ---
  const handleDelete = (e, workoutId) => {
    e.stopPropagation();
    if (window.confirm("Eliminare questa sessione?")) {
      deleteWorkout(workoutId);
    }
  };

  const toggleSession = (id) => {
    setExpandedSessions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatDuration = (start, end) => {
    if (!end) return '-';
    const diff = Math.round((end - start) / 60000);
    return `${diff} min`;
  };

  const calculateCompletedSets = (exercises) => {
    let sets = 0;
    exercises.forEach(ex => {
      ex.sets.forEach(s => { if (s.done) sets++; });
    });
    return sets;
  };

  const calculateOneRepMax = (weight, reps) => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    if (r === 1) return w;
    return w * (1 + r / 30);
  };

  const loadTestData = () => {
    if (!window.confirm("Attenzione: questo sovrascriverà il tuo storico attuale con dati di test. Sei sicuro?")) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Generate 12 workouts over the last 30 days
    const mockHistory = Array.from({ length: 12 }).map((_, i) => {
      const workoutTime = now - (30 - i * 2.5) * day; // Every ~2-3 days
      const progressFactor = i * 2.5; // Progressively heavier weights

      return {
        id: `mock-w-${i}`,
        name: i % 2 === 0 ? 'Push Day' : 'Pull Day',
        startTime: workoutTime,
        endTime: workoutTime + 60 * 60 * 1000, // 1 hour later
        exercises: i % 2 === 0 ? [
          {
            id: `mock-ex-1-${i}`,
            name: 'Panca Piana Bilanciere',
            sets: [
              { id: 1, kg: String(60 + progressFactor), reps: '8', done: true, fatigue: 'yellow' },
              { id: 2, kg: String(60 + progressFactor), reps: '8', done: true, fatigue: 'yellow' },
              { id: 3, kg: String(60 + progressFactor), reps: '7', done: true, fatigue: 'red' }
            ]
          },
          {
            id: `mock-ex-2-${i}`,
            name: 'Spinte Manubri Seduto',
            sets: [
              { id: 1, kg: String(20 + progressFactor / 2), reps: '10', done: true, fatigue: 'yellow' },
              { id: 2, kg: String(20 + progressFactor / 2), reps: '9', done: true, fatigue: 'red' }
            ]
          }
        ] : [
          {
            id: `mock-ex-3-${i}`,
            name: 'Trazioni alla Sbarra (Pull-up)',
            sets: [
              { id: 1, kg: '0', reps: String(Math.floor(5 + i / 2)), done: true, fatigue: 'yellow' },
              { id: 2, kg: '0', reps: String(Math.floor(4 + i / 2)), done: true, fatigue: 'red' }
            ]
          },
          {
            id: `mock-ex-4-${i}`,
            name: 'Curl Bilanciere',
            sets: [
              { id: 1, kg: String(30 + progressFactor / 2), reps: '10', done: true, fatigue: 'green' },
              { id: 2, kg: String(30 + progressFactor / 2), reps: '10', done: true, fatigue: 'yellow' },
              { id: 3, kg: String(32.5 + progressFactor / 2), reps: '8', done: true, fatigue: 'red' }
            ]
          }
        ]
      };
    });

    useStore.setState({ history: mockHistory.reverse() });
    alert("Dati di test caricati con successo!");
  };

  return (
    <>
      <header className="app-header">
        <h1>Profilo</h1>
        <p className="subtitle">Gestione Dati e Storico</p>
      </header>

      <main className="app-main">
        {/* Backup Section */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Backup Dati</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4 }}>
            Le tue schede e le tue statistiche sono salvate localmente sul tuo dispositivo.
            Puoi esportarle per salvarle in sicurezza o trasferirle su un altro telefono.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--surface-color-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
              onClick={handleExport}
            >
              <Upload size={20} /> Esporta
            </button>

            <button
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Download size={20} /> Importa
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>

          <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
            <button
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface-color-elevated)', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}
              onClick={loadTestData}
            >
              Carica Dati di Test (Per Sviluppo)
            </button>
          </div>
        </div>

        {/* History Section */}
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="var(--primary-color)" /> Storico Allenamenti
          </h2>

          {(!history || history.length === 0) ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem' }}>
              Nessun allenamento registrato.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[...history].reverse().map(workout => {
                const isExpanded = expandedSessions[workout.id];
                return (
                  <SwipeToDelete key={workout.id} onDelete={(e) => handleDelete(e, workout.id)}>
                    <div className="card" style={{ cursor: 'pointer', padding: '1rem' }} onClick={() => toggleSession(workout.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem', letterSpacing: '0.02em' }}>{workout.name || 'Allenamento'}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} /> {formatDate(workout.startTime)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <span className="stat-pill"><Clock size={14} /> {formatDuration(workout.startTime, workout.endTime)}</span>
                        <span className="stat-pill"><Dumbbell size={14} /> {calculateCompletedSets(workout.exercises)} serie</span>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                          {workout.exercises.map(exercise => {
                            const doneSets = exercise.sets.filter(s => s.done);
                            if (doneSets.length === 0) return null;
                            return (
                              <div key={exercise.id} style={{ marginBottom: '10px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{exercise.name}</div>
                                {doneSets.map((set, setIdx) => {
                                  const est1rm = calculateOneRepMax(set.kg, set.reps);
                                  return (
                                    <div key={set.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '2px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                      <span>Set {setIdx + 1}</span>
                                      <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{set.kg} kg × {set.reps} reps</span>
                                      {est1rm && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', backgroundColor: 'var(--primary-color-dim)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                          1RM {est1rm.toFixed(1)} kg
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </SwipeToDelete>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default Profile;
