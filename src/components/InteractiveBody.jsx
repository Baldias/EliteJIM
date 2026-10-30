import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import Model from 'react-body-highlighter';
import { useStore } from '../store/useStore';
import './InteractiveBody.css';

import { EXERCISES_DB, EXERCISE_CATEGORIES, getAllExercises, normalizeName } from '../data/exercises';
import { tr } from '../i18n';
import { computeMuscleFatigue, fatigueLevel, FATIGUE_COLORS, FATIGUE_LEVELS, FATIGUE_MUSCLES } from '../utils/muscleFatigue';

const RECOVERED_COLOR = '#B6BDC3';

// Maps our internal EXERCISE_CATEGORIES to the react-body-highlighter valid muscle names
const mapCategoryToMuscles = (category, exerciseName) => {
  const name = exerciseName.toLowerCase();

  switch (category) {
    case EXERCISE_CATEGORIES.CHEST:
      if (name.includes('croc') || name.includes('pectoral')) return ['chest'];
      return ['chest', 'triceps', 'front-deltoids'];

    case EXERCISE_CATEGORIES.BACK:
      if (name.includes('hyperextension')) return ['lower-back', 'gluteal', 'hamstring'];
      if (name.includes('scrollate')) return ['trapezius'];
      if (name.includes('pullover')) return ['upper-back', 'chest'];
      // Standard rows/pulls
      return ['upper-back', 'biceps', 'back-deltoids'];

    case 'Gambe':
      if (name.includes('calf')) return ['calves'];
      if (name.includes('femorali') || name.includes('curl') || name.includes('stacc')) {
        return ['hamstring', 'gluteal', 'lower-back'];
      }
      if (name.includes('adductor')) return ['adductor'];
      if (name.includes('abductor')) return ['abductors']; // NOTE: library expects 'adductor' or 'abductors' or 'gluteal'
      // Standard squat/press/extension
      return ['quadriceps', 'gluteal'];

    case EXERCISE_CATEGORIES.QUADRICEPS:
      if (name.includes('adductor')) return ['adductor'];
      return ['quadriceps', 'gluteal'];

    case EXERCISE_CATEGORIES.HAMSTRINGS:
      return ['hamstring', 'gluteal', 'lower-back'];

    case EXERCISE_CATEGORIES.GLUTES:
      if (name.includes('abductor')) return ['abductors'];
      return ['gluteal'];

    case EXERCISE_CATEGORIES.CALVES:
      return ['calves'];

    case EXERCISE_CATEGORIES.SHOULDERS:
      if (name.includes('posteriori') || name.includes('face pull') || name.includes('reverse')) {
        return ['back-deltoids'];
      }
      if (name.includes('laterali')) return ['back-deltoids']; // Mapped to back-delts for visual proximity
      return ['front-deltoids', 'triceps'];

    case EXERCISE_CATEGORIES.BICEPS:
      return ['biceps'];

    case EXERCISE_CATEGORIES.TRICEPS:
      return ['triceps'];

    case EXERCISE_CATEGORIES.FOREARMS:
      return ['forearm'];

    case EXERCISE_CATEGORIES.CORE:
      return ['abs'];

    case EXERCISE_CATEGORIES.NECK:
      return ['neck'];

    default:
      return [];
  }
};

const getMusclesFromExercise = (exerciseName, allExercises = []) => {
  // Find the exact exercise in allExercises
  const norm = normalizeName(exerciseName);
  const exerciseDef = allExercises.find(ex => normalizeName(ex.name) === norm);
  
  if (exerciseDef) {
    const categories = [exerciseDef.category, ...(exerciseDef.secondaryCategories || [])].filter(Boolean);
    const allMuscles = categories.flatMap(cat => mapCategoryToMuscles(cat, exerciseDef.name));
    return [...new Set(allMuscles)];
  }

  // Fallback for custom exercises or if not found in DB
  const name = exerciseName.toLowerCase();
  if (name.includes('panc') || name.includes('chest')) return ['chest', 'triceps'];
  if (name.includes('squat') || name.includes('leg ext')) return ['quadriceps', 'gluteal'];
  if (name.includes('traz') || name.includes('remat') || name.includes('lat')) return ['upper-back', 'biceps'];
  return [];
};

