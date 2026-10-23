import { scienceVolumes, currentScienceSummary } from './scienceV3';
import { scienceProgramWeekRange, projectedScienceWeekRange } from './scienceCalendar';
import { allocateScienceGrowth } from './scienceAllocation';

export function localScienceDate(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Strictly next Monday, including when today is already Monday. Calendar days
// preserve local midnight across daylight-saving changes.
export function nextScienceMonday(time) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return localScienceDate(d);
}

export const SCIENCE_LANDMARK_COLORS = { mv: '#30D158', mev: '#FFD60A', mav: '#BF5AF2', mrv: '#FF453A' };
export function scienceLandmarkBand(landmark, target, role) {
  if (role === 'maintenance' || target <= (landmark?.mvEstimate ?? 0)) return 'mv';
  if (landmark?.mrv && target >= landmark.mrv.lower) return 'mrv';
  if (landmark?.productiveRange && target >= landmark.productiveRange[0]) return 'mav';
  if (landmark?.mevEstimate != null && target > landmark.mevEstimate) return 'mav';
  return 'mev';
}

function favorableAllocation(targets, roles, program, profile, nextWeek) {
  const candidates = Object.keys(targets).filter(m => roles[m] === 'growth' && targets[m] > 0);
  const increments = Object.fromEntries(candidates.map(m => [m, profile.experience === 'beginner' ? 1 : profile.experience === 'advanced' && profile.priorities.includes(m) ? 3 : 2]));
  return allocateScienceGrowth({ ...program, targets, roles }, profile, candidates, increments, nextWeek);
}

// Read-only scenario. Never closes a week, changes targets or infers an MRV.
export function scienceWeekPreview(science, history, db, requested, now) {
  const p = science?.program;
  if (!p) return null;
  const week = Math.max(1, Math.min(5, requested));
  const saved = p.weeks.find(w => w.week === week);
  if (saved) return { ...saved.volumes, ...saved, roles: saved.roles || p.roles, kind: 'archive' };
  if (week === p.currentWeek) return { ...currentScienceSummary(history, db, science, now), landmarks: p.landmarks, kind: 'current' };
  let targets = { ...p.targets }, roles = { ...p.roles };
  let redistribution = false;
  for (let w = p.currentWeek; w < Math.min(week, 4); w++) {
    const allocation = favorableAllocation(targets, roles, p, science.profile, w + 1);
    targets = allocation.targets; roles = allocation.roles; redistribution ||= allocation.requiresConsent;
  }
  if (week === 5) targets = Object.fromEntries(Object.entries(targets).map(([m, n]) => [m, n - Math.ceil(n * 0.5)]));
  const range = projectedScienceWeekRange(p, week, now);
  return { ...scienceVolumes([], db, science, range.start, range.end), ...range, week, targets, roles, redistribution, landmarks: p.landmarks, kind: week === 5 ? 'deload-estimate' : 'estimate' };
}

export function scienceSessionGuidance(science, history, db, now) {
  const p = science?.program;
  if (!p) return null;
  const range = scienceProgramWeekRange(p);
  const summary = currentScienceSummary(history, db, science, now);
  const plannedSessions = p.sessionPlans?.[p.currentWeek]?.plannedSessions ?? science.profile.daysPerWeek;
  const completedSessions = new Set(history.filter(w => w.startTime >= range.start && w.startTime <= now && (w.exercises || []).some(e => e.sets?.some(s => s.done && !s.isWarmup && !s.isDropset && !s.isRestPause))).map(w => w.id)).size;
  const total = Object.values(p.targets).reduce((n, v) => n + v, 0);
  const missingMuscles = Object.entries(p.targets).map(([muscle, target]) => ({ muscle, remaining: Math.max(0, target - (summary.muscles[muscle]?.direct || 0)), unknown: summary.muscles[muscle]?.unknown || 0 })).filter(m => m.remaining > 0).sort((a, b) => Number(science.profile.priorities.includes(b.muscle)) - Number(science.profile.priorities.includes(a.muscle)) || a.muscle.localeCompare(b.muscle));
  const remaining = missingMuscles.reduce((n, m) => n + m.remaining, 0);
  const unknown = Object.keys(p.targets).reduce((n, m) => n + (summary.muscles[m]?.unknown || 0), 0);
  const sessionsLeft = Math.max(0, plannedSessions - completedSessions);
  return { total, missingMuscles, plannedSessions, completedSessions, remaining, unknown, sessionsLeft, average: total / plannedSessions, remainingAverage: sessionsLeft ? remaining / sessionsLeft : null };
}
