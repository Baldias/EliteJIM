import { normalizeName } from '../data/exercises';

// Used when the user has not set a bodyweight (Settings or Science quiz).
export const REFERENCE_BODYWEIGHT_KG = 75;

// Above this many reps every equation loses precision: the estimate is still
// comparable between sessions but less reliable as an absolute number.
export const MAX_RELIABLE_REPS = 12;

/**
 * Multiplier that turns a set of `reps` into an estimated 1RM.
 * Average of four validated equations (Epley, Brzycki, Mayhew, Wathan): Epley and
 * Brzycki follow the NSCA %1RM table, Mayhew and Wathan were the most accurate in
 * validation studies on bench press and squat (LeSuer et al. 1997). Between 2 and
 * 10 reps the average stays within 2% of the NSCA table (mean 1.2%), a smaller
 * worst case than any single equation.
 * Brzycki diverges above 10 reps (37 - r → 0), so it is left out there.
 */
export const repFactor = (reps) => {
  const r = Math.floor(Number(reps) || 0);
  if (r <= 1) return 1;
  const epley = 1 + r / 30;
  const mayhew = 100 / (52.2 + 41.9 * Math.exp(-0.055 * r));
  const wathan = 100 / (48.8 + 53.8 * Math.exp(-0.075 * r));
  if (r <= 10) {
    const brzycki = 36 / (37 - r);
    return (epley + brzycki + mayhew + wathan) / 4;
  }
  return (epley + mayhew + wathan) / 3;
};

/**
 * Estimated 1RM of a set, in kg of external load.
 * For bodyweight exercises pass the moved bodyweight (`bodyweightLoad`): the
 * estimate runs on the whole mass (body + added weight) and the result is the
 * added weight you could lift for one rep. Returns 0 when nothing can be estimated.
 */
export const estimate1RM = (kg, reps, bodyweightLoad = 0) => {
  const external = parseFloat(kg) || 0;
  const r = parseInt(reps, 10) || 0;
  const body = bodyweightLoad > 0 ? bodyweightLoad : 0;
  const total = external + body;
  if (r <= 0 || external < 0 || total <= 0) return 0;
  return Math.max(0, total * repFactor(r) - body);
};

// Share of bodyweight moved in each rep (push-up ≈ 64%, Ebben et al. 2011)
const BODYWEIGHT_NAME_RULES = [
  { re: /trazion|pull[\s-]?up|chin[\s-]?up/, ratio: 1 },
  { re: /dips?\b.*parallel|parallel.*\bdips?\b/, ratio: 1 },
  { re: /piegament|push[\s-]?up/, ratio: 0.64 }
];

/**
 * Fraction of bodyweight lifted by an exercise (0 for barbell/machine work).
 * DB exercises declare it with `bodyweightRatio`; custom ones are matched by name.
 */
export const getBodyweightRatio = (exerciseName, exercisesDb = []) => {
  const norm = normalizeName(exerciseName);
  if (!norm) return 0;
  const dbEx = (exercisesDb || []).find(e => normalizeName(e.name) === norm);
  if (dbEx && typeof dbEx.bodyweightRatio === 'number') return dbEx.bodyweightRatio;
  if (dbEx && !dbEx.isCustom) return 0;
  if (norm.includes('assistit')) return 0;
  const rule = BODYWEIGHT_NAME_RULES.find(r => r.re.test(norm));
  return rule ? rule.ratio : 0;
};

export const getBodyweightLoad = (exerciseName, exercisesDb, bodyweight) => {
  const ratio = getBodyweightRatio(exerciseName, exercisesDb);
  if (ratio <= 0) return 0;
  const bw = Number(bodyweight) > 0 ? Number(bodyweight) : REFERENCE_BODYWEIGHT_KG;
  return bw * ratio;
};

// Bodyweight saved in Settings, falling back to the one given in the Science quiz.
export const resolveBodyweight = (state) => {
  const own = Number(state?.bodyweight);
  if (own > 0) return own;
  const fromQuiz = parseFloat(state?.scienceReport?.inputStats?.bw);
  return fromQuiz > 0 ? fromQuiz : null;
};
