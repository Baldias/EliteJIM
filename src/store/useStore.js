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
            sets: Array.from({ length: ex.setsCount }, (_, i) => ({
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
            return {
              ...ex,
              sets: [...ex.sets, { id: Date.now(), kg: '', reps: '', targetReps: '', done: false }]
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
