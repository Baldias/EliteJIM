export const RANKS = [
  { level: 0, title: 'Rame III', minXp: 0, color: '#B87333' },
  { level: 1, title: 'Rame II', minXp: 1000, color: '#B87333' },
  { level: 2, title: 'Rame I', minXp: 2000, color: '#B87333' },
  { level: 3, title: 'Bronzo III', minXp: 3500, color: '#CD7F32' },
  { level: 4, title: 'Bronzo II', minXp: 5000, color: '#CD7F32' },
  { level: 5, title: 'Bronzo I', minXp: 7000, color: '#CD7F32' },
  { level: 6, title: 'Argento III', minXp: 10000, color: '#C0C0C0' },
  { level: 7, title: 'Argento II', minXp: 13000, color: '#C0C0C0' },
  { level: 8, title: 'Argento I', minXp: 17000, color: '#C0C0C0' },
  { level: 9, title: 'Oro III', minXp: 22000, color: '#FFD700' },
  { level: 10, title: 'Oro II', minXp: 28000, color: '#FFD700' },
  { level: 11, title: 'Oro I', minXp: 35000, color: '#FFD700' },
  { level: 12, title: 'Platino III', minXp: 45000, color: '#E5E4E2' },
  { level: 13, title: 'Platino II', minXp: 55000, color: '#E5E4E2' },
  { level: 14, title: 'Platino I', minXp: 70000, color: '#E5E4E2' },
  { level: 15, title: 'Diamante III', minXp: 90000, color: '#b9f2ff' },
  { level: 16, title: 'Diamante II', minXp: 115000, color: '#b9f2ff' },
  { level: 17, title: 'Diamante I', minXp: 150000, color: '#b9f2ff' },
  { level: 18, title: 'Champion', minXp: 250000, color: '#ff2d55' }, // Elite
];

export const getRankByXp = (xp) => {
  let currentRank = RANKS[0];
  let nextRank = RANKS[1];

  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) {
      currentRank = RANKS[i];
      nextRank = RANKS[i + 1] || null;
    } else {
      break;
    }
  }

  let progressPercent = 100;
  if (nextRank) {
    const range = nextRank.minXp - currentRank.minXp;
    const progress = xp - currentRank.minXp;
    progressPercent = (progress / range) * 100;
  }

  return {
    ...currentRank,
    nextRank,
    progressPercent
  };
};

export const getMuscleLevelByXp = (xp) => {
  // Base XP to reach Lv. 2 is 500. This grows by 20% each level.
  // At 80 XP/set with overload: ~7 sets to reach Lv. 2, ~14 sets for Lv. 3, etc.
  // A guy with 100kg x 8 earns 2x more XP than one with 50kg x 8 on the same sets.
  let level = 1;
  let currentTierBaseXP = 500;
  let xpNeededForNext = currentTierBaseXP;
  let remainingXp = xp || 0;

  while (remainingXp >= xpNeededForNext) {
    remainingXp -= xpNeededForNext;
    level++;
    xpNeededForNext = Math.floor(xpNeededForNext * 1.2); // +20% XP required per level
  }
  
  return {
    level,
    xpInCurrentLevel: remainingXp,
    xpNeededForNext,
    progressPercent: (remainingXp / xpNeededForNext) * 100
  };
};

