import { normalizeName } from '../data/exercises';

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

export const calculateSessionScore = (workout, pastHistory, exercisesDb = [], scienceReport = null) => {
  if (!workout || !workout.exercises || workout.exercises.length === 0) {
    return {
      xp: 0,
      grade: 'D',
      gradeLabel: 'Volume Insufficiente',
      gradeDescription: 'Nessun esercizio completato nella sessione.',
      nextTip: 'Completa almeno un esercizio per iniziare a guadagnare punti.',
      exercisesAnalysis: [],
      overloadRatio: 0,
      totalExercises: 0,
      setsPerHour: '0.0',
      doneSets: 0,
      overloadCount: 0,
      breakdown: [],
      muscleXpGained: {}
    };
  }

  const start = Number(workout.startTime) || 0;
  const end = Number(workout.endTime) || 0;
  const durationMs = end - start;
  const durationHours = durationMs / (1000 * 60 * 60);

  let doneSets = 0;
  const rawMuscleXp = {};

  // Flatten exercisesDb
  const allKnownExercises = Array.isArray(exercisesDb) ? exercisesDb : [];
  const exerciseMetaMap = {};
  allKnownExercises.forEach(ex => {
    const cats = [ex.category];
    if (ex.secondaryCategories) cats.push(...ex.secondaryCategories);
    exerciseMetaMap[normalizeName(ex.name)] = cats.filter(Boolean);
  });

  // Sort past history descending by date and exclude current workout if present
  const sortedPast = Array.isArray(pastHistory)
    ? [...pastHistory].filter(w => w && w.id !== workout.id).sort((a, b) => (Number(b.startTime) || 0) - (Number(a.startTime) || 0))
    : [];

  // Consider only exercises with at least 1 completed non-dropset set
  const activeExercises = workout.exercises.filter(ex =>
    ex.sets && ex.sets.some(s => s.done && !s.isDropset)
  );

  const exercisesAnalysis = [];
  const overloadedExercises = new Set();
  let overloadCount = 0;

  // --- PASS 1: Detailed Hybrid Overload Analysis per Exercise ---
  activeExercises.forEach(ex => {
    const normName = normalizeName(ex.name);
    const currentDoneSets = ex.sets.filter(s => s.done && !s.isDropset);

    // Find latest past workout containing this exercise with completed sets
    let pastEx = null;
    for (const pw of sortedPast) {
      if (pw.exercises) {
        const match = pw.exercises.find(e => normalizeName(e.name) === normName);
        if (match && match.sets && match.sets.some(s => s.done && !s.isDropset)) {
          pastEx = match;
          break;
        }
      }
    }

    if (!pastEx) {
      // First time doing this exercise
      exercisesAnalysis.push({
        name: ex.name,
        status: 'new',
        overloaded: false,
        badge: '✨ Nuova Baseline',
        badgeColor: '#3b82f6',
        detail: 'Prima sessione registrata: servirà da riferimento per i prossimi allenamenti',
        currentMetric: `${currentDoneSets.length} serie fatte`,
        pastMetric: null
      });
      return;
    }

    const pastDoneSets = pastEx.sets.filter(s => s.done && !s.isDropset);

    const currentMaxKg = Math.max(...currentDoneSets.map(s => parseFloat(s.kg) || 0));
    const pastMaxKg = Math.max(...pastDoneSets.map(s => parseFloat(s.kg) || 0));

    const currentBestReps = Math.max(...currentDoneSets.map(s => parseInt(s.reps, 10) || 0));
    const pastBestReps = Math.max(...pastDoneSets.map(s => parseInt(s.reps, 10) || 0));

    const currentTotalReps = currentDoneSets.reduce((acc, s) => acc + (parseInt(s.reps, 10) || 0), 0);
    const pastTotalReps = pastDoneSets.reduce((acc, s) => acc + (parseInt(s.reps, 10) || 0), 0);

    const currentVolume = currentDoneSets.reduce((acc, s) => acc + ((parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0)), 0);
    const pastVolume = pastDoneSets.reduce((acc, s) => acc + ((parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0)), 0);

    // Epley Estimated 1RM
    const calcE1rm = (sets) => Math.max(0, ...sets.map(s => {
      const w = parseFloat(s.kg) || 0;
      const r = parseInt(s.reps, 10) || 0;
      return (w > 0 && r > 0) ? w * (1 + r / 30) : 0;
    }));

    const currentE1rm = calcE1rm(currentDoneSets);
    const pastE1rm = calcE1rm(pastDoneSets);

    const isBodyweight = currentMaxKg === 0 && pastMaxKg === 0;
    let isOverload = false;
    let reasonDetail = '';
    let badge = '⚖️ Mantenimento';
    let badgeColor = '#8e8e93';
    let status = 'maintained';

    if (isBodyweight) {
      // Bodyweight: compare repetitions
      if (currentBestReps > pastBestReps) {
        isOverload = true;
        status = 'pr';
        badge = '⚡ Nuovo Record Reps';
        badgeColor = '#34c759';
        reasonDetail = `+${currentBestReps - pastBestReps} reps sul miglior set (${currentBestReps} vs ${pastBestReps})`;
      } else if (currentTotalReps > pastTotalReps) {
        isOverload = true;
        status = 'overload';
        badge = '🔥 Più Reps Totali';
        badgeColor = '#34c759';
        reasonDetail = `+${currentTotalReps - pastTotalReps} reps complessive (${currentTotalReps} vs ${pastTotalReps})`;
      } else if (currentTotalReps < pastTotalReps * 0.88) {
        status = 'decreased';
        badge = '🔻 Sotto Target';
        badgeColor = '#ff9500';
        reasonDetail = `Reps inferiori alla scorsa sessione (${currentTotalReps} vs ${pastTotalReps})`;
      } else {
        reasonDetail = `Volume reps stabile rispetto alla scorsa volta (${currentTotalReps} reps)`;
      }
    } else {
      // Weighted exercises: Hybrid evaluation (1RM, peak weight, reps at weight, total tonnage)
      if (currentE1rm >= pastE1rm * 1.015 && currentE1rm > 0) {
        isOverload = true;
        status = 'pr';
        badge = '⚡ Record Forza (1RM)';
        badgeColor = '#ffd700';
        const diff = (currentE1rm - pastE1rm).toFixed(1);
        reasonDetail = `+${diff} kg 1RM stimato (${currentE1rm.toFixed(1)}kg vs ${pastE1rm.toFixed(1)}kg)`;
      } else if (currentMaxKg > pastMaxKg && currentBestReps >= 3) {
        isOverload = true;
        status = 'pr';
        badge = '⚡ Nuovo Carico Max';
        badgeColor = '#ffd700';
        reasonDetail = `Carico max aumentato a ${currentMaxKg}kg (prec. ${pastMaxKg}kg)`;
      } else if (currentMaxKg === pastMaxKg && currentBestReps > pastBestReps) {
        isOverload = true;
        status = 'overload';
        badge = '🔥 Più Ripetizioni';
        badgeColor = '#34c759';
        reasonDetail = `+${currentBestReps - pastBestReps} reps a parità di peso (${currentMaxKg}kg)`;
      } else if (currentVolume > pastVolume && pastVolume > 0 && currentE1rm >= pastE1rm * 0.95) {
        isOverload = true;
        status = 'overload';
        badge = '🔥 Volume Totale';
        badgeColor = '#34c759';
        const volDiff = Math.round(currentVolume - pastVolume);
        reasonDetail = `+${volDiff} kg tonnellaggio (${currentVolume}kg vs ${pastVolume}kg)`;
      } else if (currentVolume < pastVolume * 0.85 || (pastE1rm > 0 && currentE1rm < pastE1rm * 0.90)) {
        status = 'decreased';
        badge = '🔻 Sotto Target';
        badgeColor = '#ff9500';
        reasonDetail = `Carico o volume inferiori (${currentVolume}kg vs ${pastVolume}kg)`;
      } else {
        reasonDetail = `Carichi e volume stabili (${currentMaxKg}kg × ${currentBestReps} reps)`;
      }
    }

    if (isOverload) {
      overloadedExercises.add(normName);
      overloadCount++;
    }

    exercisesAnalysis.push({
      name: ex.name,
      status,
      overloaded: isOverload,
      badge,
      badgeColor,
      detail: reasonDetail,
      currentMetric: isBodyweight ? `${currentBestReps} reps` : `${currentMaxKg}kg × ${currentBestReps}`,
      pastMetric: isBodyweight ? `${pastBestReps} reps` : `${pastMaxKg}kg × ${pastBestReps}`
    });
  });

  // --- PASS 2: Assign XP per set based on absolute tonnage ---
  workout.exercises.forEach(ex => {
    const categories = [...(exerciseMetaMap[normalizeName(ex.name)] || [])];

    // Fuzzy fallback for Shoulders & Addome in gamification
    if (categories.length === 0) {
      const fuzzyName = normalizeName(ex.name).toLowerCase();
      if (fuzzyName.includes('spalle') || fuzzyName.includes('shoulder') || fuzzyName.includes('military') || fuzzyName.includes('lento avanti')) {
        categories.push('Spalle');
      } else if (fuzzyName.includes('addome') || fuzzyName.includes('core') || fuzzyName.includes('crunch') || fuzzyName.includes('addominali')) {
        categories.push('Addome');
      } else if (fuzzyName.includes('schiena') || fuzzyName.includes('back') || fuzzyName.includes('lat machine') || fuzzyName.includes('rematore')) {
        categories.push('Dorso');
      }
    }

    const hadOverload = overloadedExercises.has(normalizeName(ex.name));

    ex.sets.forEach(set => {
      if (set.done && !set.isDropset) {
        doneSets++;
        const kg = parseFloat(set.kg) || 0;
        const reps = parseInt(set.reps, 10) || 0;

        if (categories.length > 0) {
          const setXp = hadOverload ? Math.round((kg * reps) / 10) : 5;
          categories.forEach(cat => {
            rawMuscleXp[cat] = (rawMuscleXp[cat] || 0) + setXp;
          });
        }
      }
    });
  });

  const setsPerHour = durationHours > 0 ? (doneSets / durationHours) : 0;

  // --- GRADE CALCULATION ---
  const totalExercises = activeExercises.length;
  const overloadRatio = totalExercises > 0 ? overloadCount / totalExercises : 0;
  const isJunk = doneSets < 5;
  const allNew = totalExercises > 0 && overloadCount === 0 && exercisesAnalysis.every(e => e.status === 'new');

  // Check if user is in an active Science Mesocycle Deload Week (Weeks 4, 8, 12)
  const currentScienceWeek = scienceReport?.currentWeek || 1;
  const isDeloadWeek = Boolean(scienceReport && scienceReport.status === 'active' && (currentScienceWeek === 4 || currentScienceWeek === 8 || currentScienceWeek === 12));

  let grade;
  let gradeLabel;
  let gradeDescription;
  let nextTip;

  if (isDeloadWeek) {
    if (doneSets >= 4 && doneSets <= 16) {
      grade = 'S';
      gradeLabel = 'Scarico Perfetto (Deload)';
      gradeDescription = `Hai completato ${doneSets} serie controllate, rispettando alla perfezione il recupero sistemico del mesociclo.`;
      nextTip = 'Ottimo lavoro! Ripartirai fresco e con i tessuti muscolari supercompensati per la prossima fase.';
    } else if (doneSets > 16) {
      grade = 'B';
      gradeLabel = 'Volume Elevato per Deload';
      gradeDescription = `Hai eseguito ${doneSets} serie: in settimana di scarico è consigliabile mantenersi sotto le 12-14 serie per smaltire la fatica.`;
      nextTip = 'Non spingere troppe serie durante lo scarico, l\'obiettivo scientifico è far riposare il sistema nervoso.';
    } else {
      grade = 'C';
      gradeLabel = 'Scarico Troppo Breve';
      gradeDescription = `Hai completato meno di 4 serie totali (${doneSets} serie).`;
      nextTip = 'Fai almeno 1-2 serie leggere per gruppo muscolare per mantenere attivi i pattern motori.';
    }
  } else if (isJunk) {
    grade = 'D';
    gradeLabel = 'Volume Insufficiente';
    gradeDescription = `Hai completato solo ${doneSets} ${doneSets === 1 ? 'serie' : 'serie'}. Sotto le 5 serie lo stimolo ipertrofico è troppo basso.`;
    nextTip = 'Completa almeno 6-8 serie allenanti con impegno per stimolare la crescita muscolare e guadagnare un grado superiore.';
  } else if (allNew) {
    grade = 'B';
    gradeLabel = 'Prima Sessione (Baseline)';
    gradeDescription = `Tutti i ${totalExercises} esercizi sono nuovi: i risultati odierni sono stati salvati come punto di riferimento per le prossime progressioni.`;
    nextTip = 'Nel prossimo allenamento prova ad aggiungere 1 ripetizione o 1-2 kg su questi stessi esercizi per puntare al Grado S!';
  } else if (overloadRatio >= 0.75) {
    grade = 'S';
    gradeLabel = 'Sovraccarico Totale';
    gradeDescription = `Prestazione eccezionale: hai ottenuto un sovraccarico progressivo su ${overloadCount} esercizi su ${totalExercises} (${Math.round(overloadRatio * 100)}%).`;
    nextTip = 'Sei al massimo del rendimento! Continua così e cura recupero, alimentazione e sonno.';
  } else if (overloadRatio >= 0.5) {
    grade = 'A';
    gradeLabel = 'Grande Progressione';
    gradeDescription = `Ottimo lavoro: progressione netta su oltre la metà degli esercizi (${overloadCount} su ${totalExercises}).`;
    nextTip = 'Per raggiungere il leggendario Grado S, prova a forzare anche solo 1 ripetizione in più su uno degli altri esercizi.';
  } else if (overloadRatio > 0) {
    grade = 'B';
    gradeLabel = 'Buona Sessione';
    gradeDescription = `Hai superato i tuoi standard su ${overloadCount} ${overloadCount === 1 ? 'esercizio' : 'esercizi'} su ${totalExercises}. C'è ancora margine sugli altri movimenti.`;
    nextTip = 'Focalizzati sui primi 2 esercizi base della scheda per aumentare il carico e raggiungere il Grado A.';
  } else {
    if (doneSets >= 10) {
      grade = 'C';
      gradeLabel = 'Mantenimento / Stagnazione';
      gradeDescription = `Buon volume totale (${doneSets} serie), ma non ci sono stati miglioramenti di carico o ripetizioni rispetto all'ultima volta.`;
      nextTip = 'Basta anche solo 1 ripetizione in più su una singola serie per rompere lo stallo e trasformare la sessione in progressione.';
    } else {
      grade = 'D';
      gradeLabel = 'Stimolo Sotto Target';
      gradeDescription = `Nessun sovraccarico registrato e volume complessivo basso (${doneSets} serie).`;
      nextTip = 'Aumenta il focus: spingi di più sulla prima serie di ogni esercizio o aggiungi serie per dare uno stimolo efficace.';
    }
  }

  // XP Calculation
  let xp = 0;
  const baseXP = doneSets * 30;
  xp += baseXP;

  const overloadXP = overloadCount * 200;
  xp += overloadXP;

  // Grade Multiplier
  let gradeMult = 1;
  if (grade === 'S') gradeMult = 1.5;
  if (grade === 'A') gradeMult = 1.25;
  if (grade === 'B') gradeMult = 1.0;
  if (grade === 'C') gradeMult = 0.8;
  if (grade === 'D') gradeMult = 0.4;

  xp = Math.round(xp * gradeMult);

  // Apply grade multiplier to muscle XP
  const muscleXpGained = {};
  Object.keys(rawMuscleXp).forEach(cat => {
    muscleXpGained[cat] = Math.round(rawMuscleXp[cat] * gradeMult);
  });

  const breakdown = [
    { label: gradeLabel, value: `Grado ${grade}` },
    { label: 'Serie Completate', value: `+${baseXP} XP` },
    ...(overloadCount > 0 ? [{ label: `Sovraccarico su ${overloadCount} esercizi`, value: `+${overloadXP} XP` }] : []),
    ...(gradeMult !== 1 ? [{ label: `Moltiplicatore Grado`, value: `×${gradeMult}` }] : [])
  ];

  return {
    xp,
    grade,
    gradeLabel,
    gradeDescription,
    nextTip,
    exercisesAnalysis,
    overloadRatio,
    totalExercises,
    setsPerHour: setsPerHour.toFixed(1),
    doneSets,
    overloadCount,
    breakdown,
    muscleXpGained
  };
};

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const getMondayOfWeek = (dateOrTimestamp) => {
  const d = new Date(dateOrTimestamp);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
};

