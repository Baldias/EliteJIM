import { EXERCISES_DB, getAllExercises, normalizeName } from '../data/exercises';
import { getMondayTimestamp } from './gamification';
import {
  SCIENCE_STARTING_DOSES,
  isScienceV3Active,
  currentScienceSummary,
  scienceVolumes,
  classifyScienceExercise,
} from './scienceV3';
import { scienceCompletedSets } from './scienceCarry';

export const SPLIT_MUSCLES = [
  'Petto',
  'Dorso',
  'Spalle',
  'Quadricipiti',
  'Femorali',
  'Glutei',
  'Bicipiti',
  'Tricipiti',
  'Polpacci',
  'Addome',
];

// Ordine dai gruppi muscolari più grandi ai più piccoli per strutturare ogni seduta
export const MUSCLE_SIZE_ORDER = [
  'Quadricipiti',
  'Dorso',
  'Petto',
  'Femorali',
  'Glutei',
  'Spalle',
  'Tricipiti',
  'Bicipiti',
  'Polpacci',
  'Addome',
];

const muscleSizeRank = (muscle) => {
  const idx = MUSCLE_SIZE_ORDER.indexOf(muscle);
  return idx === -1 ? MUSCLE_SIZE_ORDER.length : idx;
};

const ISOLATION_IDS = new Set([
  'c3', 'c7', 'c11', 'c12',
  'b6', 'b8', 'b11', 'b12', 'b13',
  'l4', 'l5', 'l14', 'l15', 'l17', 'l20',
  's3', 's4', 's5', 's7', 's10', 's11',
  'bi5', 'bi6', 'bi8', 'bi10',
  'tr1', 'tr2', 'tr3', 'tr4', 'tr6', 'tr7', 'tr10',
]);

const COMPOUND_IDS = new Set([
  'c1', 'c2', 'c4', 'c5', 'c6', 'c8', 'c9', 'c10', 'c13', 'c14',
  'b1', 'b2', 'b3', 'b4', 'b5', 'b7', 'b9', 'b10', 'b14', 'b15', 'b16',
  'l1', 'l2', 'l3', 'l6', 'l7', 'l10', 'l11', 'l12', 'l13', 'l16', 'l18', 'l19',
  's1', 's2', 's6', 's8', 's9', 's12', 's13', 's14', 's15', 's16',
  'tr5', 'tr8', 'tr9',
]);

const ISOLATION_RE = /\b(extens\w*|croc\w*|fly|pectoral|alzate|laterali?|frontali?|90°|curl|pushdown|french|kickback|skull|pullover|face pull|abductor|adductor|slanci|scrollate|shrugs?|hyperext\w*|crunch|plank|sissy)\b/;
const COMPOUND_RE = /\b(squat|press\w*|panca|spinte|stacc\w*|deadlift|rdl|good morning|affond\w*|lunge\w*|step up|trazion\w*|pull-?up|chin-?up|lat machine|remator\w*|row|pulley|dip|hip thrust|lento|military|arnold|t bar)\b/;

// 0 = multiarticolare (liberi prima delle macchine), 1 = intermedio, 2 = isolamento
export function exerciseCompoundRank(name, allExercises = EXERCISES_DB) {
  const norm = normalizeName(name);
  const dbEx = (allExercises || []).find(e => normalizeName(e.name) === norm);
  const eqPenalty = dbEx?.equipmentType === 'machine' ? 0.2 : dbEx?.equipmentType === 'dumbbell' ? 0.1 : 0;

  if (dbEx && ISOLATION_IDS.has(dbEx.id)) return 2 + eqPenalty;
  if (dbEx && COMPOUND_IDS.has(dbEx.id)) return 0 + eqPenalty;
  if (ISOLATION_RE.test(norm)) return 2 + eqPenalty;
  if (COMPOUND_RE.test(norm)) return 0 + eqPenalty;
  return 1 + eqPenalty;
}

function sortExercisesCompoundFirst(names, allExercises) {
  return [...names].sort((a, b) => exerciseCompoundRank(a, allExercises) - exerciseCompoundRank(b, allExercises));
}

// Limiti di selezione per gruppo muscolare:
// Polpacci consentono anche 1 solo esercizio; Glutei e Addome opzionali (anche 0).
export function muscleExerciseBounds(muscle) {
  if (muscle === 'Glutei' || muscle === 'Addome') return { min: 0, max: 4 };
  if (muscle === 'Polpacci') return { min: 1, max: 4 };
  return { min: 2, max: 4 };
}

export function resolveUserGender(state) {
  return (
    state?.scienceState?.profile?.gender ||
    state?.scienceReport?.gender ||
    state?.nutritionGoals?.profile?.sex ||
    'unspecified'
  );
}

