import React, { Suspense, lazy, useCallback, useState } from 'react';
import { Search, ScanBarcode, Plus, Minus, X, Loader2, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MACROS, NUTRIENTS, entryNutrients, sumNutrients, fmtInt, fmtDec } from '../../utils/nutrition';
import { fetchProductByBarcode } from '../../utils/foodApi';
import { FoodRow } from './FoodRow';
import { useFoodSearch } from './useFoodSearch';
import { Sheet } from './Sheet';
import { tr } from '../../i18n';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

const newId = (prefix) => `${prefix}-${Date.now()}`;
const toNum = (v) => parseFloat(String(v).replace(',', '.'));
const defaultGrams = (food) => food.lastGrams || food.servingSize || 100;
const round2 = (n) => Math.round(n * 100) / 100;

// Copia "leggera" dell'alimento da salvare dentro il pasto
const snapshot = (f) => ({
  id: f.id, name: f.name, brand: f.brand || '', source: f.source, barcode: f.barcode,
  per100: f.per100, servingSize: f.servingSize || null, servingLabel: f.servingLabel || null,
});

// Scelta di un ingrediente tra i prodotti già presenti
function IngredientPicker({ excludeId, onPick, onClose }) {
  const recentFoods = useStore(state => state.recentFoods || []);
  const customFoods = useStore(state => state.customFoods || []);
  const [query, setQuery] = useState('');
  const [scan, setScan] = useState(false);
  const [scanMsg, setScanMsg] = useState({ loading: false, text: '' });
  const { trimmed, local, online, onlineItems, noOnlineResults } = useFoodSearch(query, customFoods);

  const visible = (list) => list.filter(f => f.id !== excludeId);
  const pick = (food) => onPick(food, defaultGrams(food));

  const handleBarcode = useCallback(async (code) => {
    setScan(false);
    const own = customFoods.find(f => f.barcode === code);
    if (own) { onPick(own, defaultGrams(own)); return; }
    setScanMsg({ loading: true, text: '' });
    try {
      const food = await fetchProductByBarcode(code);
      if (food) onPick(food, defaultGrams(food));
      else setScanMsg({ loading: false, text: tr('Il codice {code} non è nel database: crealo da "Nuovo alimento" e poi aggiungilo qui.', { code }) });
    } catch {
      setScanMsg({ loading: false, text: tr('Non riesco a raggiungere il database prodotti. Controlla la connessione.') });
    }
  }, [customFoods, onPick]);

  const rows = (list) => (
    <ul className="mn-rows">
      {visible(list).map(f => <FoodRow key={f.id} food={f} grams={defaultGrams(f)} onOpen={pick} onQuickAdd={pick} />)}
    </ul>
  );

  return (
    <>
      <Sheet title={tr('Aggiungi ingrediente')} onClose={onClose} full>
        <div className="mn-search">
          <div className="mn-searchbar">
            <Search size={18} />
            <input type="search" placeholder={tr('Cerca tra prodotti e alimenti')} value={query} onChange={e => setQuery(e.target.value)} aria-label={tr('Cerca ingrediente')} />
            <button type="button" className="mn-searchbar-scan" onClick={() => setScan(true)} aria-label={tr('Scansiona codice a barre')}>
              <ScanBarcode size={20} />
            </button>
          </div>
          {scanMsg.loading && <p className="mn-hint mn-hint--center"><Loader2 size={14} className="mn-spin" /> {tr('Cerco il prodotto…')}</p>}
          {scanMsg.text && <p className="mn-hint mn-hint--warn">{scanMsg.text}</p>}

          {trimmed ? (
            <>
              {visible(local).length > 0 && <section><h3 className="mn-label">{tr('Di base e tuoi')}</h3>{rows(local.slice(0, 15))}</section>}
              <section>
                <h3 className="mn-label">{tr('Prodotti confezionati')} {online.loading && <Loader2 size={13} className="mn-spin" />}</h3>
                {online.error && <p className="mn-hint">{online.error}</p>}
                {noOnlineResults && <p className="mn-hint">{tr('Nessun prodotto con questo nome.')}</p>}
                {rows(onlineItems)}
              </section>
            </>
          ) : (
            <>
              {visible(recentFoods).length > 0 && <section><h3 className="mn-label">{tr('Usati di recente')}</h3>{rows(recentFoods)}</section>}
              {visible(customFoods).length > 0 && <section><h3 className="mn-label">{tr('Creati da te')}</h3>{rows(customFoods)}</section>}
              {visible(recentFoods).length === 0 && visible(customFoods).length === 0 && (
                <p className="mn-empty">{tr('Cerca un ingrediente per nome o marca, oppure scansiona la confezione.')}</p>
              )}
            </>
          )}
        </div>
      </Sheet>
      {scan && (
        <Suspense fallback={null}>
          <BarcodeScanner onDetected={handleBarcode} onClose={() => setScan(false)} />
        </Suspense>
      )}
    </>
  );
}

