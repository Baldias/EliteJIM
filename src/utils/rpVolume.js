import { normalizeName } from '../data/exercises';

export const RP_LANDMARKS = {
  // Landmarks in number of sets per week (Mike Israetel / RP)
  Petto: { MEV: 10, MAV_MIN: 12, MAV_MAX: 20, MRV: 22 },
  Dorso: { MEV: 10, MAV_MIN: 14, MAV_MAX: 22, MRV: 25 },
  Quadricipiti: { MEV: 8, MAV_MIN: 12, MAV_MAX: 18, MRV: 20 },
  Femorali: { MEV: 6, MAV_MIN: 10, MAV_MAX: 16, MRV: 18 },
  Glutei: { MEV: 0, MAV_MIN: 8, MAV_MAX: 14, MRV: 18 },
  Polpacci: { MEV: 8, MAV_MIN: 12, MAV_MAX: 16, MRV: 20 },
  Spalle: { MEV: 8, MAV_MIN: 16, MAV_MAX: 22, MRV: 26 },
  Bicipiti: { MEV: 8, MAV_MIN: 14, MAV_MAX: 20, MRV: 26 },
  Tricipiti: { MEV: 6, MAV_MIN: 10, MAV_MAX: 14, MRV: 18 },
  Addome: { MEV: 0, MAV_MIN: 16, MAV_MAX: 20, MRV: 25 },
  Collo: { MEV: 0, MAV_MIN: 6, MAV_MAX: 12, MRV: 18 },
  Avambracci: { MEV: 0, MAV_MIN: 8, MAV_MAX: 16, MRV: 20 }
};

export const calculateLast7DaysVolume = (history, exercisesDb) => {
  // Define "Last 7 Days" as Today + previous 6 full calendar days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = today.getTime() - (6 * 24 * 60 * 60 * 1000);
  
  // Initialize volumes for each tracked category
  const volumes = {};
  Object.keys(RP_LANDMARKS).forEach(cat => {
    volumes[cat] = 0;
  });

  // Create a fast lookup map: exercise name -> all categories (primary + secondary)
  const categoryMap = {};
  exercisesDb.forEach(ex => {
    let allCats = [ex.category];
    if (ex.secondaryCategories) {
      allCats.push(...ex.secondaryCategories);
    }
    // Backward compatibility for legacy 'Gambe' category
    allCats = allCats.map(c => c === 'Gambe' ? 'Quadricipiti' : c);
    categoryMap[normalizeName(ex.name)] = allCats;
  });

  // Filter last 7 days workouts
  const recentWorkouts = history.filter(w => w.startTime >= sevenDaysAgo);

  recentWorkouts.forEach(workout => {
    workout.exercises.forEach(ex => {
      const categories = categoryMap[normalizeName(ex.name)];
      if (categories) {
        // Count only completed sets, ignore dropsets for structural volume
        const completedSets = ex.sets.filter(s => s.done && !s.isDropset).length;
        // Distribute sets across ALL muscle groups this exercise targets
        categories.forEach(cat => {
          if (volumes[cat] !== undefined) {
            volumes[cat] += completedSets;
          }
        });
      }
    });
  });

  return volumes;
};

export const calculateVolumeForDateRange = (history, exercisesDb, startTime, endTime) => {
  const volumes = {};
  Object.keys(RP_LANDMARKS).forEach(cat => {
    volumes[cat] = 0;
  });

  const categoryMap = {};
  exercisesDb.forEach(ex => {
    let allCats = [ex.category];
    if (ex.secondaryCategories) {
      allCats.push(...ex.secondaryCategories);
    }
    allCats = allCats.map(c => c === 'Gambe' ? 'Quadricipiti' : c);
    categoryMap[normalizeName(ex.name)] = allCats;
  });

  const rangeWorkouts = history.filter(w => w.startTime >= startTime && w.startTime < endTime);

  rangeWorkouts.forEach(workout => {
    workout.exercises.forEach(ex => {
      const categories = categoryMap[normalizeName(ex.name)];
      if (categories) {
        const completedSets = ex.sets.filter(s => s.done && !s.isDropset).length;
        categories.forEach(cat => {
          if (volumes[cat] !== undefined) {
            volumes[cat] += completedSets;
          }
        });
      }
    });
  });

  return volumes;
};

