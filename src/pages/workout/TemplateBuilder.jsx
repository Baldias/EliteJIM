import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Plus, ArrowLeft, Check, Trash2, FileText, ChevronUp, ChevronDown, GripVertical, Share2 } from 'lucide-react';
import { ExerciseAutocomplete } from '../../components/ExerciseAutocomplete';
import { ShareTemplateModal } from '../../components/ShareTemplateModal';
import { parseNonNegativeInt } from '../../utils/number';
import './TemplateBuilder.css';
import { tr, trc } from '../../i18n';

const REPS_PRESETS = ['4-6', '6-8', '8-10', '10-12', '12-15', '15-20'];

function NumInput({ label, value, onChange, min = 0, step = 1, format }) {
  const display = format ? format(value) : value;
  return (
    <div className="tb-num">
      <p className="tb-label">{label}</p>
      <div className="tb-stepper">
        <button type="button" onClick={() => onChange(Math.max(min, (parseFloat(value) || 0) - step))}>−</button>
        <span>{display}</span>
        <button type="button" onClick={() => onChange((parseFloat(value) || 0) + step)}>+</button>
      </div>
    </div>
  );
}

function TemplateBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const addTemplate = useStore(state => state.addTemplate);
  const updateTemplate = useStore(state => state.updateTemplate);
  
  const editTemplateData = location.state?.template;
  const isEditing = !!editTemplateData;

  const [name, setName] = useState(isEditing ? editTemplateData.name || '' : '');
  const [exercises, setExercises] = useState(
    isEditing 
      ? (editTemplateData.exercises || []).map((ex, i) => ({ ...ex, id: ex.id || `ex-${Date.now()}-${i}`, restTime: parseNonNegativeInt(ex.restTime, 90), notes: ex.notes || '' }))
      : []
  );
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const dragTouchRef = useRef(null);

  const addEx = () => setExercises(p => [...p, { id: Date.now(), name: '', setsCount: 3, targetReps: '8-10', restTime: 90, notes: '' }]);
  const updEx = (id, field, val) => setExercises(p => p.map(e => e.id === id ? { ...e, [field]: val } : e));
  const rmEx = id => setExercises(p => p.filter(e => e.id !== id));

  const moveEx = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= exercises.length) return;
    setExercises(prev => {
      const copy = [...prev];
      const [movedItem] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, movedItem);
      return copy;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return alert(tr('Inserisci il nome della scheda'));
    if (!exercises.length) return alert(tr('Aggiungi almeno un esercizio'));
    if (exercises.some(e => !e.name.trim())) return alert(tr('Tutti gli esercizi devono avere un nome'));
    
    if (isEditing) {
      updateTemplate({ id: editTemplateData.id, name, exercises });
    } else {
      addTemplate({ name, exercises });
    }
    navigate('/');
  };

  const fmtRest = s => {
    const m = Math.floor(s / 60), sec = s % 60;
    return sec === 0 ? `${m}min` : `${m}m${sec}s`;
  };

  const isValid = name.trim() && exercises.length > 0;

  return (
    <div className="tb-page">
      <div className="ej-glow tb-glow" aria-hidden="true" />

      {/* ── HEADER ─────────────────────────── */}
      <div className="tb-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round tb-back" onClick={() => navigate('/')} title={tr('Torna alla Home')}>
          <ArrowLeft size={20} />
        </button>
        <span className="tb-header-title">{isEditing ? tr('Modifica Scheda') : tr('Nuova Scheda')}</span>
        {isValid && (
          <button type="button" className="ej-icon-btn ej-icon-btn--primary tb-share" title={tr('Condividi ed esporta')} onClick={() => setShowShare(true)}>
            <Share2 size={17} />
          </button>
        )}
        <button type="button" className={`tb-save ${isValid ? 'is-valid' : ''}`} onClick={handleSave}>
          <Check size={15} strokeWidth={3} /> {tr('Salva')}
        </button>
      </div>

      <div className="tb-body">

        {/* ── NOME ──────────────────────────── */}
        <div className="tb-name">
          <p className="tb-label">{tr('Nome scheda')}</p>
          <input
            type="text"
            placeholder={tr('Es. Petto & Tricipiti')}
            value={name}
            onChange={e => setName(e.target.value)}
            className={`tb-name-input ${name ? 'has-value' : ''}`}
          />
        </div>

        {/* ── ESERCIZI ──────────────────────── */}
        {exercises.length > 0 && (
          <div className="tb-list">
            <div className="tb-list-head">
              <p className="tb-label">{tr('Esercizi')} · {exercises.length}</p>
              <span className="tb-list-hint">{tr('Trascina o usa ▲ ▼')}</span>
            </div>

            {exercises.map((ex, idx) => (
              <div
                key={ex.id || idx}
                data-exercise-index={idx}
                draggable
                onDragStart={(e) => {
                  if (e.target.closest('input') || e.target.closest('button')) {
                    e.preventDefault();
                    return;
                  }
                  setDraggedIndex(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === idx) setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null && draggedIndex !== idx) {
                    moveEx(draggedIndex, idx);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`tb-card ${dragOverIndex === idx ? 'is-drop-target' : ''} ${draggedIndex === idx ? 'is-dragging' : ''}`}
                style={{ zIndex: exercises.length - idx }}
              >
                {/* Name row */}
                <div className="tb-card-head">
                  <div
                    className="tb-handle"
                    title={tr('Trascina per riordinare')}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      dragTouchRef.current = { startY: touch.clientY, fromIndex: idx };
                      setDraggedIndex(idx);
                    }}
                    onTouchMove={(e) => {
                      if (!dragTouchRef.current) return;
                      const touch = e.touches[0];
                      const el = document.elementFromPoint(touch.clientX, touch.clientY);
                      const targetCard = el?.closest('[data-exercise-index]');
                      if (targetCard) {
                        const targetIdx = parseInt(targetCard.getAttribute('data-exercise-index'), 10);
                        if (!isNaN(targetIdx) && targetIdx !== dragOverIndex) {
                          setDragOverIndex(targetIdx);
                        }
                      }
                    }}
                    onTouchEnd={() => {
                      if (dragTouchRef.current && dragOverIndex !== null && dragOverIndex !== dragTouchRef.current.fromIndex) {
                        moveEx(dragTouchRef.current.fromIndex, dragOverIndex);
                      }
                      dragTouchRef.current = null;
                      setDragOverIndex(null);
                      setDraggedIndex(null);
                    }}
                  >
                    <GripVertical size={16} />
                    <span className="tb-index">{idx + 1}</span>
                  </div>

                  <div className="tb-ex-name">
                    <ExerciseAutocomplete value={ex.name} onChange={val => updEx(ex.id, 'name', val)} placeholder={tr('Cerca esercizio…')} />
                  </div>

                  <div className="tb-card-actions">
                    <button type="button" className="tb-mini-btn" onClick={() => moveEx(idx, idx - 1)} disabled={idx === 0} title={tr('Sposta su')}>
                      <ChevronUp size={17} strokeWidth={2.5} />
                    </button>
                    <button type="button" className="tb-mini-btn" onClick={() => moveEx(idx, idx + 1)} disabled={idx === exercises.length - 1} title={tr('Sposta giù')}>
                      <ChevronDown size={17} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className="tb-mini-btn is-danger"
                      onClick={() => {
                        const exName = ex.name?.trim() ? tr('l\'esercizio "{name}"', { name: ex.name }) : tr('questo esercizio');
                        if (window.confirm(tr('Sei sicuro di voler eliminare {exercise} dalla scheda?', { exercise: exName }))) {
                          rmEx(ex.id);
                        }
                      }}
                      title={tr('Elimina')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Controls */}
                <div className="tb-controls">
                  <NumInput label={tr('Serie')} value={ex.setsCount} min={1} step={1} onChange={v => updEx(ex.id, 'setsCount', Math.round(v))} />
                  <NumInput label={trc('rest', 'Recupero')} value={ex.restTime} min={0} step={15} format={fmtRest} onChange={v => updEx(ex.id, 'restTime', Math.round(v))} />
                </div>

                <div className="tb-field">
                  <p className="tb-label">{tr('Reps target')}</p>
                  <div className="tb-reps">
                    {REPS_PRESETS.map(p => (
                      <button
                        type="button"
                        key={p}
                        className={`tb-rep ${ex.targetReps === p ? 'is-active' : ''}`}
                        onClick={() => updEx(ex.id, 'targetReps', p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tb-field">
                  <p className="tb-label"><FileText size={11} /> {tr('Note esercizio')}</p>
                  <input
                    type="text"
                    placeholder={tr('Es. Impugnatura larga, fermo in basso 1 sec...')}
                    value={ex.notes || ''}
                    onChange={e => updEx(ex.id, 'notes', e.target.value)}
                    className={`tb-notes ${ex.notes ? 'has-value' : ''}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ADD EXERCISE ──────────────────── */}
        <button type="button" className="tb-add" onClick={addEx}>
          <Plus size={18} strokeWidth={2.5} /> {tr('Aggiungi esercizio')}
        </button>

        {exercises.length === 0 && (
          <p className="tb-empty">{tr('Aggiungi il primo esercizio per iniziare')}</p>
        )}
      </div>

      {/* Share Template Modal */}
      <ShareTemplateModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        template={{ name: name.trim() || tr('Nuova Scheda'), exercises }}
      />
    </div>
  );
}

class TemplateBuilderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("TemplateBuilder Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: 'black', minHeight: '100vh', wordBreak: 'break-all' }}>
          <h2>TemplateBuilder ERRORE:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', marginTop: '10px' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '10px', marginTop: '10px', color: '#ffb3b3' }}>{this.state.errorInfo?.componentStack}</pre>
          <p style={{ marginTop: '20px', color: 'white', fontSize: '14px' }}>Fai uno screenshot di questa schermata!</p>
        </div>
      );
    }
    return <TemplateBuilder />;
  }
}

export default TemplateBuilderErrorBoundary;
