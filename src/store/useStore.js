import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateSessionScore, recalculateTotalXpFromHistory, calculateWeeklyStreak } from '../utils/gamification';
import { EXERCISES_DB, getAllExercises, normalizeName } from '../data/exercises';
import { estimate1RM, resolveBodyweight } from '../utils/oneRepMax';

// Only completed sets are real performances: skipped sets keep the values
// pre-filled from the previous session and must not count as "last" or PR.
const completedSets = (exercise) => (exercise?.sets || []).filter(s => s.done);

// Most recent session (history is newest first) where the exercise has completed sets.
// `bodyweightLoad` is the bodyweight moved by the exercise (see getBodyweightLoad).
export const findLastBest1RMSet = (history, exerciseName, bodyweightLoad = 0) => {
  if (!exerciseName || !history || history.length === 0) return null;
  const norm = normalizeName(exerciseName);
  for (const w of history) {
    const pastEx = w.exercises?.find(e => normalizeName(e.name) === norm);
    const doneSets = completedSets(pastEx);
    if (doneSets.length > 0) {
      let maxSet = null;
      let max1RM = -1;
      for (const s of doneSets) {
        const rm = estimate1RM(s.kg, s.reps, bodyweightLoad);
        if (rm > max1RM) {
          max1RM = rm;
          maxSet = s;
        }
      }
      if (!maxSet) maxSet = doneSets[doneSets.length - 1];
      return {
        set: maxSet,
        max1RM: max1RM > 0 ? parseFloat(max1RM.toFixed(1)) : 0,
        notes: pastEx.notes || ''
      };
    }
  }
  return null;
};

export const findAllTimeBest1RMSet = (history, exerciseName, bodyweightLoad = 0) => {
  if (!exerciseName || !history || history.length === 0) return null;
  const norm = normalizeName(exerciseName);
  let allTimeMaxSet = null;
  let allTimeMax1RM = -1;
  let allTimeNotes = '';

  for (const w of history) {
    const pastEx = w.exercises?.find(e => normalizeName(e.name) === norm);
    for (const s of completedSets(pastEx)) {
      const rm = estimate1RM(s.kg, s.reps, bodyweightLoad);
      if (rm > allTimeMax1RM) {
        allTimeMax1RM = rm;
        allTimeMaxSet = s;
        allTimeNotes = pastEx.notes || '';
      }
    }
  }

  if (!allTimeMaxSet || allTimeMax1RM <= 0) return null;
  return {
    set: allTimeMaxSet,
    max1RM: parseFloat(allTimeMax1RM.toFixed(1)),
    notes: allTimeNotes
  };
};

