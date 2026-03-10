import React, { useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Download, Upload, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Profile.css';

function Profile() {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    // Get the current state from LocalStorage directly, since Zustand persists it there under 'elitejim-storage'
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
        // Basic validation: ensure it's a valid JSON object
        const parsed = JSON.parse(content);

        if (!parsed.state) {
          alert("Il file non sembra essere un backup di EliteJIM valido.");
          return;
        }

        if (window.confirm("Attenzione: Importare questo file sovrascriverà tutte le tue schede e la cronologia attuali. Sei sicuro di voler procedere?")) {
          // Restore to local storage
          localStorage.setItem('elitejim-storage', JSON.stringify(parsed));

          // Force Zustand to re-hydrate from the newly set localStorage
          // The easiest way for a PWA is simply a page reload
          window.location.reload();
        }
      } catch (err) {
        alert("Errore durante la lettura del file: " + err.message);
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
  };

  // --- Progressive Overload Charts Logic ---
  const history = useStore(state => state.history);
  const [selectedExercise, setSelectedExercise] = useState('');

  // Extract all unique exercises ever performed spanning all history
  const uniqueExercises = useMemo(() => {
    const exSet = new Set();
    history.forEach(workout => {
      workout.exercises.forEach(ex => {
        // Only consider if at least one set was done
        if (ex.sets.some(s => s.done)) {
          exSet.add(ex.name);
        }
      });
    });
    const arr = Array.from(exSet).sort();
    if (arr.length > 0 && !selectedExercise) {
      setSelectedExercise(arr[0]);
    }
    return arr;
  }, [history, selectedExercise]);

  const calculateOneRepMax = (weight, reps) => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    if (r === 1) return w;
    return w * (1 + r / 30);
  };

  // Prepare data for the selected exercise
  const chartData = useMemo(() => {
    if (!selectedExercise) return [];

    const dataPoints = [];

    history.forEach(workout => {
      // Find the exercise in this workout
      const ex = workout.exercises.find(e => e.name === selectedExercise);
      if (!ex) return;

      const doneSets = ex.sets.filter(s => s.done);
      if (doneSets.length === 0) return;

      // Calculate Sets
      let setsCount = doneSets.length;
      let max1RM = 0;

      doneSets.forEach(s => {
        const w = parseFloat(s.kg) || 0;
        const r = parseInt(s.reps, 10) || 0;

        const rm = calculateOneRepMax(w, r);
        if (rm > max1RM) max1RM = rm;
      });

      // Format Short Date (e.g., "10 Mar")
      const d = new Date(workout.startTime);
      const shortDate = `${d.getDate()} ${d.toLocaleString('it-IT', { month: 'short' }).replace('.', '')}`;

      dataPoints.push({
        date: shortDate,
        timestamp: workout.startTime,
        setsCount: setsCount,
        oneRepMax: parseFloat(max1RM.toFixed(1))
      });
    });

    // Sort chronologically
    return dataPoints.sort((a, b) => a.timestamp - b.timestamp);
  }, [history, selectedExercise]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{label}</p>
          <p className="desc">{`1RM Est: ${payload[0].value} kg`}</p>
          {payload[1] && <p className="desc-volume">{`Serie: ${payload[1].value}`}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <header className="app-header">
        <h1>Profilo</h1>
        <p className="subtitle">Gestione Dati</p>
      </header>

      <main className="app-main">
        {/* --- Charts Section --- */}
        <section className="profile-section">
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} color="var(--primary-color)" /> Progressive Overload
            </h2>

            {uniqueExercises.length === 0 ? (
              <div className="no-data-msg">
                Nessun dato relativo ad esercizi completati.
              </div>
            ) : (
              <>
                <select
                  className="exercise-selector"
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                >
                  {uniqueExercises.map(ex => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>

                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="var(--text-muted)"
                        fontSize={12}
                        tickMargin={10}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--text-muted)"
                        fontSize={12}
                        axisLine={false}
                        tickLine={false}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="oneRepMax"
                        name="1RM Est."
                        stroke="var(--primary-color)"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="setsCount"
                        name="Serie"
                        stroke="var(--accent-color)"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </section>

        {/* --- Backup Section --- */}
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
        </div>
      </main>
    </>
  );
}

export default Profile;
