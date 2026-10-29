import { machineHistory } from './gymLocation';
import { normalizeName } from '../data/exercises';
import { estimate1RM, repFactor, getBodyweightLoad, REFERENCE_BODYWEIGHT_KG } from './oneRepMax';

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

const workingSets = (exercise) => (exercise?.sets || []).filter(s => s.done && !s.isDropset);

const fmtKg = (n) => `${Math.round(n * 10) / 10}`;
// Set loads keep their real increments (e.g. 101.25 kg)
const fmtLoad = (n) => `${Math.round(n * 100) / 100}`;

/**
 * Compares one exercise with its previous session on strength only: the best
 * estimated 1RM and the top set (the set with that 1RM). More sets, more total
 * reps or more tonnage never count as progressive overload.
 * `bodyweightLoad` is the bodyweight moved by the exercise (0 for external loads).
 */
export const evaluateExerciseOverload = (currentSets, pastSets, bodyweightLoad = 0) => {
  const toSet = (s) => ({ kg: parseFloat(s.kg) || 0, reps: parseInt(s.reps, 10) || 0 });
  const current = (currentSets || []).map(toSet).filter(s => s.reps > 0);
  const past = (pastSets || []).map(toSet).filter(s => s.reps > 0);
  if (current.length === 0 || past.length === 0) return null;

  const isBodyweightOnly = current.every(s => s.kg === 0) && past.every(s => s.kg === 0);

  if (isBodyweightOnly) {
    // Same load (the body): only the best set's reps tell if strength went up
    const cur = Math.max(...current.map(s => s.reps));
    const prev = Math.max(...past.map(s => s.reps));
    const metrics = { currentMetric: `${cur} reps`, pastMetric: `${prev} reps` };
    if (cur > prev) {
      return { status: 'pr', overloaded: true, badge: '⚡ Nuovo Record Reps', badgeColor: '#34c759',
        detail: `+${cur - prev} reps sulla serie migliore (${cur} vs ${prev})`, ...metrics };
    }
    if (repFactor(cur) < repFactor(prev) * 0.95) {
      return { status: 'decreased', overloaded: false, badge: '🔻 Sotto Target', badgeColor: '#ff9500',
        detail: `Serie migliore più corta della scorsa volta (${cur} vs ${prev} reps)`, ...metrics };
    }
    return { status: 'maintained', overloaded: false, badge: '⚖️ Mantenimento', badgeColor: '#8e8e93',
      detail: cur === prev ? `Stesse ripetizioni sulla serie migliore (${cur} reps)` : `Ripetizioni stabili sulla serie migliore (${cur} vs ${prev})`,
      ...metrics };
  }

  const topSet = (sets) => sets.reduce((best, s) => {
    const rm = estimate1RM(s.kg, s.reps, bodyweightLoad);
    return !best || rm > best.rm ? { ...s, rm } : best;
  }, null);
  const cur = topSet(current);
  const prev = topSet(past);
  const metrics = { currentMetric: `${fmtLoad(cur.kg)}kg × ${cur.reps}`, pastMetric: `${fmtLoad(prev.kg)}kg × ${prev.reps}` };
  const rmText = `${bodyweightLoad > 0 ? 'zavorra ' : ''}${fmtKg(cur.rm)}kg vs ${fmtKg(prev.rm)}kg`;
  // Thresholds are relative to the whole mass lifted (body + added weight)
  const curTotal = cur.rm + bodyweightLoad;
  const prevTotal = prev.rm + bodyweightLoad;

  // Beyond the estimate's noise (different rep ranges give slightly different 1RMs)
  if (cur.rm > 0 && curTotal >= prevTotal * 1.015) {
    return { status: 'pr', overloaded: true, badge: '⚡ Record Forza (1RM)', badgeColor: '#ffd700',
      detail: `+${fmtKg(cur.rm - prev.rm)} kg di 1RM stimato (${rmText})`, ...metrics };
  }

  // Small but certain progressions: a set that beats the previous top set on
  // load or reps without losing on the other (e.g. +1.25 kg, +1 rep at 15 reps)
  const beatsTop = current
    .filter(s => s.kg >= prev.kg && s.reps >= prev.reps && (s.kg > prev.kg || s.reps > prev.reps))
    .sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0];
  if (beatsTop) {
    const heavier = beatsTop.kg > prev.kg;
    return {
      status: 'overload', overloaded: true,
      badge: heavier ? '⚡ Più Carico' : '🔥 Più Ripetizioni', badgeColor: '#34c759',
      detail: heavier
        ? `Più peso sulla serie migliore: ${fmtLoad(beatsTop.kg)}kg × ${beatsTop.reps} (prec. ${fmtLoad(prev.kg)}kg × ${prev.reps})`
        : `+${beatsTop.reps - prev.reps} reps a ${fmtLoad(beatsTop.kg)}kg sulla serie migliore`,
      currentMetric: `${fmtLoad(beatsTop.kg)}kg × ${beatsTop.reps}`, pastMetric: metrics.pastMetric
    };
  }

  if (curTotal < prevTotal * 0.95) {
    return { status: 'decreased', overloaded: false, badge: '🔻 Sotto Target', badgeColor: '#ff9500',
      detail: `1RM stimato in calo (${rmText})`, ...metrics };
  }

  return { status: 'maintained', overloaded: false, badge: '⚖️ Mantenimento', badgeColor: '#8e8e93',
    detail: `1RM stimato stabile (${rmText})`, ...metrics };
};

