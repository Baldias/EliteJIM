// Voto atleta (0-100) di un prodotto confezionato, dai dati di Open Food Facts.
// È un'indicazione per scegliere tra prodotti simili, non un consiglio medico.
import { ADDITIVE_RISK } from '../data/additiveRisk';

// Ogni componente vale al massimo questi punti; se un dato manca il voto
// si calcola sui componenti disponibili e viene segnato come parziale
const NUTRI_POINTS = { a: 50, b: 40, c: 28, d: 15, e: 5 };
const NOVA_POINTS = { 1: 20, 2: 16, 3: 10, 4: 0 };
const ADDITIVE_PENALTY = { high: 8, moderate: 4, none: 1 };
const SUGAR_LIMIT = 22.5; // g per 100 g: soglia "alto contenuto" del semaforo UK

export const SCORE_LEVELS = [
  { id: 'great', label: 'Ottimo', min: 75 },
  { id: 'good', label: 'Buono', min: 50 },
  { id: 'poor', label: 'Mediocre', min: 25 },
  { id: 'bad', label: 'Scarso', min: 0 },
];

const NOVA_LABELS = {
  1: 'Non lavorato o minimamente lavorato',
  2: 'Ingrediente culinario',
  3: 'Alimento trasformato',
  4: 'Ultra-processato',
};

export function athleteScore(food) {
  const q = food?.quality;
  if (!q || (q.nutriscore == null && q.nova == null)) return null;
  const p = food.per100 || {};
  const parts = [];
  const pros = [];
  const cons = [];

  if (q.nutriscore) {
    const grade = q.nutriscore.toUpperCase();
    parts.push({ id: 'nutrition', label: 'Qualità nutrizionale', value: NUTRI_POINTS[q.nutriscore], max: 50, note: `Nutri-Score ${grade}` });
    if ('ab'.includes(q.nutriscore)) pros.push(`Buona qualità nutrizionale (Nutri-Score ${grade})`);
    if ('de'.includes(q.nutriscore)) cons.push(`Qualità nutrizionale bassa (Nutri-Score ${grade})`);
  }

  if (q.nova) {
    parts.push({ id: 'processing', label: 'Lavorazione', value: NOVA_POINTS[q.nova], max: 20, note: NOVA_LABELS[q.nova] });
    if (q.nova === 4) cons.push('Ultra-processato');
    if (q.nova === 1) pros.push('Poco lavorato');
  }

  if (Array.isArray(q.additives)) {
    const risky = q.additives.filter(c => ADDITIVE_RISK[c]);
    const penalty = q.additives.reduce((a, c) => a + ADDITIVE_PENALTY[ADDITIVE_RISK[c]?.[1] || 'none'], 0);
    parts.push({
      id: 'additives',
      label: 'Additivi',
      value: Math.max(0, 20 - penalty),
      max: 20,
      note: q.additives.length === 0 ? 'Nessuno' : `${q.additives.length} in totale, ${risky.length} da limitare`,
    });
    if (q.additives.length === 0) pros.push('Senza additivi');
    if (risky.length) {
      const names = risky.map(c => `${c.toUpperCase()} ${ADDITIVE_RISK[c][0].toLowerCase()}`);
      cons.push(`${risky.length === 1 ? 'Un additivo' : `${risky.length} additivi`} da limitare: ${names.join(', ')}`);
    }
  }

  if (p.kcal > 0) {
    const proteinPer100kcal = ((p.protein || 0) / p.kcal) * 100;
    const highSugar = (p.sugar || 0) > SUGAR_LIMIT;
    const value = Math.max(0, Math.min(10, proteinPer100kcal) - (highSugar ? 3 : 0));
    parts.push({ id: 'athlete', label: 'Profilo atleta', value, max: 10, note: `${Math.round(proteinPer100kcal * 10) / 10} g di proteine ogni 100 kcal` });
    if (proteinPer100kcal >= 8) pros.push(`Ricco di proteine: ${Math.round(proteinPer100kcal)} g ogni 100 kcal`);
    else if (proteinPer100kcal < 3 && p.kcal >= 150) cons.push('Poche proteine per le calorie');
    if (highSugar) cons.push(`Molti zuccheri: ${Math.round(p.sugar)} g su 100 g`);
  }

  const got = parts.reduce((a, x) => a + x.value, 0);
  const max = parts.reduce((a, x) => a + x.max, 0);
  const score = Math.round((got / max) * 100);
  return {
    score,
    level: SCORE_LEVELS.find(l => score >= l.min),
    parts,
    pros,
    cons,
    partial: max < 100,
  };
}
