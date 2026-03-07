import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import './TemplateBuilder.css';

function TemplateBuilder() {
  const navigate = useNavigate();
  const addTemplate = useStore(state => state.addTemplate);
  
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]);

  const handleAddExercise = () => {
    setExercises([...exercises, { id: Date.now(), name: '', setsCount: 3, targetReps: '8-10' }]);
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
                <input 
                  type="text" 
                  className="ex-name-input" 
                  placeholder="Nome Esercizio" 
                  value={ex.name}
                  onChange={(e) => handleUpdateExercise(ex.id, 'name', e.target.value)}
                />
                <button className="remove-btn" onClick={() => handleRemoveExercise(ex.id)}>
                  <Trash2 size={20} />
                </button>
              </div>
              
              <div className="ex-card-details">
                <div className="detail-group">
                  <label>Serie</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={ex.setsCount}
                    onChange={(e) => handleUpdateExercise(ex.id, 'setsCount', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="detail-group">
                  <label>Reps Target</label>
                  <input 
                    type="text" 
                    placeholder="Es. 8-10" 
                    value={ex.targetReps}
                    onChange={(e) => handleUpdateExercise(ex.id, 'targetReps', e.target.value)}
                  />
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
