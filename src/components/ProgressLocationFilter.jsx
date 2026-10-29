import { useState } from 'react';
import { MapPin, Pencil, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { gymLabel, locationKey } from '../utils/gymLocation';
import { Sheet } from '../pages/monitoring/Sheet';
import './GymLocation.css';

export default function ProgressLocationFilter({ history, exercise, value, onChange }) {
  const aliases = useStore(s => s.gymLocationAliases);
  const rename = useStore(s => s.renameGymLocation);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const locations = new Map();
  history.filter(w => w.exercises.some(ex => ex.name === exercise && ex.sets.some(s => s.done))).forEach(w => locations.set(locationKey(w), w.gymLocation || null));
  const selected = locations.get(value);
  return <>
    <div className="pg-gym-filter"><MapPin size={17} /><select aria-label="Filtra macchinario per località o palestra" value={value} onChange={e => onChange(e.target.value)}><option value="all">Tutte le località</option>{[...locations].map(([id, location]) => <option key={id} value={id}>{gymLabel(location, aliases)}</option>)}</select>
      {selected && <button type="button" aria-label="Rinomina località con il nome della palestra" onClick={() => { setName(gymLabel(selected, aliases)); setEditing(true); }}><Pencil size={15} /></button>}
    </div>
    {value === 'all' && locations.size > 1 && <p className="pg-hero-note">Un unico storico generale. Carichi di macchinari diversi possono variare: filtra una località per confrontarli.</p>}
    {editing && <Sheet title="Nome della palestra" onClose={() => setEditing(false)}><form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; rename(value, name); setEditing(false); }}><p className="science-sheet-intro">Località rilevata: {selected?.name}. Il nuovo nome si applica a tutti gli allenamenti di questa località.</p><input aria-label="Nome della palestra" className="autocomplete-input" maxLength={80} value={name} onChange={e => setName(e.target.value)} required /><button className="ej-btn ej-btn--primary" type="submit"><Check size={16} />Salva</button></form></Sheet>}
  </>;
}