export function splitMusclesForSplit(split, gender = 'unspecified') {
  if (!split?.days?.length) return [];
  return SPLIT_MUSCLES.filter(m =>
    split.days.some(d => d.muscles.includes(m)) && !(gender === 'male' && m === 'Glutei')
  );
}

export const SPLITS_BY_DAYS = {
  2: [
    {
      id: 'upper-lower-2',
      name: 'Upper / Lower',
      subtitle: '2 sedute · multifrequenza essenziale',
      days: [
        { name: 'Upper', muscles: ['Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti'] },
        { name: 'Lower', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Addome'] },
      ],
    },
    {
      id: 'full-body-2',
      name: 'Full Body A / B',
      subtitle: '2 sedute · tutto il corpo ogni volta',
      days: [
        { name: 'Full Body A', muscles: ['Petto', 'Dorso', 'Spalle', 'Quadricipiti', 'Femorali', 'Bicipiti', 'Tricipiti'] },
        { name: 'Full Body B', muscles: ['Petto', 'Dorso', 'Spalle', 'Quadricipiti', 'Glutei', 'Polpacci', 'Addome'] },
      ],
    },
  ],
  3: [
    {
      id: 'ppl-3',
      name: 'Push / Pull / Legs',
      subtitle: 'La split a 3 giorni più famosa',
      days: [
        { name: 'Push', muscles: ['Petto', 'Spalle', 'Tricipiti'] },
        { name: 'Pull', muscles: ['Dorso', 'Bicipiti', 'Addome'] },
        { name: 'Legs', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'] },
      ],
    },
    {
      id: 'full-body-3',
      name: 'Full Body A / B / C',
      subtitle: 'Alta frequenza su 3 giorni',
      days: [
        { name: 'Full Body A', muscles: ['Petto', 'Dorso', 'Quadricipiti', 'Spalle', 'Tricipiti', 'Addome'] },
        { name: 'Full Body B', muscles: ['Dorso', 'Petto', 'Femorali', 'Glutei', 'Bicipiti', 'Polpacci'] },
        { name: 'Full Body C', muscles: ['Quadricipiti', 'Petto', 'Dorso', 'Spalle', 'Femorali', 'Bicipiti', 'Tricipiti'] },
      ],
    },
    {
      id: 'ul-fb-3',
      name: 'Upper / Lower / Full Body',
      subtitle: 'Ibrida 3 giorni bilanciata',
      days: [
        { name: 'Upper', muscles: ['Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti'] },
        { name: 'Lower', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Addome'] },
        { name: 'Full Body', muscles: ['Petto', 'Dorso', 'Spalle', 'Quadricipiti', 'Femorali', 'Bicipiti', 'Tricipiti'] },
      ],
    },
  ],
  4: [
    {
      id: 'ul-4',
      name: 'Upper / Lower × 2',
      subtitle: 'Classica multifrequenza su 4 giorni',
      days: [
        { name: 'Upper A', muscles: ['Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti'] },
        { name: 'Lower A', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Addome'] },
        { name: 'Upper B', muscles: ['Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti'] },
        { name: 'Lower B', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Addome'] },
      ],
    },
    {
      id: 'torso-limbs-4',
      name: 'Torso / Limbs × 2',
      subtitle: 'Focus braccia nei giorni gambe',
      days: [
        { name: 'Torso A', muscles: ['Petto', 'Dorso', 'Spalle', 'Addome'] },
        { name: 'Limbs A', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Bicipiti', 'Tricipiti', 'Polpacci'] },
        { name: 'Torso B', muscles: ['Dorso', 'Petto', 'Spalle', 'Addome'] },
        { name: 'Limbs B', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Bicipiti', 'Tricipiti', 'Polpacci'] },
      ],
    },
  ],
  5: [
    {
      id: 'ppl-ul-5',
      name: 'Push / Pull / Legs / Upper / Lower',
      subtitle: 'La 5 giorni più amata per ipertrofia',
      days: [
        { name: 'Push', muscles: ['Petto', 'Spalle', 'Tricipiti'] },
        { name: 'Pull', muscles: ['Dorso', 'Bicipiti', 'Addome'] },
        { name: 'Legs', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'] },
        { name: 'Upper', muscles: ['Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti'] },
        { name: 'Lower', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Addome'] },
      ],
    },
    {
      id: 'bro-5',
      name: 'Bro Split (5 giorni)',
      subtitle: 'Un grande distretto al giorno con richiami',
      days: [
        { name: 'Petto & Tricipiti', muscles: ['Petto', 'Tricipiti', 'Addome'] },
        { name: 'Dorso & Bicipiti', muscles: ['Dorso', 'Bicipiti', 'Polpacci'] },
        { name: 'Gambe', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'] },
        { name: 'Spalle & Addome', muscles: ['Spalle', 'Addome'] },
        { name: 'Braccia & Richiamo', muscles: ['Bicipiti', 'Tricipiti', 'Petto', 'Dorso'] },
      ],
    },
  ],
  6: [
    {
      id: 'ppl-6',
      name: 'Push / Pull / Legs × 2',
      subtitle: 'Massimo volume in multifrequenza',
      days: [
        { name: 'Push A', muscles: ['Petto', 'Spalle', 'Tricipiti'] },
        { name: 'Pull A', muscles: ['Dorso', 'Bicipiti', 'Addome'] },
        { name: 'Legs A', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'] },
        { name: 'Push B', muscles: ['Petto', 'Spalle', 'Tricipiti'] },
        { name: 'Pull B', muscles: ['Dorso', 'Bicipiti', 'Addome'] },
        { name: 'Legs B', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'] },
      ],
    },
    {
      id: 'arnold-6',
      name: 'Arnold Split × 2',
      subtitle: 'Petto/Dorso · Spalle/Braccia · Gambe',
      days: [
        { name: 'Petto & Dorso A', muscles: ['Petto', 'Dorso', 'Addome'] },
        { name: 'Spalle & Braccia A', muscles: ['Spalle', 'Bicipiti', 'Tricipiti'] },
        { name: 'Gambe A', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'] },
        { name: 'Petto & Dorso B', muscles: ['Petto', 'Dorso', 'Addome'] },
        { name: 'Spalle & Braccia B', muscles: ['Spalle', 'Bicipiti', 'Tricipiti'] },
        { name: 'Gambe B', muscles: ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci'] },
      ],
    },
  ],
};

// Ordina gli esercizi di un gruppo muscolare mettendo prima quelli svolti più spesso
export function rankExercisesForMuscle(muscle, allExercises = [], history = []) {
  const usage = new Map();
  for (const workout of history || []) {
    const time = Number(workout?.startTime || workout?.endTime) || 0;
    for (const ex of workout.exercises || []) {
      if (!ex?.name || !(ex.sets || []).some(s => s.done)) continue;
      const key = normalizeName(ex.name);
      const prev = usage.get(key) || { count: 0, lastUsed: 0 };
      usage.set(key, { count: prev.count + 1, lastUsed: Math.max(prev.lastUsed, time) });
    }
  }

  return (allExercises || [])
    .filter(ex => ex.category === muscle)
    .map(ex => {
      const info = usage.get(normalizeName(ex.name)) || { count: 0, lastUsed: 0 };
      return { ...ex, count: info.count, lastUsed: info.lastUsed, isFrequent: info.count > 0 };
    })
    .sort((a, b) => (b.count - a.count) || (b.lastUsed - a.lastUsed) || a.name.localeCompare(b.name));
}

// Genera le schede della split distribuendo e ruotando gli esercizi scelti per gruppo.
// Ordina ogni seduta dai muscoli più grandi ai più piccoli e mette sempre prima
// i multiarticolari e poi gli esercizi di isolamento.
// Nei giorni più ampi (es. Upper/Lower/Full Body da 5+ muscoli) mantiene 1 esercizio
// per gruppo quando abbinati a giorni più mirati, evitando sedute da 10 esercizi.
export function buildSplitTemplates({ split, selectedByMuscle, allExercises = EXERCISES_DB, scienceSync = false, now = Date.now() }) {
  if (!split?.days?.length) return [];
  const splitGroupId = `split-${now}`;

  const dayCountByMuscle = {};
  for (const day of split.days) {
    for (const muscle of day.muscles) {
      dayCountByMuscle[muscle] = (dayCountByMuscle[muscle] || 0) + 1;
    }
  }

  const occurrenceByMuscle = {};
  const cursorByMuscle = {};

  return split.days.map((day, idx) => {
    const orderedMuscles = [...day.muscles].sort((a, b) => muscleSizeRank(a) - muscleSizeRank(b));
    const exercises = [];
    for (const muscle of orderedMuscles) {
      const list = sortExercisesCompoundFirst((selectedByMuscle?.[muscle] || []).filter(Boolean), allExercises);
      if (list.length === 0) continue;

      const totalDays = dayCountByMuscle[muscle] || 1;
      const occ = occurrenceByMuscle[muscle] || 0;
      occurrenceByMuscle[muscle] = occ + 1;

      let picked;
      if (totalDays === 1) {
        picked = list;
      } else {
        let perDay;
        if (day.muscles.length >= 5) {
          const base = Math.max(1, Math.floor(list.length / totalDays));
          const rem = list.length % totalDays;
          const hasNarrowPeer = split.days.some(d => d.muscles.includes(muscle) && d.muscles.length < 5);
          perDay = hasNarrowPeer
            ? Math.min(2, base)
            : Math.min(2, base + (occ < rem ? 1 : 0));
        } else {
          perDay = Math.min(list.length, Math.max(2, Math.ceil(list.length / totalDays)));
        }

        const start = cursorByMuscle[muscle] || 0;
        cursorByMuscle[muscle] = start + perDay;
        picked = [];
        for (let i = 0; i < perDay; i++) {
          const exName = list[(start + i) % list.length];
          if (!picked.includes(exName)) picked.push(exName);
        }
        picked = sortExercisesCompoundFirst(picked, allExercises);
      }

      for (const name of picked) {
        exercises.push({
          name,
          muscle,
          setsCount: 3,
          targetReps: '8-12',
          restTime: 90,
        });
      }
    }

    const includedMuscles = orderedMuscles.filter(m => (selectedByMuscle?.[m] || []).filter(Boolean).length > 0);
    return {
      id: `tpl-${splitGroupId}-${idx + 1}`,
      name: includedMuscles.length > 0 ? `${day.name} (${includedMuscles.join('/')})` : day.name,
      splitGroupId,
      splitId: split.id,
      scienceSync: Boolean(scienceSync),
      exercises,
    };
  });
}

// Finestra settimanale corrente e target per muscolo (da Scienza V3 se attiva,
// altrimenti settimana di calendario Lun-Dom con dosi di partenza).
export function getCurrentScienceWeekContext(state, now = Date.now()) {
  const db = getAllExercises(state?.customExercises, state?.exerciseOverrides);
  const history = state?.history || [];
  const science = state?.scienceState;

  if (isScienceV3Active(state || {})) {
    const summary = currentScienceSummary(history, db, science, now);
    const targets = science.program.targets || {};
    const completedByMuscle = {};
    for (const [m, vol] of Object.entries(summary?.muscles || {})) {
      completedByMuscle[m] = scienceCompletedSets(vol);
    }
    return {
      range: { start: summary.start, end: summary.scheduledEnd || summary.end },
      targets,
      completedByMuscle,
      db,
    };
  }

  const start = getMondayTimestamp(now);
  const end = start + 7 * 86400000;
  const experience = science?.profile?.experience || 'intermediate';
  const targets = SCIENCE_STARTING_DOSES[experience] || SCIENCE_STARTING_DOSES.intermediate;
  const volumes = scienceVolumes(history, db, science || {}, start, end);
  const completedByMuscle = {};
  for (const [m, vol] of Object.entries(volumes.muscles || {})) {
    completedByMuscle[m] = scienceCompletedSets(vol);
  }
  return { range: { start, end }, targets, completedByMuscle, db };
}

// Restituisce l'ultimo allenamento svolto con questa scheda nella settimana corrente (se presente)
export function findCompletedWorkoutThisWeek(template, state, now = Date.now()) {
  if (!template) return null;
  const { range } = getCurrentScienceWeekContext(state, now);
  let latest = null;
  for (const w of state?.history || []) {
    const t = Number(w?.startTime);
    if (!(t >= range.start && t < range.end)) continue;
    const sameTemplate = w.templateId === template.id
      || (w.templateId == null && normalizeName(w.name) === normalizeName(template.name));
    if (!sameTemplate) continue;
    if (!(w.exercises || []).some(ex => (ex.sets || []).some(s => s.done))) continue;
    if (!latest || t > Number(latest.startTime)) latest = w;
  }
  return latest;
}

// Verifica se la scheda risulta completata almeno una volta nella settimana corrente
export function isTemplateCompletedThisWeek(template, state, now = Date.now()) {
  return Boolean(findCompletedWorkoutThisWeek(template, state, now));
}

// Ripartisce le serie settimanali residue di ciascun muscolo sulle sedute rimanenti
// della split bilanciando il carico totale tra i vari allenamenti (water-filling),
// così non ci sono sedute da 12 serie accanto a sedute da 25.
function computeBalancedMuscleAllocations(group, completedIds, ctx, scienceState) {
  const muscleOf = (ex) => ex?.muscle || classifyScienceExercise(ex, ctx.db, scienceState).primary;
  const uncompleted = group.filter(t => !completedIds.has(t.id));

  const dayLoad = Object.fromEntries(uncompleted.map(t => [t.id, 0]));
  const allocation = Object.fromEntries(uncompleted.map(t => [t.id, {}]));
  const remainingByMuscle = {};

  const musclesInGroup = [...new Set(
    group.flatMap(t => (t.exercises || []).map(muscleOf)).filter(Boolean)
  )];

  const entries = musclesInGroup.map(muscle => {
    const target = Number(ctx.targets?.[muscle]) || 0;
    const done = Number(ctx.completedByMuscle?.[muscle]) || 0;
    const remaining = Math.max(0, target - done);
    remainingByMuscle[muscle] = remaining;
    const days = uncompleted.filter(t => (t.exercises || []).some(e => muscleOf(e) === muscle));
    return { muscle, remaining, days };
  }).sort((a, b) => (a.days.length - b.days.length) || (b.remaining - a.remaining));

  for (const { muscle, remaining, days } of entries) {
    if (days.length === 0 || remaining <= 0) continue;
    const d = days.length;
    if (d === 1) {
      const id = days[0].id;
      allocation[id][muscle] = remaining;
      dayLoad[id] += remaining;
      continue;
    }

    // Quota minima per ogni seduta che allena il muscolo + riempimento del giorno più scarico
    const base = remaining >= d ? Math.max(1, Math.floor(remaining / (d * 2))) : 0;
    for (const day of days) {
      allocation[day.id][muscle] = base;
      dayLoad[day.id] += base;
    }

    const extra = remaining - base * d;
    for (let s = 0; s < extra; s++) {
      let bestDay = days[0];
      for (let i = 1; i < days.length; i++) {
        const cand = days[i];
        if (
          dayLoad[cand.id] < dayLoad[bestDay.id] ||
          (dayLoad[cand.id] === dayLoad[bestDay.id] && (allocation[cand.id][muscle] || 0) < (allocation[bestDay.id][muscle] || 0))
        ) {
          bestDay = cand;
        }
      }
      allocation[bestDay.id][muscle] += 1;
      dayLoad[bestDay.id] += 1;
    }
  }

  return { allocation, remainingByMuscle, muscleOf };
}

// Calcola dinamicamente le serie di una scheda sincronizzata con Scienza:
// scala le serie già fatte nella settimana e distribuisce il resto in modo bilanciato.
export function resolveDynamicTemplate(template, state, now = Date.now()) {
  if (!template?.scienceSync) return template;

  const ctx = getCurrentScienceWeekContext(state, now);
  const allTemplates = state?.templates || [];
  const splitTemplates = template.splitGroupId
    ? allTemplates.filter(t => t.splitGroupId === template.splitGroupId)
    : [template];
  const group = splitTemplates.length > 0 ? splitTemplates : [template];

  const completedIds = new Set(
    group.filter(t => isTemplateCompletedThisWeek(t, state, now)).map(t => t.id)
  );

  const { allocation, remainingByMuscle, muscleOf } = computeBalancedMuscleAllocations(
    group,
    completedIds,
    ctx,
    state?.scienceState
  );

  // Raggruppa gli esercizi della scheda corrente per muscolo
  const indicesByMuscle = {};
  (template.exercises || []).forEach((ex, i) => {
    const m = muscleOf(ex);
    if (!m) return;
    if (!indicesByMuscle[m]) indicesByMuscle[m] = [];
    indicesByMuscle[m].push(i);
  });

  const isCompleted = completedIds.has(template.id);
  const setsByIndex = {};
  const remainingByIndex = {};

  for (const [muscle, indices] of Object.entries(indicesByMuscle)) {
    const remainingSets = remainingByMuscle[muscle] ?? 0;
    const k = indices.length;

    if (isCompleted) {
      indices.forEach((exIdx) => {
        remainingByIndex[exIdx] = remainingSets;
        setsByIndex[exIdx] = template.exercises[exIdx]?.setsCount ?? 3;
      });
      continue;
    }

    const sessionMuscleSets = allocation[template.id]?.[muscle] ?? 0;
    indices.forEach((exIdx, j) => {
      remainingByIndex[exIdx] = remainingSets;
      if (sessionMuscleSets <= 0) {
        setsByIndex[exIdx] = 1;
      } else {
        setsByIndex[exIdx] = Math.max(1, Math.floor(sessionMuscleSets / k) + (j < (sessionMuscleSets % k) ? 1 : 0));
      }
    });
  }

  return {
    ...template,
    exercises: (template.exercises || []).map((ex, idx) => ({
      ...ex,
      setsCount: setsByIndex[idx] ?? ex.setsCount ?? 3,
      ...(idx in remainingByIndex ? { remainingMuscleSets: remainingByIndex[idx] } : {}),
    })),
  };
}
