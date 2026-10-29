import { BALANCED_VOLUME_VERSION, fitBalancedTargets, scienceSessionBudget } from '../utils/scienceBalanced';
import { getAllExercises, normalizeName } from '../data/exercises';
import { SCIENCE_REFERENCE_VERSION } from '../utils/scienceReferences';
import { migrateLegacyScience } from '../utils/scienceMigration';
import { applyScienceBackfill } from '../utils/scienceBackfill';
import { decideLegacyDynamicVolume } from '../utils/scienceEvolution';
import {
  SCIENCE_MUSCLES, OPTIONAL_MUSCLES, emptyScienceState, hasLegacyScience,
  createScienceProgram, closeScienceWeek, respondScienceRecommendation,
} from '../utils/scienceV3';

const database = state => getAllExercises(state.customExercises, state.exerciseOverrides);
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;


function startProgram(state, input, now, restart = false) {
  if (hasLegacyScience(state.scienceReport, state.scienceState) || (!restart && state.scienceState?.program?.status === 'active')) return state;
  let science = state.scienceState || emptyScienceState();
  if (science.program) {
    const archived = science.program.status === 'active' ? { ...science.program, status: 'replaced', endedAt: now } : science.program;
    science = { ...science, archives: [...science.archives, archived] };
  }
  const { historicalRir, ...profileInput } = input;
  const profile = {
    ...profileInput,
    gender: ['male','female'].includes(input.gender) ? input.gender : 'unspecified',
    experience: ['beginner', 'intermediate', 'advanced'].includes(input.experience) ? input.experience : 'beginner',
    daysPerWeek: clamp(input.daysPerWeek, 1, 7, 4),
    minutesPerSession: clamp(input.minutesPerSession, 15, 240, 60),
    priorities: [...new Set(input.priorities || [])].filter(m => SCIENCE_MUSCLES.includes(m) && !(input.gender === 'male' && m === 'Glutei')).slice(0, 3),
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
    markScienceWeekPromptShown: (date) => set(state => ({ scienceState: { ...state.scienceState, weekPromptShownDate: date } })),
    updateScienceVolumeReferences: (now = Date.now()) => set(state => {
      const science = state.scienceState, p = science?.program;
      if (!p || !['active','pending'].includes(p.status) || p.startingDoseVersion === SCIENCE_REFERENCE_VERSION || hasLegacyScience(state.scienceReport, science)) return state;
      const gender = science.profile?.gender ?? state.scienceReport?.gender ?? state.nutritionGoals?.profile?.sex ?? 'unspecified';
      const profile = {...science.profile,gender,priorities:(science.profile?.priorities || []).filter(m=>gender !== 'male' || m !== 'Glutei')};
      const offRoles = Object.fromEntries(Object.entries(p.roles).filter(([,role])=>role === 'off'));
      const fresh = createScienceProgram({ ...profile, roles:offRoles, startDate:p.startDate }, state.history, database(state), science, state.scienceReport, now).program;
      const targets = {...p.targets}, initialTargets = {...p.initialTargets}, landmarks = structuredClone(p.landmarks), ceilings = {...p.ceilings}, decisions = {...p.decisions};
      const roles = {...p.roles};
      const changes = [];
      for (const m of Object.keys(targets)) {
        if (gender === 'male' && m === 'Glutei') {
          changes.push({muscle:m,before:targets[m],after:0});
          delete targets[m]; delete initialTargets[m]; delete roles[m]; delete ceilings[m];
          continue;
        }
        if (fresh.targets[m] == null) continue;
        landmarks[m] = {...landmarks[m], mvEstimate:fresh.landmarks[m].mvEstimate, mevEstimate:fresh.landmarks[m].mevEstimate,
          referenceMav:fresh.landmarks[m].referenceMav, mavTarget:fresh.landmarks[m].mavTarget, mrvEstimate:fresh.landmarks[m].mrvEstimate};
        const recovering = p.currentWeek >= 5 || p.pauses?.[m] || p.recommendations.some(r=>r.status==='accepted' && ['recovery','deload'].includes(r.type) && r.appliedWeek===p.currentWeek && (r.choice==='reduce-all' || r.muscles.includes(m)));
        const manual = p.decisions[m] === 'Obiettivo impostato da te.';
        const gained = Math.max(0, p.targets[m] - (p.initialTargets?.[m] ?? p.targets[m]));
        if (!recovering && !manual && p.roles[m] !== 'off') {
          targets[m] = fresh.targets[m] + gained;
          initialTargets[m] = fresh.targets[m];
          roles[m] = fresh.roles[m];
          if (p.roles[m] === 'maintenance' || p.roles[m] === 'support') targets[m] = Math.max(targets[m], fresh.landmarks[m].mevEstimate);
          if (targets[m] !== p.targets[m]) changes.push({muscle:m,before:p.targets[m],after:targets[m]});
          decisions[m] = 'Base aggiornata alla nuova tabella: soglia di crescita comune, storico ponderato e incrementi già maturati conservati.';
        }
        ceilings[m] = Math.max(targets[m], manual ? p.ceilings[m] : fresh.ceilings[m]);
      }
      if (profile.goal === 'balanced') Object.assign(targets, fitBalancedTargets(targets, scienceSessionBudget(profile, p)));
      const total = Object.values(targets).reduce((a,n)=>a+n,0);
      const minutes = (profile.daysPerWeek || 4) * (profile.minutesPerSession || 60);
      const timeWarning = fresh.timeRestricted ? fresh.timeWarning : total * 4 > minutes ? `Stima: ~${total * 4} min/settimana, ne hai indicati ${minutes}. I target sono conservati: valuta più tempo o priorità diverse.` : null;
      return {scienceState:{...science,profile,program:{...p,targets,initialTargets,landmarks,ceilings,decisions,roles,
        startingDoseVersion:SCIENCE_REFERENCE_VERSION,balancedVolumeVersion:profile.goal === 'balanced' ? BALANCED_VOLUME_VERSION : p.balancedVolumeVersion,timeRestricted:fresh.timeRestricted,timeWarning,initialEstimates:fresh.initialEstimates,
        referenceUpdate:{at:now,version:SCIENCE_REFERENCE_VERSION,changes},
        allocationVersion:3,
        recommendations:p.recommendations.map(r=>r.status==='pending' && r.type==='redistribution' ? {...r,status:'superseded'} : r),
      }}};
    }),
    adoptBalancedScienceVolume: (now = Date.now()) => set(state => {
      const science = state.scienceState, p = science?.program;
      if (science?.profile?.goal !== 'balanced' || !p || !['active', 'pending'].includes(p.status) || p.balancedVolumeVersion === BALANCED_VOLUME_VERSION || hasLegacyScience(state.scienceReport, science)) return state;
      const fresh = createScienceProgram({ ...science.profile, roles: p.roles, startDate: p.startDate }, state.history, database(state), science, state.scienceReport, now).program;
      const desired = Object.fromEntries(Object.keys(p.targets).map(m => {
        const recovery = p.currentWeek >= 5 || p.pauses?.[m] || p.recommendations.some(r => r.status === 'accepted' && ['recovery', 'deload'].includes(r.type) && r.appliedWeek === p.currentWeek && (r.choice === 'reduce-all' || r.muscles.includes(m)));
        const manual = p.decisions[m] === 'Obiettivo impostato da te.';
        return [m, recovery || manual ? p.targets[m] : (fresh.targets[m] ?? p.targets[m]) + Math.max(0, p.targets[m] - (p.initialTargets?.[m] ?? p.targets[m]))];
      }));
      const targets = fitBalancedTargets(desired, scienceSessionBudget(science.profile, p));
      return { scienceState: { ...science, program: { ...p, targets, initialTargets: fresh.initialTargets,
        balancedVolumeVersion: BALANCED_VOLUME_VERSION,
        decisions: { ...p.decisions, ...Object.fromEntries(Object.keys(targets).map(m => [m, 'Base del percorso completo adattata al MAV basso e al limite di 20 serie per seduta.'])) },
        recommendations: p.recommendations.map(r => r.status === 'pending' && r.type === 'redistribution' ? { ...r, status: 'superseded' } : r),
      } } };
    }),
    completeScienceEvolution: (now = Date.now()) => set(state => {
      const science = state.scienceState || emptyScienceState();
      const next = migrateLegacyScience(science, state.scienceReport, state.history, database(state), now);
      return next === science ? state : { scienceState: next };
    }),
    decideLegacyDynamicVolume: (choice, now = Date.now()) => set(state => {
      const science = state.scienceState || emptyScienceState();
      if (!hasLegacyScience(state.scienceReport,science)) return state;
      const next = decideLegacyDynamicVolume(science, state.scienceReport, state.history, database(state), choice, now);
      return next === science ? state : { scienceState: next };
    }),
    startImportedScience: (date, now = Date.now()) => set(state => {
      const science = state.scienceState, p = science?.program;
      const start = new Date(Number(date)); start.setHours(0,0,0,0);
      if (!p?.migration || p.status !== 'pending' || !Number.isFinite(start.getTime())) return state;
      return { scienceState:{...science,profile:{...science.profile,startDate:start.getTime()},program:{...p,status:'active',startDate:start.getTime(),weekStarts:{1:start.getTime()},migration:{...p.migration,startedAt:now}}} };
    }),
    applyScienceGenderPolicy: () => set(state => {
      const science=state.scienceState,p=science?.program;
      if (science?.profile?.gender !== 'male' || !p || !Object.hasOwn(p.targets,'Glutei')) return state;
      const omit=values=>Object.fromEntries(Object.entries(values).filter(([m])=>m!=='Glutei'));
      return {scienceState:{...science,profile:{...science.profile,priorities:science.profile.priorities.filter(m=>m!=='Glutei')},program:{...p,
        targets:omit(p.targets),initialTargets:omit(p.initialTargets || p.targets),roles:omit(p.roles),ceilings:omit(p.ceilings),
        decisions:{...p.decisions,Glutei:'Esclusi dai target per il profilo uomo. Le serie restano nello storico.'},
        recommendations:p.recommendations.map(r=>r.status==='pending' && r.type==='redistribution' ? {...r,status:'superseded'} : r),
      }}};
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
      return { ...(state.activeWorkout?.id === workoutId ? { activeWorkout: { ...state.activeWorkout, lastActivityAt: Date.now() } } : {}), scienceState: { ...science, annotations: { ...science.annotations, [workoutId]: { ...perWorkout, [exerciseId]: { ...perExercise, [setId]: annotation } } } } };
    }),
    classifyScienceExercise: (workoutId, exerciseId, primary) => set(state => {
      if (!SCIENCE_MUSCLES.includes(primary)) return state;
      const workout = String(state.activeWorkout?.id) === String(workoutId) ? state.activeWorkout : state.history.find(w => String(w.id) === String(workoutId));
      const ex = workout?.exercises?.find(e => String(e.id) === String(exerciseId));
      if (!ex) return state;
      const science = state.scienceState || emptyScienceState();
      const found = database(state).find(e => normalizeName(e.name) === normalizeName(ex.name));
      const classification = { primary, indirect: [], name: ex.name };
      return { ...(state.activeWorkout?.id === workoutId ? { activeWorkout: { ...state.activeWorkout, lastActivityAt: Date.now() } } : {}), scienceState: {
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
        muscles[muscle] = { recovery: ['good', 'fair', 'poor'].includes(value.recovery) ? value.recovery : null, quality: ['good', 'fair', 'poor'].includes(value.quality) ? value.quality : null, pain: value.pain === 'mild' ? 'mild' : Boolean(value.pain) };
      }
      return { scienceState: { ...science, feedback: { ...science.feedback, [workoutId]: {
        sleep: ['good', 'fair', 'poor'].includes(feedback.sleep) ? feedback.sleep : null,
        systemicFatigue: feedback.systemicFatigue === 'mild' ? 'mild' : Boolean(feedback.systemicFatigue), muscles,
      } } } };
    }),
    adoptScienceAllocation: (now = Date.now()) => set(state => {
      const science = state.scienceState, p = science?.program;
      if (!p || p.status !== 'active' || p.allocationVersion === 2 || hasLegacyScience(state.scienceReport, state.scienceState)) return state;
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
      const sessionPlans = { ...p.sessionPlans, [p.currentWeek]: { plannedSessions } };
      const targets = science.profile.goal === 'balanced' ? fitBalancedTargets(p.targets, scienceSessionBudget(science.profile, { ...p, sessionPlans })) : p.targets;
      const decisions = { ...p.decisions, ...Object.fromEntries(Object.keys(targets).filter(m => targets[m] !== p.targets[m]).map(m => [m, 'Obiettivo adattato alle sedute disponibili: massimo 20 serie per seduta.'])) };
      return { scienceState: { ...science, program: { ...p, sessionPlans, targets, decisions,
        recommendations: science.profile.goal === 'balanced' ? p.recommendations.map(r => r.status === 'pending' && r.type === 'redistribution' ? { ...r, status: 'superseded' } : r) : p.recommendations,
      } } };
    }),
    deferScienceWeek: (now = Date.now()) => set(state => {
      const science = state.scienceState, p = science?.program;
      if (!p || p.status !== 'active') return state;
      if (p.weekDeferrals?.at(-1)?.week === p.currentWeek && p.weekDeferrals.at(-1).at === now) return state;
      return { scienceState: { ...science, program: { ...p, weekDeferrals: [...(p.weekDeferrals || []), { week: p.currentWeek, at: now }] } } };
    }),
    closeScienceV3Week: (now = Date.now()) => set(state => {
      if (hasLegacyScience(state.scienceReport, state.scienceState) || state.activeWorkout) return state;
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
      const available = science.profile.goal === 'balanced' ? Math.max(0, scienceSessionBudget(science.profile, p) - Object.entries(p.targets).reduce((n, [m, v]) => n + (m === muscle ? 0 : v), 0)) : 100;
      const target = clamp(value, 0, Math.min(100, available), Math.min(available, p.targets[muscle]));
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
      if (!p || p.status !== 'active' || p.currentWeek !== 1 || p.weeks.length || hasLegacyScience(state.scienceReport, state.scienceState)) return state;
      const estimated = createScienceProgram({ ...science.profile, startDate: p.startDate }, state.history, database(state), science, state.scienceReport);
      return { scienceState: { ...science, program: {
        ...p, targets: estimated.program.targets, initialTargets: estimated.program.initialTargets,
        ceilings: estimated.program.ceilings, landmarks: estimated.program.landmarks,
        timeWarning: estimated.program.timeWarning, balancedVolumeVersion: estimated.program.balancedVolumeVersion,
        decisions: Object.fromEntries(Object.keys(p.targets).map(m => [m, 'Partenza ristimata per esperienza e ruolo del distretto. Lo storico scarso non abbassa la dose di base.'])),
      } } };
    }),
  };
}
