import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { emptyScienceState } from '../src/utils/scienceV3';
import {
  WEIGHT_TREND_DAYS,
  weightTrend,
  defaultMealForHour,
  frequentFoods,
} from '../src/utils/nutrition';
import { rangeStart, smoothedChange } from '../src/utils/progressRange';
import {
  SPLITS_BY_DAYS,
  SPLIT_MUSCLES,
  MUSCLE_SIZE_ORDER,
  muscleExerciseBounds,
  rankExercisesForMuscle,
  resolveUserGender,
  splitMusclesForSplit,
  buildSplitTemplates,
  findCompletedWorkoutThisWeek,
  isTemplateCompletedThisWeek,
  resolveDynamicTemplate,
} from '../src/utils/splits';
import { EXERCISES_DB } from '../src/data/exercises';

const original = useStore.getInitialState();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useStore.setState({ ...original, history: [], archivedTemplates: [], scienceState: emptyScienceState() }, true);
});

describe('1. default rest timer 90s', () => {
  it('defaults exercise restTime to 90s on startWorkout and addExerciseToActiveSession', () => {
    useStore.getState().startWorkout({
      id: 'tpl-custom',
      name: 'Test',
      exercises: [{ name: 'Panca Piana Bilanciere', setsCount: 3, targetReps: '8-10' }],
    });
    expect(useStore.getState().activeWorkout.exercises[0].restTime).toBe(90);

    useStore.getState().addExerciseToActiveSession('Curl Bilanciere');
    expect(useStore.getState().activeWorkout.exercises[1].restTime).toBe(90);
  });
});

describe('3. progress range and smoothed 1RM change', () => {
  it('computes smoothed percentage change using first k vs last k sessions', () => {
    const res = smoothedChange([100, 102, 104, 110, 112, 114], 3);
    expect(res.k).toBe(3);
    expect(res.start).toBeCloseTo(102, 5);
    expect(res.end).toBeCloseTo(112, 5);
    expect(res.pct).toBeCloseTo(((112 - 102) / 102) * 100, 5);

    const small = smoothedChange([80, 88], 3);
    expect(small.k).toBe(1);
    expect(small.pct).toBeCloseTo(10, 5);
    expect(smoothedChange([80])).toBeNull();
  });

  it('computes window starts for 1m, 3m, 6m, 1y, and max', () => {
    const now = new Date(2026, 10, 17, 12, 0, 0).getTime();
    expect(rangeStart('max', now)).toBe(-Infinity);
    expect(rangeStart('1m', now)).toBeLessThan(now);
    expect(rangeStart('3m', now)).toBeLessThan(rangeStart('1m', now));
    expect(rangeStart('6m', now)).toBeLessThan(rangeStart('3m', now));
    expect(rangeStart('1y', now)).toBeLessThan(rangeStart('6m', now));
  });
});

describe('4. 7-day moving average weight trend ignoring skipped days', () => {
  it('averages only actual weigh-in entries inside the 7-day window', () => {
    expect(WEIGHT_TREND_DAYS).toBe(7);
    const log = [
      { date: '2026-11-01', kg: 80.0 },
      { date: '2026-11-04', kg: 79.0 }, // within 7 days of Nov 1 -> (80 + 79)/2 = 79.5
      { date: '2026-11-07', kg: 78.0 }, // within 7 days of Nov 1 (diff=6) -> (80+79+78)/3 = 79.0
      { date: '2026-11-10', kg: 78.6 }, // Nov 1 dropped (diff=9>=7), Nov 4 (diff=6) & Nov 7 (diff=3) stay -> (79+78+78.6)/3 = 78.53
      { date: '2026-11-25', kg: 77.0 }, // all earlier weigh-ins >7 days old -> 77.0
    ];
    const out = weightTrend(log);
    expect(out.map(x => x.trend)).toEqual([80, 79.5, 79, 78.53, 77]);
  });
});

