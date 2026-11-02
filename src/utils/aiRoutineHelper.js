import { normalizeName, getExerciseCategories, EXERCISE_CATEGORIES, EQUIPMENT_TYPES } from '../data/exercises.js';
import { parseNonNegativeInt } from './number.js';
import { tr } from '../i18n';

/**
 * Genera il Master Prompt da copiare per un'AI esterna (ChatGPT, Claude, Gemini, DeepSeek).
 * Include le regole sintattiche, lo schema JSON e l'intero catalogo di esercizi disponibili nel DB.
 */
export function buildAiWorkoutPrompt({ allExercises = [], splitDays = 3, customGoal = 'Ipertrofia', userNotes = '' }) {
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

  return `You are an elite Strength & Conditioning coach and biomechanics expert.
Your task is to create a professional, science-based workout routine for the "EliteJIM" fitness app.

═══════════════════════════════════════════════════════════════
STRICT RULES (CRITICAL FOR PARSING)
═══════════════════════════════════════════════════════════════
1. OUTPUT FORMAT: Return ONLY a raw, valid JSON array. DO NOT wrap with conversational text, explanations, or text outside the JSON.
2. EXERCISE NAMES: Prefer names chosen EXACTLY and VERBATIM from the "AVAILABLE EXERCISES DATABASE" below (which contains Italian exercise names as stored in the app). Do NOT translate or alter the spelling of existing names. Add an exercise that is not in the list ONLY when no listed exercise fits: then also give its "category" (the main muscle, one of: ${Object.values(EXERCISE_CATEGORIES).join(', ')}), optional "secondaryCategories" (array, same values) and "equipmentType" ("barbell", "dumbbell" or "machine"). The user will be asked whether to add it to their database.
3. FIELDS PER EXERCISE:
   - "name": string (exact match from the DB list, or a new exercise as described above)
   - "setsCount": integer (e.g. 3 or 4)
   - "targetReps": string rep range (e.g. "6-8", "8-10", "10-12", "12-15")
   - "restTime": integer rest in seconds between sets (e.g. 60, 90, 120, 180)
   - "notes": concise coaching cue, tempo or setup tip (e.g. "1s pause at chest, control eccentric")

═══════════════════════════════════════════════════════════════
REQUIRED JSON FORMAT
═══════════════════════════════════════════════════════════════
Return an array of workout routines (for a ${splitDays}-day weekly program):

[
  {
    "name": "Push A (Petto / Spalle / Tricipiti)",
    "exercises": [
      {
        "name": "Panca Piana Bilanciere",
        "setsCount": 4,
        "targetReps": "6-8",
        "restTime": 120,
        "notes": "1s chest pause, controlled 3s eccentric"
      },
      {
        "name": "Military Press",
        "setsCount": 3,
        "targetReps": "8-10",
        "restTime": 90,
        "notes": "Locked core and glutes, full lockout"
      }
    ]
  }
]

═══════════════════════════════════════════════════════════════
AVAILABLE EXERCISES DATABASE (USE ONLY THESE EXACT NAMES)
═══════════════════════════════════════════════════════════════
${dbLines}

═══════════════════════════════════════════════════════════════
USER SPECIFICATIONS
═══════════════════════════════════════════════════════════════
• Weekly frequency: ${splitDays} days
• Primary goal: ${customGoal}
${userNotes ? `• Special requirements / injuries / focus: ${userNotes}` : '• No specific limitations: build an optimal, balanced split with proper weekly volume (10-18 weekly sets per muscle group).'}`;
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

