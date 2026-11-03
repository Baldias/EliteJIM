// A session note belongs to one workout only: it is saved with that session in
// the history and is never copied to plans, to other sessions or to the
// exercise notes (see ./exerciseNotes.js).

export const getSessionNote = (workout) =>
  typeof workout?.sessionNote === 'string' ? workout.sessionNote.trim() : '';

// The workout as it is stored: a blank note is dropped instead of saved empty.
export const withSessionNote = (workout, note) => {
  if (!workout) return workout;
  const { sessionNote: _OLD, ...rest } = workout;
  const text = typeof note === 'string' ? note.trim() : '';
  return text ? { ...rest, sessionNote: text } : rest;
};
