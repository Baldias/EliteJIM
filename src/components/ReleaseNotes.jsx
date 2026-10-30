import { useState } from 'react';
import { Activity, BarChart3, ChevronDown, ChevronUp, Timer, MapPin, Sparkles } from 'lucide-react';
import { releaseNotesFor } from '../utils/releaseNotes';
import { Sheet } from '../pages/monitoring/Sheet';
import './ReleaseNotes.css';
import { tr } from '../i18n';

const highlights = [
  { icon: MapPin, title: 'Ogni palestra, i suoi carichi', text: 'Filtra i macchinari per comune e scegli se adattare carichi e PR alla palestra.' },
  { icon: Timer, title: 'La settimana, a colpo d’occhio', text: 'Conto alla rovescia, anello delle serie mancanti e promemoria meno insistenti.' },
  { icon: Activity, title: 'Sedute salvate automaticamente', text: 'Dopo un’ora di inattività salviamo l’allenamento con l’orario dell’ultima modifica.' },
];
const previousHighlights = [
  { icon: BarChart3, title: 'Anche tutte le novità della 1.4', text: 'Storico delle serie settimanali, accesso rapido ai progressi e Scienza più flessibile.' },
];

export default function ReleaseNotes({ onClose, previousVersion }) {
  const [expanded, setExpanded] = useState(false);
  const releases = releaseNotesFor(previousVersion);
  const visibleHighlights = releases.length > 1 ? [...highlights, ...previousHighlights] : highlights;
  return <Sheet title={tr('Novità della versione 1.5')} onClose={onClose} className="release-sheet" footer={<button type="button" className="ej-btn ej-btn--primary release-done" onClick={onClose}>{tr('Continua')}</button>}>
    <div className="release-intro"><span className="release-icon"><Sparkles size={22} /></span><div><p>ELITEJIM 1.5</p><h3>{tr('Allenati, osserva, migliora.')}</h3><span>{tr('Le novità pensate per seguire meglio i tuoi progressi.')}</span></div></div>
    <div className="release-highlights">{visibleHighlights.map(item => <div className="release-highlight" key={item.title}><span className="release-highlight-icon"><item.icon size={19} /></span><div><h4>{tr(item.title)}</h4><p>{tr(item.text)}</p></div></div>)}</div>
    <button type="button" className="release-more" aria-expanded={expanded} aria-controls="release-full-changelog" onClick={() => setExpanded(value => !value)}>{expanded ? tr('Mostra meno') : tr('Scopri di più')}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    {expanded && <div id="release-full-changelog" className="release-full"><h3>{tr('Changelog completo')}</h3>{releases.map(release => <section key={release.version}><h3>{tr('Versione {version}', { version: release.version })}</h3>{release.changes.map(([section, items]) => <section key={section}><h4>{tr(section)}</h4><ul>{items.map(item => <li key={item}>{tr(item)}</li>)}</ul></section>)}</section>)}</div>}
  </Sheet>;
}
