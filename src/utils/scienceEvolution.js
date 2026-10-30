import { getScienceTargetForMuscle } from './rpVolume';
import { tr } from '../i18n';
import { hasLegacyScience, isScienceV3Active, legacyScienceKey, scienceVolumes, scienceWeekRange } from './scienceV3';

// Compatibility views for archived V2 proposals. Current protocols migrate
// through scienceMigration; the original scienceReport remains immutable.
export const legacyProtocolId = legacyScienceKey;

export const canEvolveLegacy = report => hasLegacyScience(report) && Boolean(legacyProtocolId(report));
export const needsScienceEvolution = (report, science) => canEvolveLegacy(report) && !science?.releaseV3?.seenAt;
export const legacyEvolutionFor = (report, science) => science?.legacyEvolution?.protocolId === legacyProtocolId(report) ? science.legacyEvolution : null;
export const scienceTrackingEnabled = state => isScienceV3Active(state) ||
  (hasLegacyScience(state.scienceReport, state.scienceState) && state.scienceReport?.status === 'active' && Boolean(legacyEvolutionFor(state.scienceReport, state.scienceState)));

export function evolvedLegacyReport(report, science) {
  const evolution = legacyEvolutionFor(report, science);
  if (!evolution) return report;
  return { ...report, dynamicVolumeTargets: Object.fromEntries(Object.values(evolution.decisions || {})
    .filter(d => d.choice === 'accept').map(d => [d.week, d.targets])) };
}

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b), i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
};

// Only completed weeks are evidence. Saved boundaries take precedence over
// calendar estimates, especially for weeks the athlete completed late.
export function legacyVolumeEvidence(report, history, db, science, now) {
  const evidence = [];
  const current = report.currentWeek || 1;
  for (let w = current - 1; w >= Math.max(1, current - 8) && evidence.length < 4; w--) {
    if (w >= 9) continue; // the legacy recovery/resensitization month
    const saved = report.weekHistory?.[w];
    const anchor = report.startDate || report.timestamp;
    if (!saved && !anchor) continue;
    const range = saved ? { start: Number(saved.startDate), end: Number(saved.completedDate) } : scienceWeekRange(anchor, w);
    // A prolonged or extremely short legacy week is not a weekly dose.
    const days = (range.end - range.start) / 86400000;
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end > now || days < 5 || days > 9) continue;
    if (evidence.some(e => range.start < e.end && range.end > e.start)) continue;
    const volumes = scienceVolumes(history, db, science, range.start, range.end);
    if (Object.values(volumes.muscles).some(v => v.ordinary)) evidence.push({ week: w, ...range, volumes });
  }
  return evidence;
}

