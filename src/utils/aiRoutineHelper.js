import { normalizeName, getExerciseCategories, EXERCISE_CATEGORIES, EQUIPMENT_TYPES } from '../data/exercises.js';
import { parseNonNegativeInt } from './number.js';
import { tr, getLanguage } from '../i18n';
import { getExerciseStats } from './exerciseStreaks.js';
import { hasLegacyScience } from './scienceV3.js';

const RULE = '═══════════════════════════════════════════════════════════════';
const section = title => `${RULE}\n${title}\n${RULE}`;

// Streaks shorter than this say nothing about consistency.
export const PROMPT_MIN_STREAK_WEEKS = 2;
const PROMPT_MAX_STREAKS = 20;

/**
 * Exercises with an active streak of at least two weeks, for the AI prompt.
 * Uses the same stats as the Progress page, so it follows any change to the streak rule.
 * Names are given with the database spelling when the exercise is in the DB.
 */
export function exerciseStreaksForPrompt(history = [], allExercises = [], referenceDate = Date.now()) {
  const dbNames = new Map(allExercises.map(ex => [normalizeName(ex.name), ex.name]));
  const best = new Map();
  getExerciseStats(history, referenceDate).forEach(({ streak }, name) => {
    const key = normalizeName(name);
    if (streak < PROMPT_MIN_STREAK_WEEKS || (best.get(key)?.weeks || 0) >= streak) return;
    best.set(key, { name: dbNames.get(key) || name, weeks: streak });
  });
  return [...best.values()]
    .sort((a, b) => b.weeks - a.weeks || a.name.localeCompare(b.name))
    .slice(0, PROMPT_MAX_STREAKS);
}

/**
 * Weekly direct-set targets of the current Scienza week, or null when no
 * Scienza program is running. Muscles with 0 sets are left out.
 */
export function scienceWeekForPrompt({ scienceState, scienceReport, showScience } = {}) {
  const program = scienceState?.program;
  if (!showScience || program?.status !== 'active' || hasLegacyScience(scienceReport, scienceState)) return null;
  const priorities = scienceState.profile?.priorities || [];
  const targets = Object.entries(program.targets || {})
    .filter(([, sets]) => Number(sets) > 0)
    .map(([muscle, sets]) => ({ muscle, sets: Number(sets), priority: priorities.includes(muscle) }))
    .sort((a, b) => Number(b.priority) - Number(a.priority) || b.sets - a.sets || a.muscle.localeCompare(b.muscle));
  if (!targets.length) return null;
  const sessions = Math.round(Number(program.sessionPlans?.[program.currentWeek]?.plannedSessions ?? scienceState.profile?.daysPerWeek)) || 4;
  return { week: program.currentWeek, sessions: Math.min(7, Math.max(1, sessions)), targets };
}

const GOAL_REPS = {
  Ipertrofia: 'Ipertrofia: mostly 6-12 reps, isolation exercises up to 15-20.',
  Forza: 'Forza: main compound lifts in 3-6 reps with 180-300 s rest, accessories in 6-10 reps.',
  Definizione: 'Definizione: train exactly like Ipertrofia (fat loss comes from the diet, not from higher reps); keep volume at the lower end if recovery is limited.',
  'Full Body': 'Full Body: this is the split type, every workout trains the whole body; use Ipertrofia rep ranges.'
};

const LANGUAGE_NAMES = { it: 'Italian', en: 'English' };

/**
 * Genera il Master Prompt da copiare per un'AI esterna (ChatGPT, Claude, Gemini, DeepSeek).
 * Include le regole sintattiche, lo schema JSON, i principi con cui l'app conta le serie,
 * l'intero catalogo di esercizi, gli esercizi in streak e (facoltativo) le serie della settimana Scienza.
 */
