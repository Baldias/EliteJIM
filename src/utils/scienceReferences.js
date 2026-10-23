// Coaching landmarks supplied as the product's reference table. These are
// starting estimates, not measured thresholds or trial-validated prescriptions.
// Shoulders remain one district; the rear/side row guides its direct work.
export const SCIENCE_REFERENCE_VERSION = 3;
export const SCIENCE_VOLUME_REFERENCES = {
  Petto: { mv:8, mev:10, mav:[12,20], mrv:22 },
  Dorso: { mv:8, mev:10, mav:[14,22], mrv:25 },
  Quadricipiti: { mv:6, mev:8, mav:[12,18], mrv:20 },
  Femorali: { mv:4, mev:6, mav:[10,16], mrv:20 },
  Glutei: { mv:0, mev:0, mav:[4,12], mrv:16 },
  Polpacci: { mv:6, mev:8, mav:[12,16], mrv:20 },
  Spalle: { mv:0, mev:8, mav:[16,22], mrv:26 },
  Bicipiti: { mv:5, mev:8, mav:[14,20], mrv:26 },
  Tricipiti: { mv:4, mev:6, mav:[10,14], mrv:18 },
  Addome: { mv:0, mev:0, mav:[16,20], mrv:25 },
  // Optional districts not present in the supplied table: product defaults.
  Collo: { mv:0, mev:2, mav:[4,8], mrv:12 },
  Avambracci: { mv:0, mev:2, mav:[6,12], mrv:16 },
};
export function scienceReference(muscle, experience = 'beginner') {
  const row = SCIENCE_VOLUME_REFERENCES[muscle];
  const level = experience === 'advanced' ? 2 : experience === 'intermediate' ? 1 : 0;
  return { ...row,
    // All levels share MEV. Experience selects a waypoint within MAV, and
    // modestly shifts the estimated ceiling above the table's open-ended MRV.
    mavTarget: Math.round(row.mav[0] + (row.mav[1] - row.mav[0]) * level / 2),
    mrvEstimate: row.mrv + level * 2,
    start: row.mev || (muscle === 'Glutei' ? 4 : 6),
  };
}
export function scienceGrowthStep(program, muscle, strongQuality = false) {
  const waypoint = program.landmarks[muscle]?.mavTarget ?? program.ceilings[muscle];
  const remaining = Math.max(1, 4 - program.currentWeek);
  const desired = Math.max(1, Math.ceil((waypoint - program.targets[muscle]) / remaining));
  return Math.min(strongQuality ? 3 : 2, desired);
}
