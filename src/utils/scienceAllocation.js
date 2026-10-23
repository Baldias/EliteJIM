const total = targets => Object.values(targets).reduce((sum, n) => sum + n, 0);
export const scienceWeeklyGrowthBudget = program => Math.max(1, Math.floor(total(program.initialTargets || program.targets) * 0.1));

// Product scheduling rule: hold the non-priority growth base in weeks 1–2;
// in weeks 3–4 transfer only what priorities can use, within staged floors.
// Reductions are returned as a proposal, never silently applied.
export function allocateScienceGrowth(program, profile, candidates, increments, nextWeek) {
  const targets = { ...program.targets };
  const roles = { ...program.roles };
  const priorities = profile.priorities || [];
  const specialized = profile.goal === 'specialization' && priorities.length > 0;
  const names = [...candidates].filter(m => !specialized || priorities.includes(m))
    .sort((a, b) => Number(priorities.includes(b)) - Number(priorities.includes(a)) || (targets[a] / (program.landmarks[a]?.mavTarget || program.ceilings[a])) - (targets[b] / (program.landmarks[b]?.mavTarget || program.ceilings[b])) || a.localeCompare(b));
  let budget = scienceWeeklyGrowthBudget(program);
  const reductions = {};
  const increases = {};
  for (const muscle of names) {
    const desired = Math.max(0, Math.min(increments[muscle], program.ceilings[muscle] - targets[muscle]));
    let transferred = 0;
    if (specialized && nextWeek >= 3 && nextWeek <= 4) {
      const donors = Object.keys(targets).filter(m => !priorities.includes(m) && roles[m] !== 'off' && roles[m] !== 'maintenance' && !program.pauses?.[m]);
      const floor = m => Math.max(program.landmarks[m].mevEstimate ?? 0, program.landmarks[m].mvEstimate, Math.ceil((program.initialTargets?.[m] ?? targets[m]) * (nextWeek === 3 ? 0.75 : 0.5)));
      while (transferred < desired) {
        const donor = donors.filter(m => targets[m] > floor(m)).sort((a, b) => (targets[b] - floor(b)) - (targets[a] - floor(a)) || a.localeCompare(b))[0];
        if (!donor) break;
        targets[donor]--;
        reductions[donor] = (reductions[donor] || 0) + 1;
        transferred++;
        if (targets[donor] <= program.landmarks[donor].mvEstimate) roles[donor] = 'maintenance';
      }
    }
    const extra = Math.min(desired - transferred, budget);
    const increase = transferred + extra;
    targets[muscle] += increase;
    budget -= extra;
    if (increase) increases[muscle] = increase;
  }
  return { targets, roles, reductions, increases, requiresConsent: Object.keys(reductions).length > 0, beforeTotal: total(program.targets), afterTotal: total(targets) };
}
