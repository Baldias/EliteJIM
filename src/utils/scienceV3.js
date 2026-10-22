import { normalizeName } from '../data/exercises';
import { scienceProgramWeekRange } from './scienceCalendar';
import { allocateScienceGrowth } from './scienceAllocation';

// Product starting doses, not measured biological thresholds. Direct-set accounting
// follows RP's convention; indirect work is displayed separately, never added.
export const SCIENCE_MUSCLES = [
  'Petto', 'Dorso', 'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci',
  'Spalle',
  'Bicipiti', 'Tricipiti', 'Addome', 'Collo', 'Avambracci',
];
export const LARGE_MUSCLES = ['Petto', 'Dorso', 'Quadricipiti', 'Femorali'];
export const OPTIONAL_MUSCLES = ['Collo', 'Avambracci'];
// Experience-based starting estimates for ordinary 0–1 RIR work. Sparse logs
// cannot lower these estimates. They are programming defaults, not a measured
// individual MEV; recovery feedback can still lead to an accepted reduction.
export const SCIENCE_STARTING_DOSES = {
  beginner: { Petto: 6, Dorso: 6, Quadricipiti: 6, Femorali: 4, Glutei: 4, Polpacci: 4, Spalle: 4, Bicipiti: 4, Tricipiti: 4, Addome: 4, Collo: 2, Avambracci: 2 },
  intermediate: { Petto: 8, Dorso: 10, Quadricipiti: 8, Femorali: 6, Glutei: 6, Polpacci: 6, Spalle: 6, Bicipiti: 6, Tricipiti: 6, Addome: 4, Collo: 2, Avambracci: 2 },
  advanced: { Petto: 12, Dorso: 12, Quadricipiti: 10, Femorali: 8, Glutei: 6, Polpacci: 8, Spalle: 10, Bicipiti: 8, Tricipiti: 8, Addome: 6, Collo: 4, Avambracci: 4 },
};
export const SCIENCE_MAINTENANCE_FLOORS = { beginner: 2, intermediate: 3, advanced: 4 };
export const emptyScienceState = () => ({
  schemaVersion: 1, profile: null, program: null, archives: [],
  annotations: {}, feedback: {}, classifications: {}, exerciseSnapshots: {},
});
export const hasLegacyScience = report => Boolean(report && report.status !== 'completed');
export const isScienceV3Active = state => !hasLegacyScience(state.scienceReport) && state.scienceState?.program?.status === 'active';
export const annotationFor = (science, workoutId, exerciseId, setId) =>
  science?.annotations?.[workoutId]?.[exerciseId]?.[setId] || {};