const INTENSITY_COLORS = [
  '#003f53', // Intensity 1 (1-4 sets) - Dark blue
  '#006484', // Intensity 2 (5-9 sets) - Medium blue
  '#007EA7', // Intensity 3 (10-14 sets) - App Primary Color
  '#00bfff', // Intensity 4 (15-19 sets) - Bright cyan/blue
  '#5ce1e6'  // Intensity 5 (20+ sets) - Neon cyan
];

const INTENSITY_LEGEND = ['1-4', '5-9', '10-14', '15-19', '20+'];

const getIntensity = (sets) => {
  if (sets < 5) return 1;
  if (sets < 10) return 2;
  if (sets < 15) return 3;
  if (sets < 20) return 4;
  return 5;
};

export const InteractiveBody = () => {
  const navigate = useNavigate();
  const [showFatigue, setShowFatigue] = useState(false);
  const history = useStore(state => state.history);
  const customExercises = useStore(state => state.customExercises);
  const exerciseOverrides = useStore(state => state.exerciseOverrides);
  const allExercises = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);

  const workoutData = useMemo(() => {
    // Look at workouts from the last 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentWorkouts = history.filter(w => w.endTime && w.endTime > weekAgo);

    const muscleFrequencies = {};

    recentWorkouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        // Only count if there were actual completed sets
        const completedSets = ex.sets ? ex.sets.filter(s => s.done) : [];
        if (completedSets.length > 0) {
          const muscles = getMusclesFromExercise(ex.name, allExercises);
          muscles.forEach(m => {
            muscleFrequencies[m] = (muscleFrequencies[m] || 0) + completedSets.length;
          });
        }
      });
    });

    // Create an individual entry for each muscle
    // The library uses `frequency - 1` as the index for target color in highlightedColors
    return Object.keys(muscleFrequencies).map(muscle => {
      const sets = muscleFrequencies[muscle];
      return {
        name: muscle,
        muscles: [muscle],
        frequency: getIntensity(sets)
      };
    });
  }, [history, allExercises]);

  const fatigueData = useMemo(() => computeMuscleFatigue(history, allExercises)
    .filter(m => FATIGUE_MUSCLES[m.muscle] && fatigueLevel(m.fatigue) > 0)
    .map(m => ({ name: m.muscle, muscles: [m.muscle], frequency: fatigueLevel(m.fatigue) })), [history, allExercises]);

  const toggle = () => setShowFatigue(v => !v);
  const data = showFatigue ? fatigueData : workoutData;
  const colors = showFatigue ? FATIGUE_COLORS : INTENSITY_COLORS;
  const legend = showFatigue
    ? [[tr('Recuperato'), RECOVERED_COLOR], ...FATIGUE_LEVELS.map((label, i) => [tr(label), FATIGUE_COLORS[i]])]
    : INTENSITY_LEGEND.map((label, i) => [label, INTENSITY_COLORS[i]]);

  return (
    <div
      className={`ej-card interactive-body-container is-tappable ${showFatigue ? 'is-fatigue' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={showFatigue}
      aria-label={showFatigue ? tr('Mostra le serie della settimana') : tr('Mostra la mappa della fatica')}
      onClick={toggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
    >
      <div className="ib-header">
        <h3>{showFatigue ? tr('Mappa della fatica') : tr('Mappa Muscolare')}</h3>
        <p>{showFatigue ? tr('Fatica residua stimata per muscolo, adesso') : tr('Gruppi allenati negli ultimi 7 giorni')}</p>
      </div>

      <div className="ib-views">
        <figure className="ib-view">
          <Model data={data} type="anterior" bodyColor={RECOVERED_COLOR} highlightedColors={colors} />
          <figcaption>{tr('Vista Frontale')}</figcaption>
        </figure>
        <figure className="ib-view">
          <Model data={data} type="posterior" bodyColor={RECOVERED_COLOR} highlightedColors={colors} />
          <figcaption>{tr('Vista Posteriore')}</figcaption>
        </figure>
      </div>

      <div className="ib-legend">
        {!showFatigue && <span className="ib-legend-label">{tr('Serie:')}</span>}
        {legend.map(([label, color]) => (
          <span key={label} className="ib-legend-item">
            <span className="ib-legend-swatch" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {showFatigue ? (
        <button type="button" className="ib-fatigue-link" onClick={e => { e.stopPropagation(); navigate('/fatigue'); }}>
          {tr('Dettagli per muscolo e fonti')} <ArrowRight size={14} />
        </button>
      ) : (
        <p className="ib-fatigue-link"><Activity size={14} /> {tr('Tocca per vedere la mappa della fatica')}</p>
      )}
    </div>
  );
};
