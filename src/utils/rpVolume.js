import { normalizeName } from '../data/exercises';

export const RP_LANDMARKS = {
  // Landmarks in number of sets per week
  Petto: { MEV: 10, MAV_MIN: 12, MAV_MAX: 20, MRV: 22 },
  Dorso: { MEV: 10, MAV_MIN: 14, MAV_MAX: 22, MRV: 25 },
  Gambe: { MEV: 8, MAV_MIN: 10, MAV_MAX: 18, MRV: 20 },
  Spalle: { MEV: 8, MAV_MIN: 16, MAV_MAX: 22, MRV: 26 }, // Deltoidi solitamente recuperano in fretta
  Bicipiti: { MEV: 8, MAV_MIN: 14, MAV_MAX: 20, MRV: 26 },
  Tricipiti: { MEV: 6, MAV_MIN: 10, MAV_MAX: 14, MRV: 18 },
  Addome: { MEV: 0, MAV_MIN: 16, MAV_MAX: 20, MRV: 25 }, // Spesso MEV 0 se si fanno pesi liberi
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
    const allCats = [ex.category];
    if (ex.secondaryCategories) {
      allCats.push(...ex.secondaryCategories);
    }
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

/**
 * Calculate completed sets per muscle group for a specific date range.
 * Reuses the same category mapping as calculateLast7DaysVolume.
 * @param {Array} history - workout history array
 * @param {Array} exercisesDb - exercises database array
 * @param {number} startTime - start timestamp (inclusive)
 * @param {number} endTime - end timestamp (exclusive)
 * @returns {Object} - { muscleName: completedSets }
 */
export const calculateVolumeForDateRange = (history, exercisesDb, startTime, endTime) => {
  const volumes = {};
  Object.keys(RP_LANDMARKS).forEach(cat => {
    volumes[cat] = 0;
  });

  const categoryMap = {};
  exercisesDb.forEach(ex => {
    const allCats = [ex.category];
    if (ex.secondaryCategories) {
      allCats.push(...ex.secondaryCategories);
    }
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
  if (!landmarks) return { status: 'Unknown', color: '#6b7280', label: 'N/A' }; // gray-500

  if (sets < landmarks.MEV) {
    return { 
      status: 'Maintenance', 
      color: '#3b82f6', // blue-500
      percent: Math.min(100, Math.max(0, (sets / landmarks.MEV) * 100)),
      label: 'Sotto MEV (Mantenimento)' 
    };
  } else if (sets < landmarks.MAV_MIN) {
    return { 
      status: 'MEV', 
      color: '#10b981', // emerald-500
      percent: 100, // MEV filled
      label: 'MEV (Minimo Efficace)' 
    };
  } else if (sets <= landmarks.MAV_MAX) {
    return { 
      status: 'MAV', 
      color: '#8b5cf6', // violet-500
      percent: 100,
      label: 'MAV (Volume Ottimale)' 
    };
  } else if (sets < landmarks.MRV) {
    return { 
      status: 'Overreaching', 
      color: '#f59e0b', // amber-500
      percent: 100,
      label: 'Vicino MRV (Overreaching)' 
    };
  } else {
    return { 
      status: 'MRV', 
      color: '#ef4444', // red-500
      percent: 100,
      label: 'Superato MRV (Recupero a Rischio)' 
    };
  }
};
