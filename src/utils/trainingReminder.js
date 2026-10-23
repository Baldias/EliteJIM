import { hasLegacyScience } from './scienceV3';

export const emptyTrainingReminder = () => ({ confirmations:[], nextAt:null });
// Product cadence: first eligible workout, then +2 days, then +7 days.
// Calendar arithmetic keeps local time across daylight-saving changes.
export function reminderDue(reminder, workout, now, recovery = false) {
  const confirmations = reminder?.confirmations || [];
  return Boolean(workout && !recovery && confirmations.length < 3 &&
    !confirmations.some(c => String(c.workoutId) === String(workout.id)) &&
    (reminder?.nextAt == null || now >= reminder.nextAt));
}
export function acknowledgeTrainingReminder(reminder, workout, now, recovery = false) {
  const current = reminder || emptyTrainingReminder();
  if (!reminderDue(current,workout,now,recovery)) return current;
  const confirmations = [...current.confirmations,{workoutId:workout.id,at:now}];
  const next = new Date(now);
  next.setDate(next.getDate() + (confirmations.length === 1 ? 2 : 7));
  return { confirmations, nextAt:confirmations.length < 3 ? next.getTime() : null };
}
export function isTrainingRecovery(state) {
  if (hasLegacyScience(state.scienceReport, state.scienceState)) return state.scienceReport.status === 'active' && [9,10].includes(state.scienceReport.currentWeek);
  const p = state.scienceState?.program;
  // Week five alone is not a deload: the user must have accepted recovery.
  return p?.status === 'active' && Boolean(p.recommendations?.some(r => r.status === 'accepted' && r.appliedWeek === p.currentWeek && ['deload','recovery'].includes(r.type)));
}
