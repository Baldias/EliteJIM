import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ArrowLeft, Plus, Search, Trash2, Dumbbell } from 'lucide-react';
import { EXERCISE_CATEGORIES, EXERCISES_DB, getExerciseCategories } from '../data/exercises';
import { SwipeToDelete } from '../components/SwipeToDelete';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  const customExercises = useStore(state => state.customExercises || []);
  const addCustomExercise = useStore(state => state.addCustomExercise);
  const removeCustomExercise = useStore(state => state.removeCustomExercise);

  const [searchTerm, setSearchTerm] = useState('');
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState(EXERCISE_CATEGORIES.CHEST);
  const [isAdding, setIsAdding] = useState(false);

  // Combine default and custom exercises
  const allExercises = [...EXERCISES_DB, ...customExercises];

  // Filter based on search term
  const filteredExercises = allExercises.filter(ex => {
    const categories = getExerciseCategories(ex);
    const categoryMatch = categories.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase()));
    return ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || categoryMatch;
  });

  // Group by category — exercises appear in every group they belong to
  const groupedTasks = Object.values(EXERCISE_CATEGORIES).reduce((acc, cat) => {
    acc[cat] = filteredExercises.filter(e => getExerciseCategories(e).includes(cat));
    return acc;
  }, {});

  const handleAdd = () => {
    if (!newExName.trim()) {
      alert("Inserisci un nome per l'esercizio");
      return;
    }
    // Check if exists
    if (allExercises.some(e => e.name.toLowerCase() === newExName.toLowerCase())) {
      alert("Questo esercizio esiste già nel database!");
      return;
    }

    addCustomExercise({ name: newExName.trim(), category: newExCategory, isCustom: true });
    setNewExName('');
    setIsAdding(false);
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <button className="icon-btn" onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <h2>Database Esercizi</h2>
        <div style={{ width: 44 }}></div> {/* Balance spacer */}
      </header>

      <main className="settings-content">
        <div className="search-bar-container">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Cerca esercizio o categoria..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="add-exercise-section">
          {!isAdding ? (
            <button className="btn-add-exercise" onClick={() => setIsAdding(true)}>
              <Plus size={20} /> Nuovo Esercizio Personalizzato
            </button>
          ) : (
            <div className="add-exercise-form">
              <h3>Aggiungi Esercizio</h3>
              <div className="form-group">
                <label>Nome Esercizio</label>
                <input 
                  type="text" 
                  placeholder="Es. Panca Piana Manubri 30°" 
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Gruppo Muscolare</label>
                <select 
                  value={newExCategory} 
                  onChange={(e) => setNewExCategory(e.target.value)}
                >
                  {Object.values(EXERCISE_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button className="btn-cancel" onClick={() => setIsAdding(false)}>Annulla</button>
                <button className="btn-save" onClick={handleAdd}>Salva</button>
              </div>
            </div>
          )}
        </div>

        <div className="exercises-catalog">
          {Object.entries(groupedTasks).map(([category, exercises]) => {
            if (exercises.length === 0) return null;
            return (
              <div key={category} className="category-group">
                <h3 className="category-title">{category} <span className="category-count">{exercises.length}</span></h3>
                <div className="category-list">
                  {exercises.map(ex => (
                    ex.isCustom ? (
                      <SwipeToDelete key={ex.id} onDelete={() => {
                        if (window.confirm(`Sei sicuro di voler eliminare ${ex.name}?`)) {
                          removeCustomExercise(ex.id);
                        }
                      }}>
                        <div className="ex-list-item custom-ex">
                          <div className="ex-info">
                            <Dumbbell size={16} className="ex-icon" />
                            <span>{ex.name}</span>
                          </div>
                          <span className="badge-custom">Custom</span>
                        </div>
                      </SwipeToDelete>
                    ) : (
                      <div key={ex.id} className="ex-list-item">
                        <div className="ex-info">
                          <div className="ex-dot"></div>
                          <span>{ex.name}</span>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default Settings;
