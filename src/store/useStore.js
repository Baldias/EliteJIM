import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // Array of predefined templates
      templates: [],
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

      // --- Rest Timer Actions ---
      setGlobalRestEndTime: (timestamp) => set({ globalRestEndTime: timestamp }),
      clearGlobalRestTimer: () => set({ globalRestEndTime: null }),

      // --- Science Actions ---
      saveScienceReport: (report) => set({ scienceReport: report }),
      
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
        // Build a fresh session from a template
        const session = {
          id: Date.now(),
          templateId: template ? template.id : null,
          name: template ? template.name : 'Allenamento Libero',
          startTime: Date.now(),
          exercises: template ? template.exercises.map(ex => ({
            id: Date.now() + Math.random(),
            name: ex.name,
            restTime: ex.restTime || 60,
            sets: Array.from({ length: parseInt(ex.setsCount) || 1 }, (_, i) => ({
              id: Date.now() + i,
              kg: '',
              reps: '',
              targetReps: ex.targetReps,
              done: false
            }))
          })) : []
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
          return {
            history: [completedWorkout, ...state.history],
            activeWorkout: null,
            globalRestEndTime: null
          };
        });
      },

      cancelWorkout: () => set({ activeWorkout: null, globalRestEndTime: null }),

      deleteWorkout: (workoutId) => {
        set((state) => ({
          history: state.history.filter(w => w.id !== workoutId)
        }));
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
