import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Plus, Play, Dumbbell, ChevronRight, Zap, Bell, CheckCircle2, Trash2, Edit3, Share2 } from 'lucide-react';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { InteractiveBody } from '../../components/InteractiveBody';
import { WelcomeBack } from '../../components/WelcomeBack';
import { BackupReminderBanner } from '../../components/BackupReminderBanner';
import { ShareTemplateModal } from '../../components/ShareTemplateModal';
import { EXERCISES_DB } from '../../data/exercises';
import pkg from '../../../package.json';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '☀️ Buongiorno';
  if (h < 18) return '🏋️ Buon pomeriggio';
  return '🌙 Buonasera';
}

function Home() {
  const navigate = useNavigate();
  const templates = useStore(state => state.templates);
  const startWorkout = useStore(state => state.startWorkout);
  const deleteTemplate = useStore(state => state.deleteTemplate);
  const activeWorkout = useStore(state => state.activeWorkout);
  const history = useStore(state => state.history);
  const scienceReport = useStore(state => state.scienceReport);
  const lastWorkoutDate = useStore(state => state.lastWorkoutDate);
  const userXP = useStore(state => state.userXP) || 0;
  const currentStreak = useStore(state => state.currentStreak) || 0;
  const showScience = useStore(state => state.showScience);

  const [showWelcome, setShowWelcome] = useState(false);
  const [sharingTemplate, setSharingTemplate] = useState(null);


  const handleStartTemplate = (template) => {
    if (activeWorkout && !window.confirm("Hai un allenamento in corso. Vuoi abbandonarlo?")) return;
    startWorkout(template);
    navigate('/workout');
  };

  const handleStartEmpty = () => {
    if (activeWorkout && !window.confirm("Hai un allenamento in corso. Vuoi abbandonarlo?")) return;
    startWorkout(null);
    navigate('/workout');
  };

  // --- Weekly Tracker Decommissioned ---

  return (
    <>
      {showWelcome && <WelcomeBack onClose={() => setShowWelcome(false)} />}

      <header className="app-header">
        <div style={{ position: 'absolute', top: 'max(1rem, env(safe-area-inset-top))', right: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
          <button
            type="button"
            onClick={() => navigate('/activity')}
            title="Visualizza attività e streak"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: currentStreak > 0 ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              padding: '6px 12px',
              borderRadius: '20px',
              border: currentStreak > 0 ? '1px solid rgba(255, 149, 0, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              boxShadow: currentStreak > 0 ? '0 0 12px rgba(255, 149, 0, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>🔥</span>
            <span style={{ fontWeight: '800', color: currentStreak > 0 ? '#ff9500' : 'rgba(255, 255, 255, 0.6)', fontSize: '0.86rem' }}>
              {currentStreak} {currentStreak === 1 ? 'sett' : 'sett'}
            </span>
          </button>
          {lastWorkoutDate && (
            <button onClick={() => setShowWelcome(true)} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%', width: '38px', height: '38px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'
            }}>
              <Bell size={18} />
            </button>
          )}
        </div>
        <div className="header-content">
          <h1>EliteJIM</h1>
          <p className="subtitle">{getGreeting()}</p>
        </div>
      </header>

      <main className="app-main" style={{ paddingBottom: '140px' }}>
        {/* ── BACKUP REMINDER BANNER ───────────────────── */}
        <BackupReminderBanner />

        {/* ── ALLENAMENTO IN CORSO ─────────────────────── */}
        {activeWorkout && (
          <div onClick={() => navigate('/workout')} style={{
            background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.9) 0%, rgba(var(--primary-color-rgb), 0.6) 100%)',
            borderRadius: '24px', padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1rem',
            cursor: 'pointer', boxShadow: '0 12px 30px rgba(var(--primary-color-rgb), 0.25)',
            transition: 'transform 0.2s',
            animation: 'pulse 2s ease-in-out infinite',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '1px', margin: 0, textTransform: 'uppercase' }}>⚡ In Corso</p>
              <p style={{ color: 'white', fontWeight: '800', fontSize: '1.3rem', margin: '4px 0 0' }}>{activeWorkout.name || 'Sessione Libera'}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
              <Play size={22} color="white" fill="white" />
            </div>
          </div>
        )}

        {/* ── TRACKER SETTIMANALE DECOMMISSIONED ── */}

        {/* ── QUICK START ──────────────────────────────── */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-header" style={{ marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title-premium" style={{ margin: 0, fontSize: '1.4rem' }}>
              Allenati
            </h2>
            <button
              onClick={() => navigate('/build')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255,255,255,0.05)', padding: '8px 14px',
                borderRadius: '16px', color: 'var(--text-main)',
                fontSize: '0.85rem', fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s ease-out'
              }}
            >
              <Plus size={16} color="var(--primary-color)" /> Nuova Scheda
            </button>
          </div>

          {/* Free session CTA */}
          <button onClick={handleStartEmpty} className="glass" style={{
            width: '100%', padding: '1.25rem',
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px dashed rgba(0, 195, 255, 0.22)',
            borderRadius: '24px', color: '#00c8ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            fontSize: '1rem', fontWeight: '800', transition: 'all 0.2s',
            marginBottom: templates.length > 0 ? '16px' : '0'
          }}>
            <Dumbbell size={20} />
            Sessione Libera
          </button>

          {/* Template cards */}
          {templates.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {templates.map(template => (
                <div
                  key={template.id}
                  className="glass"
                  style={{
                    borderRadius: '22px',
                    padding: '1.15rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  {/* Nome scheda in alto */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <h3 style={{
                      fontWeight: '800',
                      fontSize: '1.2rem',
                      margin: 0,
                      color: '#ffffff',
                      letterSpacing: '-0.3px',
                      lineHeight: 1.25
                    }}>
                      {template.name}
                    </h3>
                  </div>

                  {/* Sotto: Meta a sinistra e pulsanti a destra */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <span style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.84rem',
                      fontWeight: '500'
                    }}>
                      {template.exercises.length} esercizi · {template.exercises.reduce((a, ex) => a + ex.setsCount, 0)} serie
                    </span>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Sei sicuro di voler eliminare la scheda "${template.name}"?\nQuesta azione è irreversibile.`)) {
                            deleteTemplate(template.id);
                          }
                        }}
                        style={{
                          background: 'rgba(255, 59, 48, 0.1)',
                          border: '1px solid rgba(255, 59, 48, 0.25)',
                          borderRadius: '10px',
                          width: '34px',
                          height: '34px',
                          color: '#ff3b30',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s',
                          flexShrink: 0
                        }}
                        title="Elimina scheda"
                      >
                        <Trash2 size={15} />
                      </button>

                      <button
                        title="Condividi ed esporta scheda"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSharingTemplate(template);
                        }}
                        style={{
                          background: 'rgba(0, 229, 255, 0.08)',
                          border: '1px solid rgba(0, 229, 255, 0.22)',
                          borderRadius: '10px',
                          width: '34px',
                          height: '34px',
                          color: '#00e5ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s',
                          flexShrink: 0
                        }}
                      >
                        <Share2 size={15} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/build', { state: { template } });
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          width: '34px',
                          height: '34px',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s',
                          flexShrink: 0
                        }}
                        title="Modifica scheda"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        onClick={() => handleStartTemplate(template)}
                        style={{
                          background: 'linear-gradient(135deg, #007EA7 0%, #00b4d8 100%)',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '0 16px',
                          height: '40px',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '800',
                          fontSize: '0.9rem',
                          boxShadow: '0 4px 14px rgba(0, 180, 216, 0.35)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          flexShrink: 0
                        }}
                        title="Inizia allenamento"
                      >
                        <Play size={16} fill="white" />
                        <span>Inizia</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── XP INFO ──────────────────────────────────── */}
        {userXP > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '2.5rem' }}>
            <div className="glass" style={{
              flex: 1, borderRadius: '24px', padding: '1.25rem', textAlign: 'center',
              border: '1px solid rgba(255, 204, 0, 0.15)', background: 'linear-gradient(180deg, rgba(255,204,0,0.05) 0%, rgba(0,0,0,0) 100%)'
            }}>
              <p style={{ color: 'rgba(255, 204, 0, 0.8)', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px', margin: '0 0 6px 0', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Zap size={14} fill="currentColor" /> XP Totali
              </p>
              <p style={{ color: '#ffcc00', fontWeight: '900', fontSize: '1.8rem', margin: 0, textShadow: '0 2px 10px rgba(255,204,0,0.2)' }}>{userXP.toLocaleString()}</p>
            </div>
            <div className="glass" style={{
              flex: 1, borderRadius: '24px', padding: '1.25rem', textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px', margin: '0 0 6px 0', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Sessioni
              </p>
              <p style={{ color: '#fff', fontWeight: '900', fontSize: '1.8rem', margin: 0 }}>{history.length}</p>
            </div>
          </div>
        )}

        {/* ── INTERACTIVE BODY ── */}
        <InteractiveBody />

        {/* ── FOOTER ───────────────────────────────────── */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', marginTop: '3rem', fontWeight: '600', letterSpacing: '1px' }}>ELITEJIM v{pkg.version}</p>
      </main>

      {/* Share Template Modal */}
      <ShareTemplateModal 
        isOpen={!!sharingTemplate} 
        onClose={() => setSharingTemplate(null)} 
        template={sharingTemplate} 
      />
    </>
  );

}

export default Home;