export const getVolumeStatus = (sets, category) => {
  const landmarks = RP_LANDMARKS[category];
  if (!landmarks) return { status: 'Unknown', color: '#6b7280', label: 'N/A' };

  if (sets < landmarks.MEV) {
    return { 
      status: 'Maintenance', 
      color: '#3b82f6',
      percent: Math.min(100, Math.max(0, (sets / landmarks.MEV) * 100)),
      label: 'Sotto MEV (Mantenimento)' 
    };
  } else if (sets < landmarks.MAV_MIN) {
    return { 
      status: 'MEV', 
      color: '#10b981',
      percent: 100,
      label: 'MEV (Minimo Efficace)' 
    };
  } else if (sets <= landmarks.MAV_MAX) {
    return { 
      status: 'MAV', 
      color: '#8b5cf6',
      percent: 100,
      label: 'MAV (Volume Ottimale)' 
    };
  } else if (sets < landmarks.MRV) {
    return { 
      status: 'Overreaching', 
      color: '#f59e0b',
      percent: 100,
      label: 'Vicino MRV (Overreaching)' 
    };
  } else {
    return { 
      status: 'MRV', 
      color: '#ef4444',
      percent: 100,
      label: 'Superato MRV (Recupero a Rischio)' 
    };
  }
};

/**
 * Normalizza il nome di una categoria per associarla ai landmarks della Sezione Scienza.
 */
export const mapCategoryToScienceLandmark = (category, baseLandmarks) => {
  if (!category || !baseLandmarks) return null;
  if (baseLandmarks[category]) return category;
  
  const aliases = {
    'Schiena': 'Dorso',
    'Spalle (Deltoidi)': 'Spalle',
    'Addominali': 'Addome',
    'Gambe': 'Quadricipiti'
  };

  const alias = aliases[category];
  if (alias && baseLandmarks[alias]) return alias;
  return null;
};

/**
 * Calcola le serie completate per gruppo muscolare (solo categoria primaria)
 * in un dato intervallo di tempo temporale.
 */
export const calculateScienceVolume = (history, exercisesDb, baseLandmarks, startTime, endTime) => {
  const setsDone = {};
  if (!baseLandmarks) return setsDone;

  history.forEach(w => {
    const wTime = Number(w.startTime);
    if (wTime < startTime || wTime >= endTime) return;

    (w.exercises || []).forEach(ex => {
      const normalizedExName = normalizeName(ex.name);
      const foundEx = exercisesDb.find(e => normalizeName(e.name) === normalizedExName);

      // Usiamo solo la categoria primaria per evitare sovraconteggi secondari
      let cat = foundEx?.category || null;

      // Fallback fuzzy per esercizi non trovati o custom mal categorizzati
      if (!cat) {
        const fuzzy = normalizedExName.toLowerCase();
        if (fuzzy.includes('spalle') || fuzzy.includes('shoulder') || fuzzy.includes('military') || fuzzy.includes('lento avanti')) {
          cat = 'Spalle';
        } else if (fuzzy.includes('addome') || fuzzy.includes('core') || fuzzy.includes('crunch') || fuzzy.includes('addominali')) {
          cat = 'Addome';
        } else if (fuzzy.includes('schiena') || fuzzy.includes('back') || fuzzy.includes('lat machine') || fuzzy.includes('rematore')) {
          cat = 'Dorso';
        } else if (fuzzy.includes('squat') || fuzzy.includes('press') || fuzzy.includes('affondi') || fuzzy.includes('quadricipiti')) {
          cat = 'Quadricipiti';
        } else if (fuzzy.includes('stacco') || fuzzy.includes('curl femorale') || fuzzy.includes('leg curl') || fuzzy.includes('femorali')) {
          cat = 'Femorali';
        }
      }

      const targetKey = mapCategoryToScienceLandmark(cat, baseLandmarks);
      if (targetKey) {
        const count = (ex.sets || []).filter(s => s.done && !s.isDropset).length;
        setsDone[targetKey] = (setsDone[targetKey] || 0) + count;
      }
    });
  });

  return setsDone;
};

/**
 * Restituisce il target di serie per un dato muscolo in una specifica settimana di mesociclo.
 */
