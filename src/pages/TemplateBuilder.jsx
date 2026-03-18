import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Plus, ArrowLeft, Check, Trash2 } from 'lucide-react';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';

const REPS_PRESETS = ['4-6', '6-8', '8-10', '10-12', '12-15', '15-20'];

function NumInput({ label, value, onChange, min = 0, step = 1, format }) {
  const display = format ? format(value) : value;
  return (
    <div>
      <p style={{ margin: '0 0 5px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', height: '38px' }}>
        <button type="button" onClick={() => onChange(Math.max(min, (parseFloat(value) || 0) - step))}
          style={{ padding: '0 12px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', fontWeight: '800', fontSize: '1.1rem', lineHeight: 1 }}>−</button>
        <span style={{ flex: 1, textAlign: 'center', color: 'white', fontWeight: '700', fontSize: '0.9rem' }}>{display}</span>
        <button type="button" onClick={() => onChange((parseFloat(value) || 0) + step)}
          style={{ padding: '0 12px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', fontWeight: '800', fontSize: '1.1rem', lineHeight: 1 }}>+</button>
      </div>
    </div>
  );
}

function TemplateBuilder() {
  const navigate = useNavigate();
  const addTemplate = useStore(state => state.addTemplate);
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]);

  const addEx = () => setExercises(p => [...p, { id: Date.now(), name: '', setsCount: 3, targetReps: '8-10', restTime: 90 }]);
  const updEx = (id, field, val) => setExercises(p => p.map(e => e.id === id ? { ...e, [field]: val } : e));
  const rmEx = id => setExercises(p => p.filter(e => e.id !== id));

  const handleSave = () => {
    if (!name.trim()) return alert('Inserisci il nome della scheda');
    if (!exercises.length) return alert('Aggiungi almeno un esercizio');
    if (exercises.some(e => !e.name.trim())) return alert('Tutti gli esercizi devono avere un nome');
    addTemplate({ name, exercises });
    navigate('/');
  };

  const fmtRest = s => {
    const m = Math.floor(s / 60), sec = s % 60;
    return sec === 0 ? `${m}min` : `${m}m${sec}s`;
  };

  const isValid = name.trim() && exercises.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#080c10', display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ─────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,12,16,0.94)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(0,184,212,0.12)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', padding: '8px', color: 'rgba(255,255,255,0.6)', display: 'flex', width: 'auto' }}>
          <ArrowLeft size={20} />
        </button>
        <span style={{ flex: 1, fontWeight: '800', fontSize: '1rem', color: 'white' }}>Nuova Scheda</span>
        <button onClick={handleSave} style={{
          background: isValid ? 'linear-gradient(135deg, #00b8d4 0%, #0090b0 100%)' : 'rgba(255,255,255,0.07)',
          border: 'none', borderRadius: '10px', padding: '8px 16px',
          color: isValid ? 'white' : 'rgba(255,255,255,0.25)',
          fontWeight: '800', fontSize: '0.88rem',
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'all 0.2s', width: 'auto',
          boxShadow: isValid ? '0 4px 14px rgba(0,184,212,0.3)' : 'none'
        }}>
          <Check size={15} /> Salva
        </button>
      </div>

      <div style={{ flex: 1, padding: '16px 14px 120px' }}>

        {/* ── NOME ──────────────────────────── */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' }}>NOME SCHEDA</p>
          <input
            type="text"
            placeholder="Es. Petto & Tricipiti"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: name ? '1px solid rgba(0,184,212,0.3)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px', color: 'white',
              fontSize: '1rem', fontWeight: '600', outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
        </div>

        {/* ── ESERCIZI ──────────────────────── */}
        {exercises.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              ESERCIZI ({exercises.length})
            </p>

            {exercises.map((ex, idx) => (
              <div key={ex.id} style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px', marginBottom: '10px', overflow: 'hidden'
              }}>
                {/* Name row */}
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ minWidth: '22px', height: '22px', borderRadius: '7px', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: '700', color: 'rgba(255,255,255,0.35)' }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ExerciseAutocomplete value={ex.name} onChange={val => updEx(ex.id, 'name', val)} placeholder="Cerca esercizio…" />
                  </div>
                  <button onClick={() => rmEx(ex.id)} style={{ background: 'rgba(255,59,48,0.1)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,59,48,0.7)', flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Controls */}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <NumInput label="Serie" value={ex.setsCount} min={1} step={1} onChange={v => updEx(ex.id, 'setsCount', Math.round(v))} />
                    <NumInput label="Recupero" value={ex.restTime} min={0} step={15} format={fmtRest} onChange={v => updEx(ex.id, 'restTime', Math.round(v))} />
                  </div>

                  {/* Reps chips */}
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' }}>REPS TARGET</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {REPS_PRESETS.map(p => {
                        const active = ex.targetReps === p;
                        return (
                          <button key={p} onClick={() => updEx(ex.id, 'targetReps', p)} style={{
                            padding: '5px 12px', borderRadius: '20px',
                            background: active ? '#00b8d4' : 'rgba(255,255,255,0.06)',
                            border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            color: active ? 'white' : 'rgba(255,255,255,0.4)',
                            fontWeight: '700', fontSize: '0.78rem',
                            transition: 'all 0.15s'
                          }}>
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ADD EXERCISE ──────────────────── */}
        <button onClick={addEx} style={{
          width: '100%', padding: '11px',
          background: 'rgba(0,184,212,0.07)', border: '1px dashed rgba(0,184,212,0.2)',
          borderRadius: '12px', color: '#00b8d4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          fontWeight: '700', fontSize: '0.92rem'
        }}>
          <Plus size={18} /> Aggiungi Esercizio
        </button>

        {exercises.length === 0 && (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem', marginTop: '24px' }}>
            Aggiungi il primo esercizio per iniziare 💪
          </p>
        )}
      </div>
    </div>
  );
}

export default TemplateBuilder;
