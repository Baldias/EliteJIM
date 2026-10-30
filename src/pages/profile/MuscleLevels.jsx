import React from 'react';
import { useStore } from '../../store/useStore';
import { ChevronLeft, Info } from 'lucide-react';
import { EXERCISE_CATEGORIES } from '../../data/exercises';
import { getMuscleLevelByXp } from '../../utils/gamification';
import { useNavigate } from 'react-router-dom';
import './MuscleLevels.css';
import { locale, tr } from '../../i18n';

function MuscleLevels() {
  const navigate = useNavigate();
  const muscleXP = useStore(state => state.muscleXP) || {};

  const muscles = Object.values(EXERCISE_CATEGORIES)
    .map(muscle => ({ muscle, xp: muscleXP[muscle] || 0 }))
    .sort((a, b) => b.xp - a.xp);

  return (
    <div className="ej-page ml-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="ml-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round ml-back" onClick={() => navigate('/profile')} title={tr('Torna al Profilo')}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="ml-title">{tr('Livelli Muscolari')}</h1>
          <p className="ml-subtitle">{tr('Progressione RPG')}</p>
        </div>
      </header>

      <section className="ej-card ml-info">
        <h3 className="ml-info-title"><Info size={18} /> {tr('Come si sale di livello')}</h3>
        <p>
          {tr('I livelli premiano il')} <strong>{tr('Sovraccarico Progressivo')}</strong>. {tr('Ogni serie completata vale pochi XP base, ma quando su un esercizio superi la sessione precedente (1RM stimato o serie migliore, non il numero di serie) ogni sua serie vale molto di più, in proporzione al carico sollevato.')}
        </p>
      </section>

      <div className="ml-list">
        {muscles.map(({ muscle, xp }, i) => {
          const levelData = getMuscleLevelByXp(xp);
          const toNext = levelData.xpNeededForNext - levelData.xpInCurrentLevel;
          return (
            <div key={muscle} className={`ej-card ml-item ${i === 0 && xp > 0 ? 'is-top' : ''}`}>
              <div className="ml-item-head">
                <span className="ml-level">
                  <small>LV</small>
                  {levelData.level}
                </span>
                <div className="ml-item-text">
                  <span className="ml-name">{tr(muscle)}</span>
                  <span className="ml-xp">{xp.toLocaleString(locale())} XP</span>
                </div>
                <div className="ml-next">
                  <strong>{Math.round(levelData.progressPercent)}%</strong>
                  <span>→ Lv. {levelData.level + 1}</span>
                </div>
              </div>
              <div className="ej-track"><span style={{ width: `${levelData.progressPercent}%` }} /></div>
              <span className="ml-remaining">{tr('Mancano {xp} XP al prossimo livello', { xp: toNext.toLocaleString(locale()) })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MuscleLevels;
