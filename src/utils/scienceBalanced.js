import { scienceReference } from './scienceReferences';

export const BALANCED_VOLUME_VERSION = 1;
export const SCIENCE_SESSION_SET_LIMIT = 20;
const lowerPriority = new Set(['Polpacci', 'Addome', 'Femorali']);
const sum = values => Object.values(values).reduce((n, value) => n + value, 0);
export const scienceSessionBudget = (profile, program, week = program?.currentWeek) =>
  SCIENCE_SESSION_SET_LIMIT * Math.min(7, Math.max(1, Math.round(Number(program?.sessionPlans?.[week]?.plannedSessions ?? profile.daysPerWeek)) || 4));

// Integer water filling: comparable progress from each district's MEV towards
// the low MAV, with a small delay for calves, abs and hamstrings.
export function fitBalancedTargets(desired, budget, floors) {
  const names = Object.keys(desired);
  const targets = Object.fromEntries(names.map(m => [m, Math.min(desired[m], floors?.[m] ?? Math.max(2, scienceReference(m).mev))]));
  const minimum = m => desired[m] > 0 && budget >= names.filter(n => desired[n] > 0).length ? 1 : 0;
  while (sum(targets) > budget) {
    const available = names.filter(m => targets[m] > minimum(m));
    if (!available.length) break;
    available.sort((a, b) => Number(lowerPriority.has(b)) - Number(lowerPriority.has(a))
      || targets[b] / Math.max(1, floors?.[b] ?? scienceReference(b).mev) - targets[a] / Math.max(1, floors?.[a] ?? scienceReference(a).mev)
      || targets[b] - targets[a] || a.localeCompare(b));
    targets[available[0]]--;
  }
  const base = { ...targets };
  while (sum(targets) < budget) {
    const available = names.filter(m => targets[m] < desired[m]);
    if (!available.length) break;
    const progress = m => (targets[m] - base[m]) / Math.max(1, desired[m] - base[m]) + (lowerPriority.has(m) ? 0.15 : 0);
    available.sort((a, b) => progress(a) - progress(b) || a.localeCompare(b));
    targets[available[0]]++;
  }
  return targets;
}

export function balancedStartingTargets(muscles, profile, roles = {}) {
  const desired = Object.fromEntries(muscles.map(m => [m, roles[m] === 'off' ? 0 : roles[m] === 'maintenance' ? scienceReference(m).mv : scienceReference(m).mav[0]]));
  return fitBalancedTargets(desired, scienceSessionBudget(profile));
}

export function allocateBalancedGrowth(program, profile, candidates, increments, scores = {}) {
  const cap = scienceSessionBudget(profile, program, program.currentWeek + 1);
  // A lower session count immediately caps future prescriptions, including
  // old protocols. Original workouts and archived targets are never edited.
  const targets = sum(program.targets) > cap ? fitBalancedTargets(program.targets, cap) : { ...program.targets };
  const reductions = Object.fromEntries(Object.keys(targets).filter(m => targets[m] < program.targets[m]).map(m => [m, program.targets[m] - targets[m]]));
  const increases = {};
  const names = [...candidates].filter(m => !reductions[m]).sort((a, b) => (scores[b] ?? 1) - (scores[a] ?? 1)
    || targets[a] / (program.landmarks[a]?.mavTarget || program.ceilings[a]) - targets[b] / (program.landmarks[b]?.mavTarget || program.ceilings[b]) || a.localeCompare(b));
  const limit = Math.max(1, Math.floor(sum(program.initialTargets || program.targets) * 0.1));
  const belowMev = Object.keys(program.initialTargets || targets).some(m => (program.initialTargets?.[m] ?? targets[m]) < scienceReference(m).mev);
  const donorFloor = m => Math.max(targets[m] > 0 ? 1 : 0,
    belowMev && lowerPriority.has(m) ? 1 : Math.min(program.initialTargets?.[m] ?? targets[m], scienceReference(m).mev));
  let steps = 0;
  // One set per pass shares headroom before giving any district a second set.
  while (steps < limit) {
    let changed = false;
    for (const muscle of names) {
      if (steps >= limit) break;
      if (reductions[muscle] || (increases[muscle] || 0) >= increments[muscle] || targets[muscle] >= program.ceilings[muscle]) continue;
      if (sum(targets) >= cap) {
        const donors = Object.keys(targets).filter(m => m !== muscle && !reductions[m] && !increases[m] && !program.pauses?.[m]
          && program.roles[m] === 'growth' && (scores[muscle] ?? 1) > (scores[m] ?? 1)
          && targets[m] > donorFloor(m));
        donors.sort((a, b) => (scores[a] ?? 1) - (scores[b] ?? 1) || Number(lowerPriority.has(b)) - Number(lowerPriority.has(a)) || targets[b] - targets[a]);
        if (!donors.length) continue;
        targets[donors[0]]--;
        reductions[donors[0]] = 1;
      }
      targets[muscle]++;
      increases[muscle] = (increases[muscle] || 0) + 1;
      steps++;
      changed = true;
    }
    if (!changed) break;
  }
  return { targets, roles: { ...program.roles }, reductions, increases, requiresConsent: false,
    beforeTotal: sum(program.targets), afterTotal: sum(targets), cap };
}
