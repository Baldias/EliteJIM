import { isMachineExercise, locationKey } from './gymLocation';
import { balancedStartingTargets, BALANCED_VOLUME_VERSION, fitBalancedTargets, scienceSessionBudget } from './scienceBalanced';
import { normalizeName } from '../data/exercises';
import { scienceProgramWeekRange } from './scienceCalendar';
import { tr } from '../i18n';
import { allocateScienceGrowth } from './scienceAllocation';
import { scienceSetKey, scienceCompletedSets } from './scienceCarry';
import { SCIENCE_REFERENCE_VERSION, scienceReference, scienceGrowthStep } from './scienceReferences';

// Product starting doses, not measured biological thresholds. Direct-set accounting
// follows RP's convention; indirect work is displayed separately, never added.
export const SCIENCE_MUSCLES = [
  'Petto', 'Dorso', 'Quadricipiti', 'Femorali', 'Glutei', 'Adduttori', 'Polpacci',
  'Spalle',
  'Bicipiti', 'Tricipiti', 'Addome', 'Collo', 'Avambracci',
];
export const LARGE_MUSCLES = ['Petto', 'Dorso', 'Quadricipiti', 'Femorali'];
export const OPTIONAL_MUSCLES = ['Adduttori', 'Collo', 'Avambracci'];
// The MEV floor is identical across experience levels. Historical evidence
// influences the starting dose; MAV/MRV estimates guide subsequent accumulation.
export const SCIENCE_STARTING_DOSES = Object.fromEntries(['beginner','intermediate','advanced'].map(level =>
  [level, Object.fromEntries(SCIENCE_MUSCLES.map(m => [m, scienceReference(m,level).start]))]));
export const emptyScienceState = () => ({
  schemaVersion: 1, profile: null, program: null, archives: [],
  annotations: {}, feedback: {}, classifications: {}, exerciseSnapshots: {},
});
export const legacyScienceKey = report => report?.baseLandmarks
  ? JSON.stringify([report.timestamp || report.startDate || 'undated', report.baseLandmarks, report.focus1, report.focus2]) : null;
export const hasLegacyScience = (report, science) => Boolean(report && report.status !== 'completed' &&
  !(legacyScienceKey(report) && science?.legacyMigration?.protocolId === legacyScienceKey(report)));
export const isScienceV3Active = state => !hasLegacyScience(state.scienceReport, state.scienceState) && state.scienceState?.program?.status === 'active';
export const annotationFor = (science, workoutId, exerciseId, setId) =>
  science?.annotations?.[workoutId]?.[exerciseId]?.[setId] || {};

const SHOULDER_PRESS_IDS = ['s1', 's2', 's6', 's9', 's12', 's13', 's14', 's15', 's16'];
// These catalog entries train muscles outside the tracked districts. In
// particular, tibialis must not become calf work by accident.
const UNTRACKED_IDS = ['b12', 'b13', 'l24'];
const PRESS_IDS = ['c1', 'c2', 'c4', 'c5', 'c6', 'c8', 'c9', 'c10', 'c13', 'c14'];
const PULL_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7', 'b9', 'b10', 'b14', 'b15', 'b16'];
const LEG_IDS = ['l1', 'l2', 'l3', 'l10', 'l11', 'l12', 'l16', 'l18'];
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
};
const blankVolumes = () => Object.fromEntries(SCIENCE_MUSCLES.map(m => [m, { direct: 0, indirect: 0, unknown: 0, ordinary: 0 }]));