export function legacyDynamicProposal(report, history, db, science, now = Date.now()) {
  if (!legacyEvolutionFor(report, science) || report.status !== 'active') return null;
  const current = report.currentWeek || 1, week = current + 1;
  if (week > 12) return null;
  const evidence = legacyVolumeEvidence(report, history, db, science, now);
  const view = evolvedLegacyReport(report, science);
  const focus = week <= 4 ? report.focus1 || [] : week <= 8 ? report.focus2 || [] : [];
  const targets = {}, changes = [], notes = [];
  const recent = evidence[0];
  const recentWorkouts = recent ? history.filter(w => Number(w.startTime) >= recent.start && Number(w.startTime) < recent.end) : [];
  const systemic = recentWorkouts.filter(w => science.feedback?.[w.id]?.systemicFatigue === true).length >= 2;
  let increases = 0;
  const muscles = Object.keys(report.baseLandmarks).sort((a, b) => Number(focus.includes(b)) - Number(focus.includes(a)) || a.localeCompare(b));
  for (const muscle of muscles) {
    const planned = getScienceTargetForMuscle(report, muscle, week);
    targets[muscle] = planned;
    const samples = evidence.map(e => e.volumes.muscles[muscle]).filter(Boolean);
    const observed = samples.length >= 2 ? Math.round(median(samples.map(s => s.ordinary))) : null;
    const feedback = recentWorkouts.map(w => science.feedback?.[w.id]?.muscles?.[muscle]).filter(Boolean);
    const negative = feedback.some(f => f.pain === true) || feedback.filter(f => f.recovery === 'poor' || f.quality === 'poor').length >= 2;
    const good = feedback.length >= 2 && feedback.every(f => f.recovery === 'good' && f.quality === 'good' && !f.pain);
    const previous = getScienceTargetForMuscle(view, muscle, current);
    const recentVolume = recent?.volumes.muscles[muscle];
    let target = planned, reason = '';
    if (week >= 9) continue; // preserve the existing recovery calendar
    if ((negative || systemic) && previous > 0) {
      target = Math.min(planned, Math.max(0, previous - Math.ceil(previous * 0.25)));
      reason = systemic ? 'Fatica generale segnalata in più sedute: valuta meno serie.' : 'Fastidi o recupero insufficiente ripetuto: valuta meno serie.';
    } else if (observed != null && observed > planned && increases < 2) {
      // Historical work without RIR can inform a proposal, never a confirmed
      // productive dose or a measured MRV. The user must accept the change.
      target = Math.min(planned + 2, observed, Math.max(planned, Number(report.baseLandmarks[muscle].mrv) || planned));
      reason = `${tr('Mediana di {weeks} settimane: {n} serie ordinarie.', { weeks: samples.length, n: observed })} ${samples.some(s => s.unknown) ? tr('Sforzo storico non sempre registrato: stima da confermare.') : tr('Serie con sforzo registrato.')}`;
      if (target > planned) increases++;
    } else if (good && recentVolume?.direct >= previous * 0.8 && previous > 0 && increases < 2) {
      target = Math.min(planned + 1, previous + 1, Math.max(planned, Number(report.baseLandmarks[muscle].mrv) || planned));
      reason = 'Qualità e recupero buoni in più sedute; almeno l’80% del volume precedente confermato a 0–1 RIR. Un passo alla volta.';
      if (target > planned) increases++;
    } else if (observed == null || !good) {
      notes.push(muscle);
    }
    if (target !== planned) {
      targets[muscle] = target;
      changes.push({ muscle, before: planned, after: target, reason, observed });
    }
  }
  return { id: `week-${week}`, week, targets, changes, evidence: evidence.map(e => ({ week: e.week, start: e.start, end: e.end, volumes: e.volumes })),
    reason: week >= 9 ? 'Il recupero già programmato resta invariato.' : !evidence.length ? 'Servono settimane complete rappresentative. Gli obiettivi concordati restano invariati.' : !changes.length ? 'Nessuna variazione proposta con i dati disponibili. Il programma continua come concordato.' : 'Una proposta per la prossima settimana, usando le settimane già completate.',
    missingFeedback: notes, createdAt: now };
}

export function completeScienceEvolution(science, report, now) {
  if (!canEvolveLegacy(report)) return science;
  const existing = legacyEvolutionFor(report, science);
  if (existing && science.releaseV3?.seenAt) return science;
  return { ...science, releaseV3: science.releaseV3 || { seenAt: now }, legacyEvolution: existing || { protocolId: legacyProtocolId(report), enabledAt: now, decisions: {} } };
}

export function decideLegacyDynamicVolume(science, report, history, db, choice, now) {
  if (!['accept', 'reject'].includes(choice)) return science;
  const proposal = legacyDynamicProposal(report, history, db, science, now);
  const evolution = legacyEvolutionFor(report, science);
  if (!proposal || !evolution || evolution.decisions?.[proposal.id]) return science;
  return { ...science, legacyEvolution: { ...evolution, decisions: { ...evolution.decisions, [proposal.id]: { ...proposal, choice, decidedAt: now } } } };
}
