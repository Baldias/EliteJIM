import { getAllExercises, normalizeName } from '../data/exercises';
import { applyScienceBackfill } from '../utils/scienceBackfill';
import { completeScienceEvolution, decideLegacyDynamicVolume } from '../utils/scienceEvolution';
import {
  SCIENCE_MUSCLES, OPTIONAL_MUSCLES, emptyScienceState, hasLegacyScience,
  createScienceProgram, closeScienceWeek, respondScienceRecommendation, beginnerStartCorrection,
} from '../utils/scienceV3';

const database = state => getAllExercises(state.customExercises, state.exerciseOverrides);
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;


function startProgram(state, input, now, restart = false) {
  if (hasLegacyScience(state.scienceReport) || (!restart && state.scienceState?.program?.status === 'active')) return state;
  let science = state.scienceState || emptyScienceState();
  if (science.program) {
    const archived = science.program.status === 'active' ? { ...science.program, status: 'replaced', endedAt: now } : science.program;
    science = { ...science, archives: [...science.archives, archived] };
  }
  const { historicalRir, ...profileInput } = input;
  const profile = {
    ...profileInput,
    experience: ['beginner', 'intermediate', 'advanced'].includes(input.experience) ? input.experience : 'beginner',
    monthsTraining: clamp(input.monthsTraining, 0, 1200, 0),
    daysPerWeek: clamp(input.daysPerWeek, 1, 7, 4),
    minutesPerSession: clamp(input.minutesPerSession, 15, 240, 60),
    priorities: [...new Set(input.priorities || [])].filter(m => SCIENCE_MUSCLES.includes(m)).slice(0, 3),
    optionalMuscles: (input.optionalMuscles || []).filter(m => OPTIONAL_MUSCLES.includes(m)),
    goal: input.goal === 'specialization' ? 'specialization' : 'balanced',
  };
  if (profile.goal === 'specialization' && !profile.priorities.length) return state;
  if (profile.goal === 'balanced') profile.priorities = [];
  const startDate = new Date(Number(profile.startDate) || now);
  startDate.setHours(0, 0, 0, 0);
  science = applyScienceBackfill(science, state.history, database(state), startDate.getTime(), now, historicalRir);
  return { scienceState: createScienceProgram(profile, state.history, database(state), science, state.scienceReport, now) };
}

