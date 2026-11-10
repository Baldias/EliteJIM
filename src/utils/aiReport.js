// Report AI: turns the saved data of a period into a compact text to paste in
// ChatGPT, Claude or any other assistant. The app computes the numbers (sets
// per muscle, best sets, weight trend, nutrition averages) so the assistant
// reasons on the same figures the app shows instead of the raw backup JSON.
import { EXERCISE_CATEGORIES, getAllExercises, normalizeName } from '../data/exercises';
import { estimate1RM, getBodyweightLoad, resolveBodyweight } from './oneRepMax';
import { dayTotals, macroGoalsInGrams, toDateKey, weeklyRate, weightTrend } from './nutrition';
import { annotationFor } from './scienceV3';
import { getSessionNote } from './sessionNote';
import { locale, tr } from '../i18n';

const DAY = 86400000;
// Up to this many days every workout is written set by set. Longer periods get
// a weekly (or monthly) summary plus the last DETAIL_DAYS in full.
export const FULL_DETAIL_DAYS = 45;
export const DETAIL_DAYS = 28;
const MONTHLY_FROM_DAYS = 400;
const MAX_EXERCISES = 40;

export const AI_REPORT_PERIODS = [
  { id: '7d', days: 7, label: '7 giorni' },
  { id: '30d', days: 30, label: '30 giorni' },
  { id: '90d', days: 90, label: '3 mesi' },
  { id: '365d', days: 365, label: '1 anno' },
  { id: 'all', days: null, label: 'Tutto' },
  { id: 'custom', days: null, label: 'Date' },
];

