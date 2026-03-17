import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Plus, Play, Trash2 } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { InteractiveBody } from '../components/InteractiveBody';
import pkg from '../../package.json';

function Home() {
  const navigate = useNavigate();
  const templates = useStore(state => state.templates);
  const startWorkout = useStore(state => state.startWorkout);
  const deleteTemplate = useStore(state => state.deleteTemplate);
  const activeWorkout = useStore(state => state.activeWorkout);

  const handleStartTemplate = (template) => {
    if (activeWorkout && !window.confirm("Hai un allenamento in corso. Vuoi abbandonarlo e iniziarne uno nuovo?")) {
      return;
    }
    startWorkout(template);
    navigate('/workout');
  };

  const handleStartEmpty = () => {
    if (activeWorkout && !window.confirm("Hai un allenamento in corso. Vuoi abbandonarlo e iniziarne uno nuovo?")) {
      return;
    }
    startWorkout(null);
    navigate('/workout');
  };

  const handleResumeWorkout = () => {
    navigate('/workout');
  };

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <h1>EliteJIM</h1>
          <p className="subtitle">Pronto a spaccare?</p>
        </div>
      </header>
      
      <main className="app-main">
        {activeWorkout && (
          <div className="card glass start-workout-card" style={{ backgroundColor: 'var(--primary-color-dim)', borderColor: 'var(--primary-color)', marginBottom: '1rem' }}>
            <h2 style={{ color: 'var(--primary-color)' }}>Allenamento in corso</h2>
            <p>Stai facendo: <strong>{activeWorkout.name}</strong></p>
            <button onClick={handleResumeWorkout} style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
              <Play size={18} fill="currentColor" /> Riprendi
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Le tue Schede</h2>
          <button 
            onClick={() => navigate('/build')}
            style={{ 
              width: 'auto', 
              padding: '6px 12px', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              backgroundColor: 'var(--primary-color-dim)',
              color: 'var(--primary-color)',
              borderRadius: '8px'
            }}
          >
            <Plus size={16} /> Nuova
          </button>
        </div>

        {templates.map(template => (
          <SwipeToDelete key={template.id} onDelete={() => {
            if (window.confirm(`Sei sicuro di voler eliminare la scheda "${template.name}"?`)) {
              deleteTemplate(template.id);
            }
          }}>
            <div className="card glass start-workout-card" style={{ borderColor: 'var(--primary-color)' }}>
              <h2>{template.name}</h2>
              <p>{template.exercises.length} esercizi • {template.exercises.reduce((acc, ex) => acc + ex.setsCount, 0)} serie totali</p>
              <button onClick={() => handleStartTemplate(template)}>Inizia Scheda</button>
            </div>
          </SwipeToDelete>
        ))}

        <div className="card glass start-workout-card" style={{ marginTop: templates.length > 0 ? '1rem' : '0' }}>
          <h2>Allenamento Vuoto</h2>
          <p>Inizia una sessione senza template predefinito.</p>
          <button 
            style={{ backgroundColor: 'var(--surface-color-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            onClick={handleStartEmpty}
          >
            Inizia Vuoto
          </button>
        </div>
        
        <InteractiveBody />

        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v{pkg.version}</span>
        </div>
      </main>
    </>
  );
}

export default Home;
