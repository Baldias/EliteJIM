import React, { useMemo, useState } from 'react';
import { Trash2, Minus, Plus, ChevronDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { resolveBodyweight } from '../../utils/oneRepMax';
import {
  MEALS, NUTRIENTS, entryNutrients, dayTotals, macroGoalsInGrams, estimateWorkoutKcal, fmtInt, fmtDec
} from '../../utils/nutrition';
import { FuelBar, MacroMeter, MacroStrip } from './Fuel';
import { Sheet } from './Sheet';
import { ScorePanel, BetterAlternatives } from './ScorePanel';
import { athleteScore } from '../../utils/athleteScore';

const GRAM_PRESETS = [50, 100, 150, 200];
const SERVING_PRESETS = [0.5, 1, 2, 3];
const round = (n, step) => Math.round(n / step) * step;

// Dettaglio di un alimento: quantità, pasto e impatto sulla giornata.
// mode 'add' → aggiunge al diario, 'edit' → modifica una voce esistente.
export function FoodDetailSheet({ food, date, mode = 'add', initialGrams, initialMeal, onSubmit, onDelete, onClose, onPickAlternative }) {
  const score = useMemo(() => athleteScore(food), [food]);
  const goals = useStore(state => state.nutritionGoals);
  const day = useStore(state => state.foodDiary?.[date]);
  const history = useStore(state => state.history);
  const bodyweight = useStore(resolveBodyweight);

  const isQuick = food.source === 'quick';
  const hasServing = food.servingSize > 0;
  const startGrams = initialGrams ?? food.lastGrams ?? (hasServing ? food.servingSize : 100);

  const [unit, setUnit] = useState(hasServing && !isQuick && Math.abs(startGrams % food.servingSize) < 0.01 ? 'serving' : 'g');
  const [grams, setGrams] = useState(isQuick ? 100 : startGrams);
  const [meal, setMeal] = useState(initialMeal || 'breakfast');
  const [showFacts, setShowFacts] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [draft, setDraft] = useState(null); // testo digitato nel campo quantità

  const amount = unit === 'serving' ? grams / food.servingSize : grams;
  const step = unit === 'serving' ? 0.5 : (grams >= 100 ? 10 : 5);
  const setAmount = (v) => {
    const n = Math.max(0, v);
    setGrams(unit === 'serving' ? n * food.servingSize : n);
  };

  const values = useMemo(() => entryNutrients({ food, grams }), [food, grams]);

  // In modifica la voce è già nel totale del giorno: la tolgo per mostrare solo l'aggiunta
  const base = useMemo(() => {
    const t = dayTotals(day);
    if (mode !== 'edit') return t;
    const current = entryNutrients({ food, grams: initialGrams || 0 });
    return Object.fromEntries(Object.keys(t).map(k => [k, Math.max(0, t[k] - current[k])]));
  }, [day, mode, food, initialGrams]);

  const goalG = macroGoalsInGrams(goals, bodyweight);
  const budget = goalG.kcal + estimateWorkoutKcal(history, date, bodyweight);
  const valid = grams > 0;

  const footer = (
    <div className="mn-detail-actions">
      {mode === 'edit' && (
        <button type="button" className="mn-btn-ghost-danger" onClick={onDelete} aria-label="Rimuovi dal diario">
          <Trash2 size={18} />
        </button>
      )}
      <button type="button" className="mn-cta" disabled={!valid} onClick={() => onSubmit({ grams, meal })}>
        {mode === 'edit' ? 'Salva' : 'Aggiungi'} · {fmtInt(values.kcal)} kcal
      </button>
    </div>
  );

  return (
    <Sheet title={mode === 'edit' ? 'Modifica' : 'Quanto ne mangi?'} onClose={onClose} footer={footer}>
      <div className="mn-detail">
        <div className="mn-detail-head">
          {food.image && <img src={food.image} alt="" className="mn-detail-img" loading="lazy" />}
          <div className="mn-detail-name">
            <h3>{food.name}</h3>
            <p>{[food.brand, food.quantity].filter(Boolean).join(' · ') || (isQuick ? 'Inserimento rapido' : 'Valori medi')}</p>
            <div className="mn-detail-per100">
              <MacroStrip per100={food.per100} />
              <span>{fmtInt(food.per100?.kcal)} kcal / 100 g</span>
            </div>
          </div>
        </div>

        <ScorePanel result={score} />

        {!isQuick && (
          <div className="mn-qty">
            {hasServing && (
              <div className="mn-seg" role="tablist">
                <button type="button" className={unit === 'g' ? 'is-active' : ''} onClick={() => setUnit('g')}>Grammi</button>
                <button type="button" className={unit === 'serving' ? 'is-active' : ''} onClick={() => setUnit('serving')}>
                  Porzioni · {fmtDec(food.servingSize)} g
                </button>
              </div>
            )}
            <div className="mn-stepper">
              <button type="button" onClick={() => setAmount(round(amount - step, step))} disabled={amount <= step} aria-label="Diminuisci">
                <Minus size={20} />
              </button>
              <label className="mn-stepper-value">
                <input
                  inputMode="decimal"
                  value={draft ?? String(Math.round(amount * 100) / 100).replace('.', ',')}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    const n = parseFloat(e.target.value.replace(',', '.'));
                    setAmount(Number.isFinite(n) ? n : 0);
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => setDraft(null)}
                  aria-label="Quantità"
                />
                <span>{unit === 'serving' ? (amount === 1 ? 'porzione' : 'porzioni') : 'grammi'}</span>
              </label>
              <button type="button" onClick={() => setAmount(round(amount + step, step))} aria-label="Aumenta">
                <Plus size={20} />
              </button>
            </div>
            <div className="mn-presets">
              {(unit === 'serving' ? SERVING_PRESETS : GRAM_PRESETS).map(p => (
                <button key={p} type="button" className={Math.abs(amount - p) < 0.001 ? 'is-active' : ''} onClick={() => setAmount(p)}>
                  {unit === 'serving' ? (p === 0.5 ? '½' : `${p}×`) : `${p} g`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mn-chips" role="radiogroup" aria-label="Pasto">
          {MEALS.map(m => (
            <button key={m.id} type="button" className={`mn-chip ${meal === m.id ? 'is-active' : ''}`} onClick={() => setMeal(m.id)} aria-pressed={meal === m.id}>
              {m.label}
            </button>
          ))}
        </div>

        <section className="mn-impact">
          <p className="mn-label">Dopo questo pasto</p>
          <FuelBar totals={base} budget={budget} preview={values} height={10} />
          <p className="mn-impact-kcal">
            <strong>{fmtInt(base.kcal + values.kcal)}</strong> / {fmtInt(budget)} kcal
          </p>
          <MacroMeter macro="protein" value={base.protein} preview={values.protein} goal={goalG.protein} />
          <div className="mn-fuel-pair">
            <MacroMeter macro="carbs" value={base.carbs} preview={values.carbs} goal={goalG.carbs} />
            <MacroMeter macro="fat" value={base.fat} preview={values.fat} goal={goalG.fat} />
          </div>
        </section>

        {food.recipe?.ingredients?.length > 0 && (
          <>
            <button type="button" className={`mn-facts-toggle ${showIngredients ? 'is-open' : ''}`} onClick={() => setShowIngredients(s => !s)}>
              Ingredienti ({food.recipe.ingredients.length}) <ChevronDown size={16} />
            </button>
            {showIngredients && (
              <ul className="mn-recipe-list">
                {food.recipe.ingredients.map((i, n) => (
                  <li key={`${i.food.id}-${n}`}>
                    <span>{i.food.name}</span>
                    <strong>{fmtDec(i.grams)} g</strong>
                  </li>
                ))}
                <li className="is-note">
                  Pasto intero: {fmtInt(food.recipe.cookedWeight || food.recipe.ingredients.reduce((a, i) => a + i.grams, 0))} g
                  {food.recipe.portions > 1 ? `, ${food.recipe.portions} porzioni` : ''}
                </li>
              </ul>
            )}
          </>
        )}

        <button type="button" className={`mn-facts-toggle ${showFacts ? 'is-open' : ''}`} onClick={() => setShowFacts(s => !s)}>
          Valori nutrizionali <ChevronDown size={16} />
        </button>
        {showFacts && (
          <dl className="mn-facts">
            {NUTRIENTS.filter(n => n.id === 'kcal' || food.per100?.[n.id] != null).map(n => (
              <div key={n.id}>
                <dt>{n.label}</dt>
                <dd>{n.id === 'kcal' ? fmtInt(values[n.id]) : fmtDec(values[n.id])} {n.unit}</dd>
              </div>
            ))}
          </dl>
        )}

        {score && onPickAlternative && <BetterAlternatives food={food} result={score} onPick={onPickAlternative} />}
      </div>
    </Sheet>
  );
}
