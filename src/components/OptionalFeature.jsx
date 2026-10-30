import { Dna, Utensils, Check, ToggleRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import ScienceTutorialButton from '../pages/science/ScienceTutorial';
import { useMicroTransition } from '../hooks/useMicroTransition';
import MicroLoading from './MicroLoading';
import './OptionalFeature.css';
import { tr } from '../i18n';

export default function OptionalFeature({ feature, children }) {
  const isScience = feature === 'science';
  const enabled = useStore(s => isScience ? s.showScience : s.showDiary);
  const toggle = useStore(s => isScience ? s.toggleScience : s.toggleDiary);
  const transition = useMicroTransition();
  if (enabled) return children;
  const Icon = isScience ? Dna : Utensils;
  const title = isScience ? tr('Scienza') : tr('Diario');
  if (transition.busy) return <div className="ej-page optional-feature-page" aria-busy="true"><div className="ej-glow" aria-hidden="true" /><section className="ej-card"><MicroLoading food={!isScience} title={tr('Attivo {name}', { name: title })} description={isScience ? tr('Il tuo spazio per allenarti con criterio.') : tr('Pasti, obiettivi e andamento: tutto al suo posto.')} /></section></div>;
  const benefits = isScience ? [tr('Obiettivi di serie su misura per te'), tr('Progressione e recupero, settimana dopo settimana'), tr('Esercizi e sedute scelti da te')] : [tr('Pasti, calorie e nutrienti in un solo posto'), tr('Pesate e andamento nel tempo'), tr('Obiettivi adatti alle tue abitudini')];
  return <div className="ej-page optional-feature-page"><div className="ej-glow" aria-hidden="true" /><header><p>{tr('IL TUO ALLENAMENTO, A MODO TUO')}</p><h1>{title}</h1></header><section className="ej-card optional-feature-card"><span className="optional-feature-icon"><Icon size={34} /></span><span className="optional-feature-tag">{tr('FUNZIONE AGGIUNTIVA')}</span><h2>{isScience ? tr('Una guida per crescere.') : tr('Dai spazio anche all’alimentazione.')}</h2><p>{isScience ? tr('Scienza ti aiuta a dosare il lavoro in palestra e ad adattarlo a come rispondi. Attivala quando vuoi aggiungerla al tuo percorso.') : tr('Il Diario ti aiuta a seguire ciò che mangi e come cambia il tuo peso. Attivalo se vuoi affiancarlo agli allenamenti.')}</p><ul>{benefits.map(text => <li key={text}><Check size={17} />{text}</li>)}</ul><div className="optional-feature-activation"><span><strong>{tr('Attiva {name}', { name: title })}</strong><small>{tr('Puoi disattivarla nelle Impostazioni.')}</small></span><button type="button" role="switch" aria-checked={false} aria-label={tr('Attiva {name}', { name: title })} onClick={() => transition.run(toggle)}><span /></button></div>{isScience && <ScienceTutorialButton inline />}{transition.error && <p role="alert">{transition.error}</p>}<p className="optional-feature-hint"><ToggleRight size={15} />{tr('Sei tu a scegliere cosa usare.')}</p></section></div>;
}
