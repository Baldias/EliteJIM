import { useState } from 'react';
import { Activity, BarChart3, ChevronDown, ChevronUp, Dumbbell, Sparkles, TrendingUp } from 'lucide-react';
import { Sheet } from '../pages/monitoring/Sheet';
import './ReleaseNotes.css';

export const RELEASE_NOTES_VERSION = '1.4';

const highlights = [
  { icon: TrendingUp, title: 'I tuoi progressi, subito', text: 'Apri i progressi di un esercizio direttamente durante l’allenamento.' },
  { icon: BarChart3, title: 'Serie settimanali', text: 'Esplora lo storico e la media per ogni distretto muscolare.' },
  { icon: Activity, title: 'Scienza più flessibile', text: 'Le serie contano anche senza RIR e i segnali lievi non fermano la progressione.' },
  { icon: Dumbbell, title: 'Un piano per tutto il corpo', text: 'Il volume si adatta alle tue sedute, al recupero e ai tuoi progressi.' },
];

const changes = [
  ['Allenamento', [
    'Aggiunto a ogni esercizio un pulsante con icona per aprire direttamente i suoi progressi, mantenendo attiva la sessione.',
  ]],
  ['Progressi', [
    'Corretta la digitazione nella barra di ricerca degli esercizi.',
    'Aggiunto lo storico delle serie settimanali per distretto muscolare, con media, totale e massimo settimanale.',
    'Aggiunti gli intervalli 3 mesi, 6 mesi, 1 anno, Max e Personalizzato.',
    'Corretto il calcolo della media: esclude le settimane fuori dallo storico registrato e comprende le settimane vuote tra gli allenamenti.',
    'Spostati i livelli RPG e gli XP in fondo alla pagina del distretto.',
  ]],
  ['Scienza', [
    'Le serie completate vengono conteggiate anche quando il RIR non è stato registrato.',
    'Nei percorsi con priorità muscolari, i segnali lievi di stanchezza consentono incrementi graduali; segnali marcati o ripetuti possono sospendere l’aumento.',
    'Nei percorsi per tutto il corpo, la partenza usa il MAV basso come riferimento, adattato alla disponibilità di allenamento e al limite di 20 serie per seduta.',
    'Quando il budget settimanale non basta, il volume viene ridotto prima su polpacci, addome e femorali, anche sotto MEV se necessario. Recupero e andamento dei carichi guidano gli aumenti e la distribuzione successivi.',
    'Aggiunta nel check la distinzione tra stanchezza o fastidi lievi e problemi marcati.',
    'Rimossi i banner gialli dalla dashboard Scienza.',
    'Spostati “Ultimo aggiornamento” e “Mesocicli e decisioni precedenti” sotto la card “Quante serie per seduta”.',
    'Semplificata la card delle sedute e aggiunto un pulsante ? per consultarne la spiegazione.',
  ]],
];

export default function ReleaseNotes({ onClose }) {
  const [expanded, setExpanded] = useState(false);
  return <Sheet title="Novità della versione 1.4" onClose={onClose} className="release-sheet" footer={<button type="button" className="ej-btn ej-btn--primary release-done" onClick={onClose}>Continua</button>}>
    <div className="release-intro"><span className="release-icon"><Sparkles size={22} /></span><div><p>ELITEJIM 1.4</p><h3>Allenati, osserva, migliora.</h3><span>Le novità pensate per seguire meglio i tuoi progressi.</span></div></div>
    <div className="release-highlights">{highlights.map(item => <div className="release-highlight" key={item.title}><span className="release-highlight-icon"><item.icon size={19} /></span><div><h4>{item.title}</h4><p>{item.text}</p></div></div>)}</div>
    <button type="button" className="release-more" aria-expanded={expanded} aria-controls="release-full-changelog" onClick={() => setExpanded(value => !value)}>{expanded ? 'Mostra meno' : 'Scopri di più'}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    {expanded && <div id="release-full-changelog" className="release-full"><h3>Changelog completo</h3>{changes.map(([section, items]) => <section key={section}><h4>{section}</h4><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></section>)}</div>}
  </Sheet>;
}
