import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { checkStreakInactivity, calculateSessionScore, recalculateTotalXpFromHistory } from '../utils/gamification';
import { EXERCISES_DB } from '../data/exercises';

export const useStore = create(
  persist(
    (set, get) => ({
      // Array of predefined templates
      templates: [
        {
          id: 'tpl-1',
          name: 'Spinta (Petto/Spalle/Tricipiti)',
          exercises: [
            { name: 'Panca Piana Bilanciere', setsCount: 3, targetReps: '8-10', restTime: 90 },
            { name: 'Military Press', setsCount: 3, targetReps: '8-10', restTime: 90 },
            { name: 'Alzate Laterali Manubri', setsCount: 3, targetReps: '12-15', restTime: 60 },
            { name: 'Pushdown Tricipiti ai Cavi', setsCount: 3, targetReps: '12-15', restTime: 60 }
          ]
        },
        {
          id: 'tpl-2',
          name: 'Trazione (Dorso/Bicipiti)',
          exercises: [
            { name: 'Trazioni alla Sbarra (Pull-up)', setsCount: 3, targetReps: '6-8', restTime: 120 },
            { name: 'Rematore con Bilanciere', setsCount: 3, targetReps: '8-10', restTime: 90 },
            { name: 'Pulley Basso', setsCount: 3, targetReps: '10-12', restTime: 90 },
            { name: 'Curl Bilanciere', setsCount: 3, targetReps: '10-12', restTime: 60 }
          ]
        },
        {
          id: 'tpl-3',
          name: 'Gambe (Leg Day)',
          exercises: [
            { name: 'Squat con Bilanciere', setsCount: 3, targetReps: '6-8', restTime: 120 },
            { name: 'Leg Extension', setsCount: 3, targetReps: '12-15', restTime: 60 },
            { name: 'Leg Curl', setsCount: 3, targetReps: '12-15', restTime: 60 },
            { name: 'Calf Raise Seduto', setsCount: 3, targetReps: '15-20', restTime: 60 }
          ]
        }
      ],
      // Array of completed workouts
      history: [],
      // Array of custom exercises created by user
      customExercises: [],
      // Currently active workout session
      activeWorkout: null,
      // Saved science assessment report
      scienceReport: null,
      // Persistent rest timer end timestamp
      globalRestEndTime: null,

      // --- Gamification State ---
      userXP: 0,
      muscleXP: {}, // Track XP per muscle group
      currentStreak: 0,
      highestStreak: 0,
      lastWorkoutDate: null,
      recapData: null,
      showScience: true,

      // --- Gamification Actions ---
      clearRecapData: () => set({ recapData: null }),
      processInactivity: () => {
        set((state) => {
          if (!state.lastWorkoutDate) return state;
          const { newStreak, newXp, penalty } = checkStreakInactivity(state.lastWorkoutDate, state.currentStreak, state.userXP);
          if (penalty > 0 || newStreak !== state.currentStreak) {
            return { currentStreak: newStreak, userXP: newXp };
          }
          return state;
        });
      },
      syncGamificationWithHistory: () => {
        set((state) => {
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(state.history, [...EXERCISES_DB, ...(state.customExercises || [])]);
          return { userXP, muscleXP, currentStreak, highestStreak };
        });
      },

      // --- Rest Timer Actions ---
      setGlobalRestEndTime: (timestamp) => set({ globalRestEndTime: timestamp }),
      clearGlobalRestTimer: () => set({ globalRestEndTime: null }),

      // --- Science Actions ---
      saveScienceReport: (report) => set({ scienceReport: report }),
      toggleScience: () => set((state) => ({ showScience: !state.showScience })),
      
      // --- Custom Exercises Actions ---
      addCustomExercise: (exercise) =>
        set((state) => ({ customExercises: [...(state.customExercises || []), { ...exercise, id: `custom-${Date.now()}` }] })),
      removeCustomExercise: (id) =>
        set((state) => ({ customExercises: (state.customExercises || []).filter((ex) => ex.id !== id) })),

      // --- Template Actions ---
      addTemplate: (template) =>
        set((state) => ({ templates: [...state.templates, { ...template, id: Date.now() }] })),
      deleteTemplate: (id) =>
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),

      // --- Workout Actions ---
      startWorkout: (template) => {
        const history = get().history;

        // Helper: find the most recent past sets for a given exercise name
        const findLastSets = (exerciseName) => {
          for (const w of history) {
            const pastEx = w.exercises.find(e => e.name === exerciseName);
            if (pastEx && pastEx.sets && pastEx.sets.length > 0) {
              return pastEx.sets;
            }
          }
          return null;
        };

        // Build a fresh session from a template
        const session = {
          id: Date.now(),
          templateId: template ? template.id : null,
          name: template ? template.name : 'Allenamento Libero',
          startTime: Date.now(),
          exercises: template ? template.exercises.map(ex => {
            const pastSets = findLastSets(ex.name);
            return {
              id: Date.now() + Math.random(),
              name: ex.name,
              restTime: ex.restTime || 60,
              sets: Array.from({ length: parseInt(ex.setsCount) || 1 }, (_, i) => {
                const pastSet = pastSets && pastSets[i] ? pastSets[i] : (pastSets ? pastSets[pastSets.length - 1] : null);
                return {
                  id: Date.now() + i,
                  kg: pastSet ? (pastSet.kg || '') : '',
                  reps: pastSet ? (pastSet.reps || '') : '',
                  targetReps: ex.targetReps,
                  done: false
                };
              })
            };
          }) : []
        };
        set({ activeWorkout: session });
      },

      updateActiveWorkoutSet: (exerciseId, setId, field, value) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const updatedExercises = state.activeWorkout.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const updatedSets = ex.sets.map((s) => {
              if (s.id !== setId) return s;
              return { ...s, [field]: value };
            });
            return { ...ex, sets: updatedSets };
          });
          return { activeWorkout: { ...state.activeWorkout, exercises: updatedExercises } };
        });
      },

      addExerciseToActiveSession: (name) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const newExercise = {
            id: Date.now(),
            name,
            restTime: 60, // default
            sets: [{ id: Date.now() + 1, kg: '', reps: '', targetReps: '', done: false }]
          };
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: [...state.activeWorkout.exercises, newExercise]
            }
          };
        });
      },

      addSetToActiveExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const updatedExercises = state.activeWorkout.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;

            let lastKg = '';
            let lastReps = '';
            let targetReps = '';

            if (ex.sets && ex.sets.length > 0) {
              const lastSet = ex.sets[ex.sets.length - 1];
              lastKg = lastSet.kg || '';
              lastReps = lastSet.reps || '';
              targetReps = lastSet.targetReps || '';
            }

            return {
              ...ex,
              sets: [...ex.sets, { id: Date.now(), kg: lastKg, reps: lastReps, targetReps, done: false }]
            };
          });
          return { activeWorkout: { ...state.activeWorkout, exercises: updatedExercises } };
        });
      },

      addDropsetToActiveExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const updatedExercises = state.activeWorkout.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;

            let lastKg = '';
            let lastReps = '';
            if (ex.sets && ex.sets.length > 0) {
              const lastSet = ex.sets[ex.sets.length - 1];
              lastKg = lastSet.kg || '';
              lastReps = lastSet.reps || '';
            }

            return {
              ...ex,
              sets: [...ex.sets, { id: Date.now(), kg: lastKg, reps: lastReps, targetReps: '', done: false, isDropset: true }]
            };
          });
          return { activeWorkout: { ...state.activeWorkout, exercises: updatedExercises } };
        });
      },

      finishWorkout: () => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const completedWorkout = {
            ...state.activeWorkout,
            endTime: Date.now()
          };

          const sessionScore = calculateSessionScore(completedWorkout, state.history, [...EXERCISES_DB, ...(state.customExercises || [])]);
          
          let newStreak = state.currentStreak || 0;
          // Increment streak logic: if they completed at least 3 sets
          if (sessionScore.doneSets >= 3) {
            newStreak += 1;
          }

          const highestStreak = Math.max(state.highestStreak || 0, newStreak);
          const newXP = (state.userXP || 0) + sessionScore.xp;
          
          // Merge Muscle XP
          const newMuscleXP = { ...(state.muscleXP || {}) };
          if (sessionScore.muscleXpGained) {
            Object.keys(sessionScore.muscleXpGained).forEach(muscle => {
              newMuscleXP[muscle] = (newMuscleXP[muscle] || 0) + sessionScore.muscleXpGained[muscle];
            });
          }

          const recapData = {
            workout: completedWorkout,
            score: sessionScore,
            xpGained: sessionScore.xp,
            newTotalXp: newXP,
            streak: newStreak
          };

          return {
            history: [completedWorkout, ...state.history],
            activeWorkout: null,
            globalRestEndTime: null,
            userXP: newXP,
            muscleXP: newMuscleXP,
            currentStreak: newStreak,
            highestStreak,
            lastWorkoutDate: Date.now(),
            recapData
          };
        });
      },

      cancelWorkout: () => set({ activeWorkout: null, globalRestEndTime: null }),

      deleteWorkout: (workoutId) => {
        set((state) => {
          const newHistory = state.history.filter(w => w.id !== workoutId);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(newHistory, [...EXERCISES_DB, ...(state.customExercises || [])]);
          return {
            history: newHistory,
            userXP,
            muscleXP,
            currentStreak,
            highestStreak
          };
        });
      },

      deleteExerciseFromActiveSession: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.filter(ex => ex.id !== exerciseId)
            }
          };
        });
      },

      deleteSetFromActiveExercise: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const updatedExercises = state.activeWorkout.exercises.map(ex => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.filter(s => s.id !== setId)
            };
          });
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: updatedExercises
            }
          };
        });
      }
    }),
    {
      name: 'elitejim-storage', // unique name
    }
  )
);
