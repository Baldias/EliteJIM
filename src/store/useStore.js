import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { checkStreakInactivity, calculateSessionScore, recalculateTotalXpFromHistory } from '../utils/gamification';
import { EXERCISES_DB, getAllExercises, normalizeName } from '../data/exercises';

export const calculate1RM = (kg, reps) => {
  const w = parseFloat(kg) || 0;
  const r = parseFloat(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
};

export const findLastBest1RMSet = (history, exerciseName) => {
  if (!exerciseName || !history || history.length === 0) return null;
  const norm = normalizeName(exerciseName);
  for (const w of history) {
    const pastEx = w.exercises?.find(e => normalizeName(e.name) === norm);
    if (pastEx && pastEx.sets && pastEx.sets.length > 0) {
      let maxSet = null;
      let max1RM = -1;
      for (const s of pastEx.sets) {
        const rm = calculate1RM(s.kg, s.reps);
        if (rm > max1RM) {
          max1RM = rm;
          maxSet = s;
        }
      }
      if (!maxSet) maxSet = pastEx.sets[pastEx.sets.length - 1];
      return {
        set: maxSet,
        max1RM: max1RM > 0 ? parseFloat(max1RM.toFixed(1)) : 0,
        notes: pastEx.notes || ''
      };
    }
  }
  return null;
};

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
      // Map of overrides for default DB exercises: { [id]: { name, category, secondaryCategories, equipmentType } }
      exerciseOverrides: {},
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
      // --- Backup & Storage State ---
      autoBackupEnabled: true,
      autoBackupFrequency: 'after_workout', // 'after_workout' | 'weekly' | 'monthly'
      lastBackupDate: null,
      dismissedBackupReminderUntil: null,
      isStoragePersisted: false,

      // --- Backup & Storage Actions ---
      setAutoBackupSettings: (settings) => set((state) => ({ ...state, ...settings })),
      recordBackupExported: () => set({ lastBackupDate: Date.now(), dismissedBackupReminderUntil: null }),
      setStoragePersisted: (isPersisted) => set({ isStoragePersisted: isPersisted }),
      snoozeBackupReminder: (hours = 24) => set({ dismissedBackupReminderUntil: Date.now() + (hours * 60 * 60 * 1000) }),

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
          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(state.history, allKnown);
          return { userXP, muscleXP, currentStreak, highestStreak };
        });
      },

      // --- Rest Timer Actions ---
      setGlobalRestEndTime: (timestamp) => set({ globalRestEndTime: timestamp }),
      clearGlobalRestTimer: () => set({ globalRestEndTime: null }),

      // --- Science Actions ---
      saveScienceReport: (report) => set({ scienceReport: report }),
      toggleScience: () => set((state) => ({ showScience: !state.showScience })),
      
      // --- Exercise Management Actions ---
      addCustomExercise: (exercise) =>
        set((state) => ({ customExercises: [...(state.customExercises || []), { ...exercise, id: `custom-${Date.now()}`, isCustom: true }] })),

      removeCustomExercise: (id) =>
        set((state) => ({ customExercises: (state.customExercises || []).filter((ex) => ex.id !== id) })),

      updateExercise: ({ id, name, category, secondaryCategories = [], equipmentType, updateHistoryAndTemplates = true }) => {
        set((state) => {
          const customExercises = state.customExercises || [];
          const exerciseOverrides = state.exerciseOverrides || {};
          const currentAll = getAllExercises(customExercises, exerciseOverrides);
          const currentEx = currentAll.find(e => e.id === id);
          if (!currentEx) return state;

          const oldName = currentEx.name;
          const newName = (name || '').trim();
          const cleanSecondary = (secondaryCategories || []).filter(c => c && c !== category);

          let nextCustom = customExercises;
          let nextOverrides = { ...exerciseOverrides };

          if (currentEx.isCustom || String(id).startsWith('custom-')) {
            nextCustom = customExercises.map(ex => {
              if (ex.id === id) {
                return {
                  ...ex,
                  name: newName || ex.name,
                  category,
                  secondaryCategories: cleanSecondary,
                  equipmentType
                };
              }
              return ex;
            });
          } else {
            // Default exercise from EXERCISES_DB
            nextOverrides[id] = {
              name: newName || currentEx.name,
              category,
              secondaryCategories: cleanSecondary,
              equipmentType
            };
          }

          let nextTemplates = state.templates;
          let nextHistory = state.history;
          let nextActiveWorkout = state.activeWorkout;

          // Propagate rename to templates, history and active session
          if (updateHistoryAndTemplates && oldName && newName && normalizeName(oldName) !== normalizeName(newName)) {
            const oldNorm = normalizeName(oldName);

            nextTemplates = state.templates.map(tpl => ({
              ...tpl,
              exercises: (tpl.exercises || []).map(ex => {
                if (normalizeName(ex.name) === oldNorm) {
                  return { ...ex, name: newName };
                }
                return ex;
              })
            }));

            nextHistory = state.history.map(w => ({
              ...w,
              exercises: (w.exercises || []).map(ex => {
                if (normalizeName(ex.name) === oldNorm) {
                  return { ...ex, name: newName };
                }
                return ex;
              })
            }));

            if (nextActiveWorkout && nextActiveWorkout.exercises) {
              nextActiveWorkout = {
                ...nextActiveWorkout,
                exercises: nextActiveWorkout.exercises.map(ex => {
                  if (normalizeName(ex.name) === oldNorm) {
                    return { ...ex, name: newName };
                  }
                  return ex;
                })
              };
            }
          }

          const updatedAllExercises = getAllExercises(nextCustom, nextOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(nextHistory, updatedAllExercises);

          return {
            customExercises: nextCustom,
            exerciseOverrides: nextOverrides,
            templates: nextTemplates,
            history: nextHistory,
            activeWorkout: nextActiveWorkout,
            userXP,
            muscleXP,
            currentStreak,
            highestStreak
          };
        });
      },

      resetExerciseToDefault: (id, updateHistoryAndTemplates = true) => {
        set((state) => {
          const exerciseOverrides = state.exerciseOverrides || {};
          if (!exerciseOverrides[id]) return state;

          const defaultEx = EXERCISES_DB.find(e => e.id === id);
          if (!defaultEx) return state;

          const currentOverride = exerciseOverrides[id];
          const oldName = currentOverride.name || defaultEx.name;
          const defaultName = defaultEx.name;

          const nextOverrides = { ...exerciseOverrides };
          delete nextOverrides[id];

          let nextTemplates = state.templates;
          let nextHistory = state.history;
          let nextActiveWorkout = state.activeWorkout;

          if (updateHistoryAndTemplates && oldName && defaultName && normalizeName(oldName) !== normalizeName(defaultName)) {
            const oldNorm = normalizeName(oldName);

            nextTemplates = state.templates.map(tpl => ({
              ...tpl,
              exercises: (tpl.exercises || []).map(ex => {
                if (normalizeName(ex.name) === oldNorm) {
                  return { ...ex, name: defaultName };
                }
                return ex;
              })
            }));

            nextHistory = state.history.map(w => ({
              ...w,
              exercises: (w.exercises || []).map(ex => {
                if (normalizeName(ex.name) === oldNorm) {
                  return { ...ex, name: defaultName };
                }
                return ex;
              })
            }));

            if (nextActiveWorkout && nextActiveWorkout.exercises) {
              nextActiveWorkout = {
                ...nextActiveWorkout,
                exercises: nextActiveWorkout.exercises.map(ex => {
                  if (normalizeName(ex.name) === oldNorm) {
                    return { ...ex, name: defaultName };
                  }
                  return ex;
                })
              };
            }
          }

          const updatedAllExercises = getAllExercises(state.customExercises, nextOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(nextHistory, updatedAllExercises);

          return {
            exerciseOverrides: nextOverrides,
            templates: nextTemplates,
            history: nextHistory,
            activeWorkout: nextActiveWorkout,
            userXP,
            muscleXP,
            currentStreak,
            highestStreak
          };
        });
      },

      // --- Template Actions ---
      addTemplate: (template) =>
        set((state) => ({ templates: [...state.templates, { ...template, id: Date.now() }] })),
      updateTemplate: (updatedTemplate) =>
        set((state) => ({ templates: state.templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t) })),
      deleteTemplate: (id) =>
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),

      // --- Workout Actions ---
      startWorkout: (template) => {
        const history = get().history;

        // Helper: find the most recent past sets for a given exercise name
        const findLastSets = (exerciseName) => {
          const norm = normalizeName(exerciseName);
          for (const w of history) {
            const pastEx = w.exercises?.find(e => normalizeName(e.name) === norm);
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
              notes: ex.notes !== undefined ? ex.notes : '',
              restTime: ex.restTime || 60,
              isAdded: false,
              sets: Array.from({ length: parseInt(ex.setsCount) || 1 }, (_, i) => {
                const pastSet = pastSets && pastSets[i] ? pastSets[i] : (pastSets ? pastSets[pastSets.length - 1] : null);
                return {
                  id: Date.now() + i + Math.random(),
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

      updateActiveWorkoutExerciseNotes: (exerciseId, notes) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const updatedExercises = state.activeWorkout.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return { ...ex, notes };
          });
          return { activeWorkout: { ...state.activeWorkout, exercises: updatedExercises } };
        });
      },

      addExerciseToActiveSession: (name) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const history = state.history || [];
          const templates = state.templates || [];
          const bestData = name ? findLastBest1RMSet(history, name) : null;
          const bestSet = bestData?.set;

          let initialNotes = bestData?.notes || '';
          if (!initialNotes && name) {
            for (const tpl of templates) {
              const found = tpl.exercises?.find(e => normalizeName(e.name) === normalizeName(name));
              if (found?.notes) {
                initialNotes = found.notes;
                break;
              }
            }
          }

          const newExercise = {
            id: Date.now(),
            name: name || '',
            notes: initialNotes,
            restTime: 60, // default
            isAdded: true,
            sets: [{
              id: Date.now() + 1,
              kg: bestSet ? (bestSet.kg || '') : '',
              reps: bestSet ? (bestSet.reps || '') : '',
              targetReps: '',
              done: false
            }]
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

          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const sessionScore = calculateSessionScore(completedWorkout, state.history, allKnown);
          
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

          let updatedTemplates = state.templates;
          if (completedWorkout.templateId) {
            updatedTemplates = state.templates.map((tpl) => {
              if (tpl.id !== completedWorkout.templateId) return tpl;
              const updatedTplExercises = tpl.exercises.map((tEx) => {
                const activeEx = completedWorkout.exercises.find(
                  (e) => normalizeName(e.name) === normalizeName(tEx.name)
                );
                if (activeEx && activeEx.notes !== undefined) {
                  return { ...tEx, notes: activeEx.notes };
                }
                return tEx;
              });
              return { ...tpl, exercises: updatedTplExercises };
            });
          }

          return {
            templates: updatedTemplates,
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
          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(newHistory, allKnown);
          return {
            history: newHistory,
            userXP,
            muscleXP,
            currentStreak,
            highestStreak
          };
        });
      },

      updateHistoryWorkout: (workoutId, updates) => {
        set((state) => {
          const newHistory = state.history.map(w => w.id === workoutId ? { ...w, ...updates } : w);
          return { history: newHistory };
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

      advanceScienceWeek: () => set(state => {
        if (!state.scienceReport) return state;
        const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const weeksElapsed = Math.floor((now - state.scienceReport.timestamp) / MS_PER_WEEK);
        const currentWeek = Math.min(Math.max(1, weeksElapsed + 1), 12);
        
        if (currentWeek >= 12) return state; // Already at max week

        // Shift the timestamp so that the NEXT week starts exactly today (with the 12h buffer in mind)
        const newTimestamp = now - (currentWeek * MS_PER_WEEK);
        
        return {
          scienceReport: {
            ...state.scienceReport,
            timestamp: newTimestamp
          }
        };
      }),

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
