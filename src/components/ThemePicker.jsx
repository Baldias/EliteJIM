import { useState } from 'react';
import { ArrowRight, Check, ChevronRight, Palette } from 'lucide-react';
import { SCIENCE_GLOWS } from '../utils/theme';
import { useStore } from '../store/useStore';
import { Sheet } from '../pages/monitoring/Sheet';
import './ThemePicker.css';

const OPTIONS = [
  { id: 'og', name: 'OG Elite Jim', text: 'L’originale: blu notte, accenti luminosi e bottoni pieni.' },
  { id: 'science-v3', name: 'Science V3 Edition', text: 'La nuova edizione: superfici scure e controlli essenziali.' },
];
function ThemeChoices({ onDone, onboarding = false }) {
  const current = useStore(s => s.theme);
  const currentGlow = useStore(s => s.scienceGlow);
  const [glow, setGlow] = useState(currentGlow);
  const choose = useStore(s => s.chooseTheme);
  const [selected, setSelected] = useState(current);
  return <div className="theme-choices"><p>{onboarding ? 'Scegli il look del tuo compagno di allenamento. Potrai cambiarlo dal Profilo quando vuoi.' : 'Stesse funzioni, due modi di viverle. La scelta si applica a tutta l’app.'}</p><div role="radiogroup" aria-label="Tema dell’app">{OPTIONS.map(option => <button type="button" role="radio" aria-checked={selected === option.id} key={option.id} className="theme-option" onClick={() => setSelected(option.id)}><span className={`theme-preview theme-preview--${option.id}`} style={option.id === 'science-v3' ? { '--preview-glow': SCIENCE_GLOWS.find(g => g.id === glow)?.rgb } : undefined} aria-hidden="true"><span className="theme-preview-title">EliteJIM</span><span className="theme-preview-card"><i /><i /><i /></span><span className="theme-preview-footer"><i /><i /><i /></span></span><span className="theme-option-copy"><strong>{option.name}</strong><small>{option.text}</small></span><span className="theme-option-check">{selected === option.id && <Check size={16} />}</span></button>)}</div>{selected === 'science-v3' && <fieldset className="theme-glow-picker"><legend>Il colore del tuo bagliore</legend><p>Oro è il bagliore originale. Cambia solo lo sfondo.</p><div>{SCIENCE_GLOWS.map(color => <button type="button" key={color.id} aria-pressed={glow === color.id} aria-label={`Bagliore ${color.name}`} onClick={() => setGlow(color.id)}><i style={{ background:`rgb(${color.rgb})` }} />{color.name}{glow === color.id && <Check size={12} />}</button>)}</div></fieldset>}<button type="button" className="ej-btn ej-btn--primary theme-confirm" onClick={() => { choose(selected, glow); onDone?.(); }}>{onboarding ? 'Iniziamo' : 'Applica tema'}<ArrowRight size={17} /></button></div>;
}
export function ThemeOnboarding() {
  return <main className="ej-page theme-onboarding"><span className="theme-onboarding-icon"><Palette size={28} /></span><header><p>IL TUO ALLENAMENTO, IL TUO STILE</p><h1>Come vuoi vivere<br />EliteJIM?</h1></header><ThemeChoices onboarding /></main>;
}
export function ProfileThemePicker() {
  const [open, setOpen] = useState(false);
  const theme = useStore(s => s.theme);
  return <><button type="button" className="ej-card theme-profile-entry" onClick={() => setOpen(true)}><Palette size={21} /><span><strong>Aspetto dell’app</strong><small>{OPTIONS.find(o => o.id === theme)?.name}</small></span><ChevronRight size={18} /></button>{open && <Sheet title="Scegli il tuo tema" full onClose={() => setOpen(false)}><ThemeChoices onDone={() => setOpen(false)} /></Sheet>}</>;
}
