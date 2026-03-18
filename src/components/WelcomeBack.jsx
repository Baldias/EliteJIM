import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Flame, Trophy, Calendar, X } from 'lucide-react';

export function WelcomeBack({ onClose }) {
  const userXP = useStore(state => state.userXP);
  const currentStreak = useStore(state => state.currentStreak);
  const lastWorkoutDate = useStore(state => state.lastWorkoutDate);
  const scienceReport = useStore(state => state.scienceReport);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for transition
  };

  let weekInfo = null;
  if (scienceReport) {
    const elapsedDays = (Date.now() - scienceReport.timestamp) / (1000 * 60 * 60 * 24);
    const weekNum = Math.min(Math.max(1, Math.floor(elapsedDays / 7) + 1), 12);
    let month = 1;
    if (weekNum > 4 && weekNum <= 8) month = 2;
    if (weekNum > 8) month = 3;
    
    let phase = 'Fase di Accumulo';
    if (weekNum === 4 || weekNum === 8) phase = 'BOSS FIGHT (Max Volume)';
    if (month === 3 && (weekNum === 9 || weekNum === 10)) phase = 'Settimana di Scarico (Deload)';
    if (month === 3 && weekNum >= 11) phase = 'Mantenimento';

    weekInfo = { week: weekNum, month, phase };
  }

  const daysAbsent = lastWorkoutDate ? Math.floor((Date.now() - lastWorkoutDate) / (1000 * 60 * 60 * 24)) : 0;
  const lostStreak = daysAbsent > 3;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      opacity: isVisible ? 1 : 0, transition: 'opacity 0.3s ease'
    }}>
      <div className="card glass" style={{
        width: '100%', maxWidth: '400px',
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        padding: '2rem', position: 'relative',
        border: '1px solid var(--primary-color)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <button 
          onClick={handleClose}
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
        >
          <X size={24} />
        </button>

        <h2 style={{ textAlign: 'center', color: 'var(--primary-color)', fontSize: '1.8rem', marginBottom: '1.5rem', fontWeight: '800' }}>
          Bentornato!
        </h2>

        {lostStreak ? (
          <div style={{ background: 'rgba(255,59,48,0.1)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,59,48,0.3)', marginBottom: '1.5rem', textAlign: 'center' }}>
            <h4 style={{ color: '#ff3b30', marginBottom: '0.5rem' }}>Streak Perso!</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>Sei mancato per {daysAbsent} giorni. Hai perso il tuo streak e hai subito una penalità di XP per l'inattività. È il momento di rimettersi in riga!</p>
          </div>
        ) : (
          <div style={{ background: 'rgba(52,199,89,0.1)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(52,199,89,0.3)', marginBottom: '1.5rem', textAlign: 'center' }}>
            <h4 style={{ color: '#34c759', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Flame size={20} /> Streak Attivo: {currentStreak}
            </h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>Rimani costante per non perdere il moltiplicatore extra e i progressi muscolari.</p>
          </div>
        )}

        {weekInfo ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem', color: 'var(--text-main)' }}>
              <Calendar size={18} color="var(--primary-color)" /> La tua Programmazione
            </h4>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Settimana Corrente:</span>
                <strong style={{ color: 'var(--primary-color)' }}>W{weekInfo.week} (Mese {weekInfo.month})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fase:</span>
                <strong style={{ color: 'white', fontSize: '0.95rem' }}>{weekInfo.phase}</strong>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Non hai ancora creato una programmazione nel quiz Scienza!
          </p>
        )}

        <button 
          className="btn-primary" 
          onClick={handleClose}
          style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '1rem', fontSize: '1.1rem' }}
        >
          <Trophy size={20} /> Alleniamoci!
        </button>
      </div>
    </div>
  );
}
