import { normalizeName } from '../data/exercises';

// A note belongs to the exercise, not to the plan: one note per exercise,
// shared by every plan and every session. Keyed by the normalized name.

export const noteKey = (name) => normalizeName(name || '');

export const getExerciseNote = (notes, name) => {
  if (!name || !notes) return '';
  return notes[noteKey(name)] || '';
};

export const setNote = (notes, name, note) => {
  const key = noteKey(name);
  if (!key) return notes || {};
  const next = { ...(notes || {}) };
  if (note && note.trim()) next[key] = note;
  else delete next[key];
  return next;
};

// Notes saved before they became per exercise lived in each plan and in each
// session. The most recent non-empty one wins: newest session first (history
// is newest first), then the plans.
export const legacyExerciseNotes = (state) => {
  const notes = {};
  const take = (name, note) => {
    const key = noteKey(name);
    if (key && typeof note === 'string' && note.trim() && !(key in notes)) notes[key] = note.trim();
  };
  for (const w of state?.history || []) {
    for (const ex of w.exercises || []) take(ex.name, ex.notes);
  }
  for (const tpl of state?.templates || []) {
    for (const ex of tpl.exercises || []) take(ex.name, ex.notes);
  }
  return notes;
};

export const resolveExerciseNotes = (saved) => {
  if (saved?.exerciseNotes && typeof saved.exerciseNotes === 'object') return saved.exerciseNotes;
  return legacyExerciseNotes(saved);
};

// What an import would do to the notes. An empty or missing note never
// touches the saved one. A note for an exercise that has none is added.
// A different note for an exercise that already has one is a conflict:
// the user decides whether to replace it.
export const planNoteImport = (templates, notes) => {
  const additions = {};
  const conflicts = [];
  const seen = new Set();
  for (const tpl of templates || []) {
    for (const ex of tpl.exercises || []) {
      const key = noteKey(ex.name);
      const incoming = typeof ex.notes === 'string' ? ex.notes.trim() : '';
      if (!key || !incoming || seen.has(key)) continue;
      seen.add(key);
      const current = (notes || {})[key] || '';
      if (!current) additions[key] = incoming;
      else if (current.trim() !== incoming) conflicts.push({ key, name: ex.name, current, incoming });
    }
  }
  return { additions, conflicts };
};

// Merges an import into the saved notes. `replaceKeys` are the conflicts the
// user chose to overwrite.
export const applyNoteImport = (notes, templates, replaceKeys = []) => {
  const { additions, conflicts } = planNoteImport(templates, notes);
  const next = { ...(notes || {}), ...additions };
  const replace = new Set(replaceKeys);
  for (const c of conflicts) if (replace.has(c.key)) next[c.key] = c.incoming;
  return next;
};

// Plans no longer carry their own copy of the note.
export const stripTemplateNotes = (exercises) =>
  (exercises || []).map(ex => {
    const { notes: _NOTES, ...rest } = ex;
    return rest;
  });

// The note follows the exercise when it is renamed (unless the new name already has one).
export const moveNote = (notes, oldName, newName) => {
  if (!oldName || !newName || noteKey(oldName) === noteKey(newName)) return notes;
  const note = getExerciseNote(notes, oldName);
  if (!note || getExerciseNote(notes, newName)) return notes;
  return setNote(setNote(notes, newName, note), oldName, '');
};
