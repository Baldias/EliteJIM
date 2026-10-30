// Calcoli per la sezione Diario: alimentazione, peso, macro e obiettivi.
import { locale, tr, translated } from '../i18n';

export const MEALS = translated([
  { id: 'breakfast', label: 'Colazione' },
  { id: 'lunch', label: 'Pranzo' },
  { id: 'dinner', label: 'Cena' },
  { id: 'snacks', label: 'Spuntini' },
]);

export const NUTRIENTS = translated([
  { id: 'kcal', label: 'Calorie', unit: 'kcal' },
  { id: 'carbs', label: 'Carboidrati', unit: 'g' },
  { id: 'protein', label: 'Proteine', unit: 'g' },
  { id: 'fat', label: 'Grassi', unit: 'g' },
  { id: 'fiber', label: 'Fibre', unit: 'g' },
  { id: 'sugar', label: 'Zuccheri', unit: 'g' },
  { id: 'satFat', label: 'Grassi saturi', unit: 'g' },
  { id: 'salt', label: 'Sale', unit: 'g' },
]);

// kcal per grammo di macro (Atwater)
export const KCAL_PER_G = { carbs: 4, protein: 4, fat: 9 };

// Le proteine si fissano in g per kg di peso corporeo, i grassi come quota
// delle calorie, i carboidrati riempiono il resto. Senza peso registrato
// le proteine ripiegano su proteinPct.
export const DEFAULT_NUTRITION_GOALS = {
  kcal: 2000,
  proteinPerKg: 2,
  fatPct: 25,
  proteinPct: 25,
  targetWeight: null,
  weeklyGoal: 0, // kg a settimana: negativo = dimagrire
  profile: null, // { sex, age, height, activity } usato dal calcolatore
};

// Passi quotidiani, allenamenti esclusi: i fattori coprono solo il movimento
// di tutti i giorni, perché le kcal degli allenamenti si sommano a parte
export const ACTIVITY_LEVELS = translated([
  { id: 'sedentary', label: 'Meno di 5.000 passi', desc: 'Scrivania, ci si muove poco', factor: 1.2 },
  { id: 'light', label: '5.000–7.500 passi', desc: 'Qualche spostamento a piedi', factor: 1.3 },
  { id: 'moderate', label: '7.500–10.000 passi', desc: 'Spesso in piedi o in giro', factor: 1.4 },
  { id: 'active', label: '10.000–12.500 passi', desc: 'Lavoro in movimento', factor: 1.5 },
  { id: 'very', label: 'Oltre 12.500 passi', desc: 'Lavoro fisico, sempre in piedi', factor: 1.6 },
], ['label', 'desc']);

// Frequenza di allenamento: regola le proteine; le kcal di ogni seduta
// si aggiungono in automatico nei giorni in cui registri l'allenamento
export const TRAINING_LEVELS = translated([
  { id: 'none', label: 'Non mi alleno', desc: 'Per ora niente palestra', proteinAdj: -0.4 },
  { id: 'low', label: '1–2 volte a settimana', desc: 'Allenamento occasionale', proteinAdj: -0.2 },
  { id: 'mid', label: '3–4 volte a settimana', desc: 'Allenamento regolare', proteinAdj: 0 },
  { id: 'high', label: '5–6 volte a settimana', desc: 'Allenamento intenso', proteinAdj: 0 },
  { id: 'daily', label: 'Tutti i giorni', desc: 'Anche doppie sedute', proteinAdj: 0.2 },
], ['label', 'desc']);

// Proteine (g/kg) e grassi (% kcal) consigliati per fase: in deficit servono
// più proteine per conservare la massa magra
export const PHASE_MACROS = {
  cut: { proteinPerKg: 2.2, fatPct: 25 },
  maintain: { proteinPerKg: 1.8, fatPct: 30 },
  bulk: { proteinPerKg: 1.8, fatPct: 25 },
};

// Macro per fase, con le proteine adattate a quanto ti alleni
export function macrosFor(phase, training) {
  const base = PHASE_MACROS[phase] || PHASE_MACROS.maintain;
  const adj = TRAINING_LEVELS.find(t => t.id === training)?.proteinAdj || 0;
  return { ...base, proteinPerKg: Math.round(Math.min(2.4, Math.max(1.2, base.proteinPerKg + adj)) * 10) / 10 };
}

// Fasi di allenamento e ritmo settimanale proposto (kg/settimana)
export const PHASES = translated([
  { id: 'cut', label: 'Definizione', desc: 'Perdere grasso mantenendo la forza', rates: [-0.25, -0.5, -0.75, -1] },
  { id: 'maintain', label: 'Mantenimento', desc: 'Ricomposizione a peso stabile', rates: [0] },
  { id: 'bulk', label: 'Massa', desc: 'Costruire muscolo con un surplus pulito', rates: [0.25, 0.5] },
], ['label', 'desc']);

export const phaseForRate = (rate) => (rate < 0 ? 'cut' : rate > 0 ? 'bulk' : 'maintain');