export function classifyScienceExercise(exercise, db, science, workoutId) {
  const saved = workoutId != null && exercise.id != null ? science?.exerciseSnapshots?.[workoutId]?.[exercise.id] : null;
  if (saved) return saved;
  const found = db.find(e => normalizeName(e.name) === normalizeName(exercise.name));
  const key = found?.id || normalizeName(exercise.name);
  const override = science?.classifications?.[key];
  if (override) return { ...override, name: exercise.name };
  if (!found || UNTRACKED_IDS.includes(found.id)) return { primary: null, indirect: [], name: exercise.name };
  const primary = SCIENCE_MUSCLES.includes(found.category) ? found.category : null;
  const indirect = new Set((found.secondaryCategories || []).filter(m => SCIENCE_MUSCLES.includes(m)));
  if (PRESS_IDS.includes(found.id)) { indirect.add('Tricipiti'); indirect.add('Spalle'); }
  if (PULL_IDS.includes(found.id)) indirect.add('Bicipiti');
  if (['b3', 'b4', 'b5', 'b7', 'b10', 'b15'].includes(found.id)) indirect.add('Spalle');
  if (LEG_IDS.includes(found.id) || ['l6', 'l7', 'l19'].includes(found.id)) indirect.add('Glutei');
  if (SHOULDER_PRESS_IDS.includes(found.id)) indirect.add('Tricipiti');
  indirect.delete(primary);
  return { primary, indirect: [...indirect], name: exercise.name };
}

export function captureScienceExercises(science, workout, db) {
  if (workout.id == null) return science;
  const snapshots = { ...science.exerciseSnapshots?.[workout.id] };
  for (const ex of workout.exercises || []) {
    if (ex.id == null) continue;
    snapshots[ex.id] = classifyScienceExercise(ex, db, science, workout.id);
  }
  return { ...science, exerciseSnapshots: { ...science.exerciseSnapshots, [workout.id]: snapshots } };
}

// Local calendar arithmetic, not 7 * 24 hours: DST weeks can be 167/169 hours.
export function scienceWeekRange(startDate, week) {
  const start = new Date(startDate);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() };
}

export function scienceVolumes(history, db, science, start, end) {
  const muscles = blankVolumes();
  const unclassified = [];
  for (const workout of history || []) {
    const inWindow = Number(workout.startTime) >= start && Number(workout.startTime) < end;
    const importedStart = science?.program?.importedCountingStarts?.[start];
    if (!inWindow && !(importedStart != null && Number(workout.startTime) >= importedStart && Number(workout.startTime) < end)) continue;
    for (const [exerciseIndex, ex] of (workout.exercises || []).entries()) {
      const classification = classifyScienceExercise(ex, db, science, workout.id);
      for (const [setIndex, set] of (ex.sets || []).entries()) {
        const imported = science?.program?.importedSets?.[scienceSetKey(workout, ex, set, exerciseIndex, setIndex)];
        if (!inWindow && imported?.start !== start) continue;
        const annotation = annotationFor(science, workout.id, ex.id, set.id);
        if (!set.done || !(Number(set.reps) > 0) || set.isDropset || set.isRestPause || set.isWarmup || annotation.excluded) continue;
        const volume = muscles[classification.primary];
        if (!volume) { unclassified.push({ workoutId: workout.id, exerciseId: ex.id, name: ex.name }); continue; }
        volume.ordinary++;
        if (annotation.rir !== 0 && annotation.rir !== 1) {
          volume.unknown++;
          if (imported) volume.imported = (volume.imported || 0) + 1;
          continue;
        }
        volume.direct++;
        for (const muscle of new Set(classification.indirect || [])) {
          if (muscles[muscle] && muscle !== classification.primary) muscles[muscle].indirect++;
        }
      }
    }
  }
  return { muscles, unclassified: unclassified.filter((v, i, a) => a.findIndex(e => e.workoutId === v.workoutId && e.exerciseId === v.exerciseId) === i) };
}

function legacyRecovery(report, start, end) {
  if (!report) return false;
  for (let w = 9; w <= 12; w++) {
    const saved = report.weekHistory?.[w];
    const anchor = report.startDate || report.timestamp;
    const range = saved ? { start: saved.startDate, end: saved.completedDate } : anchor ? scienceWeekRange(anchor, w) : null;
    if (range && range.start < end && range.end > start) return true;
  }
  return false;
}

