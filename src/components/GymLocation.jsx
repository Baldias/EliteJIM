import { useCallback, useEffect, useState } from 'react';
import { MapPin, ArrowRight, Building2, Check, LocateFixed } from 'lucide-react';
import { useStore } from '../store/useStore';
import { detectGymCity, gymLabel, GYM_LOCATION_INTRO_VERSION } from '../utils/gymLocation';
import { Sheet } from '../pages/monitoring/Sheet';
import './GymLocation.css';
import { tr } from '../i18n';

function LocationConsent() {
  return <p className="gym-privacy">{tr('La posizione viene richiesta all’avvio della seduta e inviata a')} <a href="https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free" target="_blank" rel="noreferrer">BigDataCloud</a> {tr('per riconoscere il comune. Nell’app salviamo solo la località, senza coordinate o tracciamento continuo. Il servizio riceve anche l’indirizzo IP.')}</p>;
}

export function GymLocationSettings() {
  const preferences = useStore(s => s.gymLocationPreferences);
  const update = useStore(s => s.setGymLocationPreferences);
  return <section className="ej-card gym-settings"><h3><MapPin size={18} /> {tr('Palestre e località')}</h3><p>{tr('Le preferenze si applicano ai prossimi allenamenti. Il filtro nei Progressi è sempre disponibile per i macchinari.')}</p><LocationConsent />
    <label><input type="checkbox" checked={Boolean(preferences.capture)} onChange={e => update({ introVersion: GYM_LOCATION_INTRO_VERSION, capture: e.target.checked, ...(!e.target.checked ? { adaptLoads: false } : {}) })} />{tr('Rileva il comune degli allenamenti')}</label>
    <label><input type="checkbox" disabled={!preferences.capture} checked={Boolean(preferences.adaptLoads)} onChange={e => update({ adaptLoads: e.target.checked })} />{tr('Adatta carichi e PR dei macchinari alla località')}</label>
  </section>;
}

export default function WorkoutGymLocation({ workout }) {
  const preferences = useStore(s => s.gymLocationPreferences);
  const aliases = useStore(s => s.gymLocationAliases);
  const update = useStore(s => s.setGymLocationPreferences);
  const attach = useStore(s => s.attachWorkoutLocation);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = workout.id;
  const located = Boolean(workout.gymLocation);
  const locate = useCallback(async () => {
    setBusy(true); setError('');
    try { attach(id, await detectGymCity()); }
    catch (err) { setError(err.message || tr('Posizione non disponibile. Puoi continuare ad allenarti.')); }
    finally { setBusy(false); }
  }, [id, attach]);
  useEffect(() => {
    if (!preferences.capture || located) return;
    const timer = setTimeout(locate, 0);
    return () => clearTimeout(timer);
  }, [preferences.capture, located, locate]);
  const choose = (capture, adaptLoads) => update({ introVersion: GYM_LOCATION_INTRO_VERSION, capture, adaptLoads });
  const titles = ['Frequenti più palestre e in ogni palestra hai carichi diversi sui macchinari e non ci capisci più nulla?', 'Non è più un problema', 'I tuoi macchinari, nella palestra giusta.'];
  const bodies = ['Lo stesso esercizio, ma numeri che cambiano da una palestra all’altra. Ritrova un confronto più utile.', 'EliteJIM riconosce il comune in cui ti alleni. Nei Progressi puoi filtrare i macchinari per località e rinominarla con il nome della palestra.', 'Se attivi l’adattamento, carichi suggeriti e PR dei macchinari si basano sugli allenamenti nello stesso comune. Bilancieri e manubri mantengono il loro storico generale. La prima volta in una località crei una nuova base.'];
  return <>
    {(preferences.introVersion || 0) < GYM_LOCATION_INTRO_VERSION && <Sheet title={tr('Ogni palestra, i suoi carichi')} full onClose={() => choose(false, false)} className="gym-intro" footer={<div className="gym-intro-footer">{step < 2 ? <><button type="button" className="science-feedback-skip" onClick={() => choose(false, false)}>{tr('Non ora')}</button><button type="button" className="ej-btn ej-btn--primary" onClick={() => setStep(n => n + 1)}>{tr('Continua')}<ArrowRight size={16} /></button></> : <><button type="button" className="ej-btn ej-btn--primary" onClick={() => choose(true, true)}><Check size={16} />{tr('Attiva adattamento')}</button><button type="button" className="ej-btn ej-btn--secondary" onClick={() => choose(true, false)}>{tr('Solo località nei Progressi')}</button><button type="button" className="science-feedback-skip" onClick={() => choose(false, false)}>{tr('Continua senza posizione')}</button></>}</div>}>
      <div className="gym-slide-progress">{titles.map((_, i) => <span key={i} className={i <= step ? 'is-active' : ''} />)}</div>
      <div className="gym-slide-icon">{step === 0 ? <Building2 size={48} /> : step === 1 ? <Check size={48} /> : <LocateFixed size={48} />}</div>
      <h3>{tr(titles[step])}</h3><p className="science-sheet-intro">{tr(bodies[step])}</p>{step === 2 && <LocationConsent />}
      {step > 0 && <button type="button" className="science-feedback-skip" onClick={() => setStep(n => n - 1)}>{tr('Indietro')}</button>}
    </Sheet>}
    {preferences.capture && <div className="gym-workout-location"><MapPin size={14} /><span>{busy ? tr('Riconosco la località…') : error || gymLabel(workout.gymLocation, aliases)}{located && workout.machineLocationScoped ? tr(' · Carichi locali') : ''}</span>{!located && !busy && <button type="button" onClick={locate}>{tr('Riprova')}</button>}</div>}
  </>;
}
