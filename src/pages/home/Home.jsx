import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useWeeklyStreak } from '../../hooks/useWeeklyStreak';
import { Plus, Play, Dumbbell, Bell, CheckCircle2, Trash2, Edit3, Share2, Flame, Sparkles, FileJson, PenLine, Layers, Archive, RotateCcw, ChevronUp, Check, Dna } from 'lucide-react';
import { InteractiveBody } from '../../components/InteractiveBody';
import { WelcomeBack } from '../../components/WelcomeBack';
import { BackupReminderBanner } from '../../components/BackupReminderBanner';
import { ShareTemplateModal } from '../../components/ShareTemplateModal';
import { AiTemplateModal } from '../../components/AiTemplateModal';
import { SplitBuilderModal } from '../../components/SplitBuilderModal';
import { WorkoutDetailSheet } from '../../components/WorkoutDetailSheet';
import { DailyRecapCard } from '../../components/DailyRecapCard';
import pkg from '../../../package.json';
import RoutineCard from './RoutineCard';
import eliteJimLogo from '../../assets/elitejim-logo-script.png?inline';
import { Sheet } from '../monitoring/Sheet';
import { themePreferences } from '../../utils/theme';
import { findCompletedWorkoutThisWeek, resolveDynamicTemplate } from '../../utils/splits';
import './Home.css';
import { locale, tr } from '../../i18n';

const ARCHIVE_PULL_THRESHOLD = 64;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return tr('Buongiorno');
  if (h < 18) return tr('Buon pomeriggio');
  return tr('Buonasera');
}