export const AI_REPORT_SECTIONS = ['workouts', 'notes', 'weight', 'nutrition'];

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = (value, digits = 1) => Number(value).toLocaleString(locale(), { maximumFractionDigits: digits });
const startOfDay = time => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endOfDay = time => { const d = new Date(time); d.setHours(23, 59, 59, 999); return d.getTime(); };
const dateLabel = time => new Date(time).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: '2-digit' });
const dayLabel = time => new Date(time).toLocaleDateString(locale(), { weekday: 'short', day: '2-digit', month: '2-digit' });
const workoutTime = w => num(w?.startTime || w?.endTime);
const isWorking = s => s?.done && !s.isWarmup;
const mondayOf = time => { const d = new Date(startOfDay(time)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const monthOf = time => { const d = new Date(startOfDay(time)); d.setDate(1); return d.getTime(); };

/** { from, to } in ms for a period id; custom uses 'YYYY-MM-DD' strings. */
export function aiReportRange(periodId, history = [], now = Date.now(), custom = {}) {
  const period = AI_REPORT_PERIODS.find(p => p.id === periodId) || AI_REPORT_PERIODS[0];
  if (period.days) return { from: startOfDay(now - (period.days - 1) * DAY), to: now };
  if (period.id === 'custom') {
    const parse = key => { const [y, m, d] = String(key || '').split('-').map(Number); return y && m && d ? new Date(y, m - 1, d).getTime() : null; };
    const a = parse(custom.from) ?? startOfDay(now - 29 * DAY), b = parse(custom.to) ?? now;
    return { from: startOfDay(Math.min(a, b)), to: Math.min(now, endOfDay(Math.max(a, b))) };
  }
  const times = history.map(workoutTime).filter(t => t > 0);
  return { from: startOfDay(times.length ? Math.min(...times) : now), to: now };
}

const RIR = (workout, ex, set, science) => {
  if (set.rir === 0 || set.rir === 1) return set.rir;
  const a = annotationFor(science, workout.id, ex.id, set.id);
  return a.rir === 0 || a.rir === 1 ? a.rir : null;
};

// "80 kg × 8 R1, 7 R0 · 75 kg × 10 · D 60 kg × 8 (+2 risc.)"
export function formatSets(workout, ex, science, bodyweightExercise = false) {
  const done = (ex.sets || []).filter(s => s?.done);
  const warmups = done.filter(s => s.isWarmup).length;
  const groups = [];
  for (const set of done.filter(s => !s.isWarmup)) {
    const kg = num(set.kg);
    const tag = set.isDropset ? 'D ' : set.isRestPause ? 'RP ' : '';
    const rir = RIR(workout, ex, set, science);
    const reps = `${num(set.reps)}${rir == null ? '' : ` R${rir}`}`;
    const last = groups.at(-1);
    if (last && last.kg === kg && last.tag === tag) last.reps.push(reps);
    else groups.push({ kg, tag, reps: [reps] });
  }
  const load = kg => bodyweightExercise ? (kg > 0 ? `${tr('corpo libero')} +${fmt(kg, 2)} kg` : tr('corpo libero')) : kg > 0 ? `${fmt(kg, 2)} kg` : tr('corpo libero');
  const text = groups.map(g => `${g.tag}${load(g.kg)} × ${g.reps.join(', ')}`).join(' · ');
  return warmups ? `${text} (+${warmups} ${tr('risc.')})` : text;
}

function muscleWeights(name, catalog) {
  const def = catalog.get(normalizeName(name));
  if (!def?.category || def.category === EXERCISE_CATEGORIES.CARDIO) return {};
  const weights = { [def.category]: 1 };
  for (const cat of def.secondaryCategories || []) if (cat !== def.category && cat !== EXERCISE_CATEGORIES.CARDIO) weights[cat] = Math.max(weights[cat] || 0, 0.5);
  return weights;
}

// Working sets (no warmups, no drop sets) per muscle: 1 direct, 0.5 assisting,
// rest-pause counts half, as in the fatigue map.
function workoutMuscleSets(workout, catalog) {
  const out = {};
  for (const ex of workout.exercises || []) {
    const sets = (ex.sets || []).reduce((sum, s) => sum + (isWorking(s) && !s.isDropset ? (s.isRestPause ? 0.5 : 1) : 0), 0);
    if (!sets) continue;
    for (const [muscle, w] of Object.entries(muscleWeights(ex.name, catalog))) out[muscle] = (out[muscle] || 0) + sets * w;
  }
  return out;
}

const workingSets = workout => (workout.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).filter(isWorking).length, 0);
const minutes = w => Math.max(0, Math.round((num(w.endTime) - num(w.startTime)) / 60000));

function exerciseProgress(workouts, db, bodyweight) {
  const map = new Map();
  for (const workout of workouts) {
    for (const ex of workout.exercises || []) {
      const key = normalizeName(ex.name);
      const sets = (ex.sets || []).filter(s => isWorking(s) && !s.isDropset && !s.isRestPause && num(s.reps) > 0);
      if (!key || !sets.length) continue;
      const load = getBodyweightLoad(ex.name, db, bodyweight);
      const best = sets.map(s => ({ kg: num(s.kg), reps: num(s.reps), e1rm: estimate1RM(s.kg, s.reps, load) }))
        .reduce((a, b) => (b.e1rm > a.e1rm || (b.e1rm === a.e1rm && b.reps > a.reps) ? b : a));
      if (!map.has(key)) map.set(key, { name: ex.name, bodyweight: load > 0, sessions: [] });
      map.get(key).sessions.push({ time: workoutTime(workout), ...best, sets: sets.length });
    }
  }
  return [...map.values()].map(e => {
    const first = e.sessions[0], last = e.sessions.at(-1);
    const top = e.sessions.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
    const change = first.e1rm > 0 && e.sessions.length > 1 ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : null;
    return { name: e.name, bodyweight: e.bodyweight, count: e.sessions.length, sets: e.sessions.reduce((s, x) => s + x.sets, 0), first, last, top, change };
  }).sort((a, b) => b.count - a.count || b.sets - a.sets).slice(0, MAX_EXERCISES);
}

const setLabel = (s, bodyweight) => bodyweight ? `${s.kg > 0 ? `+${fmt(s.kg, 2)}` : '0'}×${s.reps}` : s.kg > 0 ? `${fmt(s.kg, 2)}×${s.reps}` : `${s.reps} rep`;

const muscleLine = sets => Object.entries(sets).sort((a, b) => b[1] - a[1]).map(([m, v]) => `${tr(m)} ${fmt(v)}`).join(', ');

function promptHeader(question) {
  return [
    tr('Sei un coach esperto di ipertrofia e forza, aggiornato sulla letteratura scientifica. Analizza i miei dati di allenamento esportati dall\'app EliteJIM.'),
    '',
    tr('Cosa voglio da te:'),
    tr('1. Cosa sta andando bene (progressi reali sui carichi o sulle ripetizioni).'),
    tr('2. Esercizi fermi o in calo, con una possibile causa e cosa cambiare.'),
    tr('3. Volume per muscolo: chi riceve troppe o troppo poche serie a settimana, e come riequilibrare.'),
    tr('4. Frequenza e recupero tra le sedute.'),
    tr('5. Se ci sono dati su peso e alimentazione: se sono coerenti con i progressi in palestra.'),
    tr('6. Le 3 modifiche più utili da fare da subito, in ordine di priorità.'),
    tr('Basati solo sui dati qui sotto, dimmi quando un dato manca o è troppo poco per concludere, e rispondi in modo diretto e pratico.'),
    ...(question ? ['', `${tr('Domanda specifica')}: ${question}`] : []),
  ];
}

/**
 * Builds the text of the report.
 * options: { periodId, custom:{from,to}, include:{workouts,notes,weight,nutrition}, question, prompt }
 * Returns { text, workouts, words, detail: 'full' | 'summary', range }.
 */
export function buildAiReport(state, options = {}, now = Date.now()) {
  const { periodId = '30d', custom = {}, question = '', prompt = true } = options;
  const include = { workouts: true, notes: true, weight: true, nutrition: true, ...options.include };
  const history = (state.history || []).filter(w => workoutTime(w) > 0).slice().sort((a, b) => workoutTime(a) - workoutTime(b));
  const range = aiReportRange(periodId, history, now, custom);
  const workouts = history.filter(w => workoutTime(w) >= range.from && workoutTime(w) <= range.to);
  const db = getAllExercises(state.customExercises || [], state.exerciseOverrides || {});
  const catalog = new Map(db.map(ex => [normalizeName(ex.name), ex]));
  const bodyweight = resolveBodyweight(state);
  const science = state.scienceState;
  const spanDays = Math.max(1, Math.round((range.to - range.from) / DAY));
  const weeks = Math.max(1, spanDays / 7);
  const detail = spanDays <= FULL_DETAIL_DAYS ? 'full' : 'summary';
  const lines = [];
  const push = (...rows) => lines.push(...rows);

  if (prompt) push(...promptHeader(question.trim()), '', '---', '');
  push(`# ${tr('Dati EliteJIM')} · ${dateLabel(range.from)} – ${dateLabel(range.to)} (${tr('{n} giorni', { n: spanDays })})`);
  const profile = [];
  if (bodyweight > 0) profile.push(`${tr('peso corporeo')} ${fmt(bodyweight)} kg`);
  const goal = state.nutritionGoals?.weeklyGoal;
  if (Number.isFinite(Number(goal)) && state.dietSetup?.completedAt) profile.push(Number(goal) < 0 ? tr('obiettivo: dimagrire') : Number(goal) > 0 ? tr('obiettivo: aumentare massa') : tr('obiettivo: mantenimento'));
  if (state.showScience && science?.program?.status === 'active') profile.push(tr('protocollo Scienza attivo'));
  if (profile.length) push(`${tr('Profilo')}: ${profile.join(', ')}`);
  push(tr('Legenda: "80 kg × 8 R1, 7" = serie a 80 kg da 8 e 7 ripetizioni; R0/R1 = ripetizioni in riserva (0 = cedimento); D = drop set; RP = rest-pause; "corpo libero +5 kg" = zavorra aggiunta al peso corporeo; risc. = serie di riscaldamento, escluse dai conteggi. Serie per muscolo: 1 se è il muscolo principale, 0,5 se aiuta.'));

  if (include.workouts) {
    push('', `## ${tr('Riepilogo allenamenti')}`);
    if (!workouts.length) push(tr('Nessun allenamento registrato nel periodo.'));
    else {
      const total = workouts.reduce((s, w) => s + workingSets(w), 0);
      const avgMin = Math.round(workouts.reduce((s, w) => s + minutes(w), 0) / workouts.length);
      const days = new Set(workouts.map(w => toDateKey(new Date(workoutTime(w))))).size;
      push(tr('Allenamenti: {n} in {days} giorni diversi · {perWeek} a settimana · {sets} serie allenanti · durata media {min} min', { n: workouts.length, days, perWeek: fmt(workouts.length / weeks), sets: total, min: avgMin }));
      const muscles = {};
      for (const w of workouts) for (const [m, v] of Object.entries(workoutMuscleSets(w, catalog))) muscles[m] = (muscles[m] || 0) + v;
      const perWeek = Object.fromEntries(Object.entries(muscles).map(([m, v]) => [m, v / weeks]));
      push(`${tr('Serie a settimana per muscolo (media)')}: ${muscleLine(perWeek) || '-'}`);
      const missing = Object.values(EXERCISE_CATEGORIES).filter(c => c !== EXERCISE_CATEGORIES.CARDIO && c !== EXERCISE_CATEGORIES.NECK && !muscles[c]);
      if (missing.length) push(`${tr('Muscoli mai allenati nel periodo')}: ${missing.map(m => tr(m)).join(', ')}`);

      push('', `## ${tr('Esercizi')}`, tr('Nome: sedute, serie · prima → ultima miglior serie · 1RM stimato prima → ultima (variazione) · record del periodo'));
      for (const e of exerciseProgress(workouts, db, bodyweight)) {
        const rm = e.first.e1rm > 0 ? ` · 1RM ${fmt(e.first.e1rm)} → ${fmt(e.last.e1rm)}${e.change == null ? '' : ` (${e.change >= 0 ? '+' : ''}${fmt(e.change)}%)`}` : '';
        const record = e.count > 1 ? ` · ${tr('record {set} il {date}', { set: setLabel(e.top, e.bodyweight), date: dateLabel(e.top.time) })}` : '';
        push(`- ${e.name}: ${e.count} ${e.count === 1 ? tr('seduta') : tr('sedute')}, ${e.sets} ${tr('serie')} · ${setLabel(e.first, e.bodyweight)} → ${setLabel(e.last, e.bodyweight)}${rm}${record}`);
      }

      let detailed = workouts;
      if (detail === 'summary') {
        const monthly = spanDays > MONTHLY_FROM_DAYS;
        const buckets = new Map();
        for (const w of workouts) {
          const key = monthly ? monthOf(workoutTime(w)) : mondayOf(workoutTime(w));
          const b = buckets.get(key) || { n: 0, sets: 0, muscles: {} };
          b.n++; b.sets += workingSets(w);
          for (const [m, v] of Object.entries(workoutMuscleSets(w, catalog))) b.muscles[m] = (b.muscles[m] || 0) + v;
          buckets.set(key, b);
        }
        push('', `## ${monthly ? tr('Andamento per mese') : tr('Andamento per settimana')}`);
        for (const [key, b] of [...buckets].sort((a, c) => a[0] - c[0])) {
          const label = monthly ? new Date(key).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }) : `${tr('Sett.')} ${dateLabel(key)}`;
          push(`- ${label}: ${b.n} ${b.n === 1 ? tr('allenamento') : tr('allenamenti')}, ${b.sets} ${tr('serie')} · ${muscleLine(b.muscles)}`);
        }
        const detailFrom = startOfDay(range.to - (DETAIL_DAYS - 1) * DAY);
        detailed = workouts.filter(w => workoutTime(w) >= detailFrom);
      }

      push('', `## ${detail === 'full' ? tr('Allenamenti nel dettaglio') : tr('Ultimi {n} giorni nel dettaglio', { n: DETAIL_DAYS })}`);
      if (!detailed.length) push(tr('Nessun allenamento in questi giorni.'));
      for (const w of detailed) {
        const head = [`### ${dayLabel(workoutTime(w))}`, w.name, minutes(w) ? `${minutes(w)} min` : null].filter(Boolean).join(' · ');
        push(head);
        for (const ex of w.exercises || []) {
          const sets = formatSets(w, ex, science, getBodyweightLoad(ex.name, db, bodyweight) > 0);
          if (sets) push(`- ${ex.name}: ${sets}`);
        }
        const note = include.notes ? getSessionNote(w) : '';
        if (note) push(`${tr('Nota')}: ${note.replace(/\s+/g, ' ')}`);
      }
    }
  }

  if (include.notes && !include.workouts) {
    const notes = workouts.map(w => [w, getSessionNote(w)]).filter(([, n]) => n);
    push('', `## ${tr('Note di sessione')}`);
    if (!notes.length) push(tr('Nessuna nota nel periodo.'));
    for (const [w, n] of notes) push(`- ${dateLabel(workoutTime(w))}: ${n.replace(/\s+/g, ' ')}`);
  }

  const fromKey = toDateKey(new Date(range.from)), toKey = toDateKey(new Date(range.to));
  if (include.weight) {
    push('', `## ${tr('Peso corporeo')}`);
    const log = (state.weightLog || []).filter(e => e?.date && num(e.kg) > 0).slice().sort((a, b) => a.date.localeCompare(b.date));
    const trend = weightTrend(log);
    const inRange = trend.filter(e => e.date >= fromKey && e.date <= toKey);
    if (!inRange.length) push(tr('Nessuna pesata nel periodo.'));
    else {
      const kgs = inRange.map(e => e.kg);
      const first = inRange[0], last = inRange.at(-1);
      const rate = weeklyRate(trend.filter(e => e.date <= toKey));
      push(tr('{n} pesate · tendenza {a} → {b} kg ({diff} kg) · minimo {min}, massimo {max} kg', { n: inRange.length, a: fmt(first.trend), b: fmt(last.trend), diff: `${last.trend - first.trend >= 0 ? '+' : ''}${fmt(last.trend - first.trend, 2)}`, min: fmt(Math.min(...kgs)), max: fmt(Math.max(...kgs)) }));
      if (rate != null) push(tr('Velocità nelle ultime 4 settimane: {rate} kg a settimana', { rate: `${rate >= 0 ? '+' : ''}${fmt(rate, 2)}` }));
      if (Number(state.nutritionGoals?.targetWeight) > 0) push(tr('Peso obiettivo: {kg} kg', { kg: fmt(state.nutritionGoals.targetWeight) }));
    }
  }

  if (include.nutrition) {
    push('', `## ${tr('Alimentazione')}`);
    const days = Object.entries(state.foodDiary || {}).filter(([key]) => key >= fromKey && key <= toKey).map(([, day]) => dayTotals(day)).filter(t => t.kcal > 0);
    if (!days.length) push(tr('Nessun giorno registrato nel diario alimentare.'));
    else {
      const avg = id => Math.round(days.reduce((s, t) => s + t[id], 0) / days.length);
      push(tr('{n} giorni registrati · media al giorno: {kcal} kcal, proteine {p} g, carboidrati {c} g, grassi {f} g', { n: days.length, kcal: avg('kcal'), p: avg('protein'), c: avg('carbs'), f: avg('fat') }));
      if (state.dietSetup?.completedAt) {
        const goal = macroGoalsInGrams(state.nutritionGoals, bodyweight);
        push(tr('Obiettivi impostati: {kcal} kcal, proteine {p} g, carboidrati {c} g, grassi {f} g', { kcal: goal.kcal, p: goal.protein, c: goal.carbs, f: goal.fat }));
      }
    }
  }

  const text = lines.join('\n');
  return { text, workouts: workouts.length, words: text.split(/\s+/).filter(Boolean).length, detail, range };
}