export const calculateSessionScore = (workout, pastHistory, exercisesDb = [], scienceReport = null, bodyweight = null) => {
  if (!workout || !workout.exercises || workout.exercises.length === 0) {
    return {
      xp: 0,
      grade: 'D',
      gradeLabel: 'Serie Insufficienti',
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

  // --- PASS 1: Overload analysis per exercise (estimated 1RM and top set, never volume) ---
  activeExercises.forEach(ex => {
    const normName = normalizeName(ex.name);
    const currentDoneSets = workingSets(ex);

    // Find latest past workout containing this exercise with completed sets
    let pastEx = null;
    for (const pw of machineHistory(sortedPast, ex.name, allKnownExercises, workout)) {
      const match = pw.exercises?.find(e => normalizeName(e.name) === normName);
      if (match && workingSets(match).length > 0) {
        pastEx = match;
        break;
      }
    }

    const result = pastEx
      ? evaluateExerciseOverload(currentDoneSets, workingSets(pastEx), getBodyweightLoad(ex.name, allKnownExercises, bodyweight))
      : null;

    if (!result) {
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

    if (result.overloaded) {
      overloadedExercises.add(normName);
      overloadCount++;
    }

    exercisesAnalysis.push({ name: ex.name, ...result });
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
          // Bodyweight sets (kg = 0) move the body itself: use a reference bodyweight
          // so an overloaded pull-up/dip never earns less than a non-overloaded set.
          const load = kg > 0 ? kg : REFERENCE_BODYWEIGHT_KG;
          const setXp = hadOverload ? Math.max(5, Math.round((load * reps) / 10)) : 5;
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

  // Deload weeks of the Science mesocycle are W9-W10 (see getScienceTargetForMuscle).
  // W4 and W8 are Boss Fight (MRV) weeks and must be graded like any other session.
  const currentScienceWeek = scienceReport?.currentWeek || 1;
  const isDeloadWeek = Boolean(scienceReport && scienceReport.status === 'active' && (currentScienceWeek === 9 || currentScienceWeek === 10));

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
    gradeLabel = 'Serie Insufficienti';
    gradeDescription = `Hai completato solo ${doneSets} serie: sotto le 5 serie allenanti la sessione non basta per valutare la progressione.`;
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
    // No overload: strength held or dropped? Doing more sets does not change the grade.
    const compared = exercisesAnalysis.filter(e => e.status !== 'new').length;
    const decreased = exercisesAnalysis.filter(e => e.status === 'decreased').length;
    if (decreased > compared / 2) {
      grade = 'D';
      gradeLabel = 'Calo di Forza';
      gradeDescription = `Il 1RM stimato è sceso su ${decreased} ${decreased === 1 ? 'esercizio' : 'esercizi'} su ${compared} rispetto all'ultima volta.`;
      nextTip = 'Controlla recupero, sonno e alimentazione: se il calo continua per 2-3 sessioni valuta una settimana di scarico.';
    } else {
      grade = 'C';
      gradeLabel = 'Mantenimento / Stagnazione';
      gradeDescription = 'Forza stabile: nessun esercizio ha superato il 1RM stimato o la serie migliore della scorsa volta.';
      nextTip = 'Basta 1 ripetizione o 1,25-2,5 kg in più sulla serie migliore per trasformare la sessione in progressione.';
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

export const recalculateTotalXpFromHistory = (history, exercisesDb = [], bodyweight = null) => {
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
      const score = calculateSessionScore(workout, rollingHistory, exercisesDb, null, bodyweight);
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

