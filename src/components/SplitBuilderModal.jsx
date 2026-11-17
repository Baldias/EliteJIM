import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Flame, Layers, Sparkles } from 'lucide-react';
import { Sheet } from '../pages/monitoring/Sheet';
import { useStore } from '../store/useStore';
import { getAllExercises } from '../data/exercises';
import {
  SPLITS_BY_DAYS,
  buildSplitTemplates,
  muscleExerciseBounds,
  rankExercisesForMuscle,
  resolveUserGender,
  splitMusclesForSplit,
} from '../utils/splits';
import { tr } from '../i18n';
import './SplitBuilderModal.css';

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

export function SplitBuilderModal({ isOpen, onClose }) {
  const history = useStore(state => state.history);
  const customExercises = useStore(state => state.customExercises);
  const exerciseOverrides = useStore(state => state.exerciseOverrides);
  const templates = useStore(state => state.templates || []);
  const scienceState = useStore(state => state.scienceState);
  const scienceReport = useStore(state => state.scienceReport);
  const nutritionGoals = useStore(state => state.nutritionGoals);
  const createSplitTemplates = useStore(state => state.createSplitTemplates);

  const gender = resolveUserGender({ scienceState, scienceReport, nutritionGoals });
  const scienceActive = scienceState?.program?.status === 'active';
  const defaultDays = Math.min(6, Math.max(2, Number(scienceState?.profile?.daysPerWeek) || 5));

  const [step, setStep] = useState(1);
  const [days, setDays] = useState(defaultDays);
  const [splitId, setSplitId] = useState(() => SPLITS_BY_DAYS[defaultDays]?.[0]?.id || 'ppl-ul-5');
  const [scienceSync, setScienceSync] = useState(scienceActive);
  const [selectedByMuscle, setSelectedByMuscle] = useState({});

  const allExercises = useMemo(
    () => getAllExercises(customExercises, exerciseOverrides),
    [customExercises, exerciseOverrides]
  );

  const availableSplits = SPLITS_BY_DAYS[days] || SPLITS_BY_DAYS[5];
  const selectedSplit = availableSplits.find(s => s.id === splitId) || availableSplits[0];

  const activeMuscles = useMemo(
    () => splitMusclesForSplit(selectedSplit, gender),
    [selectedSplit, gender]
  );

  const rankedByMuscle = useMemo(() => {
    const map = {};
    for (const m of activeMuscles) {
      map[m] = rankExercisesForMuscle(m, allExercises, history);
    }
    return map;
  }, [activeMuscles, allExercises, history]);

  const splitDaysByMuscle = useMemo(() => {
    const map = {};
    for (const m of activeMuscles) {
      map[m] = selectedSplit.days.filter(d => d.muscles.includes(m)).map(d => d.name);
    }
    return map;
  }, [activeMuscles, selectedSplit]);

  if (!isOpen) return null;

  const handleSelectDays = (d) => {
    setDays(d);
    const list = SPLITS_BY_DAYS[d] || [];
    if (!list.some(s => s.id === splitId)) {
      setSplitId(list[0]?.id || '');
    }
  };

  const toggleExercise = (muscle, name) => {
    const { max } = muscleExerciseBounds(muscle);
    setSelectedByMuscle(prev => {
      const current = prev[muscle] || [];
      if (current.includes(name)) {
        return { ...prev, [muscle]: current.filter(n => n !== name) };
      }
      if (current.length >= max) return prev;
      return { ...prev, [muscle]: [...current, name] };
    });
  };

  const autoFillFrequent = () => {
    setSelectedByMuscle(prev => {
      const next = { ...prev };
      for (const m of activeMuscles) {
        const { min } = muscleExerciseBounds(m);
        const current = [...(next[m] || [])];
        if (current.length >= min) continue;
        const candidates = rankedByMuscle[m] || [];
        for (const ex of candidates) {
          if (current.length >= min) break;
          if (!current.includes(ex.name)) current.push(ex.name);
        }
        next[m] = current;
      }
      return next;
    });
  };

  const readyCount = activeMuscles.filter(m => {
    const { min, max } = muscleExerciseBounds(m);
    const n = (selectedByMuscle[m] || []).length;
    return n >= min && n <= max;
  }).length;
  const allValid = readyCount === activeMuscles.length && activeMuscles.length > 0;

  const handleCreate = () => {
    if (!allValid) return;
    const filteredSelection = Object.fromEntries(
      activeMuscles.map(m => [m, selectedByMuscle[m] || []])
    );
    const built = buildSplitTemplates({
      split: selectedSplit,
      selectedByMuscle: filteredSelection,
      allExercises,
      scienceSync,
    });
    createSplitTemplates(built, { archiveExisting: true });
    onClose();
  };

  const resetAndClose = () => {
    setStep(1);
    onClose();
  };

  const footer = step === 1 ? (
    <div className="sp-footer">
      {templates.length > 0 && (
        <p className="sp-archive-hint">
          {tr('Le {n} schede attuali andranno in archivio', { n: templates.length })}
        </p>
      )}
      <button type="button" className="mn-cta" onClick={() => setStep(2)}>
        {tr('Scegli gli esercizi')}
      </button>
    </div>
  ) : (
    <div className="sp-footer">
      <button type="button" className="mn-cta" disabled={!allValid} onClick={handleCreate}>
        {allValid
          ? tr('Crea {n} schede', { n: selectedSplit.days.length })
          : tr('Completa i gruppi obbligatori ({ready}/{total})', { ready: readyCount, total: activeMuscles.length })}
      </button>
    </div>
  );

  const headerExtra = step === 2 ? (
    <button type="button" className="sp-back-btn" onClick={() => setStep(1)} aria-label={tr('Indietro')}>
      <ArrowLeft size={15} /> {tr('Split')}
    </button>
  ) : null;

  return (
    <Sheet
      title={step === 1 ? tr('Scegli la tua Split') : tr('Esercizi per gruppo')}
      onClose={resetAndClose}
      full
      headerExtra={headerExtra}
      footer={footer}
      className="sp-sheet"
    >
      {step === 1 ? (
        <div className="sp-step1">
          <section className="sp-block">
            <h3 className="sp-label">{tr('Quanti giorni ti alleni a settimana?')}</h3>
            <div className="sp-days" role="group" aria-label={tr('Allenamenti settimanali')}>
              {DAYS_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  className={`sp-day-btn ${days === d ? 'is-active' : ''}`}
                  onClick={() => handleSelectDays(d)}
                >
                  <strong>{d}</strong>
                  <span>{tr('giorni')}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="sp-block">
            <h3 className="sp-label">{tr('Split consigliate')}</h3>
            <div className="sp-splits">
              {availableSplits.map(s => {
                const active = selectedSplit.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    className={`sp-split-card ${active ? 'is-active' : ''}`}
                    onClick={() => setSplitId(s.id)}
                  >
                    <div className="sp-split-top">
                      <div className="sp-split-title">
                        <strong>{tr(s.name)}</strong>
                        <span>{tr(s.subtitle)}</span>
                      </div>
                      <span className={`sp-radio ${active ? 'is-active' : ''}`}>
                        {active && <Check size={13} strokeWidth={3} />}
                      </span>
                    </div>
                    <div className="sp-split-days">
                      {s.days.map((day, idx) => (
                        <span key={`${s.id}-${idx}`} className="sp-day-pill">{day.name}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="sp-block">
            <label className={`sp-sync ${scienceSync ? 'is-active' : ''}`}>
              <input
                type="checkbox"
                checked={scienceSync}
                onChange={e => setScienceSync(e.target.checked)}
              />
              <span className="sp-sync-icon"><Layers size={18} /></span>
              <span className="sp-sync-text">
                <strong>{tr('Sincronizza con Scienza')}</strong>
                <small>
                  {tr('Adatta dinamicamente le serie di ogni seduta a quelle rimanenti nella settimana di Scienza')}
                </small>
              </span>
              <span className={`sp-toggle ${scienceSync ? 'is-on' : ''}`} aria-hidden="true">
                <i />
              </span>
            </label>
          </section>
        </div>
      ) : (
        <div className="sp-step2">
          <div className="sp-sticky">
            <div className="sp-progress-row">
              <div className="sp-progress-info">
                <strong>{tr('{ready} di {total} gruppi pronti', { ready: readyCount, total: activeMuscles.length })}</strong>
                <span>{tr('Da 2 a 4 esercizi · min 1 Polpacci · Addome opzionale')}</span>
              </div>
              <button type="button" className="sp-auto-btn" onClick={autoFillFrequent}>
                <Sparkles size={13} /> {tr('Auto-compila')}
              </button>
            </div>
            <div className="sp-progress-track">
              <span style={{ width: `${(readyCount / Math.max(1, activeMuscles.length)) * 100}%` }} />
            </div>
          </div>

          <div className="sp-muscles">
            {activeMuscles.map(muscle => {
              const list = rankedByMuscle[muscle] || [];
              const chosen = selectedByMuscle[muscle] || [];
              const { min, max } = muscleExerciseBounds(muscle);
              const isValid = chosen.length >= min && chosen.length <= max;
              const showDone = isValid && chosen.length > 0;
              const atMax = chosen.length >= max;
              const daysLabel = (splitDaysByMuscle[muscle] || []).join(' · ');

              return (
                <section key={muscle} className={`sp-muscle ${showDone ? 'is-valid' : ''}`}>
                  <header className="sp-muscle-head">
                    <div>
                      <h4>{tr(muscle)}</h4>
                      <span>{daysLabel}</span>
                    </div>
                    <span className={`sp-count ${showDone ? 'is-valid' : chosen.length > 0 ? 'is-partial' : ''}`}>
                      {showDone && <Check size={11} strokeWidth={3} />}
                      {min === 0 && chosen.length === 0
                        ? tr('Opzionale · 0–{max}', { max })
                        : `${chosen.length}/${min}–${max}`}
                    </span>
                  </header>

                  <div className="sp-ex-grid">
                    {list.map(ex => {
                      const pickedIdx = chosen.indexOf(ex.name);
                      const isPicked = pickedIdx !== -1;
                      return (
                        <button
                          key={ex.id || ex.name}
                          type="button"
                          aria-pressed={isPicked}
                          disabled={!isPicked && atMax}
                          className={`sp-ex-chip ${isPicked ? 'is-picked' : ''} ${ex.isFrequent ? 'is-frequent' : ''}`}
                          onClick={() => toggleExercise(muscle, ex.name)}
                        >
                          {ex.isFrequent && (
                            <span className="sp-ex-freq" title={tr('Fatto spesso')}>
                              <Flame size={11} fill="currentColor" />
                            </span>
                          )}
                          <span className="sp-ex-name">{ex.name}</span>
                          {ex.count > 0 && <em className="sp-ex-count">{ex.count}×</em>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default SplitBuilderModal;