export function buildAiWorkoutPrompt({
  allExercises = [], splitDays = 3, customGoal = 'Ipertrofia', userNotes = '',
  streaks = [], scienceWeek = null, language = getLanguage()
}) {
  // Raggruppa gli esercizi per categoria primaria
  const categorized = {};

  allExercises.forEach(ex => {
    const categories = getExerciseCategories(ex);
    const primary = categories[0] || 'Altro';
    if (!categorized[primary]) categorized[primary] = [];
    if (!categorized[primary].includes(ex.name)) {
      categorized[primary].push(ex.name);
    }
  });

  // Costruisci il blocco del database formattato
  const dbLines = Object.keys(categorized).sort().map(cat => {
    const list = categorized[cat].sort().join(', ');
    return `• ${cat.toUpperCase()}: ${list}`;
  }).join('\n');

  const days = scienceWeek ? scienceWeek.sessions : splitDays;
  const notesLanguage = LANGUAGE_NAMES[language] || 'Italian';
  const goalLine = GOAL_REPS[customGoal] || GOAL_REPS.Ipertrofia;

  const volumeLine = scienceWeek
    ? '• Weekly volume: follow EXACTLY the "SCIENZA WEEKLY SETS" section below.'
    : '• Weekly volume: aim for 10-18 working sets per muscle group per week. Count a set as 1 for the main muscle of the exercise and 0.5 for each muscle that only assists (e.g. one bench press set = 1 chest + 0.5 triceps + 0.5 shoulders).';

  const scienceBlock = scienceWeek ? `

${section(`SCIENZA WEEKLY SETS (WEEK ${scienceWeek.week} OF THE USER'S PROGRAM) - MANDATORY`)}
The user follows a science-based program that sets the exact number of weekly working sets per muscle.
Across the ${days} workouts, program EXACTLY these sets per muscle, no more and no fewer:
${scienceWeek.targets.map(t => `• ${t.muscle}: ${t.sets} sets${t.priority ? ' (priority muscle)' : ''}`).join('\n')}
How the app counts them: a set counts ONLY for the main muscle of its exercise (the group it is listed under in the database below, or its "category" if it is a new exercise). Sets where a muscle only assists do NOT count toward these numbers.
Muscles not listed get no direct sets (they can still work as assisting muscles).
Spread each muscle's sets over at least two workouts when it has 6 or more sets, and keep each workout at 20 working sets or fewer.
Before answering, add up the sets per main muscle and check that every total matches the list exactly.` : '';

  const streakBlock = !streaks.length ? '' : `

${section('EXERCISES THE USER IS DOING CONSISTENTLY (ACTIVE STREAK)')}
Consecutive weeks in which the user has trained each exercise:
${streaks.map(s => `• ${s.name}: ${s.weeks} weeks`).join('\n')}
Keep these exercises in the new program, with the same exact names, when they fit the goal and the split: the user is tracking progressive overload on them. Replace one only for a clear reason (injury or user request, it no longer fits the split${scienceWeek ? ', the Scienza set targets' : ''}, or the muscle already has enough volume), and then prefer a close variation.`;

  return `You are an elite Strength & Conditioning coach and biomechanics expert.
Your task is to create a professional, science-based workout routine for the "EliteJIM" fitness app.

${section('STRICT RULES (CRITICAL FOR PARSING)')}
1. OUTPUT FORMAT: Return ONLY a raw, valid JSON array. No text, explanations or markdown outside the JSON.
2. EXERCISE NAMES: Prefer names copied EXACTLY and VERBATIM from the "AVAILABLE EXERCISES DATABASE" below (Italian names as stored in the app). Do NOT translate or alter existing names.
   Use an exercise that is NOT in the list only when no listed exercise fits. For every such new exercise you MUST also give:
   - "category": the main muscle, one of: ${Object.values(EXERCISE_CATEGORIES).join(', ')}
   - "secondaryCategories": array of the muscles that clearly assist (same values), [] if none
   - "equipmentType": "barbell", "dumbbell" or "machine" (cables count as "machine")
   The user will be asked whether to add it to their database.
3. Do not repeat the same exercise twice in the same workout.
4. FIELDS PER EXERCISE:
   - "name": string (exact name from the database, or a new exercise as in rule 2)
   - "setsCount": integer, WORKING SETS ONLY (warm-up sets are not counted)
   - "targetReps": string rep range (e.g. "4-6", "6-8", "8-12", "12-15")
   - "restTime": integer rest in seconds between sets
   - "notes": one short cue in ${notesLanguage} (max ~80 characters) about technique or setup. Use "" when there is nothing useful to add. Do not repeat sets, reps or rest here: the user sees and edits these notes during every workout.

${section('TRAINING PRINCIPLES (HOW THE APP COUNTS YOUR PROGRAM)')}
• Effort: every working set is taken to 0-1 reps in reserve (RIR 0 = no other clean rep possible, RIR 1 = one clean rep left), with correct technique. The app only counts sets at RIR 0-1 as working sets.
${volumeLine}
• Frequency: train each muscle about twice per week, leaving 48-72 hours before training the same muscle hard again.
• Rest: 120-180 s for heavy compound lifts, 90-120 s for isolation exercises.
• Exercise selection: prefer full range of motion and exercises that load the muscle in its lengthened position when possible. Put compound lifts before isolation work.
• Session size: keep each workout around 15-20 working sets.
• Rep ranges for the goal: ${goalLine}${scienceBlock}

${section('REQUIRED JSON FORMAT')}
Return an array of workout routines (for a ${days}-day weekly program):

[
  {
    "name": "Push A (Petto / Spalle / Tricipiti)",
    "exercises": [
      {
        "name": "Panca Piana Bilanciere",
        "setsCount": 3,
        "targetReps": "6-8",
        "restTime": 180,
        "notes": "Scapole addotte, pausa di 1s al petto"
      },
      {
        "name": "Alzate Laterali Manubri",
        "setsCount": 3,
        "targetReps": "12-15",
        "restTime": 90,
        "notes": ""
      },
      {
        "name": "Croci al Cavo Basso",
        "category": "Petto",
        "secondaryCategories": ["Spalle"],
        "equipmentType": "machine",
        "setsCount": 3,
        "targetReps": "10-12",
        "restTime": 90,
        "notes": "Allungamento completo in basso"
      }
    ]
  }
]
(The third exercise shows the format of a NEW exercise that is not in the database.)

${section('AVAILABLE EXERCISES DATABASE (USE THESE EXACT NAMES)')}
${dbLines}${streakBlock}

${section('USER SPECIFICATIONS')}
• Weekly frequency: ${days} days
• Primary goal: ${customGoal}
• Special requirements / injuries / focus: ${userNotes || 'none: build an optimal, balanced split.'}
These user specifications take priority over the training principles above when they conflict${scienceWeek ? ', but never change the Scienza weekly sets' : ''}.`;
}

/**
 * Ripulisce, parsa e valida il testo JSON incollato dall'utente.
 * Supporta sia un oggetto scheda singolo sia un array di schede,
 * e gestisce eventuali wrapper come { templates: [...] } o { schede: [...] }.
 */
export function parseAndValidateWorkoutJson(rawText, allKnownExercises = []) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { success: false, error: tr('Il testo inserito è vuoto.') };
  }

  // 1. Rimuovi blocchi di codice markdown (```json ... ``` o ``` ... ```)
  let cleanText = rawText.trim();
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleanText.match(jsonBlockRegex);
  if (match && match[1]) {
    cleanText = match[1].trim();
  }

  // 2. Se ci sono caratteri prima del primo '[' o '{', estrai la porzione JSON
  const firstBrace = cleanText.indexOf('{');
  const firstBracket = cleanText.indexOf('[');

  let startIndex = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex !== -1 && startIndex > 0) {
    cleanText = cleanText.substring(startIndex);
  }

  // Rimuovi eventuale testo dopo l'ultima parentesi chiusa
  const lastBrace = cleanText.lastIndexOf('}');
  const lastBracket = cleanText.lastIndexOf(']');
  const endIndex = Math.max(lastBrace, lastBracket);
  if (endIndex !== -1 && endIndex < cleanText.length - 1) {
    cleanText = cleanText.substring(0, endIndex + 1);
  }

  // 3. Esegui JSON.parse
  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch (err) {
    return {
      success: false,
      error: tr('Formato JSON non valido: {message}. Assicurati di aver copiato solo la struttura JSON restituita dall\'AI.', { message: err.message })
    };
  }

  // 4. Normalizza in array di schede
  let templatesList = [];

  if (Array.isArray(parsed)) {
    templatesList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    // Verifica se è un oggetto che racchiude un array
    if (Array.isArray(parsed.templates)) {
      templatesList = parsed.templates;
    } else if (Array.isArray(parsed.schede)) {
      templatesList = parsed.schede;
    } else if (Array.isArray(parsed.workouts)) {
      templatesList = parsed.workouts;
    } else if (Array.isArray(parsed.routines)) {
      templatesList = parsed.routines;
    } else if (parsed.exercises && Array.isArray(parsed.exercises)) {
      // È una scheda singola
      templatesList = [parsed];
    } else {
      return {
        success: false,
        error: tr("Struttura non riconosciuta. Il JSON deve contenere un array di schede o una scheda con un elenco di 'exercises'.")
      };
    }
  } else {
    return { success: false, error: tr('Il JSON fornito non contiene un oggetto o un array valido.') };
  }

  if (templatesList.length === 0) {
    return { success: false, error: tr('Nessuna scheda trovata nel JSON inserito.') };
  }

  // 5. Crea una mappa degli esercizi noti per il matching
  const knownMap = new Map();
  allKnownExercises.forEach(ex => {
    knownMap.set(normalizeName(ex.name), ex.name);
  });

  const validatedTemplates = [];
  let totalExercisesCount = 0;
  let matchedExercisesCount = 0;
  const unknownExercisesSet = new Set();
  const newExercisesMap = new Map();

  for (let i = 0; i < templatesList.length; i++) {
    const rawTpl = templatesList[i];
    if (!rawTpl || typeof rawTpl !== 'object') continue;

    const tplName = (rawTpl.name || `Scheda ${i + 1}`).trim();
    const rawExercises = Array.isArray(rawTpl.exercises) ? rawTpl.exercises : [];

    if (rawExercises.length === 0) {
      continue; // Salta schede vuote
    }

    const validatedExercises = [];

    for (const rawEx of rawExercises) {
      if (!rawEx || typeof rawEx !== 'object') continue;
      const originalName = (rawEx.name || '').trim();
      if (!originalName) continue;

      totalExercisesCount++;

      // Controlla corrispondenza nel database
      const norm = normalizeName(originalName);
      let matchedName = originalName;

      if (knownMap.has(norm)) {
        matchedName = knownMap.get(norm);
        matchedExercisesCount++;
      } else {
        unknownExercisesSet.add(originalName);
        if (!newExercisesMap.has(norm)) newExercisesMap.set(norm, describeNewExercise(originalName, rawEx));
      }

      validatedExercises.push({
        name: matchedName,
        setsCount: Math.max(1, parseInt(rawEx.setsCount, 10) || 3),
        targetReps: String(rawEx.targetReps || '8-10').trim(),
        restTime: parseNonNegativeInt(rawEx.restTime, 90),
        notes: typeof rawEx.notes === 'string' ? rawEx.notes.trim() : ''
      });
    }

    if (validatedExercises.length > 0) {
      validatedTemplates.push({
        name: tplName,
        exercises: validatedExercises
      });
    }
  }

  if (validatedTemplates.length === 0) {
    return {
      success: false,
      error: tr("Nessun esercizio valido trovato nelle schede. Verifica che ogni scheda contenga un campo 'exercises' con almeno un esercizio.")
    };
  }

  return {
    success: true,
    templates: validatedTemplates,
    stats: {
      templatesCount: validatedTemplates.length,
      totalExercises: totalExercisesCount,
      matchedCount: matchedExercisesCount,
      unknownCount: unknownExercisesSet.size,
      unknownExercises: Array.from(unknownExercisesSet),
      newExercises: Array.from(newExercisesMap.values())
    }
  };
}

const C = EXERCISE_CATEGORIES;

// Aliases accepted in the JSON "category" fields (keys, Italian values, common English names).
const CATEGORY_ALIASES = {
  chest: C.CHEST, pecs: C.CHEST, pectorals: C.CHEST,
  back: C.BACK, lats: C.BACK, dorsali: C.BACK, schiena: C.BACK, trapezius: C.BACK, traps: C.BACK,
  quadriceps: C.QUADRICEPS, quads: C.QUADRICEPS, quadricipite: C.QUADRICEPS, gambe: C.QUADRICEPS, legs: C.QUADRICEPS,
  hamstrings: C.HAMSTRINGS, femorale: C.HAMSTRINGS,
  glutes: C.GLUTES, gluteo: C.GLUTES, glutei: C.GLUTES,
  adductors: C.ADDUCTORS, adduttore: C.ADDUCTORS,
  calves: C.CALVES, calf: C.CALVES, polpaccio: C.CALVES,
  shoulders: C.SHOULDERS, delts: C.SHOULDERS, deltoids: C.SHOULDERS, deltoidi: C.SHOULDERS,
  biceps: C.BICEPS, bicipite: C.BICEPS,
  triceps: C.TRICEPS, tricipite: C.TRICEPS,
  core: C.CORE, abs: C.CORE, abdominals: C.CORE, addominali: C.CORE,
  cardio: C.CARDIO,
  neck: C.NECK,
  forearms: C.FOREARMS, avambraccio: C.FOREARMS
};
Object.entries(C).forEach(([key, value]) => {
  CATEGORY_ALIASES[key.toLowerCase()] = value;
  CATEGORY_ALIASES[value.toLowerCase()] = value;
});

export function resolveCategory(value) {
  if (typeof value !== 'string') return null;
  return CATEGORY_ALIASES[normalizeName(value)] || null;
}

// Keyword rules to guess the main muscle from an exercise name (Italian or English). Order matters: specific first.
const CATEGORY_RULES = [
  [/calf|polpacc|tibial/, C.CALVES],
  [/wrist|polso|avambracc|forearm|farmer/, C.FOREARMS],
  [/leg curl|curl femoral|femoral|hamstring|nordic|rdl|rumen|romanian|stacc|deadlift|good morning/, C.HAMSTRINGS],
  [/hip thrust|glute|glut|abduct|abduz|slanci|kickback ai cavi|frog pump/, C.GLUTES],
  [/adduct|adduz/, C.ADDUCTORS],
  [/squat|leg press|pressa|affond|lunge|leg extension|step up|split/, C.QUADRICEPS],
  [/tricip|tricep|pushdown|push down|french|skull|kickback|dip alla panca|estensioni/, C.TRICEPS],
  [/curl|bicip|bicep/, C.BICEPS],
  [/alzat|lateral|raise|military|shoulder|spall|face pull|lento|arnold|delt|tirate|upright/, C.SHOULDERS],
  [/panca|bench|chest|pett|croci|fly|push-up|push up|piegament|pec|dip/, C.CHEST],
  [/lat |lat$|trazion|pull-up|pull up|pulldown|pull-down|row|rematore|pulley|dors|back|shrug|scrollat|pullover/, C.BACK],
  [/crunch|plank|addom|abs|core|leg raise|twist|ab roller|hollow/, C.CORE],
  [/neck|collo/, C.NECK],
  [/tapis|bike|cyclette|corsa|run|ellittic|vogatore|rower|stepper|corda|jump rope|cardio/, C.CARDIO]
];

export function guessCategory(name) {
  const n = normalizeName(name);
  const rule = CATEGORY_RULES.find(([re]) => re.test(n));
  return rule ? rule[1] : null;
}

const EQUIPMENT_ALIASES = {
  barbell: EQUIPMENT_TYPES.BARBELL, bilanciere: EQUIPMENT_TYPES.BARBELL,
  dumbbell: EQUIPMENT_TYPES.DUMBBELL, manubri: EQUIPMENT_TYPES.DUMBBELL, manubrio: EQUIPMENT_TYPES.DUMBBELL,
  machine: EQUIPMENT_TYPES.MACHINE, macchina: EQUIPMENT_TYPES.MACHINE, cable: EQUIPMENT_TYPES.MACHINE, cavi: EQUIPMENT_TYPES.MACHINE
};

export function guessEquipment(name) {
  const n = normalizeName(name);
  if (/manubr|dumbbell|\bdb\b/.test(n)) return EQUIPMENT_TYPES.DUMBBELL;
  if (/macchin|machine|cav[io]|cable|pulley|smith|multipower|lat machine|press orizzontale|pressa|leg press/.test(n)) return EQUIPMENT_TYPES.MACHINE;
  return EQUIPMENT_TYPES.BARBELL;
}

/**
 * Builds the database entry proposed for an exercise that is not in the DB:
 * muscles and equipment come from the JSON when given, otherwise they are guessed from the name.
 */
export function describeNewExercise(name, rawEx = {}) {
  const fromJson = resolveCategory(rawEx.category ?? rawEx.muscle ?? rawEx.primaryMuscle);
  const category = fromJson || guessCategory(name);
  const rawSecondary = rawEx.secondaryCategories ?? rawEx.secondaryMuscles ?? [];
  const secondaryCategories = [...new Set((Array.isArray(rawSecondary) ? rawSecondary : [rawSecondary])
    .map(resolveCategory)
    .filter(c => c && c !== category))];
  const equipmentType = EQUIPMENT_ALIASES[normalizeName(rawEx.equipmentType || rawEx.equipment || '')] || guessEquipment(name);
  return {
    name,
    category,
    secondaryCategories,
    equipmentType,
    source: fromJson ? 'json' : category ? 'guess' : null
  };
}

/**
 * Formatta uno o più template in JSON pulito conforme allo standard di importazione.
 */
export function formatTemplatesForExport(templates) {
  if (!templates) return '[]';
  const list = Array.isArray(templates) ? templates : [templates];
  const cleaned = list.map(t => ({
    name: t.name || 'Scheda Personalizzata',
    exercises: (t.exercises || []).map(e => ({
      name: e.name,
      setsCount: Number(e.setsCount) || 3,
      targetReps: String(e.targetReps || '8-10'),
      restTime: parseNonNegativeInt(e.restTime, 90),
      ...(e.notes ? { notes: e.notes.trim() } : {})
    }))
  }));
  return JSON.stringify(cleaned, null, 2);
}

/**
 * Avvia il download locale di un file .json contenente i template.
 */
export function downloadTemplatesAsJson(templates, filename) {
  const jsonStr = formatTemplatesForExport(templates);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeName = (filename || 'scheda-elitejim').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

