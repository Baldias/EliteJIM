import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Plus, Play, Dumbbell, ChevronRight, Zap, Bell, CheckCircle2, Trash2, Edit3 } from 'lucide-react';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { InteractiveBody } from '../components/InteractiveBody';
import { WelcomeBack } from '../components/WelcomeBack';
import { EXERCISES_DB } from '../data/exercises';
import pkg from '../../package.json';

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

  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (lastWorkoutDate) {
      const hoursSinceLast = (Date.now() - lastWorkoutDate) / (1000 * 60 * 60);
      if (hoursSinceLast > 24) setShowWelcome(true);
    }
  }, [lastWorkoutDate]);

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

  // --- Weekly Tracker ---
  const trackerData = useMemo(() => {
    if (!scienceReport) return null;
    const elapsedDays = (Date.now() - scienceReport.timestamp) / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, 7 - (elapsedDays % 7));
    const currentWeekNum = Math.min(Math.max(1, Math.floor(elapsedDays / 7) + 1), 12);
    let currentMonth = 1;
    if (currentWeekNum > 4 && currentWeekNum <= 8) currentMonth = 2;
    if (currentWeekNum > 8) currentMonth = 3;

    let targetSetsTotal = 0;
    Object.keys(scienceReport.baseLandmarks).forEach(muscle => {
      const lm = scienceReport.baseLandmarks[muscle];
      let target;
      if (currentMonth === 3 && (currentWeekNum === 9 || currentWeekNum === 10)) {
        target = Math.max(0, lm.mev - 2);
      } else {
        const isFocus = (currentMonth === 1 && scienceReport.focus1.includes(muscle)) ||
          (currentMonth === 2 && scienceReport.focus2.includes(muscle));
        if (!isFocus) {
          target = lm.mev;
        } else {
          const relativeWeek = currentWeekNum - ((currentMonth - 1) * 4);
          const gap = lm.mrv - lm.mav;
          target = Math.round(lm.mav + ((gap / 3) * (relativeWeek - 1)));
        }
      }
      targetSetsTotal += target;
    });

    const exNameToSciMuscle = {};
    EXERCISES_DB.forEach(ex => {
      exNameToSciMuscle[ex.name] = ex.category === 'Gambe' ? '__LEG__' : ex.category;
    });
    const legMuscles = ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'].filter(m => scienceReport.baseLandmarks[m]);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const donePerMuscle = {};
    history.filter(w => w.startTime >= sevenDaysAgo).forEach(workout => {
      workout.exercises.forEach(ex => {
        const sciMuscle = exNameToSciMuscle[ex.name];
        if (!sciMuscle) return;
        const doneSets = ex.sets.filter(s => s.done && !s.isDropset).length;
        if (sciMuscle === '__LEG__') {
          const rep = legMuscles[0];
          if (rep) donePerMuscle[rep] = (donePerMuscle[rep] || 0) + doneSets;
        } else if (scienceReport.baseLandmarks[sciMuscle] !== undefined) {
          donePerMuscle[sciMuscle] = (donePerMuscle[sciMuscle] || 0) + doneSets;
        }
      });
    });

    const doneSetsTotal = Object.values(donePerMuscle).reduce((a, v) => a + v, 0);
    const missingSets = Math.max(0, targetSetsTotal - doneSetsTotal);
    const percent = Math.min(100, Math.round((doneSetsTotal / targetSetsTotal) * 100)) || 0;

    return { daysLeft: Math.ceil(daysLeft), missingSets, targetSetsTotal, doneSetsTotal, percent, currentWeekNum };
  }, [scienceReport, history]);

  const done = trackerData?.missingSets === 0;

  return (
    <>
      {showWelcome && <WelcomeBack onClose={() => setShowWelcome(false)} />}

      <header className="app-header">
        <div style={{ position: 'absolute', top: 'max(1rem, env(safe-area-inset-top))', right: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
          {currentStreak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,149,0,0.15)', padding: '5px 10px', borderRadius: '20px', border: '1px solid rgba(255,149,0,0.3)' }}>
              <span style={{ fontSize: '1rem' }}>🔥</span>
              <span style={{ fontWeight: '700', color: '#ff9500', fontSize: '0.9rem' }}>{currentStreak}</span>
            </div>
          )}
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
        {/* ── ALLENAMENTO IN CORSO ─────────────────────── */}
        {activeWorkout && (
          <div onClick={() => navigate('/workout')} style={{
            background: 'linear-gradient(135deg, var(--primary-color) 0%, #00b4d8 100%)',
            borderRadius: '24px', padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.5rem',
            cursor: 'pointer', boxShadow: '0 12px 30px rgba(0, 184, 212, 0.25)',
            transition: 'transform 0.2s',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '1px', margin: 0, textTransform: 'uppercase' }}>⚡ In Corso</p>
              <p style={{ color: 'white', fontWeight: '800', fontSize: '1.2rem', margin: '4px 0 0' }}>{activeWorkout.name || 'Sessione Libera'}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={20} color="white" fill="white" />
            </div>
          </div>
        )}

        {/* ── TRACKER SETTIMANALE ──────────────────────── */}
        {trackerData && (
          <div className="glass" style={{
            borderRadius: '24px', padding: '1.5rem',
            marginBottom: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '1px', margin: 0 }}>
                  SETTIMANA {trackerData.currentWeekNum} · VOLUME
                </p>
                {done ? (
                  <p style={{ color: '#34c759', fontWeight: '800', fontSize: '1.2rem', margin: '6px 0 0' }}>✅ Settimana Completata!</p>
                ) : (
                  <p style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1.2rem', margin: '6px 0 0' }}>
                    <span style={{ color: 'var(--primary-color)', fontSize: '1.8rem' }}>{trackerData.missingSets}</span> serie mancanti
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: `conic-gradient(${done ? '#34c759' : 'var(--primary-color)'} ${trackerData.percent * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontWeight: '900', fontSize: '0.85rem', color: done ? '#34c759' : '#fff' }}>{trackerData.percent}%</span>
                  </div>
                </div>
              </div>
            </div>
            {!done && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${trackerData.percent}%`,
                    background: 'linear-gradient(90deg, var(--primary-color), #00e5ff)',
                    borderRadius: '4px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  ⏳ {trackerData.daysLeft}g
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── QUICK START ──────────────────────────────── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2 className="section-title-premium">
              <Plus size={20} color="var(--primary-color)" />
              Allenati
            </h2>
          </div>

          {/* Template cards */}
          {templates.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
              {templates.map(template => (
                <div key={template.id} className="glass" style={{
                  borderRadius: '22px', padding: '1.25rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '800', fontSize: '1.1rem', margin: 0, color: '#fff' }}>{template.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '600', margin: '4px 0 0' }}>
                      {template.exercises.length} esercizi · {template.exercises.reduce((a, ex) => a + ex.setsCount, 0)} serie
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => { if (window.confirm(`Eliminare "${template.name}"?`)) deleteTemplate(template.id); }}
                      style={{ background: 'rgba(255,59,48,0.1)', border: 'none', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3b30', transition: 'all 0.2s' }}
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={() => handleStartTemplate(template)}
                      style={{
                        background: 'linear-gradient(135deg, var(--primary-color) 0%, #0090b0 100%)',
                        border: 'none', borderRadius: '14px',
                        padding: '10px 22px', color: 'white', fontWeight: '800', fontSize: '0.95rem',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 6px 16px rgba(0, 184, 212, 0.2)'
                      }}
                    >
                      <Play size={16} fill="white" /> Vai
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New template button */}
          <button onClick={() => navigate('/build')} className="glass" style={{
            width: '100%', padding: '1.25rem',
            borderRadius: '22px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            color: 'var(--primary-color)', fontWeight: '800', fontSize: '1rem',
            marginBottom: '12px', borderStyle: 'dashed'
          }}>
            <Plus size={20} /> Crea Nuova Scheda
          </button>

          {/* Free session CTA */}
          <button onClick={handleStartEmpty} style={{
            width: '100%', padding: '1rem',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontSize: '0.9rem', fontWeight: '700', transition: 'all 0.2s'
          }}>
            <Dumbbell size={18} />
            Sessione Libera
          </button>
        </div>

        {/* ── XP INFO ──────────────────────────────────── */}
        {userXP > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '2rem' }}>
            <div className="glass" style={{
              flex: 1, borderRadius: '22px', padding: '1.25rem', textAlign: 'center'
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.5px', margin: 0, textTransform: 'uppercase' }}>XP Totali</p>
              <p style={{ color: 'var(--primary-color)', fontWeight: '900', fontSize: '1.6rem', margin: '6px 0 0' }}>{userXP.toLocaleString()}</p>
            </div>
            <div className="glass" style={{
              flex: 1, borderRadius: '22px', padding: '1.25rem', textAlign: 'center'
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.5px', margin: 0, textTransform: 'uppercase' }}>Sessioni</p>
              <p style={{ color: '#fff', fontWeight: '900', fontSize: '1.6rem', margin: '6px 0 0' }}>{history.length}</p>
            </div>
          </div>
        )}

        {/* ── INTERACTIVE BODY ── */}
        <InteractiveBody />

        {/* ── FOOTER ───────────────────────────────────── */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', marginTop: '3rem', fontWeight: '600', letterSpacing: '1px' }}>ELITEJIM v{pkg.version}</p>
      </main>
    </>
  );

}

export default Home;
