import { Dna, Utensils, Check, ToggleRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import ScienceTutorialButton from '../pages/science/ScienceTutorial';
import './OptionalFeature.css';

export default function OptionalFeature({ feature, children }) {
  const isScience = feature === 'science';
  const enabled = useStore(s => isScience ? s.showScience : s.showDiary);
  const toggle = useStore(s => isScience ? s.toggleScience : s.toggleDiary);
  if (enabled) return children;
  const Icon = isScience ? Dna : Utensils;
  const title = isScience ? 'Scienza' : 'Diario';
  const benefits = isScience ? ['Obiettivi di serie su misura per te', 'Progressione e recupero, settimana dopo settimana', 'Esercizi e sedute scelti da te'] : ['Pasti, calorie e nutrienti in un solo posto', 'Pesate e andamento nel tempo', 'Obiettivi adatti alle tue abitudini'];
  return <div className="ej-page optional-feature-page"><div className="ej-glow" aria-hidden="true" /><header><p>IL TUO ALLENAMENTO, A MODO TUO</p><h1>{title}</h1></header><section className="ej-card optional-feature-card"><span className="optional-feature-icon"><Icon size={34} /></span><span className="optional-feature-tag">FUNZIONE AGGIUNTIVA</span><h2>{isScience ? 'Una guida per crescere.' : 'Dai spazio anche all’alimentazione.'}</h2><p>{isScience ? 'Scienza ti aiuta a dosare il lavoro in palestra e ad adattarlo a come rispondi. Attivala quando vuoi aggiungerla al tuo percorso.' : 'Il Diario ti aiuta a seguire ciò che mangi e come cambia il tuo peso. Attivalo se vuoi affiancarlo agli allenamenti.'}</p><ul>{benefits.map(text => <li key={text}><Check size={17} />{text}</li>)}</ul><div className="optional-feature-activation"><span><strong>Attiva {title}</strong><small>Puoi disattivarla nelle Impostazioni.</small></span><button type="button" role="switch" aria-checked={false} aria-label={`Attiva ${title}`} onClick={toggle}><span /></button></div>{isScience && <ScienceTutorialButton inline />}<p className="optional-feature-hint"><ToggleRight size={15} />Sei tu a scegliere cosa usare.</p></section></div>;
}
