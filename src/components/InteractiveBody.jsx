import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import Model from 'react-body-highlighter';
import { useStore } from '../store/useStore';
import './InteractiveBody.css';

import { EXERCISES_DB, EXERCISE_CATEGORIES, getAllExercises, normalizeName } from '../data/exercises';
import { tr } from '../i18n';

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

  return (
    <div
      className="ej-card interactive-body-container is-tappable"
      role="button"
      tabIndex={0}
      aria-label={tr('Apri la mappa della fatica')}
      onClick={() => navigate('/fatigue')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/fatigue'); } }}
    >
      <div className="ib-header">
        <h3>{tr('Mappa Muscolare')}</h3>
        <p>{tr('Gruppi allenati negli ultimi 7 giorni')}</p>
      </div>

      <div className="ib-views">
        <figure className="ib-view">
          <Model data={workoutData} type="anterior" highlightedColors={INTENSITY_COLORS} />
          <figcaption>{tr('Vista Frontale')}</figcaption>
        </figure>
        <figure className="ib-view">
          <Model data={workoutData} type="posterior" highlightedColors={INTENSITY_COLORS} />
          <figcaption>{tr('Vista Posteriore')}</figcaption>
        </figure>
      </div>

      <div className="ib-legend">
        <span className="ib-legend-label">{tr('Serie:')}</span>
        {INTENSITY_LEGEND.map((label, i) => (
          <span key={label} className="ib-legend-item">
            <span className="ib-legend-swatch" style={{ background: INTENSITY_COLORS[i] }} />
            {label}
          </span>
        ))}
      </div>

      <p className="ib-fatigue-link"><Activity size={14} /> {tr('Tocca per vedere la mappa della fatica')}</p>
    </div>
  );
};
