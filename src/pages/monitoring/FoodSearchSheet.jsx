import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Search, ScanBarcode, Zap, Plus, Loader2, Check, CookingPot } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MEALS, fmtInt } from '../../utils/nutrition';
import { fetchProductByBarcode } from '../../utils/foodApi';
import { FoodDetailSheet } from './FoodDetailSheet';
import { FoodRow } from './FoodRow';
import { RecipeSheet } from './RecipeSheet';
import { useFoodSearch } from './useFoodSearch';
import { Sheet } from './Sheet';
import { tr, trc } from '../../i18n';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

const newId = (prefix) => `${prefix}-${Date.now()}`;
const defaultGrams = (food) => food.lastGrams || food.servingSize || 100;

const emptyNutri = { kcal: '', carbs: '', protein: '', fat: '', fiber: '', sugar: '', satFat: '', salt: '' };
const parseNum = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function QuickAddSheet({ onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [v, setV] = useState({ kcal: '', protein: '', carbs: '', fat: '' });
  const macroKcal = parseNum(v.carbs) * 4 + parseNum(v.protein) * 4 + parseNum(v.fat) * 9;
  const kcal = v.kcal !== '' ? parseNum(v.kcal) : Math.round(macroKcal);
  const submit = () => onSubmit({
    id: newId('quick'),
    name: name.trim() || tr('Inserimento rapido'),
    brand: '',
    source: 'quick',
    per100: { kcal, carbs: parseNum(v.carbs), protein: parseNum(v.protein), fat: parseNum(v.fat) },
  });
  return (
    <Sheet
      title={tr('Inserimento rapido')}
      onClose={onClose}
      footer={(
        <button type="button" className="mn-cta" disabled={!(kcal > 0)} onClick={submit}>
          {tr(tr('Aggiungi'))} · {fmtInt(kcal)} kcal
        </button>
      )}
    >
      <div className="mn-form">
        <p className="mn-hint">{tr("Per quando sai già i numeri: un pasto fuori, una ricetta, un'etichetta.")}</p>
        <label className="mn-field"><span>{tr('Cos\'era')}</span>
          <input className="mn-input" value={name} onChange={e => setName(e.target.value)} placeholder={tr('Es. Poke al salmone')} />
        </label>
        <label className="mn-field"><span>{tr('Calorie')}</span>
          <input className="mn-input mn-input--big" inputMode="decimal" value={v.kcal} onChange={e => setV({ ...v, kcal: e.target.value })} placeholder={macroKcal > 0 ? String(Math.round(macroKcal)) : '0'} />
        </label>
        <div className="mn-field-row mn-field-row--3">
          {[['protein', 'Proteine g'], ['carbs', 'Carboidrati g'], ['fat', 'Grassi g']].map(([k, label]) => (
            <label key={k} className={`mn-field is-${k}`}><span>{tr(label)}</span>
              <input className="mn-input" inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} placeholder="0" />
            </label>
          ))}
        </div>
        <p className="mn-hint">{tr('Se lasci vuote le calorie le calcolo dai macro.')}</p>
      </div>
    </Sheet>
  );
}

