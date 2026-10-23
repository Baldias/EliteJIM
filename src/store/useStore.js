import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { calculateSessionScore, recalculateTotalXpFromHistory, calculateWeeklyStreak } from '../utils/gamification';
import { EXERCISES_DB, getAllExercises, normalizeName } from '../data/exercises';
import { parseNonNegativeInt } from '../utils/number';
import { estimate1RM, resolveBodyweight } from '../utils/oneRepMax';
import { DEFAULT_NUTRITION_GOALS } from '../utils/nutrition';
import { emptyScienceState, captureScienceExercises } from '../utils/scienceV3';
import { acknowledgeTrainingReminder, emptyTrainingReminder, isTrainingRecovery } from '../utils/trainingReminder';
import { hasLegacyScience } from '../utils/scienceV3';
import { scienceScoringReport } from '../utils/scienceMigration';
import { scienceTrackingEnabled } from '../utils/scienceEvolution';
import { SCIENCE_GLOWS, THEMES, THEME_SELECTION_VERSION, themePreferences } from '../utils/theme';
import { scienceActions } from './scienceStore';
import { existingFeaturePreferences } from '../utils/featurePreferences';

const MAX_RECENT_FOODS = 40;
import { IS_DEMO, STORAGE_KEY, getAppStorage } from '../demo/demoMode';
import { buildDemoState } from '../demo/demoData';

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
          name: 'Leg Day (Quadricipiti & Femorali)',
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
      scienceState: emptyScienceState(),
      ...scienceActions(set),
      // User bodyweight in kg (null = not set): used for the 1RM of pull-ups, dips, push-ups
      bodyweight: null,
      // Persistent rest timer end timestamp
      globalRestEndTime: null,

      // --- Diario (peso & alimentazione) ---
      // [{ date: 'YYYY-MM-DD', kg }] ordinato per data crescente
      weightLog: [],
      // { 'YYYY-MM-DD': { breakfast: [entry], lunch: [], dinner: [], snacks: [] } }
      // entry = { id, food: { name, brand, per100, servingSize, servingLabel, ... }, grams }
      foodDiary: {},
      nutritionGoals: DEFAULT_NUTRITION_GOALS,
      recentFoods: [],
      customFoods: [],
      // Test iniziale del Diario: completedAt = piano calcolato,
      // postponedAt = "più tardi" (non si riapre da solo), cardHidden = invito nascosto
      dietSetup: { completedAt: null, postponedAt: null, cardHidden: false },

      // --- Gamification State ---
      userXP: 0,
      muscleXP: {}, // Track XP per muscle group
      currentStreak: 0,
      highestStreak: 0,
      lastWorkoutDate: null,
      recapData: null,
      theme: 'science-v3',
      themeChosen: false,
      themeChoiceVersion: 0,
      scienceGlow: 'gold',
      chooseTheme: (theme, glow = get().scienceGlow) => { if (THEMES.includes(theme)) set({ theme, themeChosen: true, themeChoiceVersion: THEME_SELECTION_VERSION, scienceGlow: SCIENCE_GLOWS.some(g => g.id === glow) ? glow : get().scienceGlow }); },
      trainingReminder: emptyTrainingReminder(),
      acknowledgeTrainingReminder: (now = Date.now()) => set(state => {
        const next = acknowledgeTrainingReminder(state.trainingReminder, state.activeWorkout, now, isTrainingRecovery(state));
        return next === state.trainingReminder ? state : { trainingReminder:next };
      }),
      showScience: false,
      showDiary: false,
      // --- Backup & Storage State ---
      autoBackupEnabled: true,
      autoBackupFrequency: 'after_workout', // 'after_workout' | 'weekly' | 'monthly'
      lastBackupDate: null,
      dismissedBackupReminderUntil: null,
      isStoragePersisted: false,

      // Demo link: fake history in place of the empty defaults (see demo/demoMode.js)
      ...(IS_DEMO ? buildDemoState() : {}),

      // --- Backup & Storage Actions ---
      setAutoBackupSettings: (settings) => set((state) => ({ ...state, ...settings })),
      recordBackupExported: () => set({ lastBackupDate: Date.now(), dismissedBackupReminderUntil: null }),
      setStoragePersisted: (isPersisted) => set({ isStoragePersisted: isPersisted }),
      snoozeBackupReminder: (hours = 24) => set({ dismissedBackupReminderUntil: Date.now() + (hours * 60 * 60 * 1000) }),

      setBodyweight: (kg) => {
        const value = parseFloat(kg);
        set({ bodyweight: value > 0 ? Math.round(value * 10) / 10 : null });
      },

      // --- Diario Actions ---
      // Registra (o sostituisce) il peso di un giorno; il peso più recente
      // diventa anche il peso corporeo usato per il 1RM a corpo libero.
      addWeightEntry: (date, kg) => {
        const value = Math.round(parseFloat(kg) * 10) / 10;
        if (!date || !(value > 0)) return;
        set((state) => {
          const weightLog = [...(state.weightLog || []).filter(e => e.date !== date), { date, kg: value }]
            .sort((a, b) => a.date.localeCompare(b.date));
          return { weightLog, bodyweight: weightLog[weightLog.length - 1].kg };
        });
      },
      deleteWeightEntry: (date) => {
        set((state) => {
          const weightLog = (state.weightLog || []).filter(e => e.date !== date);
          const latest = weightLog[weightLog.length - 1];
          return { weightLog, ...(latest ? { bodyweight: latest.kg } : {}) };
        });
      },
      // Restituisce l'id della voce creata (serve per l'annullamento)
      addFoodEntry: (date, meal, food, grams) => {
        const g = parseFloat(grams);
        if (!date || !meal || !food || !(g > 0)) return null;
        const cleanFood = { ...food };
        delete cleanFood.lastGrams;
        const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, food: cleanFood, grams: g };
        set((state) => {
          const day = state.foodDiary?.[date] || {};
          const recentFoods = food.source === 'quick'
            ? state.recentFoods
            : [{ ...cleanFood, lastGrams: g }, ...(state.recentFoods || []).filter(f => f.id !== food.id)].slice(0, MAX_RECENT_FOODS);
          return {
            foodDiary: { ...state.foodDiary, [date]: { ...day, [meal]: [...(day[meal] || []), entry] } },
            recentFoods
          };
        });
        return entry.id;
      },
      // Aggiorna grammi e/o pasto di una voce già registrata
      updateFoodEntry: (date, meal, entryId, { grams, meal: newMeal }) => {
        set((state) => {
          const day = state.foodDiary?.[date];
          const entry = day?.[meal]?.find(e => e.id === entryId);
          if (!entry) return state;
          const updated = { ...entry, grams: parseFloat(grams) > 0 ? parseFloat(grams) : entry.grams };
          const target = newMeal || meal;
          const nextDay = { ...day };
          if (target === meal) {
            nextDay[meal] = day[meal].map(e => (e.id === entryId ? updated : e));
          } else {
            nextDay[meal] = day[meal].filter(e => e.id !== entryId);
            nextDay[target] = [...(day[target] || []), updated];
          }
          return { foodDiary: { ...state.foodDiary, [date]: nextDay } };
        });
      },
      deleteFoodEntry: (date, meal, entryId) => {
        set((state) => {
          const day = state.foodDiary?.[date];
          if (!day?.[meal]) return state;
          return { foodDiary: { ...state.foodDiary, [date]: { ...day, [meal]: day[meal].filter(e => e.id !== entryId) } } };
        });
      },
      // Rimette una voce appena eliminata nella stessa posizione (per "Annulla")
      restoreFoodEntry: (date, meal, entry, index) => {
        set((state) => {
          const day = state.foodDiary?.[date] || {};
          const list = [...(day[meal] || [])];
          list.splice(Math.min(Math.max(0, index), list.length), 0, entry);
          return { foodDiary: { ...state.foodDiary, [date]: { ...day, [meal]: list } } };
        });
      },
      copyMeal: (fromDate, toDate, meal) => {
        set((state) => {
          const source = state.foodDiary?.[fromDate]?.[meal] || [];
          if (source.length === 0) return state;
          const day = state.foodDiary?.[toDate] || {};
          const copies = source.map((e, i) => ({ ...e, id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}` }));
          return { foodDiary: { ...state.foodDiary, [toDate]: { ...day, [meal]: [...(day[meal] || []), ...copies] } } };
        });
      },
      setNutritionGoals: (goals) => set((state) => ({ nutritionGoals: { ...DEFAULT_NUTRITION_GOALS, ...state.nutritionGoals, ...goals } })),
      // Salva il piano del test; il peso indicato diventa la pesata di oggi
      // se per oggi non ce n'è già una
      completeDietSetup: (goals, { date, kg } = {}) => {
        set((state) => ({
          nutritionGoals: { ...DEFAULT_NUTRITION_GOALS, ...state.nutritionGoals, ...goals },
          dietSetup: { ...state.dietSetup, completedAt: Date.now(), cardHidden: false },
        }));
        if (date && kg > 0 && !(get().weightLog || []).some(e => e.date === date)) get().addWeightEntry(date, kg);
      },
      postponeDietSetup: () => set((state) => ({ dietSetup: { ...state.dietSetup, postponedAt: Date.now() } })),
      hideDietSetupCard: () => set((state) => ({ dietSetup: { ...state.dietSetup, cardHidden: true } })),
      // Aggiunge o aggiorna un alimento creato (anche un pasto composto);
      // la copia tra i recenti si aggiorna, con la porzione nuova per i pasti
      addCustomFood: (food) => set((state) => ({
        customFoods: [food, ...(state.customFoods || []).filter(f => f.id !== food.id)],
        recentFoods: (state.recentFoods || []).map(f => (f.id === food.id
          ? { ...food, lastGrams: food.source === 'recipe' && food.servingSize ? food.servingSize : f.lastGrams }
          : f)),
      })),
      deleteCustomFood: (foodId) => set((state) => ({
        customFoods: (state.customFoods || []).filter(f => f.id !== foodId),
        recentFoods: (state.recentFoods || []).filter(f => f.id !== foodId)
      })),

      // --- Gamification Actions ---
      clearRecapData: () => set({ recapData: null }),
      syncGamificationWithHistory: () => {
        set((state) => {
          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(state.history, allKnown, resolveBodyweight(state));
          return { userXP, muscleXP, currentStreak, highestStreak };
        });
      },

      // --- Rest Timer Actions ---
      setGlobalRestEndTime: (timestamp) => set({ globalRestEndTime: timestamp }),
      clearGlobalRestTimer: () => set({ globalRestEndTime: null }),

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
      toggleDiary: () => set((state) => ({ showDiary: !state.showDiary })),
      
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
            restTime: parseNonNegativeInt(ex.restTime, 90),
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
              restTime: parseNonNegativeInt(ex.restTime, 60),
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

      finishWorkout: () => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const completedWorkout = {
            ...state.activeWorkout,
            endTime: Date.now()
          };

          const allKnown = getAllExercises(state.customExercises, state.exerciseOverrides);
          const sessionScore = calculateSessionScore(completedWorkout, state.history, allKnown, scienceScoringReport(state), resolveBodyweight(state));
          
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
            ...(scienceTrackingEnabled(state) ? { scienceState: captureScienceExercises(state.scienceState, completedWorkout, allKnown) } : {}),
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
        if (!hasLegacyScience(state.scienceReport, state.scienceState)) return state;
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
      name: STORAGE_KEY, // demo mode uses its own key in sessionStorage
      storage: createJSONStorage(getAppStorage),
      merge: (saved, current) => ({ ...current, ...saved, ...existingFeaturePreferences(saved), ...themePreferences(saved), trainingReminder: saved?.trainingReminder || emptyTrainingReminder() }),
    }
  )
);