export const calculateSessionScore = (workout, pastHistory, exercisesDb = []) => {
  if (!workout || !workout.exercises || workout.exercises.length === 0) {
    return { xp: 0, grade: 'D', setsPerHour: 0, breakdown: [], muscleXpGained: {} };
  }

  const durationMs = workout.endTime - workout.startTime;
  const durationHours = durationMs / (1000 * 60 * 60);
  
  let doneSets = 0;
  let totalVolume = 0;
  let overloadCount = 0;
  const rawMuscleXp = {};
  // --- PASS 1: Determine which exercises achieved progressive overload ---
  const overloadedExercises = new Set();
  
  // Flatten exercisesDb and any others passed (like customExercises)
  const allKnownExercises = Array.isArray(exercisesDb) ? exercisesDb : [];
  
  // Map for fast lookup of categories [primary, ...secondary]
  const exerciseMetaMap = {};
  allKnownExercises.forEach(ex => {
    const cats = [ex.category];
    if (ex.secondaryCategories) cats.push(...ex.secondaryCategories);
    exerciseMetaMap[ex.name] = cats.filter(Boolean);
  });

  workout.exercises.forEach(ex => {
    if (pastHistory && pastHistory.length > 0) {
      const pastWorkout = pastHistory.find(w => w.exercises.some(e => e.name === ex.name));
      if (pastWorkout) {
        const pastEx = pastWorkout.exercises.find(e => e.name === ex.name);
        const pastVolume = pastEx.sets
          .filter(s => s.done && !s.isDropset)
          .reduce((acc, s) => acc + ((parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0)), 0);
        const currentVolume = ex.sets
          .filter(s => s.done && !s.isDropset)
          .reduce((acc, s) => acc + ((parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0)), 0);
        if (currentVolume > pastVolume && pastVolume > 0) {
          overloadedExercises.add(ex.name);
          overloadCount++;
        }
      }
    }
  });

  // --- PASS 2: Assign XP per set based on absolute tonnage ---
  workout.exercises.forEach(ex => {
    const categories = exerciseMetaMap[ex.name] || [];
    const hadOverload = overloadedExercises.has(ex.name);

    ex.sets.forEach(set => {
      if (set.done && !set.isDropset) {
        doneSets++;
        const kg = parseFloat(set.kg) || 0;
        const reps = parseInt(set.reps, 10) || 0;
        totalVolume += kg * reps;

        if (categories.length > 0) {
          const setXp = hadOverload ? Math.round((kg * reps) / 10) : 5;
          
          // Distribute XP among all muscles (primary gets 100%, secondary gets 100% too for simplicity/fun)
          categories.forEach(cat => {
            rawMuscleXp[cat] = (rawMuscleXp[cat] || 0) + setXp;
          });
        }
      }
    });
  });

  const setsPerHour = durationHours > 0 ? (doneSets / durationHours) : 0;
  
  // --- GRADE CALCULATION ---
  // Based on: overload ratio + adequate volume
  // NOT based on pacing (how fast you did the workout — irrelevant)
  
  const totalExercises = workout.exercises.length;
  const overloadedCount = overloadedExercises.size;
  const overloadRatio = totalExercises > 0 ? overloadedCount / totalExercises : 0;

  // "Junk volume" = fewer than 5 sets completed (basically nothing done)
  const isJunk = doneSets < 5;
  // "First timer" = no history to compare against (all exercises are new)
  const allNew = totalExercises > 0 && overloadedCount === 0 && 
    workout.exercises.every(ex => !pastHistory?.find(w => w.exercises.some(e => e.name === ex.name)));

  let grade;
  let gradeLabel;

  if (isJunk) {
    // Junk volume — barely any sets, no real training stimulus
    grade = 'D';
    gradeLabel = 'Volume Insufficiente';
  } else if (allNew) {
    // First time doing all these exercises — give them a B as baseline
    grade = 'B';
    gradeLabel = 'Prima Sessione';
  } else if (overloadRatio >= 0.8) {
    // 80%+ of exercises had progressive overload — exceptional
    grade = 'S';
    gradeLabel = 'Sovraccarico Totale';
  } else if (overloadRatio >= 0.5) {
    // More than half the exercises had overload — excellent
    grade = 'A';
    gradeLabel = 'Grande Progressione';
  } else if (overloadRatio > 0) {
    // Some overload, decent session
    grade = 'B';
    gradeLabel = 'Qualche Progressione';
  } else {
    // Stagnazione — no overload on any tracked exercise
    // Only give C if volume was at least decent
    grade = doneSets >= 10 ? 'C' : 'D';
    gradeLabel = doneSets >= 10 ? 'Mantenimento (Nessun Overload)' : 'Junk Volume';
  }

  // XP Calculation — primarily driven by muscle XP (which is based on tonnage)
  let xp = 0;
  const baseXP = doneSets * 30; // Only 30 base XP per set for account-level XP
  xp += baseXP;

  const overloadXP = overloadedCount * 200;
  xp += overloadXP;

  // Grade Multiplier
  let gradeMult = 1;
  if (grade === 'S') gradeMult = 1.5;
  if (grade === 'A') gradeMult = 1.25;
  if (grade === 'B') gradeMult = 1.0;
  if (grade === 'C') gradeMult = 0.8;
  if (grade === 'D') gradeMult = 0.4;

  xp = Math.round(xp * gradeMult);

  // Apply grade multiplier to muscle XP as well
  const muscleXpGained = {};
  Object.keys(rawMuscleXp).forEach(cat => {
    muscleXpGained[cat] = Math.round(rawMuscleXp[cat] * gradeMult);
  });

  const breakdown = [
    { label: gradeLabel, value: `Grado ${grade}` },
    { label: 'Serie Completate', value: `+${baseXP} XP` },
    ...(overloadedCount > 0 ? [{ label: `Sovraccarico su ${overloadedCount} esercizi`, value: `+${overloadXP} XP` }] : []),
    ...(gradeMult !== 1 ? [{ label: `Moltiplicatore Grado`, value: `×${gradeMult}` }] : [])
  ];

  return {
    xp,
    grade,
    setsPerHour: setsPerHour.toFixed(1),
    doneSets,
    overloadCount,
    breakdown,
    muscleXpGained
  };
};

export const checkStreakInactivity = (lastWorkoutDateMs, currentStreak, xp) => {
  if (!lastWorkoutDateMs) return { newStreak: 0, newXp: xp, penalty: 0 };
  
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const daysInactive = Math.floor((Date.now() - lastWorkoutDateMs) / MS_PER_DAY);
  
  let newStreak = currentStreak;
  let newXp = xp;
  let penalty = 0;

  if (daysInactive >= 3) {
    // Break streak
    newStreak = 0;
    
    // Penalize XP: 100 XP per each day inactive past 2 days, cap at -2000
    penalty = Math.min(2000, (daysInactive - 2) * 100);
    newXp = Math.max(0, xp - penalty);
  }

  return { newStreak, newXp, penalty, daysInactive };
};