describe('5. frequent foods & default meal by hour', () => {
  it('suggests the right default meal for the hour of day', () => {
    expect(defaultMealForHour(8)).toBe('breakfast');
    expect(defaultMealForHour(13)).toBe('lunch');
    expect(defaultMealForHour(16)).toBe('snacks');
    expect(defaultMealForHour(20)).toBe('dinner');
  });

  it('ranks frequent foods and picks the most commonly used dose', () => {
    const oats = { id: 'oats', name: 'Fiocchi d\'avena', per100: { kcal: 370, protein: 13 } };
    const chicken = { id: 'chk', name: 'Petto di pollo', per100: { kcal: 110, protein: 23 } };
    const pasta = { id: 'pasta', name: 'Pasta', per100: { kcal: 350, protein: 12 } };
    const almonds = { id: 'almonds', name: 'Mandorle', per100: { kcal: 580, protein: 21 } };
    const quick = { id: 'q1', name: 'Extra', source: 'quick', per100: { kcal: 100 } };

    const diary = {
      '2026-11-10': { breakfast: [{ id: '1', food: oats, grams: 60 }], lunch: [{ id: '2', food: chicken, grams: 150 }] },
      '2026-11-11': { breakfast: [{ id: '3', food: oats, grams: 80 }], dinner: [{ id: '4', food: quick, grams: 100 }, { id: '6', food: pasta, grams: 120 }], snacks: [{ id: '7', food: almonds, grams: 25 }] },
      '2026-11-12': { breakfast: [{ id: '5', food: oats, grams: 80 }], lunch: [{ id: '8', food: pasta, grams: 120 }] },
    };

    const result = frequentFoods(diary, [], 5);
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ food: oats, grams: 80, count: 3 });

    // Meal-specific filtering: breakfast vs unified lunch+dinner vs snacks
    const breakfastItems = frequentFoods(diary, [], 8, 'breakfast');
    expect(breakfastItems.map(i => i.food.id)).toEqual(['oats']);
    expect(breakfastItems[0].grams).toBe(80);

    const lunchItems = frequentFoods(diary, [], 8, 'lunch');
    const dinnerItems = frequentFoods(diary, [], 8, 'dinner');
    expect(lunchItems).toEqual(dinnerItems);
    expect(lunchItems.map(i => i.food.id)).toEqual(['pasta', 'chk']);

    const snackItems = frequentFoods(diary, [], 8, 'snacks');
    expect(snackItems.map(i => i.food.id)).toEqual(['almonds']);
  });
});

