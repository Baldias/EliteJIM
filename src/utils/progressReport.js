import { scienceCompletedSets, scienceUnconfirmedSets } from './scienceCarry';
import { EXERCISE_CATEGORIES, getAllExercises, normalizeName } from '../data/exercises';
import { estimate1RM, getBodyweightLoad, resolveBodyweight } from './oneRepMax';
import { computeOverloadStats } from './overload';
import { calculateWeeklyStreak, getRankByXp } from './gamification';
import { hasLegacyScience } from './scienceV3';
import { getActualSetsForScienceWeek, getScienceTargetForMuscle } from './rpVolume';
import { evolvedLegacyReport, legacyEvolutionFor } from './scienceEvolution';
import { themePreferences } from './theme';
import { scienceWeekPreview } from './sciencePlanning';
import { localScienceDate, scienceLandmarkBand } from './sciencePlanning';

const n = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const ordinary = sets => (sets || []).filter(s => s.done && !s.isDropset && !s.isRestPause && !s.isWarmup && n(s.reps) > 0);
const day = time => new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

function activitySeries(history) {
  if (!history.length) return { granularity: 'settimana', points: [] };
  const first = new Date(history[0].startTime), last = new Date(history.at(-1).startTime);
  const monthly = last - first > 366 * 86400000;
  const anchor = time => {
    const date = new Date(time);
    date.setHours(0, 0, 0, 0);
    if (monthly) date.setDate(1);
    else date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date;
  };
  const buckets = new Map();
  for (const workout of history) {
    const key = localScienceDate(anchor(workout.startTime));
    const old = buckets.get(key) || { workouts: 0, sets: 0 };
    old.workouts++;
    old.sets += (workout.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).filter(s => s.done).length, 0);
    buckets.set(key, old);
  }
  const cursor = anchor(first), end = anchor(last), points = [];
  while (cursor <= end) {
    const value = buckets.get(localScienceDate(cursor)) || { workouts: 0, sets: 0 };
    points.push({ time: cursor.getTime(), ...value });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 7);
  }
  return { granularity: monthly ? 'mese' : 'settimana', points };
}