export function initialScienceVolumes(history, db, science, legacy, startDate, now = Date.now()) {
  const weeks = [];
  for (let back = 1; back <= 8 && weeks.length < 4; back++) {
    const { start, end } = scienceWeekRange(startDate, 1 - back);
    if (end > now) continue;
    if (legacyRecovery(legacy, start, end)) continue;
    if ((science.archives || []).some(p => p.weeks?.some(w => w.start < end && w.end > start && w.recovery))) continue;
    const volume = scienceVolumes(history, db, science, start, end);
    if (Object.values(volume.muscles).some(v => v.ordinary)) weeks.push(volume);
  }
  return Object.fromEntries(SCIENCE_MUSCLES.map(m => {
    const samples = weeks.map(w => w.muscles[m].ordinary);
    const dose = samples.length >= 2 ? Math.round(median(samples)) : 0;
    return [m, dose > 0 ? dose : null];
  }));
}

export function createScienceProgram(profile, history, db, science, legacy, now = Date.now()) {
  const start = new Date(profile.startDate || now);
  start.setHours(0, 0, 0, 0);
  const startDate = start.getTime();
  const experience = ['beginner', 'intermediate', 'advanced'].includes(profile.experience) ? profile.experience : 'beginner';
  const priorities = [...new Set(profile.priorities || [])].filter(m => SCIENCE_MUSCLES.includes(m) && !(profile.gender === 'male' && m === 'Glutei')).slice(0, 3);
  const active = SCIENCE_MUSCLES.filter(m => (profile.gender !== 'male' || m !== 'Glutei') && (!OPTIONAL_MUSCLES.includes(m) || profile.optionalMuscles?.includes(m)));
  const baseline = initialScienceVolumes(history, db, science, legacy, startDate, now);
  const historicalRange = scienceWeekRange(startDate, -7);
  const historicalVolumes = scienceVolumes(history, db, science, historicalRange.start, Math.min(startDate, now));
  const historicalFeedback = history.filter(w => Number(w.startTime) >= historicalRange.start && Number(w.startTime) < Math.min(startDate, now)).map(w => science.feedback?.[w.id]).filter(Boolean);
  const hasHistory = active.some(m => baseline[m] != null);
  const targets = {};
  const roles = {};
  const initialEstimates = {};
  for (const muscle of active) {
    const role = profile.goal === 'specialization' && priorities.length && !priorities.includes(muscle) ? 'support' : 'growth';
    roles[muscle] = profile.roles?.[muscle] || role;
    const dose = SCIENCE_STARTING_DOSES[experience][muscle];
    const volume = historicalVolumes.muscles[muscle];
    const feedback = historicalFeedback.map(f => f.muscles?.[muscle]).filter(Boolean);
    const reliable = volume.ordinary > 0 && volume.direct / volume.ordinary >= 0.8 && feedback.length >= 2 &&
      feedback.every(f => f.quality === 'good' && f.recovery === 'good' && !f.pain) && !historicalFeedback.some(f => f.systemicFatigue);
    // Product weighting, not a percentage established by RP or a measured MEV.
    // High logged volume alone cannot become the starting growth dose.
    const weight = baseline[muscle] == null ? 0 : ({ beginner: reliable ? 0.3 : 0.15, intermediate: reliable ? 0.45 : 0.25, advanced: reliable ? 0.6 : 0.35 })[experience];
    const upper = Math.max(dose, scienceReference(muscle, experience).mavTarget);
    const ordinary = Math.min(upper, Math.max(dose, Math.round(dose + weight * ((baseline[muscle] ?? dose) - dose))));
    initialEstimates[muscle] = { referenceDose:dose, historyMedian:baseline[muscle], historyWeight:weight, reliable, estimate:ordinary };
    targets[muscle] = roles[muscle] === 'off' ? 0 : roles[muscle] === 'maintenance' ? Math.max(scienceReference(muscle).mv, Math.ceil(ordinary / 2)) : ordinary;
  }
  if (profile.goal === 'balanced') {
    Object.assign(targets, balancedStartingTargets(active, profile, roles));
    for (const muscle of active) initialEstimates[muscle] = { ...initialEstimates[muscle], referenceDose: scienceReference(muscle).mav[0], historyWeight: 0, estimate: targets[muscle] };
  }
  const budget = Math.max(1, Math.floor((Number(profile.daysPerWeek) || 4) * (Number(profile.minutesPerSession) || 60) / 4));
  const sum = Object.values(targets).reduce((a, n) => a + n, 0);
  const timeRestricted = profile.goal !== 'balanced' && !hasHistory && budget < sum * 0.6;
  if (timeRestricted) {
    // Largest-remainder allocation preserves the time budget exactly.
    const scaled = active.map(m => ({ muscle: m, value: targets[m] * budget / sum }));
    scaled.forEach(v => { targets[v.muscle] = Math.floor(v.value); });
    let remainder = budget - Object.values(targets).reduce((a, n) => a + n, 0);
    for (const v of scaled.sort((a, b) => (b.value % 1) - (a.value % 1))) {
      if (remainder-- <= 0) break;
      targets[v.muscle]++;
    }
  }
  const landmarks = Object.fromEntries(active.map(m => [m, {
    ...(science.program?.landmarks?.[m] ? structuredClone(science.program.landmarks[m]) : {}),
    mvEstimate: scienceReference(m).mv,
    mevEstimate: scienceReference(m).mev,
    referenceMav: [...scienceReference(m).mav],
    mavTarget: scienceReference(m, experience).mavTarget,
    mrvEstimate: scienceReference(m, experience).mrvEstimate,
    productiveRange: structuredClone(science.program?.landmarks?.[m]?.productiveRange ?? null),
    maxTolerated: science.program?.landmarks?.[m]?.maxTolerated ?? null,
    mrv: structuredClone(science.program?.landmarks?.[m]?.mrv ?? null),
    fatigueSignals: structuredClone(science.program?.landmarks?.[m]?.fatigueSignals || []),
    confidence: science.program?.landmarks?.[m]?.confidence || 'low',
    source: profile.goal === 'balanced' ? 'balanced-low-mav' : targets[m] > SCIENCE_STARTING_DOSES[experience][m] && initialEstimates[m].historyWeight > 0 ? 'blended-estimate' : 'starting-dose',
  }]));
  const program = {
    balancedVolumeVersion: profile.goal === 'balanced' ? BALANCED_VOLUME_VERSION : null,
    id: `science-v3-${now}`, modelVersion: 3, status: 'active', startDate,
    currentWeek: 1, plannedWeeks: 5, allocationVersion: 2, startingDoseVersion: SCIENCE_REFERENCE_VERSION, timeRestricted, initialEstimates, weekStarts: { 1: startDate }, sessionPlans: {}, weekDeferrals: [], targets, initialTargets: { ...targets }, roles,
    ceilings: Object.fromEntries(active.map(m => [m, Math.max(scienceReference(m, experience).mrvEstimate, targets[m])])),
    landmarks, weeks: [], recommendations: [], pauses: {},
    timeWarning: sum > budget ? timeRestricted
      ? tr('Forte carenza di tempo: ~{available} minuti disponibili contro ~{needed} richiesti. La base è ridotta e può scendere sotto la dose di crescita di riferimento. Aumenta la disponibilità per ripristinarla.', { available: budget * 4, needed: sum * 4 })
      : tr('Stima: ~{needed} min/settimana, ne hai indicati {available}. I target sono conservati: valuta più tempo o priorità diverse.', { needed: sum * 4, available: budget * 4 }) : null,
    decisions: {},
  };
  return { ...science, profile: { ...profile, experience, priorities }, program };
}

