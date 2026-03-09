import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // Array of predefined templates
      templates: [],
      // Array of completed workouts
      history: [],
      // Currently active workout session
      activeWorkout: null,

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

      toggleSupersetWithPrevious: (exerciseIndex) => {
        set((state) => {
          if (!state.activeWorkout || exerciseIndex <= 0) return state;
          
          const exercises = [...state.activeWorkout.exercises];
          const currentEx = { ...exercises[exerciseIndex] };
          const prevEx = { ...exercises[exerciseIndex - 1] };
          
          if (currentEx.supersetId && currentEx.supersetId === prevEx.supersetId) {
             currentEx.supersetId = null;
          } else {
             if (!prevEx.supersetId) {
                prevEx.supersetId = Date.now().toString();
             }
             currentEx.supersetId = prevEx.supersetId;
          }
          
          exercises[exerciseIndex - 1] = prevEx;
          exercises[exerciseIndex] = currentEx;
          
          return { activeWorkout: { ...state.activeWorkout, exercises } };
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
            activeWorkout: null
          };
        });
      },

      cancelWorkout: () => set({ activeWorkout: null })
    }),
    {
      name: 'elitejim-storage', // unique name
    }
  )
);