export const getExercise1RMStats = (history, exerciseName, bodyweightLoad = 0) => {
  const lastSession = findLastBest1RMSet(history, exerciseName, bodyweightLoad);
  const allTime = findAllTimeBest1RMSet(history, exerciseName, bodyweightLoad);
  return { lastSession, allTime };
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
            { name: 'Panca Piana Bilanciere', setsCount: 3, targetReps: '8-10' },
            { name: 'Military Press', setsCount: 3, targetReps: '8-10' },
            { name: 'Alzate Laterali Manubri', setsCount: 3, targetReps: '12-15' },
            { name: 'Pushdown Tricipiti ai Cavi', setsCount: 3, targetReps: '12-15' }
          ]
        },
        {
          id: 'tpl-2',
          name: 'Trazione (Dorso/Bicipiti)',
          exercises: [
            { name: 'Trazioni alla Sbarra (Pull-up)', setsCount: 3, targetReps: '6-8' },
            { name: 'Rematore con Bilanciere', setsCount: 3, targetReps: '8-10' },
            { name: 'Pulley Basso', setsCount: 3, targetReps: '10-12' },
            { name: 'Curl Bilanciere', setsCount: 3, targetReps: '10-12' }
          ]
        },
        {
          id: 'tpl-3',
          name: 'Leg Day (Quadricipiti & Femorali)',
          exercises: [
            { name: 'Squat con Bilanciere', setsCount: 3, targetReps: '6-8' },
            { name: 'Leg Extension', setsCount: 3, targetReps: '12-15' },
            { name: 'Leg Curl', setsCount: 3, targetReps: '12-15' },
            { name: 'Calf Raise Seduto', setsCount: 3, targetReps: '15-20' }
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
      // User bodyweight in kg (null = not set): used for the 1RM of pull-ups, dips, push-ups
      bodyweight: null,

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

      setBodyweight: (kg) => {
        const value = parseFloat(kg);
        set({ bodyweight: value > 0 ? Math.round(value * 10) / 10 : null });
      },

      // --- Gamification Actions ---
      clearRecapData: () => set({ recapData: null }),
      syncGamificationWithHistory: () => {
        set((state) => {
          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(state.history, allKnown, resolveBodyweight(state));
          return { userXP, muscleXP, currentStreak, highestStreak };
        });
      },

      // --- Science Actions ---
      saveScienceReport: (report) => set({ scienceReport: report }),
      startScienceMesocycle: (startDateTimestamp) => set(state => {
        if (!state.scienceReport) return state;
        const start = startDateTimestamp || Date.now();
        return {
          scienceReport: {
            ...state.scienceReport,
            status: 'active',
            startDate: start,
            currentWeek: 1,
            currentWeekStartDate: start,
            weekHistory: state.scienceReport.weekHistory || {}
          }
        };
      }),
      completeScienceMesocycle: () => set(state => {
        if (!state.scienceReport) return state;
        return {
          scienceReport: {
            ...state.scienceReport,
            status: 'completed'
          }
        };
      }),
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
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(nextHistory, updatedAllExercises, resolveBodyweight(state));

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
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(nextHistory, updatedAllExercises, resolveBodyweight(state));

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
      importTemplates: (newTemplates) => {
        const list = Array.isArray(newTemplates) ? newTemplates : [newTemplates];
        if (list.length === 0) return 0;
        const normalizedList = list.map((t, idx) => ({
          ...t,
          id: `tpl-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          name: (t.name || 'Scheda Importata').trim(),
          exercises: (t.exercises || []).map(ex => ({
            name: (ex.name || '').trim(),
            setsCount: parseInt(ex.setsCount) || 3,
            targetReps: String(ex.targetReps || '8-10').trim(),
            notes: (ex.notes || '').trim()
          }))
        }));
        set((state) => ({ templates: [...(state.templates || []), ...normalizedList] }));
        return normalizedList.length;
      },

      // --- Workout Actions ---
      startWorkout: (template) => {
        const history = get().history;

        // Helper: completed working sets (no drop sets) of the most recent session with this exercise
        const findLastSets = (exerciseName) => {
          const norm = normalizeName(exerciseName);
          for (const w of history) {
            const pastEx = w.exercises?.find(e => normalizeName(e.name) === norm);
            const workingSets = completedSets(pastEx).filter(s => !s.isDropset);
            if (workingSets.length > 0) {
              return workingSets;
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

      finishWorkout: () => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const completedWorkout = {
            ...state.activeWorkout,
            endTime: Date.now()
          };

          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const sessionScore = calculateSessionScore(completedWorkout, state.history, allKnown, state.scienceReport, resolveBodyweight(state));
          
          const updatedHistory = [completedWorkout, ...state.history];
          const { currentStreak: newStreak, highestStreak: calculatedHighest } = calculateWeeklyStreak(updatedHistory);
          const highestStreak = Math.max(state.highestStreak || 0, calculatedHighest, newStreak);
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
            history: updatedHistory,
            activeWorkout: null,
            userXP: newXP,
            muscleXP: newMuscleXP,
            currentStreak: newStreak,
            highestStreak,
            lastWorkoutDate: Date.now(),
            recapData
          };
        });
      },

      cancelWorkout: () => set({ activeWorkout: null }),

      deleteWorkout: (workoutId) => {
        set((state) => {
          const newHistory = state.history.filter(w => w.id !== workoutId);
          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(newHistory, allKnown, resolveBodyweight(state));
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
          // Keep history newest-first: "last session" lookups and pre-fill rely on it
          const newHistory = state.history
            .map(w => w.id === workoutId ? { ...w, ...updates } : w)
            .sort((a, b) => (Number(b.startTime) || 0) - (Number(a.startTime) || 0));
          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(newHistory, allKnown, resolveBodyweight(state));
          const latest = newHistory[0];
          return {
            history: newHistory,
            userXP,
            muscleXP,
            currentStreak,
            highestStreak,
            lastWorkoutDate: latest ? (Number(latest.endTime) || Number(latest.startTime) || null) : null
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

      advanceScienceWeek: () => set(state => {
        if (!state.scienceReport) return state;
        const currentW = state.scienceReport.currentWeek || 1;
        const now = Date.now();
        const weekStart = state.scienceReport.currentWeekStartDate || state.scienceReport.startDate || state.scienceReport.timestamp;

        const updatedHistory = {
          ...(state.scienceReport.weekHistory || {}),
          [currentW]: {
            startDate: weekStart,
            completedDate: now
          }
        };

        if (currentW >= 12) {
          return {
            scienceReport: {
              ...state.scienceReport,
              status: 'completed',
              weekHistory: updatedHistory
            }
          };
        }

        return {
          scienceReport: {
            ...state.scienceReport,
            currentWeek: currentW + 1,
            currentWeekStartDate: now,
            weekHistory: updatedHistory
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