export const getScienceTargetForMuscle = (report, muscle, weekNum) => {
  if (!report || !report.baseLandmarks) return 0;
  const lm = report.baseLandmarks[muscle];
  if (!lm) return 0;

  const month = weekNum <= 4 ? 1 : (weekNum <= 8 ? 2 : 3);

  // Mese 3 (Settimane 9-12): Deload e Risensibilizzazione
  if (month === 3) {
    if (weekNum === 9 || weekNum === 10) return Math.max(0, lm.mev - 2); // Deload
    return lm.mev; // Mantenimento basso / risensibilizzazione
  }

  // Verifica se il muscolo è nel focus del mese corrente
  const isFocus = (month === 1 && (report.focus1 || []).includes(muscle)) ||
                  (month === 2 && (report.focus2 || []).includes(muscle));

  if (!isFocus) {
    return lm.mev; // Mantenimento
  }

  // Muscolo in focus: progressione lineare da MAV a MRV su 4 settimane
  const relativeWeek = weekNum - ((month - 1) * 4); // 1, 2, 3, 4
  const gap = lm.mrv - lm.mav;
  const weeklyIncrement = gap / 3;
  const target = lm.mav + (weeklyIncrement * (relativeWeek - 1));
  return Math.round(target);
};

/**
 * Restituisce il badge di fase (MEV, MAV, Overreach, MRV, Deload) per il muscolo e target.
 */
export const getSciencePhaseBadge = (report, muscle, weekNum, targetSets) => {
  if (!report || !report.baseLandmarks) return null;
  const lm = report.baseLandmarks[muscle];
  if (!lm) return null;

  const month = weekNum <= 4 ? 1 : (weekNum <= 8 ? 2 : 3);

  if (month === 3 && (weekNum === 9 || weekNum === 10)) {
    return { label: 'Deload', color: '#34c759', bg: 'rgba(52, 199, 89, 0.15)' };
  }

  if (targetSets <= lm.mev) {
    return { label: 'MEV', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
  }
  if (targetSets >= lm.mrv) {
    return { label: 'MRV', color: '#ff3b30', bg: 'rgba(255, 59, 48, 0.15)' };
  }

  if (Math.abs(targetSets - lm.mav) < Math.abs(targetSets - lm.mrv)) {
    return { label: 'MAV', color: '#ff9500', bg: 'rgba(255, 149, 0, 0.15)' };
  } else {
    return { label: 'Overreach', color: '#ff2d55', bg: 'rgba(255, 45, 85, 0.15)' };
  }
};

/**
 * Calcola le serie completate per una determinata settimana di mesociclo in modo deterministico:
 * - Se la settimana è completata e registrata in weekHistory, usa esattamente i suoi timestamp di inizio e fine.
 * - Se la settimana è quella attiva in corso, usa currentWeekStartDate fino a Date.now().
 * - Per settimane future non ancora avviate, restituisce mappa vuota.
 * - Retrocompatibilità: se il report è nel vecchio formato senza weekHistory, calcola la finestra senza overlap.
 */
export const getActualSetsForScienceWeek = (history, exercisesDb, report, weekNum) => {
  if (!report || !report.baseLandmarks) return {};

  const currentW = report.currentWeek || 1;

  // 1. Settimana passata registrata nello storico
  if (report.weekHistory && report.weekHistory[weekNum]) {
    const { startDate, completedDate } = report.weekHistory[weekNum];
    return calculateScienceVolume(history, exercisesDb, report.baseLandmarks, startDate, completedDate);
  }

  // 2. Settimana attiva corrente
  if (weekNum === currentW) {
    const startDate = report.currentWeekStartDate || report.startDate || report.timestamp;
    // Se è la settimana 1 e l'utente ha creato il report dopo essersi già allenato oggi, buffer di sicurezza di 12 ore solo per W1
    const buffer = weekNum === 1 ? (12 * 60 * 60 * 1000) : 0;
    return calculateScienceVolume(history, exercisesDb, report.baseLandmarks, startDate - buffer, Date.now() + 1000);
  }

  // 3. Settimana passata in un vecchio report privo di weekHistory (fallback calcolo retrocompatibile SENZA overlap)
  if (weekNum < currentW) {
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const mesoStart = report.startDate || report.timestamp;
    const weekStart = mesoStart + (weekNum - 1) * MS_PER_WEEK - (weekNum === 1 ? 12 * 60 * 60 * 1000 : 0);
    const weekEnd = mesoStart + weekNum * MS_PER_WEEK;
    return calculateScienceVolume(history, exercisesDb, report.baseLandmarks, weekStart, weekEnd);
  }

  // 4. Settimana futura non ancora iniziata
  return {};
};
