import React from 'react';
import { useStore } from '../store/useStore';
import { Zap, ChevronLeft, Info } from 'lucide-react';
import { EXERCISE_CATEGORIES } from '../data/exercises';
import { getMuscleLevelByXp } from '../utils/gamification';
import { useNavigate } from 'react-router-dom';

function MuscleLevels() {
  const navigate = useNavigate();
  const muscleXP = useStore(state => state.muscleXP) || {};

  return (
    <>
      {/* ── HEADER with back ─────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg-color)', borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <button onClick={() => navigate('/profile')} style={{
          background: 'rgba(255,255,255,0.07)', border: 'none',
          borderRadius: '10px', padding: '8px 10px',
          color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', flexShrink: 0
        }}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <p style={{ margin: 0, fontWeight: '800', fontSize: '1.05rem', color: 'white' }}>Livelli Muscolari</p>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Progressione RPG</p>
        </div>
      </div>

      <main className="app-main" style={{ paddingBottom: '100px' }}>
        
        <div style={{ padding: '1.2rem', background: 'rgba(255,204,0,0.1)', borderRadius: '16px', border: '1px solid rgba(255,204,0,0.3)', marginBottom: '2rem' }}>
          <h3 style={{ color: '#ffcc00', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem', fontSize: '1.1rem' }}>
            <Info size={20} />
            Come salire di Livello?
          </h3>
          <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            I Livelli Muscolari si basano esclusivamente sul <strong>Volume Totale</strong> e sul <strong>Sovraccarico Progressivo</strong>. 
            <br/><br/>
            Completare serie normali fornisce una quantità minima di XP base. Ma se batti il tuo record di volume precedente su un esercizio (es. passando da 1000kg a 1200kg totali sollevati), riceverai una <strong>quantità enorme di XP</strong> proporzionata al tonnellaggio spostato!
          </p>
        </div>

        <div className="card glass" style={{ padding: '1.5rem', borderRadius: '24px' }}>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {Object.values(EXERCISE_CATEGORIES)
              .map(muscle => {
                const xp = muscleXP[muscle] || 0;
                return { muscle, xp };
              })
              .sort((a, b) => b.xp - a.xp)
              .map(({ muscle, xp }) => {
              const levelData = getMuscleLevelByXp(xp);
              
              return (
                <div key={muscle} style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '1rem', 
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {muscle} 
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{xp} XP</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffcc00' }}>Lv. {levelData.level}</span>
                    </div>
                  </div>
                  
                  <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${levelData.progressPercent}%`, 
                      background: 'linear-gradient(90deg, var(--primary-color) 0%, #ffcc00 100%)', 
                      borderRadius: '4px',
                      transition: 'width 1s ease-out'
                    }}></div>
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    Mancano {levelData.xpNeededForNext - levelData.xpInCurrentLevel} XP al prossimo
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </>
  );
}

export default MuscleLevels;
