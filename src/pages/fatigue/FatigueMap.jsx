import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Model from 'react-body-highlighter';
import { ChevronLeft, BookOpen, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getAllExercises } from '../../data/exercises';
import { computeMuscleFatigue, fatigueLevel, FATIGUE_COLORS, FATIGUE_LEVELS, FATIGUE_MUSCLES } from '../../utils/muscleFatigue';
import { locale, tr } from '../../i18n';
import './FatigueMap.css';

const RECOVERED_COLOR = '#B6BDC3';

const SOURCES = [
  ['Morán-Navarro et al. 2017 · Recupero con e senza cedimento', 'https://pubmed.ncbi.nlm.nih.gov/28965198/'],
  ['Belcher et al. 2019 · Recupero di squat, panca e stacco', 'https://doi.org/10.1139/apnm-2019-0004'],
  ['Schoenfeld et al. 2016 · Frequenza di allenamento', 'https://pubmed.ncbi.nlm.nih.gov/27102172/'],
  ['Pelland et al. 2026 · Volume e frequenza settimanali', 'https://sportrxiv.org/index.php/server/preprint/view/537'],
];

const formatReady = hours => {
  if (hours <= 0) return tr('Recuperato');
  if (hours < 24) return tr('Pronto tra ~{n} h', { n: hours });
  return tr('Pronto tra ~{n} g', { n: Math.round(hours / 24 * 2) / 2 });
};

const formatLast = at => new Date(at).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });

export default function FatigueMap() {
  const navigate = useNavigate();
  const history = useStore(state => state.history || []);
  const customExercises = useStore(state => state.customExercises);
  const exerciseOverrides = useStore(state => state.exerciseOverrides);
  const allExercises = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);
  const [selected, setSelected] = useState(null);
  const [showMethod, setShowMethod] = useState(false);

  const { visible, tired, modelData } = useMemo(() => {
    const visible = computeMuscleFatigue(history, allExercises).filter(m => FATIGUE_MUSCLES[m.muscle]);
    const tired = visible.filter(m => fatigueLevel(m.fatigue) > 0);
    // The library colours a muscle with highlightedColors[frequency - 1].
    const modelData = tired.map(m => ({ name: m.muscle, muscles: [m.muscle], frequency: fatigueLevel(m.fatigue) }));
    return { visible, tired, modelData };
  }, [history, allExercises]);

  const handleMuscle = ({ muscle }) => {
    const key = muscle === 'left-soleus' || muscle === 'right-soleus' ? 'calves' : muscle;
    if (FATIGUE_MUSCLES[key]) setSelected(key);
  };

  const detail = selected && (visible.find(m => m.muscle === selected) || { muscle: selected, fatigue: 0, sets: 0, readyInHours: 0 });

  return (
    <div className="ej-page fm-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="fm-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round fm-back" onClick={() => navigate(-1)} aria-label={tr('Torna indietro')}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="fm-title">{tr('Mappa della fatica')}</h1>
          <p className="fm-sub">{tr('Fatica residua stimata per muscolo, adesso')}</p>
        </div>
      </header>

      <section className="ej-card fm-map">
        <div className="fm-views">
          <figure className="fm-view">
            <Model data={modelData} type="anterior" bodyColor={RECOVERED_COLOR} highlightedColors={FATIGUE_COLORS} onClick={handleMuscle} />
            <figcaption>{tr('Vista Frontale')}</figcaption>
          </figure>
          <figure className="fm-view">
            <Model data={modelData} type="posterior" bodyColor={RECOVERED_COLOR} highlightedColors={FATIGUE_COLORS} onClick={handleMuscle} />
            <figcaption>{tr('Vista Posteriore')}</figcaption>
          </figure>
        </div>

        <div className="fm-legend" aria-label={tr('Legenda')}>
          <span className="fm-legend-item"><span className="fm-swatch" style={{ background: RECOVERED_COLOR }} />{tr('Recuperato')}</span>
          {FATIGUE_LEVELS.map((label, i) => (
            <span key={label} className="fm-legend-item"><span className="fm-swatch" style={{ background: FATIGUE_COLORS[i] }} />{tr(label)}</span>
          ))}
        </div>

        {detail ? (
          <div className="fm-detail" role="status">
            <div>
              <strong>{tr(FATIGUE_MUSCLES[detail.muscle])}</strong>
              <span>{detail.sets ? tr('{n} serie negli ultimi 4 giorni', { n: detail.sets.toLocaleString(locale()) }) : tr('Nessuna serie negli ultimi 4 giorni')}</span>
            </div>
            <div className="fm-detail-value">
              <strong>{Math.round(detail.fatigue * 100)}%</strong>
              <span>{formatReady(detail.readyInHours)}</span>
            </div>
          </div>
        ) : (
          <p className="fm-hint">{tr('Tocca un muscolo per i dettagli')}</p>
        )}
      </section>

      <section className="ej-card fm-list">
        <h2>{tr('Muscoli ancora affaticati')}</h2>
        {tired.length === 0 ? (
          <p className="fm-empty">{tr('Tutti i muscoli risultano recuperati. Buon allenamento!')}</p>
        ) : tired.map(m => {
          const level = fatigueLevel(m.fatigue);
          return (
            <button type="button" key={m.muscle} className={`fm-row ${selected === m.muscle ? 'is-selected' : ''}`} onClick={() => setSelected(m.muscle)}>
              <span className="fm-row-name">
                <strong>{tr(FATIGUE_MUSCLES[m.muscle])}</strong>
                <small>{tr('Ultima seduta: {date}', { date: formatLast(m.lastAt) })}</small>
              </span>
              <span className="fm-row-bar" aria-hidden="true"><span style={{ width: `${Math.round(m.fatigue * 100)}%`, background: FATIGUE_COLORS[level - 1] }} /></span>
              <span className="fm-row-value">
                <strong>{Math.round(m.fatigue * 100)}%</strong>
                <small>{formatReady(m.readyInHours)}</small>
              </span>
            </button>
          );
        })}
      </section>

      <section className="ej-card fm-method">
        <button type="button" className="fm-method-toggle" onClick={() => setShowMethod(v => !v)} aria-expanded={showMethod}>
          <BookOpen size={18} />
          <span>{tr('Come la calcoliamo')}</span>
        </button>
        {showMethod && (
          <div className="fm-method-body">
            <p>{tr('Ogni serie completata conta come vicina al cedimento, perché è il protocollo dell’app; le serie di riscaldamento non contano. Un muscolo prende una serie intera quando è il bersaglio dell’esercizio e mezza quando aiuta (per esempio i tricipiti nella panca).')}</p>
            <p>{tr('Più serie fai in una seduta, più la fatica parte alta (6 serie dirette la portano al massimo) e più dura: da 24 a 72 ore, il 20% in più per i grandi muscoli delle gambe e i lombari. Poi cala in modo graduale, e le sedute vicine si sommano.')}</p>
            <p>{tr('Gli studi sugli atleti allenati mostrano che arrivare al cedimento allunga il recupero di 24-48 ore e che dopo uno squat pesante la velocità può restare più bassa fino a 72 ore. È anche il motivo per cui allenare un muscolo due volte a settimana funziona bene.')}</p>
            <p className="fm-method-note">{tr('È una stima per orientarti, non una misura: sonno, alimentazione, esperienza e il tipo di esercizio cambiano molto il recupero. Se un muscolo ti sembra pronto prima, fidati delle sensazioni e delle prestazioni.')}</p>
            {SOURCES.map(([label, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">{tr(label)} <ArrowRight size={14} /></a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
