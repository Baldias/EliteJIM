import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
import './TemplateBuilder.css';

function TemplateBuilder() {
  const navigate = useNavigate();
  const addTemplate = useStore(state => state.addTemplate);

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]);

  const handleAddExercise = () => {
    setExercises([...exercises, { id: Date.now(), name: '', setsCount: 3, targetReps: '8-10', restTime: 60 }]);
  };

  const handleUpdateExercise = (id, field, value) => {
    setExercises(exercises.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
  };

  const handleRemoveExercise = (id) => {
    setExercises(exercises.filter(ex => ex.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Inserisci un nome per la scheda (es. Petto/Tricipiti)");
      return;
    }
    if (exercises.length === 0) {
      alert("Aggiungi almeno un esercizio!");
      return;
    }

    // Validate exercise names
    if (exercises.some(ex => !ex.name.trim())) {
      alert("Tutti gli esercizi devono avere un nome.");
      return;
    }

    addTemplate({ name, exercises });
    navigate('/');
  };

  return (
    <div className="builder-container">
      <header className="builder-header">
        <button className="icon-btn" onClick={() => navigate('/')}><ArrowLeft size={24} /></button>
        <h2>Nuova Scheda</h2>
        <button className="icon-btn save-btn" onClick={handleSave}><Save size={24} /></button>
      </header>

      <main className="builder-content">
        <div className="input-group">
          <label>Nome Scheda</label>
          <input
            type="text"
            placeholder="Es. Spinta - Giorno A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="exercises-list">
          <h3>Esercizi ({exercises.length})</h3>
          {exercises.map((ex, idx) => (
            <div key={ex.id} className="builder-exercise-card">
              <div className="ex-card-header">
                <span className="ex-number">{idx + 1}</span>
                <div style={{ flex: 1 }}>
                  <ExerciseAutocomplete
                    value={ex.name}
                    onChange={(val) => handleUpdateExercise(ex.id, 'name', val)}
                  />
                </div>
                <button className="remove-btn" onClick={() => handleRemoveExercise(ex.id)}>
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="ex-card-details">
                <div className="detail-group">
                  <label>Serie</label>
                  <div className="number-input-group">
                    <button 
                      type="button" 
                      className="num-btn"
                      onClick={() => handleUpdateExercise(ex.id, 'setsCount', Math.max(1, (parseInt(ex.setsCount) || 1) - 1))}
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={ex.setsCount !== undefined ? ex.setsCount : ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        handleUpdateExercise(ex.id, 'setsCount', val === '' ? '' : parseInt(val, 10));
                      }}
                    />
                    <button 
                      type="button" 
                      className="num-btn"
                      onClick={() => handleUpdateExercise(ex.id, 'setsCount', (parseInt(ex.setsCount) || 0) + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="detail-group">
                  <label>Reps Target</label>
                  <div className="number-input-group">
                    <button 
                      type="button" 
                      className="num-btn"
                      onClick={() => {
                        let current = ex.targetReps || '';
                        let num = 8; // default fallback
                        if (current) {
                          const match = current.match(/\d+$/);
                          if (match) num = parseInt(match[0], 10);
                        }
                        const newNum = Math.max(2, num - 2);
                        handleUpdateExercise(ex.id, 'targetReps', `${newNum - 2}-${newNum}`);
                      }}
                    >
                      -
                    </button>
                    <input
                      type="text"
                      placeholder="Es. 8-10"
                      value={ex.targetReps}
                      onChange={(e) => handleUpdateExercise(ex.id, 'targetReps', e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="num-btn"
                      onClick={() => {
                        let current = ex.targetReps || '';
                        let num = 8; // default fallback
                        if (current) {
                          const match = current.match(/\d+$/);
                          if (match) num = parseInt(match[0], 10);
                        }
                        const newNum = num + 2;
                        handleUpdateExercise(ex.id, 'targetReps', `${newNum - 2}-${newNum}`);
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="detail-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Recupero (secondi)</label>
                  <div className="number-input-group">
                    <button 
                      type="button" 
                      className="num-btn"
                      onClick={() => handleUpdateExercise(ex.id, 'restTime', Math.max(0, (parseInt(ex.restTime) || 0) - 15))}
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={ex.restTime !== undefined ? ex.restTime : 0}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        handleUpdateExercise(ex.id, 'restTime', val === '' ? '' : parseInt(val, 10));
                      }}
                    />
                    <button 
                      type="button" 
                      className="num-btn"
                      onClick={() => handleUpdateExercise(ex.id, 'restTime', (parseInt(ex.restTime) || 0) + 15)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="add-exercise-btn" onClick={handleAddExercise}>
          <Plus size={20} /> Aggiungi Esercizio
        </button>
      </main>
    </div>
  );
}

export default TemplateBuilder;