const SHOULDER_PRESS_IDS = ['s1', 's2', 's6', 's9', 's12', 's13', 's14', 's15', 's16'];
// These catalog entries train muscles outside the tracked districts. In
// particular, adductors and tibialis must not become quad/calf work by accident.
const UNTRACKED_IDS = ['b12', 'b13', 'l14', 'l24'];
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
  const saved = science?.exerciseSnapshots?.[workoutId]?.[exercise.id];
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
  const snapshots = { ...science.exerciseSnapshots?.[workout.id] };
  for (const ex of workout.exercises || []) {
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
    if (!(Number(workout.startTime) >= start && Number(workout.startTime) < end)) continue;
    for (const ex of workout.exercises || []) {
      const classification = classifyScienceExercise(ex, db, science, workout.id);
      for (const set of ex.sets || []) {
        const annotation = annotationFor(science, workout.id, ex.id, set.id);
        if (!set.done || !(Number(set.reps) > 0) || set.isDropset || set.isRestPause || set.isWarmup || annotation.excluded) continue;
        const volume = muscles[classification.primary];
        if (!volume) { unclassified.push({ workoutId: workout.id, exerciseId: ex.id, name: ex.name }); continue; }
        volume.ordinary++;
        if (annotation.rir !== 0 && annotation.rir !== 1) { volume.unknown++; continue; }
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
  const priorities = [...new Set(profile.priorities || [])].filter(m => SCIENCE_MUSCLES.includes(m)).slice(0, 3);
  const active = SCIENCE_MUSCLES.filter(m => !OPTIONAL_MUSCLES.includes(m) || profile.optionalMuscles?.includes(m));
  const baseline = initialScienceVolumes(history, db, science, legacy, startDate, now);
  const hasHistory = active.some(m => baseline[m] != null);
  const targets = {};
  const roles = {};
  for (const muscle of active) {
    const role = profile.goal === 'specialization' && priorities.length && !priorities.includes(muscle) ? 'support' : 'growth';
    roles[muscle] = profile.roles?.[muscle] || role;
    const dose = SCIENCE_STARTING_DOSES[experience][muscle];
    const ordinary = Math.max(dose, baseline[muscle] ?? 0);
    targets[muscle] = roles[muscle] === 'off' ? 0 : roles[muscle] === 'maintenance' ? Math.max(SCIENCE_MAINTENANCE_FLOORS[experience], Math.ceil(ordinary / 2)) : ordinary;
  }
  const budget = Math.max(1, Math.floor((Number(profile.daysPerWeek) || 4) * (Number(profile.minutesPerSession) || 60) / 4));
  const sum = Object.values(targets).reduce((a, n) => a + n, 0);
  if (!hasHistory && sum > budget) {
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
    mvEstimate: roles[m] === 'maintenance' ? targets[m] : Math.max(SCIENCE_MAINTENANCE_FLOORS[experience], Math.ceil(targets[m] / 2)),
    mevEstimate: ['growth', 'support'].includes(roles[m]) ? targets[m] : null,
    productiveRange: structuredClone(science.program?.landmarks?.[m]?.productiveRange ?? null),
    maxTolerated: science.program?.landmarks?.[m]?.maxTolerated ?? null,
    mrv: structuredClone(science.program?.landmarks?.[m]?.mrv ?? null),
    fatigueSignals: structuredClone(science.program?.landmarks?.[m]?.fatigueSignals || []),
    confidence: science.program?.landmarks?.[m]?.confidence || 'low',
    source: baseline[m] != null && baseline[m] >= SCIENCE_STARTING_DOSES[experience][m] ? 'history-estimate' : 'starting-dose',
  }]));
  const program = {
    id: `science-v3-${now}`, modelVersion: 3, status: 'active', startDate,
    currentWeek: 1, plannedWeeks: 5, allocationVersion: 2, weekStarts: { 1: startDate }, sessionPlans: {}, weekDeferrals: [], targets, initialTargets: { ...targets }, roles,
    ceilings: Object.fromEntries(active.map(m => [m, Math.max(experience === 'beginner' ? 16 : experience === 'intermediate' ? 20 : 24, targets[m])])),
    landmarks, weeks: [], recommendations: [], pauses: {},
    timeWarning: sum > budget ? hasHistory ? `Il volume iniziale deriva dallo storico (~${sum * 4} min/settimana); verifica la disponibilità dichiarata.` : 'La dose iniziale è proporzionata al tempo dichiarato usando ~4 minuti per serie, una stima organizzativa. Con poco tempo alcuni distretti possono richiedere più disponibilità.' : null,
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
        if (best) exposures.push({ name: normalizeName(ex.name), rir, kg: Number(best.kg) || 0, reps: Number(best.reps), time: Number(workout.startTime), workoutId: workout.id });
      }
    }
  }
  const latest = exposures.at(-1);
  if (!latest) return { status: 'insufficient', count: 0 };
  const comparable = exposures.filter(e => e.name === latest.name && e.rir === latest.rir && e.time >= end - 42 * 86400000);
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
  const fatigued = [];
  const feedback = workouts.map(w => science.feedback?.[w.id]).filter(Boolean);
  const systemic = feedback.filter(f => f.systemicFatigue).length >= 2;
  for (const muscle of Object.keys(targets)) {
    const volume = volumes.muscles[muscle];
    const performance = sciencePerformance(history, db, science, muscle, closedRange.end);
    const local = feedback.map(f => f.muscles?.[muscle]).filter(Boolean);
    const goodRecovery = local.length > 0 && local.every(f => f.recovery === 'good' && !f.pain && f.quality !== 'poor') && !systemic;
    const poorRecovery = local.some(f => f.recovery === 'poor' || f.quality === 'poor' || f.pain);
    const currentExposure = workouts.some(w => (w.exercises || []).some(ex => classifyScienceExercise(ex, db, science, w.id).primary === muscle && ex.sets?.some(s => s.done && [0, 1].includes(annotationFor(science, w.id, ex.id, s.id).rir))));
    const hasData = workouts.length > 0 && currentExposure && volume.direct > 0;
    if (hasData && (poorRecovery || performance.status === 'decline')) {
      fatigued.push(muscle);
      landmarks[muscle].fatigueSignals.push({ week: p.currentWeek, volume: volume.direct, poorRecovery, performance: performance.status });
      const signals = landmarks[muscle].fatigueSignals;
      if (signals.length >= 2 && landmarks[muscle].maxTolerated != null && !local.some(f => f.pain)) {
        const lower = landmarks[muscle].maxTolerated;
        landmarks[muscle].mrv = { lower, upper: Math.max(lower, Math.min(...signals.slice(-2).map(s => s.volume))), confidence: 'low' };
      }
    }
    if (hasData && goodRecovery && performance.status === 'progress') {
      const old = landmarks[muscle].productiveRange;
      landmarks[muscle].productiveRange = old ? [Math.min(old[0], volume.direct), Math.max(old[1], volume.direct)] : [volume.direct, volume.direct];
      landmarks[muscle].maxTolerated = Math.max(landmarks[muscle].maxTolerated || 0, volume.direct);
      landmarks[muscle].confidence = 'observed';
      decisions[muscle] = 'Prestazioni in crescita: conserva il volume che sta funzionando.';
    }
    const qualityCoverage = volume.ordinary > 0 ? volume.direct / volume.ordinary : 0;
    if (!hasData) decisions[muscle] = 'Dati insufficienti: target invariato. Registra serie ordinarie e RIR.';
    else if (p.currentWeek >= 4) decisions[muscle] = p.currentWeek === 4 ? 'Picco del blocco registrato: valutiamo lo scarico, senza imporlo.' : 'Settimana di recupero da concordare: nessuna riduzione automatica.';
    else if (p.roles[muscle] === 'growth' && goodRecovery && performance.status !== 'decline' && volume.direct >= targets[muscle] * 0.8 && qualityCoverage >= 0.8 && targets[muscle] < p.ceilings[muscle]) {
      candidates.push(muscle);
      const exposures = workouts.filter(w => (w.exercises || []).some(ex => classifyScienceExercise(ex, db, science, w.id).primary === muscle && ex.sets?.some(s => s.done && !annotationFor(science, w.id, ex.id, s.id).excluded && [0, 1].includes(annotationFor(science, w.id, ex.id, s.id).rir)))).length;
      const strongQuality = volume.direct >= targets[muscle] && qualityCoverage >= 0.9 && exposures >= 2 && local.every(f => f.quality === 'good');
      increments[muscle] = science.profile.experience === 'beginner' ? 1 : science.profile.experience === 'advanced' && strongQuality && science.profile.priorities.includes(muscle) ? 3 : 2;
      decisions[muscle] = 'Serie confermate e recupero buono: possiamo aumentare lo stimolo.';
    } else if (performance.status !== 'progress') decisions[muscle] = 'Target conservato: servono serie di qualità confermate e feedback di recupero buono. Puoi sempre impostarlo tu.';
  }
  const allocation = allocateScienceGrowth(p, science.profile, candidates, increments, p.currentWeek + 1);
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
    for (const m of Object.keys(allocation.increases)) decisions[m] = `+${allocation.increases[m]} serie proposte con redistribuzione: in attesa della tua scelta.`;
  } else {
    Object.assign(targets, allocation.targets);
    nextRoles = allocation.roles;
    for (const [muscle, increase] of Object.entries(allocation.increases)) decisions[muscle] = `+${increase} serie: qualità e recupero buoni. Aumento totale contenuto entro circa il 5% della dose iniziale.`;
  }
  const affected = systemic ? Object.keys(targets).filter(m => targets[m] > 0) : fatigued;
  if (p.currentWeek < 4 && affected.length && !recommendations.some(r => r.status === 'pending' && r.type === 'recovery')) {
    recommendations.push({
      id: `${p.id}-recovery-${p.currentWeek}`, type: 'recovery', status: 'pending', week: p.currentWeek,
      muscles: affected, systemic,
      reason: systemic ? 'Hai segnalato fatica generale in almeno due sedute. Valuta meno serie o una pausa; decidi tu.' : 'Recupero insufficiente, fastidi o calo ripetuto: valuta meno serie o una pausa per questi distretti.',
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
  const muscles = choice === 'reduce-all' ? Object.keys(targets) : rec.muscles;
  const reduction = rec.type === 'deload' ? 0.5 : 0.25;
  if (choice !== 'reject') for (const muscle of muscles) {
    if (choice === 'pause') {
      pauses[muscle] = { week: p.currentWeek, resumeTarget: Math.max(0, targets[muscle] - Math.ceil(targets[muscle] * reduction)) };
      targets[muscle] = 0;
    } else targets[muscle] = Math.max(0, targets[muscle] - Math.ceil(targets[muscle] * reduction));
  }
  return { ...science, program: { ...p, targets, pauses, recommendations: p.recommendations.map(r => r.id === id ? { ...r, status: choice === 'reject' ? 'rejected' : 'accepted', choice, respondedAt: now, appliedWeek: p.currentWeek } : choice !== 'reject' && r.type === 'redistribution' && r.status === 'pending' ? { ...r, status: 'superseded' } : r) } };
}
