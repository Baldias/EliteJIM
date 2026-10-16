import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Flame, Trophy, Calendar, X, AlertTriangle } from 'lucide-react';
import './WelcomeBack.css';

export function WelcomeBack({ onClose }) {
  const currentStreak = useStore(state => state.currentStreak);
  const lastWorkoutDate = useStore(state => state.lastWorkoutDate);
  const scienceReport = useStore(state => state.scienceReport);
  const showScience = useStore(state => state.showScience);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for transition
  };

  let weekInfo = null;
  if (showScience && scienceReport && scienceReport.status === 'active') {
    const weekNum = scienceReport.currentWeek || 1;
    const month = weekNum <= 4 ? 1 : (weekNum <= 8 ? 2 : 3);
    
    let phase = 'Fase di Accumulo';
    if (weekNum === 4 || weekNum === 8) phase = 'BOSS FIGHT (Max Volume)';
    if (month === 3 && (weekNum === 9 || weekNum === 10)) phase = 'Settimana di Scarico (Deload)';
    if (month === 3 && weekNum >= 11) phase = 'Mantenimento / Risensibilizzazione';

    weekInfo = { week: weekNum, month, phase };
  }

  const daysAbsent = lastWorkoutDate ? Math.floor((Date.now() - lastWorkoutDate) / (1000 * 60 * 60 * 24)) : 0;
  const lostStreak = daysAbsent > 3;

  return (
    <div className={`wb-overlay ${isVisible ? 'is-visible' : ''}`} onClick={handleClose}>
      <div className="wb-card" onClick={e => e.stopPropagation()}>
        <button type="button" className="wb-close" onClick={handleClose} aria-label="Chiudi">
          <X size={18} />
        </button>

        <h2 className="wb-title">Bentornato!</h2>

        {lostStreak ? (
          <div className="wb-status is-lost">
            <h4><AlertTriangle size={18} /> Streak Perso!</h4>
            <p>Sei mancato per {daysAbsent} giorni. Hai perso il tuo streak e hai subito una penalità di XP per l'inattività. È il momento di rimettersi in riga!</p>
          </div>
        ) : (
          <div className="wb-status is-active">
            <h4><Flame size={18} fill="currentColor" /> Streak Attivo: {currentStreak} {currentStreak === 1 ? 'settimana' : 'settimane'}</h4>
            <p>Rimani costante per non perdere il moltiplicatore extra e i progressi muscolari.</p>
          </div>
        )}

        {showScience && (
          weekInfo ? (
            <div className="wb-plan">
              <h4><Calendar size={16} /> La tua Programmazione</h4>
              <div className="wb-plan-box">
                <div className="wb-plan-row">
                  <span>Settimana Corrente:</span>
                  <strong className="is-primary">W{weekInfo.week} (Mese {weekInfo.month})</strong>
                </div>
                <div className="wb-plan-row">
                  <span>Fase:</span>
                  <strong>{weekInfo.phase}</strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="wb-note">Non hai ancora creato una programmazione nel quiz Scienza!</p>
          )
        )}

        <button type="button" className="wb-cta" onClick={handleClose}>
          <Trophy size={18} /> Alleniamoci!
        </button>
      </div>
    </div>
  );
}
