// Ricerca alimenti: database generico locale + Open Food Facts
// (database aperto e gratuito di prodotti confezionati, nessuna chiave API).
// https://openfoodfacts.github.io/openfoodfacts-server/api/
import { GENERIC_FOODS } from '../data/genericFoods';

// La ricerca non invia header CORS: si passa dal proxy sullo stesso dominio
// (vite.config.js in sviluppo, vercel.json in produzione).
const OFF_SEARCH = '/api/off-search';
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v2/product';
const PRODUCT_FIELDS = 'code,product_name,product_name_it,generic_name_it,brands,nutriments,serving_size,serving_quantity,quantity,image_small_url,image_front_small_url,nutriscore_grade,nova_group,additives_tags,categories_tags,labels_tags';

// Additivi: "en:e322i" è una sottovoce di "en:e322" → tengo solo il codice base.
// Le lettere come in E150c invece identificano additivi diversi e restano.
function additiveCodes(tags) {
  if (!Array.isArray(tags)) return null;
  const codes = [...new Set(tags.map(t => String(t).replace(/^\w+:/, '').toLowerCase()))];
  return codes.filter(c => !codes.some(o => o !== c && c.startsWith(o) && /^(i|ii|iii|iv|v|vi)$/.test(c.slice(o.length))));
}

// Dati di qualità usati dal voto atleta (assenti se Open Food Facts non li ha)
function qualityFrom(p) {
  const grade = String(p.nutriscore_grade || '').toLowerCase();
  const nova = Number(p.nova_group);
  // solo i tag della tassonomia ufficiale (es. "en:biscuits"), non quelli liberi tipo "en:Snack dolci"
  const categories = (p.categories_tags || []).filter(c => /^en:[a-z0-9-]+$/.test(c));
  return {
    nutriscore: /^[a-e]$/.test(grade) ? grade : null,
    nova: nova >= 1 && nova <= 4 ? nova : null,
    additives: additiveCodes(p.additives_tags),
    // dalla più generica alla più specifica: l'ultima serve per le alternative
    categories: categories.slice(-4),
    organic: (p.labels_tags || []).some(l => /organic|bio/.test(l)),
  };
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};

export const normalizeText = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim();

// Converte un prodotto Open Food Facts nel formato alimento dell'app
export function normalizeOffProduct(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184; // kJ → kcal
  const name = (p.product_name_it || p.product_name || p.generic_name_it || '').trim();
  if (!name || kcal == null) return null;
  const brands = Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || '');
  const servingSize = num(p.serving_quantity);
  return {
    id: `off-${p.code}`,
    barcode: p.code,
    name,
    brand: brands.split(',')[0].trim(),
    source: 'off',
    image: p.image_front_small_url || p.image_small_url || null,
    quantity: p.quantity || '',
    per100: {
      kcal: Math.round(num(kcal)),
      carbs: num(n.carbohydrates_100g),
      protein: num(n.proteins_100g),
      fat: num(n.fat_100g),
      fiber: num(n.fiber_100g),
      sugar: num(n.sugars_100g),
      satFat: num(n['saturated-fat_100g']),
      salt: num(n.salt_100g),
    },
    servingSize: servingSize > 0 ? servingSize : null,
    servingLabel: servingSize > 0 ? servingLabelFrom(p.serving_size) : null,
    quality: qualityFrom(p),
  };
}

// "1 biscotto (12 g)" → "1 biscotto"; "85 g" o "1 serving (85 g)" → "1 porzione"
function servingLabelFrom(raw) {
  const label = String(raw || '').replace(/\(.*?\)/g, '').trim();
  if (!label || /^[\d.,\s]+(g|ml|gr|grammi)?$/i.test(label) || /serving|portion/i.test(label)) return '1 porzione';
  return label;
}

export function searchLocalFoods(query, customFoods = []) {
  const q = normalizeText(query);
  if (!q) return [];
  const words = q.split(/\s+/);
  const matches = (f) => {
    const hay = normalizeText(`${f.name} ${f.brand || ''}`);
    return words.every(w => hay.includes(w));
  };
  return [...customFoods.filter(matches), ...GENERIC_FOODS.filter(matches)];
}

export async function searchOffFoods(query, { signal, pageSize = 25 } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q, page_size: String(pageSize), langs: 'it,en', fields: PRODUCT_FIELDS });
  const res = await fetch(`${OFF_SEARCH}?${params}`, { signal });
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) {
    throw new Error(`Ricerca non disponibile (${res.status})`);
  }
  const data = await res.json();
  const seen = new Set();
  return (data.hits || [])
    .map(normalizeOffProduct)
    .filter(f => f && !seen.has(f.id) && seen.add(f.id));
}

// Prodotti della stessa categoria con un Nutri-Score migliore, preferendo
// quelli venduti in Italia. Il confronto fine lo fa poi il voto atleta.
export async function searchAlternatives(food, { signal, limit = 30 } = {}) {
  const category = food?.quality?.categories?.at(-1);
  if (!category) return [];
  const grades = ['a', 'b', 'c', 'd'].filter(g => !food.quality.nutriscore || g < food.quality.nutriscore);
  if (grades.length === 0) return [];
  const base = `categories_tags:"${category}" AND nutriscore_grade:(${grades.join(' OR ')})`;
  const run = async (q) => {
    const params = new URLSearchParams({ q, page_size: String(limit), langs: 'it,en', fields: PRODUCT_FIELDS });
    const res = await fetch(`${OFF_SEARCH}?${params}`, { signal });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`Ricerca non disponibile (${res.status})`);
    return ((await res.json()).hits || []).map(normalizeOffProduct).filter(f => f && f.id !== food.id);
  };
  const italian = await run(`${base} AND countries_tags:"en:italy"`);
  return italian.length >= 3 ? italian : [...italian, ...(await run(base)).filter(f => !italian.some(i => i.id === f.id))];
}

export async function fetchProductByBarcode(barcode, { signal } = {}) {
  const code = String(barcode).replace(/\D/g, '');
  if (!code) return null;
  const res = await fetch(`${OFF_PRODUCT}/${code}.json?fields=${PRODUCT_FIELDS}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Servizio non disponibile (${res.status})`);
  const data = await res.json();
  if (data.status === 0 || !data.product) return null;
  return normalizeOffProduct({ code, ...data.product });
}