function CreateFoodSheet({ initialBarcode = '', initialName = '', onCreated, onClose }) {
  const addCustomFood = useStore(state => state.addCustomFood);
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(initialBarcode);
  const [serving, setServing] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [n, setN] = useState(emptyNutri);
  const valid = name.trim() && n.kcal !== '';

  const save = () => {
    const servingSize = parseNum(serving);
    const food = {
      id: newId('custom'),
      name: name.trim(),
      brand: brand.trim(),
      barcode: barcode.replace(/\D/g, '') || undefined,
      source: 'custom',
      per100: Object.fromEntries(Object.keys(emptyNutri).map(k => [k, parseNum(n[k])])),
      servingSize: servingSize > 0 ? servingSize : null,
      servingLabel: servingSize > 0 ? (servingLabel.trim() || tr('1 porzione')) : null,
    };
    addCustomFood(food);
    onCreated(food);
  };

  return (
    <Sheet title={tr('Nuovo alimento')} onClose={onClose} full
      footer={<button type="button" className="mn-cta" disabled={!valid} onClick={save}>{tr('Salva tra i miei alimenti')}</button>}>
      <div className="mn-form">
        {initialBarcode && <p className="mn-hint mn-hint--warn">{tr('Il codice {code} non è nel database: copia i valori dall\'etichetta, lo ritroverai alla prossima scansione.', { code: initialBarcode })}</p>}
        <label className="mn-field"><span>{tr('Nome')}</span>
          <input className="mn-input" value={name} onChange={e => setName(e.target.value)} placeholder={tr('Es. Torta della nonna')} />
        </label>
        <div className="mn-field-row">
          <label className="mn-field"><span>{tr('Marca')}</span>
            <input className="mn-input" value={brand} onChange={e => setBrand(e.target.value)} placeholder={tr('Facoltativa')} />
          </label>
          <label className="mn-field"><span>{tr('Codice a barre')}</span>
            <input className="mn-input" inputMode="numeric" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder={tr('Facoltativo')} />
          </label>
        </div>
        <p className="mn-label">{tr('Per 100 g, come in etichetta')}</p>
        <label className="mn-field"><span>{tr('Calorie')}</span>
          <input className="mn-input mn-input--big" inputMode="decimal" value={n.kcal} onChange={e => setN({ ...n, kcal: e.target.value })} placeholder="0" />
        </label>
        <div className="mn-field-row mn-field-row--3">
          {[['protein', 'Proteine g'], ['carbs', 'Carboidrati g'], ['fat', 'Grassi g']].map(([k, label]) => (
            <label key={k} className={`mn-field is-${k}`}><span>{tr(label)}</span>
              <input className="mn-input" inputMode="decimal" value={n[k]} onChange={e => setN({ ...n, [k]: e.target.value })} placeholder="0" />
            </label>
          ))}
        </div>
        <div className="mn-field-row">
          {[['fiber', 'Fibre g'], ['sugar', 'di cui zuccheri g'], ['satFat', 'di cui saturi g'], ['salt', 'Sale g']].map(([k, label]) => (
            <label key={k} className="mn-field"><span>{tr(label)}</span>
              <input className="mn-input" inputMode="decimal" value={n[k]} onChange={e => setN({ ...n, [k]: e.target.value })} placeholder="0" />
            </label>
          ))}
        </div>
        <p className="mn-label">{tr('Porzione abituale')}</p>
        <div className="mn-field-row">
          <label className="mn-field"><span>{tr('Grammi')}</span>
            <input className="mn-input" inputMode="decimal" value={serving} onChange={e => setServing(e.target.value)} placeholder={tr('Facoltativa')} />
          </label>
          <label className="mn-field"><span>{tr('Nome')}</span>
            <input className="mn-input" value={servingLabel} onChange={e => setServingLabel(e.target.value)} placeholder={tr('Es. 1 fetta')} />
          </label>
        </div>
      </div>
    </Sheet>
  );
}