export const getMondayTimestamp = (dateOrTimestamp) => {
  return getMondayOfWeek(dateOrTimestamp).getTime();
};

/**
 * Calcola la streak a settimane e lo storico delle settimane attive:
 * - Ogni settimana (Lun-Dom) con almeno un workout valido aggiunge +1 alla streak.
 * - Se passano >= 7 giorni dall'ultimo allenamento, la streak attuale si azzera.
 */
export const calculateWeeklyStreak = (history = [], referenceDate = Date.now()) => {
  if (!history || history.length === 0) {
    return { currentStreak: 0, highestStreak: 0, isStreakActive: false, daysSinceLastWorkout: null };
  }

  // Filtra i workout con timestamp valido e ordina dal più vecchio al più recente
  const validWorkouts = history
    .filter(w => w && (w.startTime || w.endTime))
    .map(w => ({
      ...w,
      time: Number(w.startTime || w.endTime)
    }))
    .sort((a, b) => a.time - b.time);

  if (validWorkouts.length === 0) {
    return { currentStreak: 0, highestStreak: 0, isStreakActive: false, daysSinceLastWorkout: null };
  }

  const latestWorkout = validWorkouts[validWorkouts.length - 1];
  const daysSinceLastWorkout = Math.max(0, Math.floor((referenceDate - latestWorkout.time) / MS_PER_DAY));

  // Raggruppa i workout per lunedì della settimana
  const weekMap = new Map();
  validWorkouts.forEach(w => {
    const mondayMs = getMondayTimestamp(w.time);
    if (!weekMap.has(mondayMs)) {
      weekMap.set(mondayMs, []);
    }
    weekMap.get(mondayMs).push(w);
  });

  // Elenco ordinato dei lunedì con allenamenti
  const sortedMondays = Array.from(weekMap.keys()).sort((a, b) => a - b);

  if (sortedMondays.length === 0) {
    return { currentStreak: 0, highestStreak: 0, isStreakActive: false, daysSinceLastWorkout };
  }

  // Calcolo highestStreak storico
  let highestStreak = 0;
  let runningStreak = 0;
  let prevMonday = null;

  for (let i = 0; i < sortedMondays.length; i++) {
    const currentMonday = sortedMondays[i];
    if (prevMonday === null) {
      runningStreak = 1;
    } else {
      const diffWeeks = Math.round((currentMonday - prevMonday) / (7 * MS_PER_DAY));
      if (diffWeeks === 1) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
    }
    highestStreak = Math.max(highestStreak, runningStreak);
    prevMonday = currentMonday;
  }

  // Calcolo currentStreak attivo al momento del referenceDate
  // Se sono passati >= 7 giorni dall'ultimo workout, la streak è persa (0)
  if (daysSinceLastWorkout >= 7) {
    return {
      currentStreak: 0,
      highestStreak,
      isStreakActive: false,
      daysSinceLastWorkout
    };
  }

  // Calcola quante settimane consecutive terminano nell'ultima settimana allenata
  let activeStreakCount = 1;
  for (let i = sortedMondays.length - 1; i > 0; i--) {
    const curr = sortedMondays[i];
    const prev = sortedMondays[i - 1];
    const diffWeeks = Math.round((curr - prev) / (7 * MS_PER_DAY));
    if (diffWeeks === 1) {
      activeStreakCount++;
    } else {
      break;
    }
  }

  highestStreak = Math.max(highestStreak, activeStreakCount);

  return {
    currentStreak: activeStreakCount,
    highestStreak,
    isStreakActive: true,
    daysSinceLastWorkout
  };
};