export function currentScienceSummary(history, db, science, now = Date.now()) {
  const p = science?.program;
  if (!p) return null;
  const range = scienceProgramWeekRange(p);
  const result = scienceVolumes(history, db, science, range.start, now + 1);
  return { ...result, ...range, end: Math.max(range.end, now + 1), scheduledEnd: range.end, week: p.currentWeek, targets: p.targets, roles: p.roles };
}

// Compare like with like (same exercise, RIR and external load). Arbitrary
// machine load changes and different exercises cannot fabricate a plateau.
export function sciencePerformance(history, db, science, muscle, end) {
  const exposures = [];
  for (const workout of [...history].sort((a, b) => a.startTime - b.startTime)) {
    if (workout.startTime >= end || workout.startTime < science.program.startDate) continue;
    for (const ex of workout.exercises || []) {
      if (classifyScienceExercise(ex, db, science, workout.id).primary !== muscle) continue;
      for (const rir of [0, 1]) {
        const sets = (ex.sets || []).filter(s => {
          const a = annotationFor(science, workout.id, ex.id, s.id);
          return s.done && !s.isDropset && !s.isRestPause && !s.isWarmup && !a.excluded && a.rir === rir && Number(s.reps) > 0;
        });
        const best = sets.reduce((a, s) => !a || Number(s.kg) > Number(a.kg) || (Number(s.kg) === Number(a.kg) && Number(s.reps) > Number(a.reps)) ? s : a, null);
        if (best) exposures.push({ name: normalizeName(ex.name), rir, kg: Number(best.kg) || 0, reps: Number(best.reps), time: Number(workout.startTime), workoutId: workout.id, location: isMachineExercise(ex.name, db) ? locationKey(workout) : null, scoped: workout.machineLocationScoped });
      }
    }
  }
  const latest = exposures.at(-1);
  if (!latest) return { status: 'insufficient', count: 0 };
  const comparable = exposures.filter(e => e.name === latest.name && e.rir === latest.rir && (!latest.scoped || latest.location !== 'unlocated' && e.location === latest.location) && e.time >= end - 42 * 86400000);
  const unique = comparable.filter((e, i, a) => a.findLastIndex(v => v.workoutId === e.workoutId) === i).slice(-3);
  if (unique.length < 3) return { status: 'insufficient', count: unique.length };
  const increases = (a, b) => (b.kg >= a.kg && b.reps >= a.reps && (b.kg > a.kg || b.reps > a.reps));
  const decreases = (a, b) => b.kg <= a.kg && b.reps <= a.reps && (b.kg < a.kg || b.reps < a.reps);
  if (increases(unique[0], unique[1]) || increases(unique[1], unique[2])) return { status: 'progress', count: 3 };
  if (decreases(unique[0], unique[1]) && decreases(unique[1], unique[2])) return { status: 'decline', count: 3 };
  if (unique.every(e => e.kg === latest.kg && e.reps === latest.reps)) return { status: 'plateau', count: 3 };
  return { status: 'mixed', count: 3 };
}

