import { EXERCISE_CATEGORIES, normalizeName } from '../data/exercises';

/**
 * Residual fatigue per muscle, estimated from the logged sessions.
 *
 * Product heuristic, not a measurement. The time scale follows studies on
 * recovery between sessions in trained lifters:
 * - Morán-Navarro et al. 2017 (Eur J Appl Physiol, PMID 28965198): sets to
 *   failure need roughly 24-48 h more than the same work kept short of failure.
 * - Belcher et al. 2019 (Appl Physiol Nutr Metab, doi 10.1139/apnm-2019-0004):
 *   after 4 sets to failure, squat velocity stays lower for up to 72 h.
 * - Schoenfeld et al. 2016 and Pelland et al. 2026: training a muscle about
 *   twice a week works at least as well as once, so 48-72 h is the usual
 *   window before the same muscle is hard-trained again.
 *
 * Every completed working set counts as near failure (the app's protocol is
 * 0-1 RIR); warmups are ignored. A muscle's dose in a session is its direct
 * sets plus half of the sets where it only assists. The dose sets both how
 * fatigued the muscle starts (6 sets ≈ full) and how long recovery lasts
 * (24 h + 6 h per set, 24-72 h, ×1.2 for the large lower-body muscles).
 * Fatigue then fades linearly and overlapping sessions add up.
 *
 * Readiness: below 25% the muscle can be trained normally; 25-50% it can be
 * trained with fewer sets or more reps in reserve; from 50% it is better to
 * wait. With 6 hard sets that means ~30 h "wait", ready after ~45 h (60 h
 * window), matching the 24-48 h extra recovery after failure in the studies.
 */

const HOUR = 3600 * 1000;
export const FATIGUE_WINDOW_HOURS = 96;
// Readiness thresholds on residual fatigue (see readiness() below).
export const READY_BELOW = 0.25;
export const WAIT_FROM = 0.5;
const FULL_DOSE = 6;
const SYNERGIST = 0.5;
const PARTIAL_SET = 0.5;
const LOWER_BODY = new Set(['quadriceps', 'hamstring', 'gluteal', 'lower-back', 'adductor', 'abductors']);

// react-body-highlighter muscle ids shown on the map, with the Italian label.
export const FATIGUE_MUSCLES = {
  chest: 'Petto',
  'front-deltoids': 'Deltoidi anteriori',
  'back-deltoids': 'Deltoidi posteriori',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearm: 'Avambracci',
  'upper-back': 'Dorso',
  trapezius: 'Trapezi',
  'lower-back': 'Lombari',
  abs: 'Addome',
  obliques: 'Obliqui',
  quadriceps: 'Quadricipiti',
  hamstring: 'Femorali',
  gluteal: 'Glutei',
  adductor: 'Adduttori',
  abductors: 'Abduttori',
  calves: 'Polpacci',
  neck: 'Collo',
};

const has = (name, ...words) => words.some(w => name.includes(w));

/** Muscles worked by one category: `primary` count as direct sets, `assist` as half. */
export function categoryTargets(category, exerciseName = '') {
  const name = normalizeName(exerciseName);
  switch (category) {
    case EXERCISE_CATEGORIES.CHEST:
      if (has(name, 'croc', 'pectoral', 'fly')) return { primary: ['chest'], assist: ['front-deltoids'] };
      return { primary: ['chest'], assist: ['triceps', 'front-deltoids'] };
    case EXERCISE_CATEGORIES.BACK:
      if (has(name, 'hyperextension', 'iperestension')) return { primary: ['lower-back'], assist: ['gluteal', 'hamstring'] };
      if (has(name, 'scrollat', 'shrug')) return { primary: ['trapezius'], assist: ['forearm'] };
      if (has(name, 'pullover', 'braccia tese')) return { primary: ['upper-back'], assist: ['triceps'] };
      if (has(name, 'remat', 'row', 'pulley')) return { primary: ['upper-back', 'trapezius'], assist: ['biceps', 'back-deltoids', 'forearm'] };
      return { primary: ['upper-back'], assist: ['biceps', 'forearm'] };
    case 'Gambe':
      if (has(name, 'calf')) return { primary: ['calves'], assist: [] };
      if (has(name, 'femorali', 'curl', 'stacc')) return categoryTargets(EXERCISE_CATEGORIES.HAMSTRINGS, name);
      return categoryTargets(EXERCISE_CATEGORIES.QUADRICEPS, name);
    case EXERCISE_CATEGORIES.QUADRICEPS:
      if (has(name, 'adductor')) return { primary: ['adductor'], assist: [] };
      if (has(name, 'extension', 'sissy')) return { primary: ['quadriceps'], assist: [] };
      return { primary: ['quadriceps'], assist: ['gluteal', 'adductor'] };
    case EXERCISE_CATEGORIES.HAMSTRINGS:
      if (has(name, 'curl')) return { primary: ['hamstring'], assist: ['calves'] };
      return { primary: ['hamstring', 'gluteal'], assist: ['lower-back', 'adductor', 'forearm'] };
    case EXERCISE_CATEGORIES.GLUTES:
      if (has(name, 'abductor')) return { primary: ['abductors'], assist: ['gluteal'] };
      return { primary: ['gluteal'], assist: ['hamstring'] };
    case EXERCISE_CATEGORIES.CALVES:
      return { primary: ['calves'], assist: [] };
    case EXERCISE_CATEGORIES.SHOULDERS:
      if (has(name, 'posterior', 'face pull', 'reverse', '90°')) return { primary: ['back-deltoids'], assist: ['trapezius'] };
      if (has(name, 'laterali', 'tirate al mento', 'upright')) return { primary: ['front-deltoids', 'back-deltoids'], assist: ['trapezius'] };
      if (has(name, 'frontal')) return { primary: ['front-deltoids'], assist: [] };
      return { primary: ['front-deltoids'], assist: ['triceps', 'trapezius'] };
    case EXERCISE_CATEGORIES.BICEPS:
      return { primary: ['biceps'], assist: ['forearm'] };
    case EXERCISE_CATEGORIES.TRICEPS:
      return { primary: ['triceps'], assist: [] };
    case EXERCISE_CATEGORIES.FOREARMS:
      return { primary: ['forearm'], assist: [] };
    case EXERCISE_CATEGORIES.CORE:
      if (has(name, 'twist')) return { primary: ['obliques'], assist: ['abs'] };
      return { primary: ['abs'], assist: ['obliques'] };
    case EXERCISE_CATEGORIES.NECK:
      return { primary: ['neck'], assist: [] };
    default:
      return { primary: [], assist: [] };
  }
}