function formatElapsed(startTime, now) {
  const diff = Math.max(0, Math.floor((now - startTime) / 1000));
  const m = String(Math.floor(diff / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function Home() {
  const navigate = useNavigate();
  const templates = useStore(state => state.templates || []);
  const archivedTemplates = useStore(state => state.archivedTemplates || []);
  const startWorkout = useStore(state => state.startWorkout);
  const deleteTemplate = useStore(state => state.deleteTemplate);
  const restoreArchivedTemplate = useStore(state => state.restoreArchivedTemplate);
  const deleteArchivedTemplate = useStore(state => state.deleteArchivedTemplate);
  const activeWorkout = useStore(state => state.activeWorkout);
  const showDiary = useStore(state => state.showDiary);
  const history = useStore(state => state.history);
  const customExercises = useStore(state => state.customExercises);
  const exerciseOverrides = useStore(state => state.exerciseOverrides);
  const scienceState = useStore(state => state.scienceState);
  const scienceReport = useStore(state => state.scienceReport);
  const lastWorkoutDate = useStore(state => state.lastWorkoutDate);
  const isOgTheme = useStore(state => themePreferences(state).theme === 'og');
  const { currentStreak } = useWeeklyStreak();

  const [showWelcome, setShowWelcome] = useState(false);
  const [sharingTemplate, setSharingTemplate] = useState(null);
  const [actionTemplate, setActionTemplate] = useState(null);
  const [completedPreview, setCompletedPreview] = useState(null);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [splitBuilderOpen, setSplitBuilderOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pullPx, setPullPx] = useState(0);
  const [aiTab, setAiTab] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const archiveRef = useRef(null);
  const pullPxRef = useRef(0);
  const touchAnchorYRef = useRef(null);
  const wheelDeltaRef = useRef(0);
  const wheelTimerRef = useRef(null);

  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  // WhatsApp-style overscroll in fondo alla pagina per svelare l'archivio schede
  useEffect(() => {
    if (archivedTemplates.length === 0 || archiveOpen) {
      pullPxRef.current = 0;
      return;
    }
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
    const updatePull = (px) => {
      pullPxRef.current = px;
      setPullPx(px);
    };
    const openArchive = () => {
      wheelDeltaRef.current = 0;
      touchAnchorYRef.current = null;
      updatePull(0);
      setArchiveOpen(true);
      navigator.vibrate?.(15);
    };

    const onTouchStart = (e) => {
      touchAnchorYRef.current = atBottom() ? e.touches[0].clientY : null;
    };
    const onTouchMove = (e) => {
      if (!atBottom()) {
        touchAnchorYRef.current = null;
        if (pullPxRef.current > 0) updatePull(0);
        return;
      }
      if (touchAnchorYRef.current == null) {
        touchAnchorYRef.current = e.touches[0].clientY;
        return;
      }
      const dy = touchAnchorYRef.current - e.touches[0].clientY;
      updatePull(dy > 0 ? Math.min(100, dy * 0.5) : 0);
    };
    const onTouchEnd = () => {
      if (pullPxRef.current >= ARCHIVE_PULL_THRESHOLD) openArchive();
      else updatePull(0);
      touchAnchorYRef.current = null;
    };
    const onWheel = (e) => {
      if (e.deltaY <= 0 || !atBottom()) return;
      wheelDeltaRef.current = Math.min(160, wheelDeltaRef.current + e.deltaY);
      updatePull(Math.min(100, (wheelDeltaRef.current / 140) * ARCHIVE_PULL_THRESHOLD));
      clearTimeout(wheelTimerRef.current);
      if (wheelDeltaRef.current >= 140) {
        openArchive();
      } else {
        wheelTimerRef.current = setTimeout(() => {
          wheelDeltaRef.current = 0;
          updatePull(0);
        }, 320);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      clearTimeout(wheelTimerRef.current);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('wheel', onWheel);
    };
  }, [archivedTemplates.length, archiveOpen]);

  useEffect(() => {
    if (archiveOpen) archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [archiveOpen]);

  const storeSnapshot = useMemo(() => ({
    templates,
    history,
    customExercises,
    exerciseOverrides,
    scienceState,
    scienceReport,
  }), [templates, history, customExercises, exerciseOverrides, scienceState, scienceReport]);

  const templateCards = useMemo(() => templates.map(t => {
    const completedWorkout = findCompletedWorkoutThisWeek(t, storeSnapshot, now);
    return {
      raw: t,
      resolved: resolveDynamicTemplate(t, storeSnapshot, now),
      completedWorkout,
      completedThisWeek: Boolean(completedWorkout),
    };
  }), [templates, storeSnapshot, now]);

  const handleDeleteArchived = (template) => {
    if (window.confirm(tr('Sei sicuro di voler eliminare la scheda "{name}"?\nQuesta azione è irreversibile.', { name: template.name }))) {
      deleteArchivedTemplate(template.id);
    }
  };

  const elapsed = activeWorkout ? formatElapsed(activeWorkout.startTime, now) : '00:00';

  const handleStartTemplate = (template) => {
    if (activeWorkout && !window.confirm(tr('Hai un allenamento in corso. Vuoi abbandonarlo?'))) return;
    startWorkout(template);
    navigate('/workout');
  };

  const handleStartEmpty = () => {
    if (activeWorkout && !window.confirm(tr('Hai un allenamento in corso. Vuoi abbandonarlo?'))) return;
    startWorkout(null);
    navigate('/workout');
  };

  const handleDelete = (template) => {
    if (window.confirm(tr('Sei sicuro di voler eliminare la scheda "{name}"?\nQuesta azione è irreversibile.', { name: template.name }))) {
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
          <div className="home-brand">
            <p className="ej-eyebrow">{getGreeting()}</p>
            {isOgTheme
              ? <h1 className="ej-title">EliteJIM</h1>
              : <h1 className="home-logo-title"><img src={eliteJimLogo} alt="EliteJIM" width="272" height="116" /></h1>}
          </div>
          <div className="home-header-actions">
            <button
              type="button"
              className={`home-streak ${currentStreak > 0 ? 'is-active' : ''}`}
              onClick={() => navigate('/activity')}
              title={tr('Visualizza attività e streak')}
            >
              <Flame size={16} />
              <span>{currentStreak} {tr('sett')}</span>
            </button>
            {lastWorkoutDate && (
              <button type="button" className="ej-icon-btn ej-icon-btn--round" onClick={() => setShowWelcome(true)} title={tr('Riepilogo')}>
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
                <span className="home-active-dot" /> {tr('In corso')} · {elapsed}
              </span>
              <span className="home-active-name">{activeWorkout.name || 'Sessione Libera'}</span>
            </div>
            <span className="home-active-play">
              <Play size={20} fill="currentColor" />
            </span>
          </button>
        )}

        {/* ── RIEPILOGO GIORNALIERO (→ Diario, solo se attivo) ──────── */}
        {showDiary && !activeWorkout && <DailyRecapCard />}

        {/* ── ALLENAMENTO LIBERO ─────────────────────── */}
        <section className="home-section" aria-labelledby="home-training-title">
          <h2 className="ej-section-title" id="home-training-title">{tr('Allenati')}</h2>
          <button type="button" className="home-free" onClick={handleStartEmpty}>
            <Dumbbell size={20} /> {tr('Sessione Libera')}
          </button>
        </section>

        {/* ── SCHEDE ────────────────────────────────── */}
        <section className="home-section" aria-labelledby="home-routines-title">
          <div className="home-routines-heading">
            <div className="ej-section-header">
              <h2 className="ej-section-title" id="home-routines-title">{tr('Le tue schede')}</h2>
              <button type="button" className="ej-btn ej-btn--secondary home-new-btn" onClick={() => setNewTemplateOpen(true)}>
                <Plus size={16} className="home-new-icon" /> {tr('Nuova Scheda')}
              </button>
            </div>
            {!isOgTheme && templates.length > 0 && <p className="home-routine-hint" id="routine-gesture-hint">{tr('Tocca per iniziare · Tieni premuto per le opzioni')}</p>}
          </div>
          {templates.length > 0 && !isOgTheme && (
            <div className="home-routines">
              {templateCards.map(({ raw, resolved, completedWorkout, completedThisWeek }) => (
                <RoutineCard
                  key={raw.id}
                  template={resolved}
                  completedThisWeek={completedThisWeek}
                  onStart={() => (completedWorkout ? setCompletedPreview({ workout: completedWorkout, template: raw }) : handleStartTemplate(raw))}
                  onActions={() => setActionTemplate(raw)}
                />
              ))}
            </div>
          )}
          {/* OG: rectangular cards with inline actions, as before the grid redesign. */}
          {templates.length > 0 && isOgTheme && (
            <div className="home-routine-list">
              {templateCards.map(({ raw, resolved, completedWorkout, completedThisWeek }) => {
                const setsTotal = (resolved.exercises || []).reduce((a, ex) => a + (Number(ex.setsCount) || 0), 0);
                return (
                  <article key={raw.id} className={`ej-card home-routine-row ${completedThisWeek ? 'is-completed-week' : ''}`}>
                    <div
                      className="home-routine-head"
                      onClick={completedWorkout ? () => setCompletedPreview({ workout: completedWorkout, template: raw }) : undefined}
                      style={completedWorkout ? { cursor: 'pointer' } : undefined}
                    >
                      <span className="home-routine-badge">{(resolved.name || '?').trim().charAt(0).toUpperCase()}</span>
                      <div className="home-routine-text">
                        <h3>{resolved.name}</h3>
                        <p>
                          {(resolved.exercises || []).length} {tr('esercizi')} · {setsTotal} {tr('serie')}
                          {resolved.scienceSync && <> · <Dna size={11} /> {tr('Scienza')}</>}
                          {completedThisWeek && <> · <Check size={11} /> {tr('Fatta')}</>}
                        </p>
                      </div>
                    </div>
                    <div className="home-routine-actions">
                      <div className="home-routine-tools">
                        <button type="button" className="ej-icon-btn ej-icon-btn--danger" onClick={() => handleDelete(raw)} title={tr('Elimina scheda')}>
                          <Trash2 size={16} />
                        </button>
                        <button type="button" className="ej-icon-btn ej-icon-btn--primary" onClick={() => setSharingTemplate(raw)} title={tr('Condividi ed esporta scheda')}>
                          <Share2 size={16} />
                        </button>
                        <button type="button" className="ej-icon-btn" onClick={() => navigate('/build', { state: { template: raw } })} title={tr('Modifica scheda')}>
                          <Edit3 size={16} />
                        </button>
                      </div>
                      <button type="button" className="ej-btn ej-btn--primary" onClick={() => handleStartTemplate(raw)} title={tr('Inizia allenamento')}>
                        <Play size={14} fill="currentColor" /> {tr('Inizia')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SESSIONI TOTALI ────────────────────────── */}
        {history.length > 0 && (
          <div className="ej-card home-stat home-stat--full">
            <div className="home-stat-head">
              <span className="home-stat-icon"><CheckCircle2 size={18} /></span>
              <div className="home-stat-copy">
                <span className="home-stat-label">{tr('Sessioni totali')}</span>
                <small className="home-stat-sub">{tr('Allenamenti completati')}</small>
              </div>
            </div>
            <span className="home-stat-value">{history.length.toLocaleString(locale())}</span>
          </div>
        )}

        <InteractiveBody />

        <p className="ej-footer-version">ELITEJIM v{pkg.version.replace(/\.0$/, '')}</p>

        {/* Archivio nascosto stile WhatsApp: compare tirando verso il basso a fine pagina */}
        {archivedTemplates.length > 0 && !archiveOpen && (() => {
          const progress = Math.min(1, pullPx / ARCHIVE_PULL_THRESHOLD);
          const ready = progress >= 1;
          return (
            <button
              type="button"
              className={`home-archive-pull ${pullPx > 0 ? 'is-pulling' : ''} ${ready ? 'is-ready' : ''}`}
              style={{
                '--pull-progress': progress,
                transform: pullPx > 0 ? `translateY(${-Math.round(pullPx * 0.18)}px) scale(${0.96 + progress * 0.05})` : undefined,
              }}
              onClick={() => setArchiveOpen(true)}
              aria-label={tr('Apri archivio schede ({n})', { n: archivedTemplates.length })}
            >
              <span className="home-archive-pull-bar" aria-hidden="true">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
              <span className="home-archive-pull-row">
                <Archive size={13} />
                <span>
                  {ready
                    ? tr('Rilascia per aprire l’archivio ({n})', { n: archivedTemplates.length })
                    : pullPx > 0
                      ? tr('Continua a tirare per l’archivio ({n})', { n: archivedTemplates.length })
                      : tr('Tira verso il basso per l’archivio ({n})', { n: archivedTemplates.length })}
                </span>
              </span>
            </button>
          );
        })()}

        {archivedTemplates.length > 0 && archiveOpen && (
          <section ref={archiveRef} className="ej-card home-archive" aria-label={tr('Archivio schede')}>
            <div className="home-archive-head">
              <div className="home-archive-title">
                <Archive size={16} />
                <h3>{tr('Archivio schede')}</h3>
                <span className="home-archive-badge">{archivedTemplates.length}</span>
              </div>
              <button type="button" className="home-archive-close" onClick={() => setArchiveOpen(false)}>
                <ChevronUp size={15} /> {tr('Nascondi')}
              </button>
            </div>
            <div className="home-archive-list">
              {archivedTemplates.map(t => {
                const sets = (t.exercises || []).reduce((sum, ex) => sum + (Number(ex.setsCount) || 0), 0);
                return (
                  <div key={t.id} className="home-archive-item">
                    <div className="home-archive-info">
                      <strong>{t.name}</strong>
                      <span>{(t.exercises || []).length} {tr('esercizi')} · {sets} {tr('serie')}</span>
                    </div>
                    <div className="home-archive-actions">
                      <button type="button" className="ej-icon-btn ej-icon-btn--primary" onClick={() => handleStartTemplate(t)} title={tr('Inizia allenamento')} aria-label={tr('Inizia allenamento')}>
                        <Play size={14} fill="currentColor" />
                      </button>
                      <button type="button" className="ej-icon-btn" onClick={() => restoreArchivedTemplate(t.id)} title={tr('Ripristina scheda')} aria-label={tr('Ripristina scheda')}>
                        <RotateCcw size={14} />
                      </button>
                      <button type="button" className="ej-icon-btn ej-icon-btn--danger" onClick={() => handleDeleteArchived(t)} title={tr('Elimina scheda')} aria-label={tr('Elimina scheda')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {actionTemplate && <Sheet title={tr('Opzioni scheda')} onClose={() => setActionTemplate(null)}><div className="home-routine-menu"><p>{actionTemplate.name}</p><button type="button" onClick={() => { setSharingTemplate(actionTemplate); setActionTemplate(null); }}><Share2 size={19} /><span>{tr('Condividi scheda')}<small>{tr('Esporta o invia a un amico')}</small></span></button><button type="button" onClick={() => { setActionTemplate(null); navigate('/build', { state: { template: actionTemplate } }); }}><Edit3 size={19} /><span>{tr(tr('Modifica scheda'))}<small>{tr('Esercizi, serie e dettagli')}</small></span></button><button type="button" className="is-danger" onClick={() => handleDelete(actionTemplate)}><Trash2 size={19} /><span>{tr(tr('Elimina scheda'))}<small>{tr('Ti chiederemo conferma')}</small></span></button></div></Sheet>}

      {newTemplateOpen && (
        <Sheet title={tr('Nuova Scheda')} onClose={() => setNewTemplateOpen(false)}>
          <div className="home-routine-menu">
            <p>{tr('Come vuoi crearla?')}</p>
            <button type="button" className="is-featured" onClick={() => { setNewTemplateOpen(false); setSplitBuilderOpen(true); }}>
              <Layers size={19} />
              <span>
                <em className="home-menu-title-row">{tr('Splits')} <i className="home-featured-pill">{tr('Consigliato')}</i></em>
                <small>{tr('Scegli i giorni a settimana, la split e sincronizza le serie con Scienza')}</small>
              </span>
            </button>
            <button type="button" onClick={() => { setNewTemplateOpen(false); navigate('/build'); }}>
              <PenLine size={19} />
              <span>{tr('Crea a mano')}<small>{tr('Scegli tu esercizi e serie')}</small></span>
            </button>
            <button type="button" onClick={() => { setNewTemplateOpen(false); setAiTab('prompt'); }}>
              <Sparkles size={19} />
              <span>{tr('Crea con l’AI')}<small>{tr('Genera un prompt per ChatGPT e importa la scheda')}</small></span>
            </button>
            <button type="button" onClick={() => { setNewTemplateOpen(false); setAiTab('import'); }}>
              <FileJson size={19} />
              <span>{tr('Importa da JSON')}<small>{tr('Incolla una scheda condivisa o generata')}</small></span>
            </button>
          </div>
        </Sheet>
      )}

      <SplitBuilderModal isOpen={splitBuilderOpen} onClose={() => setSplitBuilderOpen(false)} />

      {completedPreview && (
        <WorkoutDetailSheet
          workout={completedPreview.workout}
          onClose={() => setCompletedPreview(null)}
          footer={(
            <button
              type="button"
              className="mn-cta"
              onClick={() => {
                const tpl = completedPreview.template;
                setCompletedPreview(null);
                handleStartTemplate(tpl);
              }}
            >
              {tr('Ripeti allenamento')}
            </button>
          )}
        />
      )}

      <AiTemplateModal isOpen={!!aiTab} initialTab={aiTab || 'prompt'} onClose={() => setAiTab(null)} />

      <ShareTemplateModal
        isOpen={!!sharingTemplate}
        onClose={() => setSharingTemplate(null)}
        template={sharingTemplate}
      />
    </>
  );
}

export default Home;