// Compositore di un pasto (es. pancake): ingredienti + porzioni → nuovo alimento
export function RecipeSheet({ recipe, onSaved, onClose }) {
  const addCustomFood = useStore(state => state.addCustomFood);
  const deleteCustomFood = useStore(state => state.deleteCustomFood);
  const saved = recipe?.recipe;

  const [name, setName] = useState(recipe?.name || '');
  const [items, setItems] = useState(() => (saved?.ingredients || []).map((i, n) => ({ key: `i${n}`, food: i.food, grams: String(i.grams).replace('.', ',') })));
  const [portions, setPortions] = useState(saved?.portions || 1);
  const [portionName, setPortionName] = useState(saved?.portionName || '');
  const [cooked, setCooked] = useState(saved?.cookedWeight ? String(saved.cookedWeight) : '');
  const [picking, setPicking] = useState(false);

  const parsed = items.map(i => ({ ...i, g: toNum(i.grams) }));
  const rawWeight = parsed.reduce((a, i) => a + (i.g > 0 ? i.g : 0), 0);
  const cookedWeight = toNum(cooked) > 0 ? toNum(cooked) : null;
  const totalWeight = cookedWeight || rawWeight;
  const totals = sumNutrients(parsed.filter(i => i.g > 0).map(i => ({ food: i.food, grams: i.g })));
  const perPortion = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / portions]));
  const valid = name.trim() && parsed.length > 0 && parsed.every(i => i.g > 0) && totalWeight > 0;

  const addIngredient = useCallback((food, grams) => {
    setItems(list => [...list, { key: `${food.id}-${Date.now()}`, food: snapshot(food), grams: String(Math.round(grams * 10) / 10).replace('.', ',') }]);
    setPicking(false);
  }, []);

  const save = () => {
    const per100 = Object.fromEntries(NUTRIENTS.map(n => [n.id, round2((totals[n.id] / totalWeight) * 100)]));
    per100.kcal = Math.round(per100.kcal);
    const label = portionName.trim() || tr('porzione');
    const food = {
      id: recipe?.id || newId('recipe'),
      name: name.trim(),
      brand: '',
      source: 'recipe',
      per100,
      servingSize: Math.round((totalWeight / portions) * 10) / 10,
      servingLabel: `1 ${label}`,
      recipe: {
        ingredients: parsed.map(i => ({ food: i.food, grams: i.g })),
        portions,
        portionName: portionName.trim(),
        cookedWeight,
      },
    };
    addCustomFood(food);
    onSaved(food);
  };

  const remove = () => {
    if (window.confirm(tr('Eliminare "{name}" dai tuoi alimenti? Le voci già nel diario restano.', { name: recipe.name }))) {
      deleteCustomFood(recipe.id);
      onClose();
    }
  };

  const footer = (
    <div className="mn-detail-actions">
      {recipe && (
        <button type="button" className="mn-btn-ghost-danger" onClick={remove} aria-label={tr('Elimina pasto')}>
          <Trash2 size={18} />
        </button>
      )}
      <button type="button" className="mn-cta" disabled={!valid} onClick={save}>
        {recipe ? tr('Salva modifiche') : tr('Salva il pasto')}
      </button>
    </div>
  );

  return (
    <>
      <Sheet title={recipe ? tr('Modifica pasto') : tr('Componi un pasto')} onClose={onClose} full footer={footer}>
        <div className="mn-recipe">
          <label className="mn-field">
            <span>{tr('Nome')}</span>
            <input className="mn-input mn-input--big" value={name} onChange={e => setName(e.target.value)} placeholder={tr('Es. Pancake proteici')} />
          </label>

          <section>
            <h3 className="mn-label">{tr('Ingredienti')}</h3>
            {items.length > 0 && (
              <ul className="mn-ingredients">
                {parsed.map(i => (
                  <li key={i.key}>
                    <span className="mn-ingredient-name">
                      <strong>{i.food.name}</strong>
                      <small>{i.g > 0 ? `${fmtInt(entryNutrients({ food: i.food, grams: i.g }).kcal)} kcal` : '—'}{i.food.brand ? ` · ${i.food.brand}` : ''}</small>
                    </span>
                    <label className="mn-ingredient-qty">
                      <input
                        inputMode="decimal"
                        value={i.grams}
                        onChange={e => setItems(list => list.map(x => (x.key === i.key ? { ...x, grams: e.target.value } : x)))}
                        onFocus={e => e.target.select()}
                        aria-label={tr('Grammi di {name}', { name: i.food.name })}
                      />
                      <small>g</small>
                    </label>
                    <button type="button" className="mn-ingredient-remove" onClick={() => setItems(list => list.filter(x => x.key !== i.key))} aria-label={tr('Togli {name}', { name: i.food.name })}>
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="mn-add-ingredient" onClick={() => setPicking(true)}>
              <Plus size={18} /> {tr(tr('Aggiungi ingrediente'))}
            </button>
          </section>

          <section>
            <h3 className="mn-label">{tr('Quante porzioni fa?')}</h3>
            <div className="mn-recipe-yield">
              <div className="mn-stepper mn-stepper--inline">
                <button type="button" onClick={() => setPortions(p => Math.max(1, p - 1))} disabled={portions <= 1} aria-label={tr('Una porzione in meno')}><Minus size={16} /></button>
                <span className="mn-stepper-inline-value">{portions}</span>
                <button type="button" onClick={() => setPortions(p => Math.min(50, p + 1))} aria-label={tr('Una porzione in più')}><Plus size={16} /></button>
              </div>
              <input className="mn-input" value={portionName} onChange={e => setPortionName(e.target.value)} placeholder={tr('porzione, pancake, fetta…')} aria-label={tr('Nome della porzione')} />
            </div>
            <label className="mn-field mn-field--inline">
              <span>{tr('Peso finale da cotto')}</span>
              <input className="mn-input" inputMode="decimal" value={cooked} onChange={e => setCooked(e.target.value)} placeholder={rawWeight ? fmtInt(rawWeight) : '—'} />
              <small>g</small>
            </label>
            <p className="mn-hint">{tr("Facoltativo: se pesi il pasto pronto, i valori per 100 g tengono conto dell'acqua persa o assorbita in cottura.")}</p>
          </section>

          {parsed.length > 0 && (
            <section className="mn-plan">
              <p className="mn-plan-phase">
                1 {portionName.trim() || tr('porzione')} · {fmtInt(totalWeight / portions)} g{portions > 1 ? ` · ${tr('totale {kcal} kcal', { kcal: fmtInt(totals.kcal) })}` : ''}
              </p>
              <p className="mn-plan-kcal">{fmtInt(perPortion.kcal)}<small>kcal</small></p>
              <div className="mn-plan-macros">
                {MACROS.map(m => (
                  <div key={m.id} className={`is-${m.id}`}>
                    <strong>{fmtDec(perPortion[m.id])}<small> g</small></strong>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </Sheet>
      {picking && <IngredientPicker excludeId={recipe?.id} onPick={addIngredient} onClose={() => setPicking(false)} />}
    </>
  );
}
