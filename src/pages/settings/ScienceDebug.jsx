import { useState } from 'react';
import { Bug, ChevronRight, FastForward, LockKeyhole, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ScienceStoreContext, useScienceStore } from '../../store/scienceContext';
import { createScienceSandbox } from '../../store/scienceDebug';
import { scienceProgramWeekRange } from '../../utils/scienceCalendar';
import { Sheet } from '../monitoring/Sheet';
import ScienceV3 from '../science/ScienceV3';
import ScienceWeekPrompt from '../../components/ScienceWeekPrompt';
import packageInfo from '../../../package.json';
import { locale } from '../../i18n';

function Simulator({ onReset }) {
  const now = useScienceStore(s => s.scienceDebugNow);
  const program = useScienceStore(s => s.scienceState.program);
  const advance = useScienceStore(s => s.advanceScienceDebugWeek);
  const lateDay = useScienceStore(s => s.advanceScienceDebugDay);
  const [scenario, setScenario] = useState('good');
  const due = program && now >= scienceProgramWeekRange(program).end;
  return <div className="sv3-debug">
    <div className="sv3-debug-toolbar"><span className="sv3-debug-label"><Bug size={14} />SIMULAZIONE · {new Date(now).toLocaleDateString(locale())}</span><p>Copia temporanea di Scienza. Serie di test, decisioni e tempo simulato non vengono salvati nei dati reali. Gli scenari sostituiscono le sedute della settimana solo in questa copia; “Dati copiati” usa lo storico esistente.</p>
      <div className="sv3-debug-scenarios" role="group" aria-label="Dati della settimana simulata">{[['recorded', 'Dati copiati'], ['empty', 'Nessun dato'], ['good', 'Recupero buono'], ['fatigue', 'Fatica elevata']].map(([id, text]) => <button type="button" key={id} aria-pressed={scenario === id} onClick={() => setScenario(id)}>{text}</button>)}</div>
      <button type="button" className="ej-btn ej-btn--primary sv3-wide-button" disabled={!program || program.status !== 'active' || due} onClick={() => advance(scenario)}><FastForward size={16} />{due ? 'Check settimanale disponibile qui sotto' : 'Simula il passaggio della settimana'}</button>
      {due && program?.status === 'active' && <button type="button" className="ej-btn ej-btn--secondary sv3-wide-button sv3-debug-late-day" onClick={lateDay}>+1 giorno di ritardo</button>}
      <button type="button" className="sv3-repeat-quiz" onClick={onReset}><RotateCcw size={13} />Riparti dalla copia iniziale</button>
    </div>
    <ScienceV3 /><ScienceWeekPrompt />
  </div>;
}

export default function ScienceDebugEntry() {
  const [taps, setTaps] = useState(0);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [sandbox, setSandbox] = useState(null);
  const [generation, setGeneration] = useState(0);
  const unlock = e => {
    e.preventDefault();
    if (password !== '1234') { setError(true); return; }
    setSandbox(createScienceSandbox(useStore.getState()));
    setPassword(''); setError(false);
  };
  return <>
    <button type="button" className="st-debug-secret" aria-label="Versione EliteJIM" onClick={() => { if (taps >= 4) { setOpen(true); setTaps(0); } else setTaps(n => n + 1); }}>EliteJIM · {packageInfo.version}</button>
    {open && !sandbox && <Sheet title="Debug" onClose={() => { setOpen(false); setPassword(''); setError(false); }}><form className="sv3-debug-unlock" onSubmit={unlock}><span className="science-quiz-icon"><LockKeyhole size={25} /></span><h3 className="science-quiz-question">Accesso al simulatore</h3><p className="science-sheet-intro">Ambiente di prova separato per verificare le settimane di Scienza.</p><label className="sv3-quiz-field">Password<input type="password" inputMode="numeric" autoComplete="off" aria-label="Password debug" value={password} onChange={e => { setPassword(e.target.value); setError(false); }} /></label>{error && <p className="sv3-debug-error" role="alert">Password errata.</p>}<button type="submit" className="ej-btn ej-btn--primary sv3-wide-button">Apri Debug<ChevronRight size={16} /></button></form></Sheet>}
    {open && sandbox && <Sheet title="Debug · Scienza" full onClose={() => { setSandbox(null); setOpen(false); }}><ScienceStoreContext.Provider value={sandbox}><Simulator key={generation} onReset={() => { setSandbox(createScienceSandbox(useStore.getState())); setGeneration(n => n + 1); }} /></ScienceStoreContext.Provider></Sheet>}
  </>;
}
