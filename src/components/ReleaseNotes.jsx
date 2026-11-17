import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, MapPin, Sparkles, Timer, TrendingUp, Utensils } from 'lucide-react';
import { releaseNotesFor } from '../utils/releaseNotes';
import { Sheet } from '../pages/monitoring/Sheet';
import './ReleaseNotes.css';
import { tr } from '../i18n';

const highlights = [
  { icon: Layers, title: 'Splits intelligenti & dinamiche', text: 'Genera la tua split in un attimo, sincronizza e bilancia le serie con Scienza e consulta le vecchie schede in archivio.' },
  { icon: TrendingUp, title: 'Progressi senza ostacoli', text: 'Intervalli 1M–Max, variazione % dell’1RM smussata, note subito leggibili e apertura diretta dell’allenamento.' },
  { icon: Utensils, title: 'Diario e peso più precisi', text: 'Cibi più frequenti filtrati per pasto con dose abituale, toggle rapido della spunta e media mobile peso a 7 giorni.' },
  { icon: Timer, title: 'Recupero di default a 1:30', text: 'Il timer predefinito tra le serie passa da un minuto a un minuto e mezzo.' },
];
const previousHighlights = [
  { icon: MapPin, title: 'Anche tutte le novità precedenti', text: 'Palestre per località, conto alla rovescia Scienza e salvataggio automatico delle sedute.' },
];

export default function ReleaseNotes({ onClose, previousVersion }) {
  const [expanded, setExpanded] = useState(false);
  const releases = releaseNotesFor(previousVersion);
  const visibleHighlights = releases.length > 1 ? [...highlights, ...previousHighlights] : highlights;
  return <Sheet title={tr('Novità della versione 1.6')} onClose={onClose} className="release-sheet" footer={<button type="button" className="ej-btn ej-btn--primary release-done" onClick={onClose}>{tr('Continua')}</button>}>
    <div className="release-intro"><span className="release-icon"><Sparkles size={22} /></span><div><p>ELITEJIM 1.6</p><h3>{tr('Più veloce, più chiara, su misura.')}</h3><span>{tr('Le novità pensate per schede, progressi e diario.')}</span></div></div>
    <div className="release-highlights">{visibleHighlights.map(item => <div className="release-highlight" key={item.title}><span className="release-highlight-icon"><item.icon size={19} /></span><div><h4>{tr(item.title)}</h4><p>{tr(item.text)}</p></div></div>)}</div>
    <button type="button" className="release-more" aria-expanded={expanded} aria-controls="release-full-changelog" onClick={() => setExpanded(value => !value)}>{expanded ? tr('Mostra meno') : tr('Scopri di più')}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    {expanded && <div id="release-full-changelog" className="release-full"><h3>{tr('Changelog completo')}</h3>{releases.map(release => <section key={release.version}><h3>{tr('Versione {version}', { version: release.version })}</h3>{release.changes.map(([section, items]) => <section key={section}><h4>{tr(section)}</h4><ul>{items.map(item => <li key={item}>{tr(item)}</li>)}</ul></section>)}</section>)}</div>}
  </Sheet>;
}