export function closeScienceWeek(science, history, db, now = Date.now()) {
  const p = science?.program;
  if (!p || p.status !== 'active') return science;
  const range = scienceProgramWeekRange(p);
  if (now < range.end || p.weeks.some(w => w.week === p.currentWeek)) return science;
  const closedRange = { start: range.start, end: Math.max(range.end, now) };
  const volumes = scienceVolumes(history, db, science, closedRange.start, closedRange.end);
  const workouts = history.filter(w => w.startTime >= closedRange.start && w.startTime < closedRange.end);
  const targets = { ...p.targets };
  const landmarks = structuredClone(p.landmarks);
  const decisions = {};
  const recommendations = [...p.recommendations];
  const candidates = [];
  const increments = {};
  const growthScores = {};
  const fatigued = [];
  const feedback = workouts.map(w => science.feedback?.[w.id]).filter(Boolean);
  // Only explicitly marked fatigue, repeated across sessions, stops the block.
  // The new "mild" answer never becomes a systemic recovery problem.
  const systemic = feedback.filter(f => f.systemicFatigue === true).length >= 2;
  for (const muscle of Object.keys(targets)) {
    const volume = volumes.muscles[muscle];
    const performance = sciencePerformance(history, db, science, muscle, closedRange.end);
    const local = feedback.map(f => f.muscles?.[muscle]).filter(Boolean);
    const completed = scienceCompletedSets(volume);
    const markedPain = local.some(f => f.pain === true);
    const poorChecks = local.filter(f => f.recovery === 'poor' || f.quality === 'poor');
    const poorRecovery = markedPain || poorChecks.length >= 2
      || local.some(f => f.recovery === 'poor' && f.quality === 'poor');
    const concerningDecline = performance.status === 'decline' && poorChecks.length > 0;
    const recoveryBlocked = systemic || poorRecovery || concerningDecline;
    const mildSignals = local.some(f => ['fair', 'poor'].includes(f.recovery)
      || ['fair', 'poor'].includes(f.quality) || f.pain === 'mild')
      || feedback.some(f => f.systemicFatigue || ['fair', 'poor'].includes(f.sleep));
    const goodRecovery = local.length > 0 && local.every(f => f.recovery === 'good' && !f.pain && f.quality === 'good') && !mildSignals && !systemic;
    // scienceVolumes already excludes warmups, techniques and excluded sets.
    // Missing RIR does not erase a completed exposure or prevent progression.
    const hasData = completed > 0;
    growthScores[muscle] = recoveryBlocked ? -2 : mildSignals ? 0 : goodRecovery ? (performance.status === 'progress' ? 3 : 2) : 1;
    if (hasData && (poorRecovery || concerningDecline)) {
      fatigued.push(muscle);
      landmarks[muscle].fatigueSignals.push({ week: p.currentWeek, volume: completed, poorRecovery, performance: performance.status });
      const signals = landmarks[muscle].fatigueSignals;
      if (signals.length >= 2 && landmarks[muscle].maxTolerated != null && !local.some(f => f.pain)) {
        const lower = landmarks[muscle].maxTolerated;
        landmarks[muscle].mrv = { lower, upper: Math.max(lower, Math.min(...signals.slice(-2).map(s => s.volume))), confidence: 'low' };
      }
    }
    if (hasData && goodRecovery && volume.direct > 0 && performance.status === 'progress') {
      const old = landmarks[muscle].productiveRange;
      landmarks[muscle].productiveRange = old ? [Math.min(old[0], volume.direct), Math.max(old[1], volume.direct)] : [volume.direct, volume.direct];
      landmarks[muscle].maxTolerated = Math.max(landmarks[muscle].maxTolerated || 0, volume.direct);
      landmarks[muscle].confidence = 'observed';
    }
    const qualityCoverage = volume.ordinary > 0 ? volume.direct / volume.ordinary : 0;
    if (!hasData) decisions[muscle] = 'Nessuna serie ordinaria completata: target invariato.';
    else if (p.currentWeek >= 4) decisions[muscle] = p.currentWeek === 4 ? 'Picco del blocco registrato: valutiamo lo scarico, senza imporlo.' : 'Settimana di recupero da concordare: nessuna riduzione automatica.';
    else if (p.roles[muscle] !== 'growth') decisions[muscle] = 'Distretto fuori priorità: base di volume conservata.';
    else if (recoveryBlocked) decisions[muscle] = systemic ? 'Aumento sospeso: fatica generale marcata in almeno due sedute.' : markedPain ? 'Aumento sospeso: dolore che limita il movimento.' : 'Aumento sospeso: recupero insufficiente ripetuto o segnali marcati associati.';
    else if (completed < targets[muscle] * 0.8) decisions[muscle] = 'Completa almeno l’80% delle serie previste prima di aumentare il target.';
    else if (targets[muscle] >= p.ceilings[muscle]) decisions[muscle] = 'Soglia di volume raggiunta: rivaluta l’obiettivo prima di aggiungere serie.';
    else if (targets[muscle] > 0 && !p.pauses?.[muscle]) {
      candidates.push(muscle);
      const exposures = workouts.filter(w => scienceCompletedSets(scienceVolumes([w], db, science, closedRange.start, closedRange.end).muscles[muscle]) > 0).length;
      const strongQuality = goodRecovery && volume.direct >= targets[muscle] && qualityCoverage >= 0.9 && exposures >= 2;
      // Mild fatigue changes the size of the step, never cancels it.
      increments[muscle] = mildSignals ? 1 : scienceGrowthStep(p, muscle, strongQuality);
      decisions[muscle] = 'Incremento disponibile: in attesa dell’allocazione del volume settimanale.';
    }
  }
  const allocation = allocateScienceGrowth(p, science.profile, candidates, increments, p.currentWeek + 1, growthScores);
  let nextRoles = { ...p.roles };
  for (let i = 0; i < recommendations.length; i++) {
    if (recommendations[i].status === 'pending' && recommendations[i].type === 'redistribution') recommendations[i] = { ...recommendations[i], status: 'superseded' };
  }
  if (allocation.requiresConsent) {
    recommendations.push({ id: `${p.id}-redistribution-${p.currentWeek}`, type: 'redistribution', status: 'pending', week: p.currentWeek,
      muscles: Object.keys(allocation.reductions), increases: allocation.increases, reductions: allocation.reductions,
      proposedTargets: allocation.targets, proposedRoles: allocation.roles, basisTargets: { ...p.targets },
      beforeTotal: allocation.beforeTotal, afterTotal: allocation.afterTotal,
      reason: 'Spostiamo parte del lavoro dai distretti fuori priorità alle priorità nelle ultime due settimane, mantenendo il totale stabile o con una piccola crescita. Applichiamo la redistribuzione solo se la accetti.',
    });
    for (const m of Object.keys(allocation.increases)) decisions[m] = tr('+{n} serie proposte con redistribuzione: in attesa della tua scelta.', { n: allocation.increases[m] });
  } else {
    Object.assign(targets, allocation.targets);
    nextRoles = allocation.roles;
    for (const muscle of candidates) {
      const increase = allocation.increases[muscle];
      decisions[muscle] = increase
        ? tr('+{n} serie: nessun problema di recupero marcato. Incremento graduale entro il budget settimanale.', { n: increase })
        : science.profile.goal === 'balanced' ? 'Volume conservato: limite di 20 serie per seduta; gli aumenti seguono recupero e andamento dei carichi.' : 'Incremento rimandato: budget settimanale assegnato alle altre priorità, nessun blocco del recupero.';
    }
  }
  if (science.profile.goal === 'balanced') for (const [muscle, reduction] of Object.entries(allocation.reductions)) {
    decisions[muscle] = tr('−{n} serie: volume ridistribuito entro il limite di 20 serie per seduta, privilegiando i distretti che recuperano meglio.', { n: reduction });
  }
  const affected = systemic ? Object.keys(targets).filter(m => targets[m] > 0) : fatigued;
  if (p.currentWeek < 4 && affected.length && !recommendations.some(r => r.status === 'pending' && r.type === 'recovery')) {
    recommendations.push({
      id: `${p.id}-recovery-${p.currentWeek}`, type: 'recovery', status: 'pending', week: p.currentWeek,
      muscles: affected, systemic,
      reason: systemic ? 'Hai segnalato fatica generale marcata in almeno due sedute. Valuta meno serie o una pausa; decidi tu.' : 'Dolore limitante, recupero insufficiente ripetuto o calo con segnali marcati: valuta meno serie o una pausa per questi distretti.',
      proposedTargets: Object.fromEntries(affected.map(m => [m, Math.max(0, targets[m] - Math.ceil(targets[m] * 0.25))])),
    });
  }
  if (p.currentWeek === 4) {
    // A single pending decision avoids applying both a local recovery and the
    // end-of-block deload on top of one another.
    for (let i = 0; i < recommendations.length; i++) {
      if (recommendations[i].status === 'pending') recommendations[i] = { ...recommendations[i], status: 'superseded' };
    }
    // The scheduled deload is proposed, not applied. The athlete chooses whole
    // body or just the districts showing difficulty, or postpones it entirely.
    const districts = affected.length ? affected : Object.keys(targets).filter(m => p.roles[m] === 'growth' && targets[m] > 0);
    recommendations.push({
      id: `${p.id}-deload`, type: 'deload', status: 'pending', week: 4,
      muscles: districts, systemic,
      reason: affected.length ? 'Quattro settimane di accumulo completate. Puoi scaricare tutto il corpo oppure solo i distretti con segnali di recupero insufficiente.' : 'Quattro settimane di accumulo completate. Senza segnali negativi marcati non dichiariamo overreaching: puoi scaricare tutto, i distretti in crescita, oppure rimandare.',
      proposedTargets: Object.fromEntries(districts.map(m => [m, Math.floor(targets[m] * 0.5)])),
    });
  }
  const week = {
    week: p.currentWeek, ...closedRange, scheduledEnd: range.end, roles: { ...p.roles }, targets: { ...p.targets }, volumes,
    decisions, landmarks: structuredClone(landmarks), recovery: Object.values(p.pauses).some(Boolean) || p.recommendations.some(r => r.status === 'accepted' && r.appliedWeek === p.currentWeek),
    classifications: Object.fromEntries(workouts.map(w => [w.id, Object.fromEntries((w.exercises || []).map(ex => [ex.id, classifyScienceExercise(ex, db, science, w.id)]))])),
  };
  const pauses = { ...p.pauses };
  for (const [muscle, pause] of Object.entries(pauses)) {
    if (pause && pause.week === p.currentWeek) { targets[muscle] = pause.resumeTarget; delete pauses[muscle]; }
  }
  if (science.profile.goal === 'balanced') Object.assign(targets, fitBalancedTargets(targets, scienceSessionBudget(science.profile, p, p.currentWeek + 1)));
  return { ...science, program: { ...p, targets, roles: nextRoles, weekStarts: { ...p.weekStarts, [p.currentWeek + 1]: closedRange.end }, landmarks, decisions, recommendations, pauses, weeks: [...p.weeks, week], currentWeek: p.currentWeek + 1, status: p.currentWeek >= p.plannedWeeks ? 'completed' : 'active' } };
}

