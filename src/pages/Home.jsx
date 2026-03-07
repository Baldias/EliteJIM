import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Plus } from 'lucide-react';

function Home() {
  const navigate = useNavigate();
  const templates = useStore(state => state.templates);
  const startWorkout = useStore(state => state.startWorkout);

  const handleStartTemplate = (template) => {
    startWorkout(template);
    navigate('/workout');
  };

  const handleStartEmpty = () => {
    startWorkout(null);
    navigate('/workout');
  };

  return (
    <>
      <header className="app-header">
        <h1>EliteJIM</h1>
        <p className="subtitle">Pronto a spaccare?</p>
      </header>
      
      <main className="app-main">
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
          <div key={template.id} className="card start-workout-card" style={{ borderColor: 'var(--primary-color)' }}>
            <h2>{template.name}</h2>
            <p>{template.exercises.length} esercizi • {template.exercises.reduce((acc, ex) => acc + ex.setsCount, 0)} serie totali</p>
            <button onClick={() => handleStartTemplate(template)}>Inizia Scheda</button>
          </div>
        ))}

        <div className="card start-workout-card" style={{ marginTop: templates.length > 0 ? '1rem' : '0' }}>
          <h2>Allenamento Vuoto</h2>
          <p>Inizia una sessione senza template predefinito.</p>
          <button 
            style={{ backgroundColor: 'var(--surface-color-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            onClick={handleStartEmpty}
          >
            Inizia Vuoto
          </button>
        </div>
      </main>
    </>
  );
}

export default Home;