export function toDateKey(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDateKey(key, days) {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function formatDayLabel(key) {
  const today = toDateKey();
  if (key === today) return tr('Oggi');
  if (key === shiftDateKey(today, -1)) return tr('Ieri');
  if (key === shiftDateKey(today, 1)) return tr('Domani');
  const label = fromDateKey(key).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const round1 = (n) => Math.round(n * 10) / 10;

// Valori nutrizionali di una voce del diario (alimento × grammi)
export function entryNutrients(entry) {
  const factor = (Number(entry?.grams) || 0) / 100;
  const per100 = entry?.food?.per100 || {};
  const out = {};
  for (const n of NUTRIENTS) {
    const v = Number(per100[n.id]);
    out[n.id] = Number.isFinite(v) ? v * factor : 0;
  }
  return out;
}

export function sumNutrients(entries = []) {
  const totals = Object.fromEntries(NUTRIENTS.map(n => [n.id, 0]));
  for (const e of entries) {
    const v = entryNutrients(e);
    for (const n of NUTRIENTS) totals[n.id] += v[n.id];
  }
  return totals;
}

export function dayEntries(day) {
  if (!day) return [];
  return MEALS.flatMap(m => day[m.id] || []);
}

export function dayTotals(day) {
  return sumNutrients(dayEntries(day));
}

// Obiettivi in grammi: proteine da g/kg, grassi da % kcal, carboidrati il resto
export function macroGoalsInGrams(goals, bodyweight) {
  const g = { ...DEFAULT_NUTRITION_GOALS, ...goals };
  const bw = Number(bodyweight);
  const protein = bw > 0 && g.proteinPerKg > 0
    ? Math.round(g.proteinPerKg * bw)
    : Math.round((g.kcal * g.proteinPct) / 100 / KCAL_PER_G.protein);
  const fat = Math.round((g.kcal * g.fatPct) / 100 / KCAL_PER_G.fat);
  const carbs = Math.max(0, Math.round((g.kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs));
  return { kcal: g.kcal, protein, fat, carbs };
}

// Peso di tendenza: media mobile esponenziale che pesa il 10% ogni giorno
// trascorso, così le oscillazioni di acqua e glicogeno si smorzano.
export function weightTrend(log = []) {
  let trend = null;
  let prevDate = null;
  return log.map((e) => {
    if (trend == null) {
      trend = e.kg;
    } else {
      const days = Math.max(1, Math.round((fromDateKey(e.date) - fromDateKey(prevDate)) / 86400000));
      trend += (1 - Math.pow(0.9, days)) * (e.kg - trend);
    }
    prevDate = e.date;
    return { ...e, trend: Math.round(trend * 100) / 100 };
  });
}

// kg/settimana: regressione lineare della tendenza nelle ultime 4 settimane
export function weeklyRate(trendLog = []) {
  if (trendLog.length < 2) return null;
  const last = fromDateKey(trendLog[trendLog.length - 1].date);
  const pts = trendLog
    .map(e => ({ x: (fromDateKey(e.date) - last) / 86400000, y: e.trend }))
    .filter(p => p.x >= -28);
  if (pts.length < 2 || pts[pts.length - 1].x - pts[0].x < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den > 0 ? (num / den) * 7 : null;
}

// Fabbisogno passo per passo: metabolismo basale × attività + deficit/surplus.
// Con la massa grassa usa Katch-McArdle (più precisa per chi è muscoloso),
// altrimenti Mifflin-St Jeor.
export function energyBreakdown({ sex, age, height, weight, activity, weeklyGoal, bodyFat }) {
  const w = Number(weight), h = Number(height), a = Number(age), bf = Number(bodyFat);
  if (!(w > 0 && h > 0 && a > 0)) return null;
  const method = bf > 3 && bf < 60 ? 'katch' : 'mifflin';
  const bmr = method === 'katch'
    ? 370 + 21.6 * w * (1 - bf / 100)
    : 10 * w + 6.25 * h - 5 * a + (sex === 'female' ? -161 : 5);
  const factor = ACTIVITY_LEVELS.find(l => l.id === activity)?.factor || 1.2;
  const maintenance = bmr * factor;
  // 1 kg di grasso ≈ 7700 kcal → kcal/giorno = kg/settimana × 7700 / 7
  const delta = (Number(weeklyGoal) || 0) * 1100;
  const minimum = sex === 'female' ? 1200 : 1500;
  const kcal = Math.max(minimum, Math.round((maintenance + delta) / 10) * 10);
  return { method, bmr: Math.round(bmr), maintenance: Math.round(maintenance), delta: Math.round(delta), kcal, floored: kcal === minimum };
}

export function computeCalorieGoal(params) {
  return energyBreakdown(params)?.kcal ?? null;
}

// Stima delle kcal bruciate con gli allenamenti del giorno (pesi ≈ 5 MET)
export function estimateWorkoutKcal(history, dateKey, bodyweight) {
  const kg = Number(bodyweight) > 0 ? Number(bodyweight) : 75;
  let kcal = 0;
  for (const w of history || []) {
    const start = Number(w.startTime);
    if (!start || toDateKey(new Date(start)) !== dateKey) continue;
    const end = Number(w.endTime) || start;
    const hours = Math.min(3, Math.max(0, (end - start) / 3600000));
    kcal += 5 * kg * hours;
  }
  return Math.round(kcal);
}

export const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString(locale());
export const fmtDec = (n) => round1(Number(n) || 0).toLocaleString(locale(), { maximumFractionDigits: 1 });

// Ordine di lettura: le proteine prima, sono la priorità per chi si allena
export const MACROS = translated([
  { id: 'protein', label: 'Proteine', short: 'P' },
  { id: 'carbs', label: 'Carboidrati', short: 'C' },
  { id: 'fat', label: 'Grassi', short: 'G' },
], ['label', 'short']);

// Ripartizione percentuale delle kcal tra i macro
export function macroSplit({ carbs = 0, protein = 0, fat = 0 }) {
  const kc = carbs * KCAL_PER_G.carbs;
  const kp = protein * KCAL_PER_G.protein;
  const kf = fat * KCAL_PER_G.fat;
  const tot = kc + kp + kf;
  if (tot <= 0) return { carbs: 0, protein: 0, fat: 0 };
  return { carbs: (kc / tot) * 100, protein: (kp / tot) * 100, fat: (kf / tot) * 100 };
}