export function respondScienceRecommendation(science, id, choice, now = Date.now()) {
  const p = science?.program;
  const rec = p?.recommendations.find(r => r.id === id && r.status === 'pending');
  if (!rec || p.status !== 'active' || !['reject', 'reduce', 'reduce-all', 'pause', 'redistribute'].includes(choice)) return science;
  if (rec.type === 'redistribution') {
    if (!['reject', 'redistribute'].includes(choice)) return science;
    if (Object.keys(p.targets).some(m => p.targets[m] !== rec.basisTargets[m])) return science;
    const accepted = choice === 'redistribute';
    return { ...science, program: { ...p,
      targets: accepted ? { ...rec.proposedTargets } : p.targets,
      roles: accepted ? { ...rec.proposedRoles } : p.roles,
      decisions: { ...p.decisions, ...Object.fromEntries(Object.keys(p.targets).map(m => [m, accepted ? 'Redistribuzione settimanale accettata: il lavoro segue le priorità mantenendo contenuto il totale.' : 'Redistribuzione rifiutata: obiettivo conservato.'])) },
      recommendations: p.recommendations.map(r => r.id === id ? { ...r, status: accepted ? 'accepted' : 'rejected', choice, respondedAt: now, appliedWeek: p.currentWeek } : r),
    } };
  }
  if (choice === 'redistribute') return science;
  const targets = { ...p.targets };
  const pauses = { ...p.pauses };
  const muscles = (choice === 'reduce-all' ? Object.keys(targets) : rec.muscles).filter(m => Object.hasOwn(targets, m));
  const reduction = rec.type === 'deload' ? 0.5 : 0.25;
  if (choice !== 'reject') for (const muscle of muscles) {
    if (choice === 'pause') {
      pauses[muscle] = { week: p.currentWeek, resumeTarget: Math.max(0, targets[muscle] - Math.ceil(targets[muscle] * reduction)) };
      targets[muscle] = 0;
    } else targets[muscle] = Math.max(0, targets[muscle] - Math.ceil(targets[muscle] * reduction));
  }
  return { ...science, program: { ...p, targets, pauses, recommendations: p.recommendations.map(r => r.id === id ? { ...r, status: choice === 'reject' ? 'rejected' : 'accepted', choice, respondedAt: now, appliedWeek: p.currentWeek } : choice !== 'reject' && r.type === 'redistribution' && r.status === 'pending' ? { ...r, status: 'superseded' } : r) } };
}
