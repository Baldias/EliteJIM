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
  const showScience = useStore(state => state.showScience);

  const [showWelcome, setShowWelcome] = useState(false);


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

        {/* ── TRACKER SETTIMANALE ──────────────────────── */}
        {showScience && trackerData && (
          <div className="glass" style={{
            borderRadius: '24px', padding: '1.5rem',
            marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '1px', margin: 0 }}>
                  SETTIMANA {trackerData.currentWeekNum} · VOLUME
                </p>
                {done ? (
                  <p style={{ color: '#34c759', fontWeight: '800', fontSize: '1.3rem', margin: '6px 0 0' }}>✅ Target Raggiunto!</p>
                ) : (
                  <p style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1.2rem', margin: '6px 0 0' }}>
                    <span style={{ color: 'var(--primary-color)', fontSize: '1.8rem' }}>{trackerData.missingSets}</span> serie mancanti
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: `conic-gradient(${done ? '#34c759' : 'var(--primary-color)'} ${trackerData.percent * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontWeight: '900', fontSize: '0.9rem', color: done ? '#34c759' : '#fff' }}>{trackerData.percent}%</span>
                  </div>
                </div>
              </div>
            </div>
            {!done && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${trackerData.percent}%`,
                    background: 'var(--primary-color)',
                    borderRadius: '4px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                  ⏳ {trackerData.daysLeft}g
                </span>
              </div>
            )}
          </div>
        )}

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
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '24px', color: 'var(--primary-color)',
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
                <div key={template.id} className="glass" style={{
                  borderRadius: '24px', padding: '1.25rem 1.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div style={{ flex: 1, paddingRight: '1rem' }}>
                    <p style={{ fontWeight: '800', fontSize: '1.15rem', margin: 0, color: '#fff', letterSpacing: '-0.3px' }}>{template.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500', margin: '4px 0 0' }}>
                      {template.exercises.length} esercizi · {template.exercises.reduce((a, ex) => a + ex.setsCount, 0)} serie
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => { if (window.confirm(`Eliminare "${template.name}"?`)) deleteTemplate(template.id); }}
                      style={{ background: 'rgba(255,59,48,0.08)', border: 'none', borderRadius: '14px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3b30', transition: 'all 0.2s' }}
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => handleStartTemplate(template)}
                      style={{
                        background: 'rgba(0, 126, 167, 0.85)',
                        border: '1px solid rgba(0, 126, 167, 0.5)', borderRadius: '14px',
                        padding: '10px 24px', color: 'white', fontWeight: '800', fontSize: '0.95rem',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 4px 12px rgba(0, 126, 167, 0.25)',
                        transition: 'transform 0.2s ease-out'
                      }}
                    >
                      <Play size={16} fill="white" /> Vai
                    </button>
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
    </>
  );

}

export default Home;