/** Weight of one set for each muscle of an exercise (1 direct, 0.5 assisting). */
export function exerciseMuscleWeights(exerciseName, allExercises = []) {
  const norm = normalizeName(exerciseName);
  const def = allExercises.find(ex => normalizeName(ex.name) === norm);
  const weights = {};
  const add = (muscles, w) => muscles.forEach(m => { weights[m] = Math.max(weights[m] || 0, w); });
  if (!def) return weights;
  const main = categoryTargets(def.category, def.name);
  add(main.primary, 1);
  add(main.assist, SYNERGIST);
  (def.secondaryCategories || []).forEach(cat => {
    const t = categoryTargets(cat, def.name);
    add(t.primary, SYNERGIST);
  });
  return weights;
}

const setValue = set => {
  if (!set?.done || set.isWarmup) return 0;
  return set.isDropset || set.isRestPause ? PARTIAL_SET : 1;
};

export const recoveryHours = (muscle, dose) => {
  const base = Math.min(72, Math.max(24, 24 + 6 * dose));
  return LOWER_BODY.has(muscle) ? base * 1.2 : base;
};

/** Per-session doses for each muscle in the fatigue window. */
export function muscleSessions(history = [], allExercises = [], now = Date.now()) {
  const from = now - FATIGUE_WINDOW_HOURS * HOUR;
  const sessions = {};
  history.forEach(workout => {
    const end = Number(workout?.endTime || workout?.startTime);
    if (!end || end < from || end > now) return;
    const doses = {};
    (workout.exercises || []).forEach(ex => {
      const sets = (ex.sets || []).reduce((sum, s) => sum + setValue(s), 0);
      if (!sets) return;
      Object.entries(exerciseMuscleWeights(ex.name, allExercises)).forEach(([m, w]) => {
        doses[m] = (doses[m] || 0) + sets * w;
      });
    });
    Object.entries(doses).forEach(([m, dose]) => {
      (sessions[m] ||= []).push({ at: end, dose, hours: recoveryHours(m, dose) });
    });
  });
  return sessions;
}

const fatigueAt = (sessions, t) => Math.min(1, sessions.reduce((sum, s) => {
  const elapsed = (t - s.at) / HOUR;
  if (elapsed < 0 || elapsed >= s.hours) return sum;
  return sum + Math.min(1, s.dose / FULL_DOSE) * (1 - elapsed / s.hours);
}, 0));

/**
 * Current residual fatigue for every muscle trained in the window:
 * { muscle, fatigue (0-1), sets (weighted, last 96 h), lastAt, readyInHours }.
 * Sorted from most to least fatigued.
 */
export function computeMuscleFatigue(history = [], allExercises = [], now = Date.now()) {
  const sessions = muscleSessions(history, allExercises, now);
  return Object.entries(sessions).map(([muscle, list]) => {
    const fatigue = fatigueAt(list, now);
    let readyInHours = 0;
    if (fatigue >= READY_BELOW) {
      readyInHours = FATIGUE_WINDOW_HOURS;
      for (let h = 1; h <= FATIGUE_WINDOW_HOURS; h++) {
        if (fatigueAt(list, now + h * HOUR) < READY_BELOW) { readyInHours = h; break; }
      }
    }
    return {
      muscle,
      fatigue,
      sets: Math.round(list.reduce((sum, s) => sum + s.dose, 0) * 2) / 2,
      lastAt: Math.max(...list.map(s => s.at)),
      readyInHours,
    };
  }).sort((a, b) => b.fatigue - a.fatigue);
}

// Grey = ready (not highlighted), orange = almost ready, red = better wait.
export const READINESS_COLORS = ['#f2994a', '#e5484d'];
export const READINESS = [
  { label: 'Pronto', hint: 'Allenalo pure come al solito' },
  { label: 'Quasi pronto', hint: 'Si può allenare con meno serie o tenendo 2-3 ripetizioni in riserva' },
  { label: 'Meglio aspettare', hint: 'Allena altri muscoli e ridai un’occhiata più tardi' },
];

/** 0 = ready, 1 = almost ready, 2 = better wait (index into READINESS). */
export const readiness = fatigue => (fatigue < READY_BELOW ? 0 : fatigue < WAIT_FROM ? 1 : 2);
