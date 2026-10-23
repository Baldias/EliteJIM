import { calculateScienceVolume, getScienceTargetForMuscle } from './rpVolume';
import { annotationFor, captureScienceExercises, createScienceProgram, hasLegacyScience, legacyScienceKey, SCIENCE_MUSCLES, scienceVolumes, scienceWeekRange } from './scienceV3';
import { scienceSetKey } from './scienceCarry';

const calendarShift = (time, days) => { const date = new Date(time); date.setDate(date.getDate() + days); return date.getTime(); };
const validTime = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const sourceWeekStart = (report, week, now) => validTime(report.weekHistory?.[week]?.startDate,
  scienceWeekRange(validTime(report.startDate, validTime(report.timestamp, now)), week).start);

// An explicit, atomic V2 -> V3 sidecar migration. scienceReport remains byte
// identical for archive/score compatibility; the marker retires its engine.
export function migrateLegacyScience(science, report, history, db, now = Date.now()) {
  const protocolId = legacyScienceKey(report);
  if (!protocolId || !hasLegacyScience(report, science)) return science;
  if (science.program?.status === 'active' || science.program?.status === 'pending') return {
    ...science, releaseV3:{...science.releaseV3,seenAt:science.releaseV3?.seenAt || now},
    legacyMigration:{version:1,protocolId,migratedAt:now,sourceWeek:report.currentWeek,originalReport:structuredClone(report),snapshots:{}},
  }; // retire V2 while keeping the newer V3 program intact
  if (science.program) science = {...science,archives:[...(science.archives || []),science.program],program:null};
  const pending = report.status === 'pending';
  const sourceWeek = Math.min(12, Math.max(1, Math.round(Number(report.currentWeek) || 1)));
  const currentWeek = sourceWeek <= 8 ? (sourceWeek - 1) % 4 + 1 : 5;
  const blockFirstWeek = sourceWeek <= 4 ? 1 : sourceWeek <= 8 ? 5 : 5;
  const currentStart = pending ? now : validTime(report.currentWeekStartDate, sourceWeekStart(report, sourceWeek, now));
  const blockStart = sourceWeekStart(report, blockFirstWeek, calendarShift(currentStart, -(currentWeek - 1) * 7));
  const gender = ['male','female'].includes(science.profile?.gender) ? science.profile.gender : ['male','female'].includes(report.gender) ? report.gender : 'unspecified';
  const priorities = [...new Set(sourceWeek <= 4 ? report.focus1 || [] : report.focus2 || [])].filter(m => SCIENCE_MUSCLES.includes(m) && !(gender === 'male' && m === 'Glutei')).slice(0,3);
  const profile = { ...science.profile,
    experience: ['beginner','intermediate','advanced'].includes(science.profile?.experience) ? science.profile.experience : ['beginner','intermediate','advanced'].includes(report.experienceLevel) ? report.experienceLevel : 'intermediate',
    gender, priorities, goal:priorities.length ? 'specialization' : 'balanced',
    daysPerWeek: Math.min(7,Math.max(1,Number(report.daysPerWeek) || 4)),
    minutesPerSession:science.profile?.minutesPerSession || 60,
    optionalMuscles:SCIENCE_MUSCLES.filter(m => ['Collo','Avambracci'].includes(m) && report.baseLandmarks[m]),
    startDate:blockStart, useWeight:Boolean(science.profile?.useWeight), source:'legacy-migration',
  };
  let next = createScienceProgram(profile, history, db, science, report, now);
  const p = next.program;
  p.id = `science-v3-import-${report.timestamp || report.startDate || now}`;
  p.startDate = blockStart;
  p.currentWeek = pending ? 1 : currentWeek;
  p.status = pending ? 'pending' : 'active';
  p.weekStarts = { [p.currentWeek]:currentStart };
  p.importedSets = {};
  p.importedCountingStarts = {};
  p.migration = { sourceWeek, sourceStatus:report.status, at:now, currentWeek:p.currentWeek };
  p.timeWarning = null;
  p.startingDoseVersion = 2; // current targets are carried first, then adopt the new reference policy
  const sourceTargets = (week, names = Object.keys(p.targets)) => Object.fromEntries(names.map(m => {
    const original = Number(getScienceTargetForMuscle(report,m,week)) || 0;
    const accepted = science.legacyEvolution?.protocolId === protocolId
      ? Object.values(science.legacyEvolution.decisions || {}).find(d => d.choice === 'accept' && d.week === week)?.targets?.[m] : null;
    return [m,Math.max(0,Math.round(accepted ?? original))];
  }));
  p.targets = sourceTargets(sourceWeek);
  p.initialTargets = sourceTargets(blockFirstWeek);
  for (const m of Object.keys(p.targets)) {
    p.roles[m] = p.targets[m] === 0 ? 'off' : sourceWeek >= 9 ? 'maintenance' : priorities.includes(m) || !priorities.length ? 'growth' : 'support';
    p.ceilings[m] = Math.max(p.ceilings[m],p.targets[m]);
    p.decisions[m] = 'Obiettivo della settimana corrente conservato nel passaggio a Scienza V3.0. I prossimi aggiornamenti seguono qualità e recupero.';
    // V2 quiz thresholds were not measured personal landmarks.
    p.landmarks[m].source = 'imported-target';
  }
  const ranges = [];
  const archive = {};
  if (!pending) for (let oldWeek=1;oldWeek<=sourceWeek;oldWeek++) {
    const start = oldWeek === sourceWeek ? currentStart : sourceWeekStart(report,oldWeek,now);
    const end = oldWeek === sourceWeek ? now+1 : Math.min(validTime(report.weekHistory?.[oldWeek]?.completedDate, sourceWeekStart(report,oldWeek+1,now)),validTime(report.weekHistory?.[oldWeek+1]?.startDate,currentStart),currentStart);
    const countingStart = start - (oldWeek === 1 && oldWeek === sourceWeek ? 12*3600000 : 0);
    archive[oldWeek] = { week:oldWeek,start,end,targets:sourceTargets(oldWeek,Object.keys(report.baseLandmarks)),
      counts:calculateScienceVolume(history,db,report.baseLandmarks,countingStart,end) };
    if (oldWeek < blockFirstWeek || oldWeek > 8 && oldWeek !== sourceWeek || end <= start) continue;
    const week = oldWeek === sourceWeek ? currentWeek : oldWeek-blockFirstWeek+1;
    ranges.push({week,start,end,countingStart,sourceWeek:oldWeek});
    p.weekStarts[week] = start;
    if (countingStart < start) p.importedCountingStarts[start] = countingStart;
  }
  // Old ordinary series retain their earned progress, with a distinct origin.
  // No unknown effort is converted to 0/1 RIR and no future series get credit.
  for (const workout of history || []) {
    const range = ranges.find(r => Number(workout.startTime) >= r.countingStart && Number(workout.startTime) < r.end);
    if (!range) continue;
    next = captureScienceExercises(next,workout,db);
    for (const [ei,ex] of (workout.exercises || []).entries()) for (const [si,set] of (ex.sets || []).entries()) {
      const a = annotationFor(next,workout.id,ex.id,set.id);
      if (!set.done || !(Number(set.reps)>0) || set.isWarmup || set.isDropset || set.isRestPause || a.excluded) continue;
      p.importedSets[scienceSetKey(workout,ex,set,ei,si)] = {week:range.week,start:range.start};
    }
  }
  next = { ...next, program:p };
  p.weeks = ranges.filter(r => r.week < p.currentWeek).map(r => ({
    week:r.week,start:r.start,end:r.end,scheduledEnd:calendarShift(r.start,7),
    targets:sourceTargets(r.sourceWeek),roles:{...p.roles},landmarks:structuredClone(p.landmarks),
    volumes:scienceVolumes(history,db,next,r.start,r.end),decisions:{...p.decisions},recovery:false,imported:true,
    classifications:Object.fromEntries(history.filter(w=>Number(w.startTime)>=r.countingStart && Number(w.startTime)<r.end).map(w=>[w.id,next.exerciseSnapshots[w.id] || {}])),
  }));
  if (!pending && [9,10].includes(sourceWeek)) p.recommendations.push({id:`${p.id}-existing-recovery`,type:'deload',status:'accepted',week:4,appliedWeek:5,choice:'imported',
    muscles:Object.keys(p.targets),reason:'Scarico già in corso nel protocollo precedente: mantenuto senza una seconda riduzione.',respondedAt:now});
  if (!pending && currentWeek === 5 && ![9,10].includes(sourceWeek)) p.recommendations.push({id:`${p.id}-deload`,type:'deload',status:'pending',week:4,
    muscles:Object.keys(p.targets).filter(m=>p.targets[m]>0),reason:'Valuta il recupero al termine del blocco importato. Nessuna riduzione senza la tua scelta.'});
  return { ...next, releaseV3:{...science.releaseV3,seenAt:science.releaseV3?.seenAt || now},
    legacyMigration:{version:1,protocolId,migratedAt:now,sourceWeek,originalReport:structuredClone(report),
      originalEvolution:structuredClone(science.legacyEvolution || null),snapshots:archive},
  };
}

// Preserve the scoring formula and historical XP; only supply the current
// recovery context after the old engine has been retired.
export function scienceScoringReport(state) {
  const raw = state.scienceReport, science = state.scienceState;
  if (!science?.legacyMigration || hasLegacyScience(raw,science)) return raw;
  const p = science.program;
  const recovery = p?.status === 'active' && p.recommendations.some(r=>r.status==='accepted' && r.appliedWeek===p.currentWeek && ['deload','recovery'].includes(r.type));
  return {...raw,status:p?.status === 'active' ? 'active' : 'completed',currentWeek:recovery ? 9 : 1};
}