// All these actions touch scienceState only. In particular, they never call
// updateHistoryWorkout/syncGamificationWithHistory (which recalculate XP).
export function scienceActions(set) {
  return {
    respondBeginnerStartCorrection: (accept, now = Date.now()) => set(state => {
      if (typeof accept !== 'boolean') return state;
      const science = state.scienceState, p = science?.program;
      const correction = beginnerStartCorrection(science, state.history, database(state), state.scienceReport, now);
      if (!correction) return state;
      const targets = { ...p.targets }, initialTargets = { ...p.initialTargets }, landmarks = structuredClone(p.landmarks), decisions = { ...p.decisions };
      if (accept) for (const c of correction.changes) {
        targets[c.muscle] = c.after; initialTargets[c.muscle] = c.after;
        landmarks[c.muscle] = { ...landmarks[c.muscle], mevEstimate:correction.estimated.landmarks[c.muscle].mevEstimate, mvEstimate:correction.estimated.landmarks[c.muscle].mvEstimate, source:'blended-estimate' };
        decisions[c.muscle] = 'Nuova stima iniziale per principianti accettata: livello e storico ponderato.';
      }
      const ceilings = { ...p.ceilings };
      if (accept) for (const c of correction.changes) ceilings[c.muscle] = correction.estimated.ceilings[c.muscle];
      return { scienceState:{ ...science, program:{ ...p, targets, initialTargets, landmarks, decisions, ceilings, timeWarning:accept ? correction.estimated.timeWarning : p.timeWarning, startingDoseVersion:2, initialEstimates:correction.estimated.initialEstimates,
        initialDoseCorrection:{ accepted:accept, at:now, changes:correction.changes } } } };
    }),
    completeScienceEvolution: (now = Date.now()) => set(state => {
      const science = state.scienceState || emptyScienceState();
      const next = completeScienceEvolution(science, state.scienceReport, now);
      return next === science ? state : { scienceState: next };
    }),
    decideLegacyDynamicVolume: (choice, now = Date.now()) => set(state => {
      const science = state.scienceState || emptyScienceState();
      const next = decideLegacyDynamicVolume(science, state.scienceReport, state.history, database(state), choice, now);
      return next === science ? state : { scienceState: next };
    }),
    startScienceV3: (input, now = Date.now()) => set(state => startProgram(state, input, now)),
    restartScienceV3: (input, now = Date.now()) => set(state => startProgram(state, input, now, true)),
    annotateScienceSet: (workoutId, exerciseId, setId, changes) => set(state => {
      if (workoutId == null || exerciseId == null || setId == null) return state;
      const workout = state.activeWorkout?.id === workoutId ? state.activeWorkout : state.history.find(w => String(w.id) === String(workoutId));
      if (!workout?.exercises?.some(e => String(e.id) === String(exerciseId) && e.sets?.some(s => String(s.id) === String(setId)))) return state;
      const science = state.scienceState || emptyScienceState();
      const perWorkout = science.annotations[workoutId] || {};
      const perExercise = perWorkout[exerciseId] || {};
      const old = perExercise[setId] || {};
      const annotation = { ...old };
      if (Object.hasOwn(changes, 'rir')) annotation.rir = changes.rir === 0 || changes.rir === 1 ? changes.rir : null;
      if (Object.hasOwn(changes, 'excluded')) annotation.excluded = Boolean(changes.excluded);
      return { scienceState: { ...science, annotations: { ...science.annotations, [workoutId]: { ...perWorkout, [exerciseId]: { ...perExercise, [setId]: annotation } } } } };
    }),
    classifyScienceExercise: (workoutId, exerciseId, primary) => set(state => {
      if (!SCIENCE_MUSCLES.includes(primary)) return state;
      const workout = String(state.activeWorkout?.id) === String(workoutId) ? state.activeWorkout : state.history.find(w => String(w.id) === String(workoutId));
      const ex = workout?.exercises?.find(e => String(e.id) === String(exerciseId));
      if (!ex) return state;
      const science = state.scienceState || emptyScienceState();
      const found = database(state).find(e => normalizeName(e.name) === normalizeName(ex.name));
      const classification = { primary, indirect: [], name: ex.name };
      return { scienceState: {
        ...science,
        classifications: { ...science.classifications, [found?.id || normalizeName(ex.name)]: classification },
        exerciseSnapshots: { ...science.exerciseSnapshots, [workoutId]: { ...science.exerciseSnapshots[workoutId], [exerciseId]: classification } },
      } };
    }),
    saveScienceFeedback: (workoutId, feedback) => set(state => {
      if (!state.history.some(w => String(w.id) === String(workoutId))) return state;
      const science = state.scienceState || emptyScienceState();
      const muscles = {};
      for (const [muscle, value] of Object.entries(feedback.muscles || {})) {
        if (!SCIENCE_MUSCLES.includes(muscle)) continue;
        muscles[muscle] = { recovery: ['good', 'fair', 'poor'].includes(value.recovery) ? value.recovery : null, quality: ['good', 'fair', 'poor'].includes(value.quality) ? value.quality : null, pain: Boolean(value.pain) };
      }
      return { scienceState: { ...science, feedback: { ...science.feedback, [workoutId]: {
        sleep: ['good', 'fair', 'poor'].includes(feedback.sleep) ? feedback.sleep : null,
        systemicFatigue: Boolean(feedback.systemicFatigue), muscles,
      } } } };
    }),
    adoptScienceAllocation: (now = Date.now()) => set(state => {
      const science = state.scienceState, p = science?.program;
      if (!p || p.status !== 'active' || p.allocationVersion === 2 || hasLegacyScience(state.scienceReport)) return state;
      const fresh = createScienceProgram({ ...science.profile, startDate: p.startDate }, state.history, database(state), science, state.scienceReport, now).program;
      const targets = { ...p.targets }, roles = { ...p.roles }, landmarks = structuredClone(p.landmarks);
      for (const m of Object.keys(targets)) {
        if (science.profile.priorities.includes(m) || science.profile.goal !== 'specialization' || p.roles[m] === 'off') continue;
        if (p.currentWeek <= 2 && p.decisions[m] !== 'Obiettivo impostato da te.') targets[m] = Math.max(targets[m], fresh.targets[m]);
        roles[m] = targets[m] <= fresh.landmarks[m].mvEstimate ? 'maintenance' : 'support';
        landmarks[m] = { ...landmarks[m], mvEstimate: fresh.landmarks[m].mvEstimate, mevEstimate: fresh.landmarks[m].mevEstimate };
      }
      return { scienceState: { ...science, program: { ...p, targets, roles, landmarks, allocationVersion: 2,
        initialTargets: { ...fresh.targets, ...Object.fromEntries(science.profile.priorities.map(m => [m, p.initialTargets?.[m] ?? p.targets[m]])) },
        weeks: p.weeks.map(w => ({ ...w, roles: w.roles || { ...p.roles } })),
        allocationNotice: 'Base di crescita ripristinata per i distretti fuori priorità. Nelle ultime due settimane potrai redistribuire parte delle serie verso le priorità.',
      } } };
    }),
    setScienceWeekSessions: sessions => set(state => {
      const science = state.scienceState, p = science?.program;
      if (!p || p.status !== 'active') return state;
      const plannedSessions = clamp(sessions, 1, 7, science.profile.daysPerWeek || 4);
      return { scienceState: { ...science, program: { ...p, sessionPlans: { ...p.sessionPlans, [p.currentWeek]: { plannedSessions } } } } };
    }),
    deferScienceWeek: (now = Date.now()) => set(state => {
      const science = state.scienceState, p = science?.program;
      if (!p || p.status !== 'active') return state;
      if (p.weekDeferrals?.at(-1)?.week === p.currentWeek && p.weekDeferrals.at(-1).at === now) return state;
      return { scienceState: { ...science, program: { ...p, weekDeferrals: [...(p.weekDeferrals || []), { week: p.currentWeek, at: now }] } } };
    }),
    closeScienceV3Week: (now = Date.now()) => set(state => {
      if (hasLegacyScience(state.scienceReport) || state.activeWorkout) return state;
      const science = state.scienceState || emptyScienceState();
      const next = closeScienceWeek(science, state.history, database(state), now);
      return next === science ? state : { scienceState: next };
    }),
    respondScienceRecovery: (id, choice, now = Date.now()) => set(state => {
      const science = state.scienceState || emptyScienceState();
      const next = respondScienceRecommendation(science, id, choice, now);
      return next === science ? state : { scienceState: next };
    }),
    setScienceTarget: (muscle, value, ceiling) => set(state => {
      const science = state.scienceState;
      const p = science?.program;
      if (!p || p.status !== 'active' || !Object.hasOwn(p.targets, muscle)) return state;
      const target = clamp(value, 0, 100, p.targets[muscle]);
      return { scienceState: { ...science, program: {
        ...p, targets: { ...p.targets, [muscle]: target },
        ceilings: { ...p.ceilings, [muscle]: Math.max(target, clamp(ceiling, 0, 100, p.ceilings[muscle])) },
        decisions: { ...p.decisions, [muscle]: 'Obiettivo impostato da te.' },
        recommendations: p.recommendations.map(r => r.type === 'redistribution' && r.status === 'pending' ? { ...r, status: 'superseded' } : r),
        pauses: Object.fromEntries(Object.entries(p.pauses).filter(([m]) => m !== muscle)),
      } } };
    }),
    reestimateScienceStart: () => set(state => {
      const science = state.scienceState;
      const p = science?.program;
      if (!p || p.status !== 'active' || p.currentWeek !== 1 || p.weeks.length || hasLegacyScience(state.scienceReport)) return state;
      const estimated = createScienceProgram({ ...science.profile, startDate: p.startDate }, state.history, database(state), science, state.scienceReport);
      return { scienceState: { ...science, program: {
        ...p, targets: estimated.program.targets, initialTargets: estimated.program.initialTargets,
        ceilings: estimated.program.ceilings, landmarks: estimated.program.landmarks,
        timeWarning: estimated.program.timeWarning,
        decisions: Object.fromEntries(Object.keys(p.targets).map(m => [m, 'Partenza ristimata per esperienza e ruolo del distretto. Lo storico scarso non abbassa la dose di base.'])),
      } } };
    }),
  };
}
