import React, { useState, useMemo } from 'react';
import Model from 'react-body-highlighter';
import { useStore } from '../store/useStore';
import './InteractiveBody.css';

import { EXERCISES_DB, EXERCISE_CATEGORIES } from '../data/exercises';

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

    case EXERCISE_CATEGORIES.LEGS:
      if (name.includes('calf')) return ['calves'];
      if (name.includes('femorali') || name.includes('curl') || name.includes('stacc')) {
        return ['hamstring', 'gluteal', 'lower-back'];
      }
      if (name.includes('adductor')) return ['adductor'];
      if (name.includes('abductor')) return ['abductors']; // NOTE: library expects 'adductor' or 'abductors' or 'gluteal'
      // Standard squat/press/extension
      return ['quadriceps', 'gluteal'];

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

const getMusclesFromExercise = (exerciseName) => {
  // Find the exact exercise in our DB
  const exerciseDef = EXERCISES_DB.find(ex => ex.name === exerciseName);

  if (exerciseDef) {
    return mapCategoryToMuscles(exerciseDef.category, exerciseDef.name);
  }

  // Fallback for custom exercises or if not found in DB
  // Just a very basic fallback, though user requested to purely rely on DB
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

const getIntensity = (sets) => {
  if (sets < 5) return 1;
  if (sets < 10) return 2;
  if (sets < 15) return 3;
  if (sets < 20) return 4;
  return 5;
};

export const InteractiveBody = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const history = useStore(state => state.history);

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
          const muscles = getMusclesFromExercise(ex.name);
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
  }, [history]);

  return (
    <div className="interactive-body-container">
      <div className="ib-header">
        <div>
          <h3>Mappa Muscolare</h3>
          <p>Gruppi allenati negli ultimi 7 giorni</p>
        </div>
      </div>

      <div className="ib-scene" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`ib-card-inner ${isFlipped ? 'is-flipped' : ''}`}>

          <div className="ib-card-face ib-card-front">
            <Model
              data={workoutData}
              style={{ width: '100%', height: '100%', padding: '1rem' }}
              type="anterior"
              highlightedColors={INTENSITY_COLORS}
            />
            <span className="ib-label">Vista Frontale</span>
          </div>

          <div className="ib-card-face ib-card-back">
            <Model
              data={workoutData}
              style={{ width: '100%', height: '100%', padding: '1rem' }}
              type="posterior"
              highlightedColors={INTENSITY_COLORS}
            />
            <span className="ib-label">Vista Posteriore</span>
          </div>

        </div>
      </div>
    </div>
  );
};
