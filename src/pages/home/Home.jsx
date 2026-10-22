import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useWeeklyStreak } from '../../hooks/useWeeklyStreak';
import { Plus, Play, Dumbbell, Zap, Bell, CheckCircle2, Trash2, Edit3, Share2, Flame } from 'lucide-react';
import { InteractiveBody } from '../../components/InteractiveBody';
import { WelcomeBack } from '../../components/WelcomeBack';
import { BackupReminderBanner } from '../../components/BackupReminderBanner';
import { ShareTemplateModal } from '../../components/ShareTemplateModal';
import { DailyRecapCard } from '../../components/DailyRecapCard';
import pkg from '../../../package.json';
import RoutineCard from './RoutineCard';
import { Sheet } from '../monitoring/Sheet';
import './Home.css';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function formatElapsed(startTime, now) {
  const diff = Math.max(0, Math.floor((now - startTime) / 1000));
  const m = String(Math.floor(diff / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function Home() {
  const navigate = useNavigate();
  const templates = useStore(state => state.templates);
  const startWorkout = useStore(state => state.startWorkout);
  const deleteTemplate = useStore(state => state.deleteTemplate);
  const activeWorkout = useStore(state => state.activeWorkout);
  const history = useStore(state => state.history);
  const lastWorkoutDate = useStore(state => state.lastWorkoutDate);
  const userXP = useStore(state => state.userXP) || 0;
  const { currentStreak } = useWeeklyStreak();

  const [showWelcome, setShowWelcome] = useState(false);
  const [sharingTemplate, setSharingTemplate] = useState(null);
  const [actionTemplate, setActionTemplate] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  const elapsed = activeWorkout ? formatElapsed(activeWorkout.startTime, now) : '00:00';

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

  const handleDelete = (template) => {
    if (window.confirm(`Sei sicuro di voler eliminare la scheda "${template.name}"?\nQuesta azione è irreversibile.`)) {
      deleteTemplate(template.id);
      setActionTemplate(null);
    }
  };

  return (
    <>
      {showWelcome && <WelcomeBack onClose={() => setShowWelcome(false)} />}

      <div className="ej-page home-page">
        <div className="ej-glow" aria-hidden="true" />

        {/* ── HEADER ─────────────────────────────────── */}
        <header className="home-header">
          <div>
            <p className="ej-eyebrow">{getGreeting()}</p>
            <h1 className="ej-title">EliteJIM</h1>
          </div>
          <div className="home-header-actions">
            <button
              type="button"
              className={`home-streak ${currentStreak > 0 ? 'is-active' : ''}`}
              onClick={() => navigate('/activity')}
              title="Visualizza attività e streak"
            >
              <Flame size={16} />
              <span>{currentStreak} sett</span>
            </button>
            {lastWorkoutDate && (
              <button type="button" className="ej-icon-btn ej-icon-btn--round" onClick={() => setShowWelcome(true)} title="Riepilogo">
                <Bell size={18} />
              </button>
            )}
          </div>
        </header>

        <BackupReminderBanner />

        {/* ── ALLENAMENTO IN CORSO ───────────────────── */}
        {activeWorkout && (
          <button type="button" className="home-active" onClick={() => navigate('/workout')}>
            <div className="home-active-info">
              <span className="home-active-live">
                <span className="home-active-dot" /> In corso · {elapsed}
              </span>
              <span className="home-active-name">{activeWorkout.name || 'Sessione Libera'}</span>
            </div>
            <span className="home-active-play">
              <Play size={20} fill="currentColor" />
            </span>
          </button>
        )}

        {/* ── RIEPILOGO GIORNALIERO (→ Diario) ──────── */}
        {!activeWorkout && <DailyRecapCard />}

        {/* ── ALLENAMENTO LIBERO ─────────────────────── */}
        <section className="home-section" aria-labelledby="home-training-title">
          <h2 className="ej-section-title" id="home-training-title">Allenati</h2>
          <button type="button" className="home-free" onClick={handleStartEmpty}>
            <Dumbbell size={20} /> Sessione Libera
          </button>
        </section>

        {/* ── SCHEDE ────────────────────────────────── */}
        <section className="home-section" aria-labelledby="home-routines-title">
          <div className="home-routines-heading">
            <div className="ej-section-header">
              <h2 className="ej-section-title" id="home-routines-title">Le tue schede</h2>
              <button type="button" className="ej-btn ej-btn--secondary home-new-btn" onClick={() => navigate('/build')}>
                <Plus size={16} className="home-new-icon" /> Nuova Scheda
              </button>
            </div>
            {templates.length > 0 && <p className="home-routine-hint" id="routine-gesture-hint">Tocca per iniziare · Tieni premuto per le opzioni</p>}
          </div>
          {templates.length > 0 && <div className="home-routines">{templates.map(template => <RoutineCard key={template.id} template={template} onStart={() => handleStartTemplate(template)} onActions={() => setActionTemplate(template)} />)}</div>}
        </section>

        {/* ── XP & SESSIONI ──────────────────────────── */}
        {userXP > 0 && (
          <div className="home-xp-row">
            <div className="ej-card home-stat home-stat--xp">
              <span className="home-stat-label"><Zap size={13} fill="currentColor" /> XP Totali</span>
              <span className="home-stat-value">{userXP.toLocaleString('it-IT')}</span>
            </div>
            <div className="ej-card home-stat">
              <span className="home-stat-label"><CheckCircle2 size={13} /> Sessioni</span>
              <span className="home-stat-value">{history.length}</span>
            </div>
          </div>
        )}

        <InteractiveBody />

        <p className="ej-footer-version">ELITEJIM v{pkg.version}</p>
      </div>

      {actionTemplate && <Sheet title="Opzioni scheda" onClose={() => setActionTemplate(null)}><div className="home-routine-menu"><p>{actionTemplate.name}</p><button type="button" onClick={() => { setSharingTemplate(actionTemplate); setActionTemplate(null); }}><Share2 size={19} /><span>Condividi scheda<small>Esporta o invia a un amico</small></span></button><button type="button" onClick={() => { setActionTemplate(null); navigate('/build', { state: { template: actionTemplate } }); }}><Edit3 size={19} /><span>Modifica scheda<small>Esercizi, serie e dettagli</small></span></button><button type="button" className="is-danger" onClick={() => handleDelete(actionTemplate)}><Trash2 size={19} /><span>Elimina scheda<small>Ti chiederemo conferma</small></span></button></div></Sheet>}

      <ShareTemplateModal
        isOpen={!!sharingTemplate}
        onClose={() => setSharingTemplate(null)}
        template={sharingTemplate}
      />
    </>
  );
}

export default Home;
