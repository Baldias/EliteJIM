import { normalizeName, getExerciseCategories } from '../data/exercises.js';

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
2. EXERCISE NAMES: The "name" field of each exercise MUST be chosen EXACTLY and VERBATIM from the "AVAILABLE EXERCISES DATABASE" below (which contains Italian exercise names as stored in the app). Do NOT translate, alter spelling, or invent new names.
3. FIELDS PER EXERCISE:
   - "name": string (exact match from the DB list)
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
    return { success: false, error: 'Il testo inserito è vuoto.' };
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
      error: `Formato JSON non valido: ${err.message}. Assicurati di aver copiato solo la struttura JSON restituita dall'AI.`
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
        error: "Struttura non riconosciuta. Il JSON deve contenere un array di schede o una scheda con un elenco di 'exercises'."
      };
    }
  } else {
    return { success: false, error: 'Il JSON fornito non contiene un oggetto o un array valido.' };
  }

  if (templatesList.length === 0) {
    return { success: false, error: 'Nessuna scheda trovata nel JSON inserito.' };
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
      }

      validatedExercises.push({
        name: matchedName,
        setsCount: Math.max(1, parseInt(rawEx.setsCount, 10) || 3),
        targetReps: String(rawEx.targetReps || '8-10').trim(),
        restTime: Math.max(15, parseInt(rawEx.restTime, 10) || 90),
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
      error: "Nessun esercizio valido trovato nelle schede. Verifica che ogni scheda contenga un campo 'exercises' con almeno un esercizio."
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
      unknownExercises: Array.from(unknownExercisesSet)
    }
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
      restTime: Number(e.restTime) || 90,
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