describe('6. splits generator, archive & dynamic Science sync', () => {
  it('ranks frequently performed exercises first for a muscle', () => {
    const history = [
      { id: 1, startTime: 1000, exercises: [{ name: 'Croci ai Cavi', sets: [{ done: true, kg: 20, reps: 12 }] }] },
      { id: 2, startTime: 2000, exercises: [{ name: 'Croci ai Cavi', sets: [{ done: true, kg: 20, reps: 12 }] }] },
    ];
    const ranked = rankExercisesForMuscle('Petto', EXERCISES_DB, history);
    expect(ranked[0].name).toBe('Croci ai Cavi');
    expect(ranked[0].count).toBe(2);
    expect(ranked[0].isFrequent).toBe(true);
  });

  it('distributes chosen exercises across split days and archives old templates on creation', () => {
    const split5 = SPLITS_BY_DAYS[5][0]; // Push / Pull / Legs / Upper / Lower
    const selectedByMuscle = Object.fromEntries(
      SPLIT_MUSCLES.map(m => [m, rankExercisesForMuscle(m, EXERCISES_DB, []).slice(0, 3).map(e => e.name)])
    );
    const built = buildSplitTemplates({ split: split5, selectedByMuscle, scienceSync: true, now: 1700000000000 });
    expect(built).toHaveLength(5);
    expect(built.every(t => t.scienceSync && t.splitGroupId === 'split-1700000000000')).toBe(true);

    // Every selected chest exercise should appear across Push + Upper
    const chestInSplit = new Set(
      built.flatMap(t => t.exercises).filter(e => e.muscle === 'Petto').map(e => e.name)
    );
    for (const name of selectedByMuscle.Petto) expect(chestInSplit.has(name)).toBe(true);

    const oldIds = useStore.getState().templates.map(t => t.id);
    useStore.getState().createSplitTemplates(built, { archiveExisting: true });
    expect(useStore.getState().templates).toHaveLength(5);
    expect(useStore.getState().archivedTemplates.map(t => t.id)).toEqual(oldIds);

    useStore.getState().restoreArchivedTemplate(oldIds[0]);
    expect(useStore.getState().templates.some(t => t.id === oldIds[0])).toBe(true);
    expect(useStore.getState().archivedTemplates.some(t => t.id === oldIds[0])).toBe(false);

    useStore.getState().deleteArchivedTemplate(oldIds[1]);
    expect(useStore.getState().archivedTemplates.some(t => t.id === oldIds[1])).toBe(false);
  });

  it('dynamically adjusts remaining Science sets across remaining sessions and marks finished templates green for the week', () => {
    const weekStart = new Date(2026, 10, 16, 0, 0, 0).getTime(); // Monday
    const now = weekStart + 2 * 3600 * 1000;
    const split5 = SPLITS_BY_DAYS[5][0]; // Push & Upper train Petto
    const selectedByMuscle = Object.fromEntries(
      SPLIT_MUSCLES.map(m => [m, rankExercisesForMuscle(m, EXERCISES_DB, []).slice(0, 2).map(e => e.name)])
    );
    const built = buildSplitTemplates({ split: split5, selectedByMuscle, scienceSync: true, now: weekStart });

    // Start Science V3 and set Petto target to 12 weekly sets
    useStore.getState().createSplitTemplates(built, { archiveExisting: true });
    useStore.getState().startScienceV3({ experience: 'intermediate', goal: 'balanced', daysPerWeek: 5, minutesPerSession: 60, startDate: weekStart }, weekStart);
    useStore.getState().setScienceTarget('Petto', 12);

    const pushTpl = built[0];
    const upperTpl = built[3];

    // Before completing Push: 12 remaining chest sets distributed across Push + Upper,
    // and all 5 split sessions stay balanced without 12-vs-25 spikes.
    const beforePush = resolveDynamicTemplate(pushTpl, useStore.getState(), now);
    const beforeUpper = resolveDynamicTemplate(upperTpl, useStore.getState(), now);
    const pushChestBefore = beforePush.exercises.filter(e => e.muscle === 'Petto').reduce((s, e) => s + e.setsCount, 0);
    const upperChestBefore = beforeUpper.exercises.filter(e => e.muscle === 'Petto').reduce((s, e) => s + e.setsCount, 0);
    expect(pushChestBefore + upperChestBefore).toBe(12);

    const sessionTotals = built.map(t => resolveDynamicTemplate(t, useStore.getState(), now).exercises.reduce((s, e) => s + e.setsCount, 0));
    expect(Math.max(...sessionTotals) - Math.min(...sessionTotals)).toBeLessThanOrEqual(4);
    expect(isTemplateCompletedThisWeek(pushTpl, useStore.getState(), now)).toBe(false);

    // Log Push with 7 completed chest sets
    useStore.setState({
      history: [{
        id: 'w-push',
        templateId: pushTpl.id,
        name: pushTpl.name,
        startTime: weekStart + 3600 * 1000,
        endTime: weekStart + 5400 * 1000,
        exercises: [
          { id: 1, name: selectedByMuscle.Petto[0], sets: Array.from({ length: 4 }, (_, i) => ({ id: i + 1, kg: 80, reps: 8, done: true })) },
          { id: 2, name: selectedByMuscle.Petto[1], sets: Array.from({ length: 3 }, (_, i) => ({ id: i + 10, kg: 30, reps: 10, done: true })) },
        ],
      }],
    });

    // Push is marked completed this week; Upper scales remaining 12 - 7 = 5 chest sets onto Upper's 1 remaining chest session!
    expect(isTemplateCompletedThisWeek(pushTpl, useStore.getState(), now)).toBe(true);
    expect(findCompletedWorkoutThisWeek(pushTpl, useStore.getState(), now)?.id).toBe('w-push');
    expect(isTemplateCompletedThisWeek(upperTpl, useStore.getState(), now)).toBe(false);

    const upperAfter = resolveDynamicTemplate(upperTpl, useStore.getState(), now);
    const upperChestSets = upperAfter.exercises.filter(e => e.muscle === 'Petto').reduce((s, e) => s + e.setsCount, 0);
    expect(upperChestSets).toBe(5);
  });

  it('allows 1 exercise for Polpacci, 0 for Glutei/Addome, omits empty muscles from templates, and hides Glutei for male users', () => {
    expect(muscleExerciseBounds('Addome')).toEqual({ min: 0, max: 4 });
    expect(muscleExerciseBounds('Polpacci')).toEqual({ min: 1, max: 4 });
    expect(muscleExerciseBounds('Glutei')).toEqual({ min: 0, max: 4 });
    expect(muscleExerciseBounds('Petto')).toEqual({ min: 2, max: 4 });

    const split5 = SPLITS_BY_DAYS[5][0];
    expect(resolveUserGender({ nutritionGoals: { profile: { sex: 'male' } } })).toBe('male');
    expect(splitMusclesForSplit(split5, 'male')).not.toContain('Glutei');
    expect(splitMusclesForSplit(split5, 'female')).toContain('Glutei');
    expect(splitMusclesForSplit(split5, 'unspecified')).toContain('Glutei');

    const built = buildSplitTemplates({
      split: split5,
      selectedByMuscle: {
        Petto: ['Panca Piana Bilanciere', 'Croci ai Cavi'],
        Dorso: ['Lat Machine Avanti', 'Pulley Basso'],
        Spalle: ['Military Press', 'Alzate Laterali Manubri'],
        Quadricipiti: ['Squat con Bilanciere', 'Leg Extension'],
        Femorali: ['Leg Curl', 'Stacchi Rumeni (RDL)'],
        Glutei: [],
        Bicipiti: ['Curl Bilanciere', 'Hammer Curl'],
        Tricipiti: ['Pushdown Tricipiti ai Cavi', 'French Press'],
        Polpacci: ['Calf Raise Seduto'],
        Addome: [],
      },
      now: 1700000000000,
    });
    const legs = built.find(t => t.name.startsWith('Legs'));
    expect(legs.name).not.toContain('Glutei');
    expect(legs.exercises.some(e => e.muscle === 'Glutei')).toBe(false);
    expect(legs.exercises.filter(e => e.muscle === 'Polpacci')).toHaveLength(1);

    const pull = built.find(t => t.name.startsWith('Pull'));
    expect(pull.name).not.toContain('Addome');
    expect(pull.exercises.some(e => e.muscle === 'Addome')).toBe(false);
  });

  it('orders muscles from largest to smallest and compounds before isolations', () => {
    const splitBro = SPLITS_BY_DAYS[5][1]; // includes Braccia & Richiamo: ['Bicipiti', 'Tricipiti', 'Petto', 'Dorso']
    const customExercises = [
      ...EXERCISES_DB,
      { id: 'cust-1', name: 'Leg Press Inclinata', category: 'Quadricipiti', equipmentType: 'machine', isCustom: true },
    ];
    const built = buildSplitTemplates({
      split: splitBro,
      allExercises: customExercises,
      selectedByMuscle: {
        Petto: ['Croci ai Cavi', 'Panca Piana Bilanciere'],
        Dorso: ['Pullover ai Cavi', 'Rematore con Bilanciere'],
        Spalle: ['Alzate Laterali Manubri', 'Military Press'],
        Quadricipiti: ['Leg Extension', 'Leg Press Inclinata', 'Squat con Bilanciere'],
        Femorali: ['Leg Curl', 'Stacchi Rumeni (RDL)'],
        Glutei: [],
        Bicipiti: ['Curl ai Cavi', 'Curl Bilanciere'],
        Tricipiti: ['Pushdown Tricipiti ai Cavi', 'Dip alla Panca'],
        Polpacci: ['Calf Raise Seduto'],
        Addome: ['Crunch a Terra'],
      },
      now: 1700000000000,
    });

    const legs = built.find(t => t.name.startsWith('Gambe'));
    const quadNames = legs.exercises.filter(e => e.muscle === 'Quadricipiti').map(e => e.name);
    // Compounds (Squat, Leg Press Inclinata) strictly precede isolation (Leg Extension)
    expect(quadNames.indexOf('Squat con Bilanciere')).toBeLessThan(quadNames.indexOf('Leg Press Inclinata'));
    expect(quadNames.indexOf('Leg Press Inclinata')).toBeLessThan(quadNames.indexOf('Leg Extension'));

    // Muscle groups strictly ordered from largest to smallest
    const legsRanks = legs.exercises.map(e => MUSCLE_SIZE_ORDER.indexOf(e.muscle));
    expect(legsRanks).toEqual([...legsRanks].sort((a, b) => a - b));

    const richiamo = built.find(t => t.name.startsWith('Braccia & Richiamo'));
    const richiamoRanks = richiamo.exercises.map(e => MUSCLE_SIZE_ORDER.indexOf(e.muscle));
    expect(richiamoRanks).toEqual([...richiamoRanks].sort((a, b) => a - b));
    expect(richiamo.exercises[0].muscle).toBe('Dorso');
    expect(richiamo.exercises[0].name).toBe('Rematore con Bilanciere');
  });
});