export const checkStreakInactivity = (lastWorkoutDateMs, currentStreak, xp) => {
  if (!lastWorkoutDateMs) return { newStreak: 0, newXp: xp, penalty: 0 };
  
  const daysInactive = Math.floor((Date.now() - lastWorkoutDateMs) / MS_PER_DAY);
  
  let newStreak = currentStreak;
  let newXp = xp;
  let penalty = 0;

  if (daysInactive >= 7) {
    // Azzera streak dopo 7 giorni di inattività
    newStreak = 0;
    
    // Penalità XP oltre i 7 giorni
    penalty = Math.min(2000, (daysInactive - 6) * 100);
    newXp = Math.max(0, xp - penalty);
  }

  return { newStreak, newXp, penalty, daysInactive };
};

export const recalculateTotalXpFromHistory = (history, exercisesDb = []) => {
  console.log(`[DEBUG] recalculateTotalXpFromHistory started. History length: ${history?.length}`);
  try {
    if (!history || history.length === 0) {
      return { userXP: 0, muscleXP: {}, currentStreak: 0, highestStreak: 0 };
    }

    // Sort by date ascending to process oldest sessions first
    const sortedHistory = [...history].sort((a, b) => Number(a.startTime) - Number(b.startTime));
    
    let totalXP = 0;
    const totalMuscleXP = {};
    const rollingHistory = [];

    sortedHistory.forEach(workout => {
      // Calcola XP della sessione
      const score = calculateSessionScore(workout, rollingHistory, exercisesDb);
      totalXP += score.xp;
      
      if (score.muscleXpGained) {
        Object.keys(score.muscleXpGained).forEach(muscle => {
          totalMuscleXP[muscle] = (totalMuscleXP[muscle] || 0) + score.muscleXpGained[muscle];
        });
      }
      
      rollingHistory.push(workout);
    });

    // Calcolo streak a settimane
    const { currentStreak, highestStreak } = calculateWeeklyStreak(history);

    return {
      userXP: totalXP,
      muscleXP: totalMuscleXP,
      currentStreak,
      highestStreak
    };
  } catch (err) {
    console.error("[CRITICAL ERROR] recalculateTotalXpFromHistory failed:", err);
    throw err;
  }
};

