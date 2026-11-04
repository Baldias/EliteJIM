// How much a completed set counts toward weekly volume and fatigue.
// Drop sets and rest-pause mini-sets are continuations of the set before them:
// meta-analyses find similar hypertrophy to traditional sets with fewer total
// sets (Coleman 2022, Sødal 2023), so each one counts as half a set, like the
// fractional counting of Pelland 2026. Warm-ups and skipped sets count 0.
export const PARTIAL_SET = 0.5;

export const isTechniqueSet = set => Boolean(set?.isDropset || set?.isRestPause);

export const setVolumeValue = set => {
  if (!set?.done || set.isWarmup) return 0;
  return isTechniqueSet(set) ? PARTIAL_SET : 1;
};

export const countSets = sets => (sets || []).reduce((sum, set) => sum + setVolumeValue(set), 0);