// A read-only snapshot. Totals and records use the existing app calculations;
// scientific accounting is kept separate from gamification and logged workload.
export function buildProgressReport(state, now = Date.now(), { includeWeight = false, includeScience = false, demo = false } = {}) {
  const history = (state.history || []).filter(w => w && Number.isFinite(Number(w.startTime)) && Number(w.startTime) > 0).slice().sort((a, b) => a.startTime - b.startTime);
  const db = getAllExercises(state.customExercises || [], state.exerciseOverrides || {});
  const bodyweight = resolveBodyweight(state);
  const catalog = new Map(db.map(ex => [normalizeName(ex.name), ex]));
  const groups = [...Object.values(EXERCISE_CATEGORIES), 'Altri esercizi'];
  const progression = new Map();
  let completedSets = 0, repetitions = 0, externalKg = 0, minutes = 0;
  for (const workout of history) {
    minutes += Math.max(0, (Number(workout.endTime) - Number(workout.startTime)) / 60000 || 0);
    const perWorkout = new Map();
    for (const exercise of workout.exercises || []) {
      for (const set of exercise.sets || []) if (set.done) {
        completedSets++; repetitions += n(set.reps); externalKg += n(set.kg) * n(set.reps);
      }
      const key = normalizeName(exercise.name || '');
      const recorded = (exercise.sets || []).filter(s => s.done).length;
      if (!key || !recorded) continue;
      if (!progression.has(key)) progression.set(key, { name: exercise.name, group: catalog.get(key)?.category || 'Altri esercizi', points: [], bodyweightExercise: getBodyweightLoad(exercise.name, db, bodyweight) > 0, registeredSets: 0 });
      progression.get(key).registeredSets += recorded;
      const sets = ordinary(exercise.sets);
      if (!sets.length) continue;
      const load = getBodyweightLoad(exercise.name, db, bodyweight);
      const values = sets.map(s => ({ kg: n(s.kg), reps: n(s.reps), estimated: estimate1RM(s.kg, s.reps, load) }));
      const estimated = values.some(s => s.estimated > 0);
      const best = values.reduce((a, b) => (estimated ? b.estimated > a.estimated : b.reps > a.reps) ? b : a);
      const entry = { time: Number(workout.startTime), ...best };
      const previous = perWorkout.get(key);
      if (!previous || best.estimated > previous.estimated || (best.estimated === previous.estimated && best.reps > previous.reps)) perWorkout.set(key, entry);
    }
    for (const [key, entry] of perWorkout) progression.get(key).points.push(entry);
  }
  const exercises = [...progression.values()].sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.name.localeCompare(b.name, 'it')).map(ex => {
    if (!ex.points.length) return { ...ex, metric: null, unit: null, first: null, latest: null, best: null, deltaPercent: null };
    const metric = ex.points.some(p => p.estimated > 0) ? 'estimated' : 'reps';
    const points = ex.points.map(p => ({ ...p, value: p[metric] }));
    const first = points[0], latest = points.at(-1), best = points.reduce((a, b) => b.value > a.value ? b : a);
    return { ...ex, points, first, latest, best, metric, unit: metric === 'estimated' ? 'kg' : 'rep', deltaPercent: first.value > 0 && points.length > 1 ? (latest.value - first.value) / first.value * 100 : null };
  });
  const { prCount, overloadRate } = computeOverloadStats(history, { exercisesDb: db, bodyweight });
  const streak = calculateWeeklyStreak(history, now);
  const rank = getRankByXp(n(state.userXP));
  let science = null;
  if (includeScience && !hasLegacyScience(state.scienceReport, state.scienceState) && state.scienceState?.program) {
    const p = state.scienceState.program;
    const weeks = Array.from({ length: 5 }, (_, i) => scienceWeekPreview(state.scienceState, history, db, i + 1, now)).filter(Boolean).map(summary => {
      const counts = summary.muscles || summary.volumes?.muscles || {};
      return { week: summary.week, start: summary.start, end: summary.end, kind: summary.kind,
        phase: summary.kind === 'archive' ? 'Registrata' : summary.kind === 'current' ? 'In corso' : summary.kind === 'deload-estimate' ? 'Scarico proposto · stima' : 'Stima · da rivalutare',
        rows: Object.entries(summary.targets).map(([name, target]) => ({ name, target, done: scienceCompletedSets(counts[name]), unknown: scienceUnconfirmedSets(counts[name]), imported:counts[name]?.imported || 0, band: scienceLandmarkBand((summary.landmarks || p.landmarks)[name], target, (summary.roles || p.roles)[name]), focus: state.scienceState.profile.priorities.includes(name) })) };
    });
    const current = weeks.find(w => w.week === p.currentWeek) || weeks.at(-1);
    if (current) science = { accounting: 'v3', ...current, weeks };
  } else if (includeScience && state.scienceReport?.baseLandmarks) {
    const p = evolvedLegacyReport(state.scienceReport, state.scienceState), week = p.currentWeek || 1;
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const w = i + 1, archived = p.weekHistory?.[w];
      const counts = p.status === 'pending' || w > week ? {} : getActualSetsForScienceWeek(history, db, p, w);
      const focus = w <= 4 ? p.focus1 || [] : w <= 8 ? p.focus2 || [] : [];
      return { week: w, kind: archived ? 'archive' : w === week && p.status !== 'pending' ? 'current' : 'estimate',
        phase: archived ? 'Registrata' : w === week && p.status !== 'pending' ? 'In corso' : 'Stima · da rivalutare',
        rows: Object.keys(p.baseLandmarks).map(name => {
          const target = getScienceTargetForMuscle(p, name, w), lm = p.baseLandmarks[name];
          return { name, target, done: counts[name] || 0, unknown: 0, focus: focus.includes(name), band: w >= 9 ? 'mv' : target <= lm.mev ? 'mev' : target >= lm.mrv ? 'mrv' : 'mav' };
        }) };
    });
    science = { accounting: 'legacy', dynamicVolume: Boolean(legacyEvolutionFor(state.scienceReport, state.scienceState)), ...weeks[week - 1], weeks };
  }
  const weight = includeWeight ? (state.weightLog || []).filter(w => n(w.kg) > 0 && Number.isFinite(new Date(`${w.date}T12:00:00`).getTime())).slice().sort((a, b) => a.date.localeCompare(b.date)).map(w => ({ time: new Date(`${w.date}T12:00:00`).getTime(), value: n(w.kg) })) : null;
  return {
    theme: themePreferences(state).theme, scienceGlow: themePreferences(state).scienceGlow,
    demo, generatedAt: now, filename: `EliteJIM-progressi-${localScienceDate(now)}.pdf`,
    period: history.length ? `${day(history[0].startTime)} – ${day(history.at(-1).startTime)}` : 'Nessuna seduta registrata',
    totals: { workouts: history.length, completedSets, repetitions, externalKg, minutes: Math.round(minutes), xp: n(state.userXP), prCount, overloadRate, currentStreak: streak.currentStreak, highestStreak: streak.highestStreak },
    rank: { title: rank.title, color: rank.color, progress: rank.progressPercent },
    activity: activitySeries(history), exercises, science, weight,
  };
}
