import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ArrowLeft, Plus, Search, Trash2, Dumbbell, Edit2, RotateCcw, X, Check } from 'lucide-react';
import { EXERCISE_CATEGORIES, EQUIPMENT_TYPES, getAllExercises, getExerciseCategories, normalizeName } from '../../data/exercises';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import './Settings.css';

function Exercises() {
  const navigate = useNavigate();
  const customExercises = useStore(state => state.customExercises || []);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
  const addCustomExercise = useStore(state => state.addCustomExercise);
  const removeCustomExercise = useStore(state => state.removeCustomExercise);
  const updateExercise = useStore(state => state.updateExercise);
  const resetExerciseToDefault = useStore(state => state.resetExerciseToDefault);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState(EXERCISE_CATEGORIES.CHEST);
  const [newExSecondary, setNewExSecondary] = useState([]);
  const [newExEquipment, setNewExEquipment] = useState(EQUIPMENT_TYPES.BARBELL);

  // Modal edit state
  const [editingExercise, setEditingExercise] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState(EXERCISE_CATEGORIES.CHEST);
  const [editSecondary, setEditSecondary] = useState([]);
  const [editEquipment, setEditEquipment] = useState(EQUIPMENT_TYPES.BARBELL);
  const [editSyncHistory, setEditSyncHistory] = useState(true);

  // Combine default, overrides and custom exercises
  const allExercises = useMemo(() => {
    return getAllExercises(customExercises, exerciseOverrides);
  }, [customExercises, exerciseOverrides]);

  // Filter based on search term
  const filteredExercises = useMemo(() => {
    return allExercises.filter(ex => {
      const categories = getExerciseCategories(ex);
      const searchLow = searchTerm.toLowerCase();
      const categoryMatch = categories.some(cat => cat.toLowerCase().includes(searchLow));
      return ex.name.toLowerCase().includes(searchLow) || categoryMatch;
    });
  }, [allExercises, searchTerm]);

  // Group by category — exercises appear in every group they belong to
  const groupedTasks = useMemo(() => {
    return Object.values(EXERCISE_CATEGORIES).reduce((acc, cat) => {
      acc[cat] = filteredExercises.filter(e => getExerciseCategories(e).includes(cat));
      return acc;
    }, {});
  }, [filteredExercises]);

  const handleOpenEdit = (ex, e) => {
    if (e) e.stopPropagation();
    setEditingExercise(ex);
    setEditName(ex.name);
    setEditCategory(ex.category || EXERCISE_CATEGORIES.CHEST);
    setEditSecondary(ex.secondaryCategories || []);
    setEditEquipment(ex.equipmentType || EQUIPMENT_TYPES.BARBELL);
    setEditSyncHistory(true);
  };

  const handleToggleSecondary = (cat, isForNew = false) => {
    if (isForNew) {
      setNewExSecondary(prev =>
        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
      );
    } else {
      setEditSecondary(prev =>
        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
      );
    }
  };

  const handleAdd = () => {
    if (!newExName.trim()) {
      alert("Inserisci un nome per l'esercizio");
      return;
    }
    // Check if exists
    if (allExercises.some(e => normalizeName(e.name) === normalizeName(newExName))) {
      alert("Questo esercizio esiste già nel database!");
      return;
    }

    addCustomExercise({
      name: newExName.trim(),
      category: newExCategory,
      secondaryCategories: newExSecondary.filter(c => c !== newExCategory),
      equipmentType: newExEquipment,
      isCustom: true
    });

    setNewExName('');
    setNewExSecondary([]);
    setNewExEquipment(EQUIPMENT_TYPES.BARBELL);
    setIsAdding(false);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      alert("Inserisci un nome per l'esercizio");
      return;
    }

    // Check duplicate among other exercises
    const isDuplicate = allExercises.some(
      e => e.id !== editingExercise.id && normalizeName(e.name) === normalizeName(editName)
    );
    if (isDuplicate) {
      alert("Un altro esercizio con questo nome esiste già nel database!");
      return;
    }

    updateExercise({
      id: editingExercise.id,
      name: editName.trim(),
      category: editCategory,
      secondaryCategories: editSecondary.filter(c => c !== editCategory),
      equipmentType: editEquipment,
      updateHistoryAndTemplates: editSyncHistory
    });

    setEditingExercise(null);
  };

  const handleResetDefault = () => {
    if (!editingExercise) return;
    if (window.confirm(`Vuoi ripristinare "${editingExercise.name}" ai valori originali predefiniti?`)) {
      resetExerciseToDefault(editingExercise.id, editSyncHistory);
      setEditingExercise(null);
    }
  };

  const handleDeleteCustom = () => {
    if (!editingExercise) return;
    if (window.confirm(`Sei sicuro di voler eliminare "${editingExercise.name}"?`)) {
      removeCustomExercise(editingExercise.id);
      setEditingExercise(null);
    }
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <button className="icon-btn" style={{ background: 'transparent', border: 'none' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </button>
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
              <h3>Aggiungi Esercizio Personalizzato</h3>
              <div className="form-group">
                <label>Nome Esercizio</label>
                <input 
                  type="text" 
                  placeholder="Es. Panca Piana Bilanciere" 
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Gruppo Muscolare Principale</label>
                <select 
                  value={newExCategory} 
                  onChange={(e) => {
                    setNewExCategory(e.target.value);
                    setNewExSecondary(prev => prev.filter(c => c !== e.target.value));
                  }}
                >
                  {Object.values(EXERCISE_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Gruppi Muscolari Secondari (Opzionali)</label>
                <div className="chips-container">
                  {Object.values(EXERCISE_CATEGORIES)
                    .filter(cat => cat !== newExCategory)
                    .map(cat => (
                      <button
                        key={cat}
                        type="button"
                        className={`muscle-chip ${newExSecondary.includes(cat) ? 'selected' : ''}`}
                        onClick={() => handleToggleSecondary(cat, true)}
                      >
                        {newExSecondary.includes(cat) && <Check size={12} style={{ display: 'inline', marginRight: 4 }} />}
                        {cat}
                      </button>
                    ))}
                </div>
              </div>
              <div className="form-group">
                <label>Tipo Attrezzo</label>
                <select
                  value={newExEquipment}
                  onChange={(e) => setNewExEquipment(e.target.value)}
                >
                  <option value={EQUIPMENT_TYPES.BARBELL}>Bilanciere / Macchina (+2.5kg)</option>
                  <option value={EQUIPMENT_TYPES.DUMBBELL}>Manubri (+2kg)</option>
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
                <h3 className="category-title">
                  {category} <span className="category-count">{exercises.length}</span>
                </h3>
                <div className="category-list">
                  {exercises.map(ex => {
                    const isDumbbell = ex.equipmentType === EQUIPMENT_TYPES.DUMBBELL;
                    const equipmentLabel = isDumbbell ? 'Manubri (+2kg)' : 'Bilanciere (+2.5kg)';
                    const secondaryLabel = ex.secondaryCategories && ex.secondaryCategories.length > 0
                      ? `+ ${ex.secondaryCategories.join(', ')}`
                      : null;

                    const content = (
                      <div 
                        className={`ex-list-item ${ex.isCustom ? 'custom-ex' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => handleOpenEdit(ex, e)}
                      >
                        <div className="ex-info" style={{ flex: 1, minWidth: 0 }}>
                          {ex.isCustom ? (
                            <Dumbbell size={18} className="ex-icon" style={{ flexShrink: 0 }} />
                          ) : (
                            <div className="ex-dot" style={{ flexShrink: 0 }}></div>
                          )}
                          <div className="ex-details" style={{ minWidth: 0, overflow: 'hidden' }}>
                            <span className="ex-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ex.name}
                            </span>
                            <div className="ex-meta-row">
                              <span className="ex-tag">{equipmentLabel}</span>
                              {secondaryLabel && (
                                <span className="ex-secondary-text">{secondaryLabel}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="ex-item-actions" onClick={e => e.stopPropagation()}>
                          {ex.isCustom && <span className="badge-custom">Custom</span>}
                          {ex.isModified && <span className="badge-modified">Modificato</span>}
                          <button
                            type="button"
                            className="ex-action-btn edit-btn"
                            title="Modifica esercizio"
                            onClick={(e) => handleOpenEdit(ex, e)}
                          >
                            <Edit2 size={15} />
                          </button>
                          {ex.isCustom && (
                            <button
                              type="button"
                              className="ex-action-btn delete-btn"
                              title="Elimina"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Sei sicuro di voler eliminare "${ex.name}"?`)) {
                                  removeCustomExercise(ex.id);
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );

                    return ex.isCustom ? (
                      <SwipeToDelete
                        key={ex.id}
                        onDelete={() => {
                          if (window.confirm(`Sei sicuro di voler eliminare "${ex.name}"?`)) {
                            removeCustomExercise(ex.id);
                          }
                        }}
                      >
                        {content}
                      </SwipeToDelete>
                    ) : (
                      <div key={ex.id}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mini Guida Esercizi */}
        <div className="settings-guide-box" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
          <p className="settings-guide-title">Come funzionano gli esercizi?</p>
          <p className="settings-guide-text">
            Puoi modificare qualsiasi esercizio predefinito o crearne di nuovi con <strong>Nuovo Esercizio</strong> in alto. Vengono tutti integrati istantaneamente nel generatore di schede AI e nel calcolo automatico dei tuoi massimali (1RM).
          </p>
        </div>
      </main>

      {/* Edit Exercise Modal */}
      {editingExercise && (
        <div className="modal-backdrop" onClick={() => setEditingExercise(null)}>
          <div className="edit-modal-card" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h3>
                <Edit2 size={20} color="var(--primary-color)" /> Modifica Esercizio
              </h3>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setEditingExercise(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="modal-body">
              <div className="form-group">
                <label>Nome Esercizio</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome dell'esercizio"
                />
              </div>

              <div className="form-group">
                <label>Gruppo Muscolare Principale</label>
                <select 
                  value={editCategory}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setEditCategory(newCat);
                    setEditSecondary(prev => prev.filter(c => c !== newCat));
                  }}
                >
                  {Object.values(EXERCISE_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Gruppi Muscolari Secondari / Sinergici</label>
                <div className="chips-container">
                  {Object.values(EXERCISE_CATEGORIES)
                    .filter(cat => cat !== editCategory)
                    .map(cat => (
                      <button
                        key={cat}
                        type="button"
                        className={`muscle-chip ${editSecondary.includes(cat) ? 'selected' : ''}`}
                        onClick={() => handleToggleSecondary(cat, false)}
                      >
                        {editSecondary.includes(cat) && <Check size={12} style={{ display: 'inline', marginRight: 4 }} />}
                        {cat}
                      </button>
                    ))}
                </div>
              </div>

              <div className="form-group">
                <label>Tipo Attrezzo (Incremento Carico)</label>
                <select
                  value={editEquipment}
                  onChange={(e) => setEditEquipment(e.target.value)}
                >
                  <option value={EQUIPMENT_TYPES.BARBELL}>Bilanciere / Macchina (+2.5kg per volta)</option>
                  <option value={EQUIPMENT_TYPES.DUMBBELL}>Manubri (+2kg: 1kg per mano)</option>
                </select>
              </div>

              <label className="sync-option-container">
                <input 
                  type="checkbox"
                  checked={editSyncHistory}
                  onChange={(e) => setEditSyncHistory(e.target.checked)}
                />
                <div className="sync-option-text">
                  <div className="sync-option-title">Aggiorna anche nelle schede e nello storico</div>
                  <div className="sync-option-desc">
                    Se cambi il nome, aggiorna automaticamente le tue schede e gli allenamenti passati per preservare 1RM, note e grafici di progresso.
                  </div>
                </div>
              </label>
            </div>

            <footer className="modal-footer">
              {editingExercise.isModified && !editingExercise.isCustom && (
                <button 
                  type="button" 
                  className="modal-reset-btn"
                  onClick={handleResetDefault}
                >
                  <RotateCcw size={15} /> Ripristina valori predefiniti
                </button>
              )}

              {editingExercise.isCustom && (
                <button 
                  type="button" 
                  className="modal-delete-btn"
                  onClick={handleDeleteCustom}
                >
                  <Trash2 size={15} /> Elimina esercizio
                </button>
              )}

              <div className="modal-footer-main">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setEditingExercise(null)}
                >
                  Annulla
                </button>
                <button 
                  type="button" 
                  className="btn-save" 
                  onClick={handleSaveEdit}
                >
                  Salva Modifiche
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default Exercises;