// Ricerca e aggiunta di alimenti. Resta aperto per registrare più cose di fila.
export function FoodSearchSheet({ date, initialMeal, onClose }) {
  const recentFoods = useStore(state => state.recentFoods || []);
  const customFoods = useStore(state => state.customFoods || []);
  const addFoodEntry = useStore(state => state.addFoodEntry);
  const deleteFoodEntry = useStore(state => state.deleteFoodEntry);
  const deleteCustomFood = useStore(state => state.deleteCustomFood);

  const [meal, setMeal] = useState(initialMeal || 'breakfast');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('recent');
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState(null); // 'scan' | 'quick' | { create: { barcode, name } } | { recipe: food | null }
  const [scanState, setScanState] = useState({ loading: false, message: '' });
  const [added, setAdded] = useState([]); // [{ entryId, meal, foodId, name, kcal }]
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const { trimmed, local, online, onlineItems: listOnline, noOnlineResults } = useFoodSearch(query, customFoods);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const log = (food, grams, targetMeal = meal) => {
    const entryId = addFoodEntry(date, targetMeal, food, grams);
    if (!entryId) return;
    const item = { entryId, meal: targetMeal, foodId: food.id, name: food.name, kcal: (food.per100.kcal * grams) / 100 };
    setAdded(a => [...a, item]);
    setToast(item);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
    navigator.vibrate?.(20);
  };

  const undo = () => {
    if (!toast) return;
    deleteFoodEntry(date, toast.meal, toast.entryId);
    setAdded(a => a.filter(i => i.entryId !== toast.entryId));
    setToast(null);
  };

  const handleBarcode = useCallback(async (code) => {
    setPanel(null);
    const own = customFoods.find(f => f.barcode === code);
    if (own) { setSelected(own); return; }
    setScanState({ loading: true, message: '' });
    try {
      const food = await fetchProductByBarcode(code);
      setScanState({ loading: false, message: '' });
      if (food) setSelected(food);
      else setPanel({ create: { barcode: code } });
    } catch {
      setScanState({ loading: false, message: tr('Non riesco a raggiungere il database prodotti. Controlla la connessione.') });
    }
  }, [customFoods]);

  const addedIds = new Set(added.map(i => i.foodId));
  const searching = trimmed.length > 0;
  const addedKcal = added.reduce((a, i) => a + i.kcal, 0);
  const rowProps = (f) => ({ food: f, grams: defaultGrams(f), justAdded: addedIds.has(f.id), onOpen: setSelected, onQuickAdd: (food, g) => log(food, g) });

  return (
    <>
      <Sheet
        title={tr('Aggiungi')}
        onClose={onClose}
        full
        overlay={toast && (
          <div className="mn-toast" role="status">
            <Check size={16} />
            <span><strong>{toast.name}</strong> {tr('in')} {MEALS.find(m => m.id === toast.meal)?.label.toLowerCase()}</span>
            <button type="button" onClick={undo}>{trc('undo', 'Annulla')}</button>
          </div>
        )}
        footer={added.length > 0 && (
          <button type="button" className="mn-cta" onClick={onClose}>
            {tr('Fatto')} · {added.length} {added.length === 1 ? tr('alimento') : tr('alimenti')}, {fmtInt(addedKcal)} kcal
          </button>
        )}
      >
        <div className="mn-search">
          <div className="mn-chips" role="radiogroup" aria-label={tr('Pasto')}>
            {MEALS.map(m => (
              <button key={m.id} type="button" className={`mn-chip ${meal === m.id ? 'is-active' : ''}`} onClick={() => setMeal(m.id)} aria-pressed={meal === m.id}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="mn-searchbar">
            <Search size={18} />
            <input
              type="search"
              placeholder={tr('Alimento, marca o piatto')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label={tr('Cerca alimento')}
            />
            <button type="button" className="mn-searchbar-scan" onClick={() => setPanel('scan')} aria-label={tr('Scansiona codice a barre')}>
              <ScanBarcode size={20} />
            </button>
          </div>

          <div className="mn-search-actions">
            <button type="button" onClick={() => setPanel('quick')}><Zap size={14} /> {tr('Solo i numeri')}</button>
            <button type="button" onClick={() => setPanel({ create: { name: trimmed } })}><Plus size={14} /> {tr(tr('Nuovo alimento'))}</button>
            <button type="button" onClick={() => setPanel({ recipe: null })}><CookingPot size={14} /> {tr('Componi un pasto')}</button>
          </div>

          {scanState.loading && <p className="mn-hint mn-hint--center"><Loader2 size={14} className="mn-spin" /> {tr('Cerco il prodotto…')}</p>}
          {scanState.message && <p className="mn-hint mn-hint--warn">{scanState.message}</p>}

          {searching ? (
            <>
              {local.length > 0 && (
                <section>
                  <h3 className="mn-label">{tr('Di base e tuoi')}</h3>
                  <ul className="mn-rows">
                    {local.slice(0, 15).map(f => <FoodRow key={f.id} {...rowProps(f)} />)}
                  </ul>
                </section>
              )}
              <section>
                <h3 className="mn-label">
                  {tr('Prodotti confezionati')}
                  {online.loading && <Loader2 size={13} className="mn-spin" />}
                </h3>
                {online.error && <p className="mn-hint">{online.error}</p>}
                {noOnlineResults && (
                  <p className="mn-hint">{tr('Nessun prodotto con questo nome. Prova la scansione o crealo tu.')}</p>
                )}
                <ul className="mn-rows">
                  {listOnline.map(f => <FoodRow key={f.id} {...rowProps(f)} />)}
                </ul>
              </section>
            </>
          ) : (
            <>
              <div className="mn-seg mn-seg--small">
                <button type="button" className={tab === 'recent' ? 'is-active' : ''} onClick={() => setTab('recent')}>{tr('Usati di recente')}</button>
                <button type="button" className={tab === 'custom' ? 'is-active' : ''} onClick={() => setTab('custom')}>{tr('Creati da te')}</button>
              </div>
              {tab === 'recent' && (recentFoods.length === 0
                ? <p className="mn-empty">{tr("Qui ritrovi ciò che mangi più spesso, con la quantità dell'ultima volta: basta un tocco sul +.")}</p>
                : <ul className="mn-rows">{recentFoods.map(f => <FoodRow key={f.id} {...rowProps(f)} />)}</ul>)}
              {tab === 'custom' && (customFoods.length === 0
                ? <p className="mn-empty">{tr('Ricette di casa o prodotti che non trovi: creali una volta e li hai sempre qui.')}</p>
                : <ul className="mn-rows">{customFoods.map(f => (
                  <FoodRow
                    key={f.id}
                    {...rowProps(f)}
                    onEdit={f.source === 'recipe' ? (food) => setPanel({ recipe: food }) : undefined}
                    onDelete={f.source === 'recipe' ? undefined : (food) => window.confirm(tr('Eliminare "{name}" dai tuoi alimenti?', { name: food.name })) && deleteCustomFood(food.id)}
                  />
                ))}</ul>)}
            </>
          )}
          <p className="mn-source-note">
            {tr('Prodotti:')} <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL) · {tr('alimenti di base: valori medi CREA/USDA')}
          </p>
        </div>
      </Sheet>

      {selected && (
        <FoodDetailSheet
          key={selected.id} // passando a un'alternativa il pannello riparte con quantità e unità del nuovo prodotto
          food={selected}
          date={date}
          initialMeal={meal}
          onClose={() => setSelected(null)}
          onSubmit={({ grams, meal: m }) => { log(selected, grams, m); setSelected(null); }}
          onPickAlternative={setSelected}
        />
      )}
      {panel === 'scan' && (
        <Suspense fallback={null}>
          <BarcodeScanner onDetected={handleBarcode} onClose={() => setPanel(null)} />
        </Suspense>
      )}
      {panel === 'quick' && (
        <QuickAddSheet onClose={() => setPanel(null)} onSubmit={(food) => { log(food, 100); setPanel(null); }} />
      )}
      {panel?.create && (
        <CreateFoodSheet
          initialBarcode={panel.create.barcode}
          initialName={panel.create.name}
          onClose={() => setPanel(null)}
          onCreated={(food) => { setPanel(null); setSelected(food); }}
        />
      )}
      {panel && typeof panel === 'object' && 'recipe' in panel && (
        <RecipeSheet
          recipe={panel.recipe}
          onClose={() => setPanel(null)}
          onSaved={(food) => { setPanel(null); setTab('custom'); setSelected(food); }}
        />
      )}
    </>
  );
}
