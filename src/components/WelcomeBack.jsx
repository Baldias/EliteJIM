import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useWeeklyStreak } from '../hooks/useWeeklyStreak';
import { Flame, Trophy, Calendar, X, AlertTriangle } from 'lucide-react';
import './WelcomeBack.css';
import { hasLegacyScience } from '../utils/scienceV3';

export function WelcomeBack({ onClose }) {
  const { currentStreak, daysSinceLastWorkout } = useWeeklyStreak();
  const scienceReport = useStore(state => state.scienceReport);
  const science = useStore(state => state.scienceState);
  const scienceProgram = science?.program;
  const showScience = useStore(state => state.showScience);

  const [isVisible, setIsVisible] = useState(false);

  // Start the entrance transition on the next frame
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for transition
  };

  let weekInfo = null;
  if (showScience && hasLegacyScience(scienceReport, science) && scienceReport.status === 'active') {
    const weekNum = scienceReport.currentWeek || 1;
    const month = weekNum <= 4 ? 1 : (weekNum <= 8 ? 2 : 3);
    
    let phase = 'Fase di Accumulo';
    if (weekNum === 4 || weekNum === 8) phase = 'BOSS FIGHT (Max Volume)';
    if (month === 3 && (weekNum === 9 || weekNum === 10)) phase = 'Settimana di Scarico (Deload)';
    if (month === 3 && weekNum >= 11) phase = 'Mantenimento / Risensibilizzazione';

    weekInfo = { week: weekNum, month, phase };
  }

  if (showScience && !hasLegacyScience(scienceReport, science) && scienceProgram?.status === 'active') {
    const week = scienceProgram.currentWeek;
    weekInfo = { week, month: null, phase: week === 5 ? 'Recupero da concordare' : week === 4 ? 'Picco del blocco' : 'Accumulo · 0–1 RIR' };
  }

  // Same rule as calculateWeeklyStreak: the streak resets after 7 days without training
  const daysAbsent = daysSinceLastWorkout ?? 0;
  const lostStreak = daysSinceLastWorkout !== null && currentStreak === 0;

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
            <p>Sei mancato per {daysAbsent} giorni: dopo 7 giorni senza allenamento la streak si azzera. È il momento di rimettersi in riga!</p>
          </div>
        ) : (
          <div className="wb-status is-active">
            <h4><Flame size={18} fill="currentColor" /> Streak Attivo: {currentStreak} {currentStreak === 1 ? 'settimana' : 'settimane'}</h4>
            <p>Allenati almeno una volta a settimana per mantenerla attiva.</p>
          </div>
        )}

        {showScience && (
          weekInfo ? (
            <div className="wb-plan">
              <h4><Calendar size={16} /> La tua Programmazione</h4>
              <div className="wb-plan-box">
                <div className="wb-plan-row">
                  <span>Settimana Corrente:</span>
                  <strong className="is-primary">W{weekInfo.week}{weekInfo.month ? ` (Mese ${weekInfo.month})` : ' · Scienza V3'}</strong>
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
