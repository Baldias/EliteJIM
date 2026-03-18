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

      {/* ── HEADER ──────────────────────────────────────── */}
      <header style={{
        padding: '1.5rem 1.25rem 0.75rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2px' }}>{getGreeting()}</p>
          <h1 style={{ fontSize: '1.9rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>EliteJIM</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
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
      </header>

      <main style={{ padding: '0 1.25rem 120px' }}>

        {/* ── ALLENAMENTO IN CORSO ─────────────────────── */}
        {activeWorkout && (
          <div onClick={() => navigate('/workout')} style={{
            background: 'linear-gradient(135deg, var(--primary-color) 0%, #00b4d8 100%)',
            borderRadius: '20px', padding: '1.1rem 1.4rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1.5rem', marginTop: '0.5rem',
            cursor: 'pointer', boxShadow: '0 8px 30px rgba(0, 184, 212, 0.3)',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '1px', margin: 0 }}>⚡ IN CORSO</p>
              <p style={{ color: 'white', fontWeight: '800', fontSize: '1.1rem', margin: '2px 0 0' }}>{activeWorkout.name || 'Sessione Libera'}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={20} color="white" fill="white" />
            </div>
          </div>
        )}

        {/* ── TRACKER SETTIMANALE ──────────────────────── */}
        {trackerData && (
          <div style={{
            background: done ? 'rgba(52,199,89,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${done ? 'rgba(52,199,89,0.35)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '20px', padding: '1.2rem 1.4rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.8px', margin: 0 }}>
                  SETTIMANA {trackerData.currentWeekNum} · VOLUME
                </p>
                {done ? (
                  <p style={{ color: '#34c759', fontWeight: '800', fontSize: '1.15rem', margin: '4px 0 0' }}>✅ Settimana Completata!</p>
                ) : (
                  <p style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1.15rem', margin: '4px 0 0' }}>
                    <span style={{ color: 'var(--primary-color)', fontSize: '1.6rem' }}>{trackerData.missingSets}</span> serie mancanti
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: `conic-gradient(${done ? '#34c759' : 'var(--primary-color)'} ${trackerData.percent * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.8rem', color: done ? '#34c759' : 'var(--text-main)' }}>{trackerData.percent}%</span>
                  </div>
                </div>
              </div>
            </div>
            {!done && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${trackerData.percent}%`,
                    background: 'linear-gradient(90deg, var(--primary-color), #00e5ff)',
                    borderRadius: '3px', transition: 'width 1s ease'
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ⏳ {trackerData.daysLeft}g rimasti
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── QUICK START ──────────────────────────────── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '0.78rem', fontWeight: '800', margin: '0 0 1rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>
            ALLENATI ORA
          </h2>

          {/* Template cards */}
          {templates.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
              {templates.map(template => (
                <div key={template.id} style={{
                  background: 'linear-gradient(135deg, rgba(0,60,80,0.5) 0%, rgba(0,40,60,0.5) 100%)',
                  border: '1px solid rgba(0,184,212,0.2)',
                  borderRadius: '18px', padding: '1rem 1.2rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', fontSize: '1rem', margin: 0 }}>{template.name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', margin: '3px 0 0' }}>
                      {template.exercises.length} esercizi · {template.exercises.reduce((a, ex) => a + ex.setsCount, 0)} serie
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => { if (window.confirm(`Eliminare "${template.name}"?`)) deleteTemplate(template.id); }}
                      style={{ background: 'rgba(255,59,48,0.12)', border: 'none', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3b30' }}
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => handleStartTemplate(template)}
                      style={{
                        background: 'linear-gradient(135deg, var(--primary-color) 0%, #0090b0 100%)',
                        border: 'none', borderRadius: '12px',
                        padding: '9px 20px', color: 'white', fontWeight: '800', fontSize: '0.9rem',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        boxShadow: '0 4px 14px rgba(0,184,212,0.3)'
                      }}
                    >
                      <Play size={14} fill="white" /> Inizia
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New template button — full-width block */}
          <button onClick={() => navigate('/build')} style={{
            width: '100%', padding: '1rem 1.2rem',
            background: 'rgba(0,184,212,0.07)',
            border: '1px solid rgba(0,184,212,0.2)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            color: 'var(--primary-color)', fontWeight: '700', fontSize: '0.95rem',
            marginBottom: '10px'
          }}>
            <Plus size={18} /> Crea nuova scheda
          </button>

          {/* Free session CTA */}
          <button onClick={handleStartEmpty} style={{
            width: '100%', padding: '0.9rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '16px', color: 'rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontSize: '0.88rem', fontWeight: '600'
          }}>
            <Dumbbell size={16} />
            Sessione libera senza scheda
          </button>
        </div>

        {/* ── XP INFO ──────────────────────────────────── */}
        {userXP > 0 && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{
              flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '16px', padding: '1rem', textAlign: 'center'
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>XP TOTALI</p>
              <p style={{ color: 'var(--primary-color)', fontWeight: '800', fontSize: '1.4rem', margin: '4px 0 0' }}>{userXP.toLocaleString()}</p>
            </div>
            <div style={{
              flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '16px', padding: '1rem', textAlign: 'center'
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>ALLENAMENTI</p>
              <p style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1.4rem', margin: '4px 0 0' }}>{history.length}</p>
            </div>
          </div>
        )}

        {/* ── INTERACTIVE BODY ── */}
        <InteractiveBody />

        {/* ── FOOTER ───────────────────────────────────── */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginTop: '2rem' }}>v{pkg.version}</p>
      </main>
    </>
  );
}

export default Home;
