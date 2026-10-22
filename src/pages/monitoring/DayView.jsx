import React from 'react';
import { ChevronLeft, ChevronRight, Coffee, UtensilsCrossed, Moon, Apple, Plus, BarChart3 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { resolveBodyweight } from '../../utils/oneRepMax';
import {
  MEALS, MACROS, dayTotals, sumNutrients, entryNutrients, macroGoalsInGrams, estimateWorkoutKcal,
  shiftDateKey, toDateKey, fromDateKey, fmtInt, fmtDec
} from '../../utils/nutrition';
import { FuelBar } from './Fuel';

const MEAL_ICONS = { breakfast: Coffee, lunch: UtensilsCrossed, dinner: Moon, snacks: Apple };
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function mondayOf(key) {
  const d = fromDateKey(key);
  return shiftDateKey(key, -((d.getDay() + 6) % 7));
}

// Una riga: frecce per cambiare settimana, i 7 giorni, un puntino dove c'è qualcosa
export function WeekStrip({ date, onChange }) {
  const diary = useStore(state => state.foodDiary || {});
  const goals = useStore(state => state.nutritionGoals);
  const today = toDateKey();
  const monday = mondayOf(date);
  const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(monday, i));

  return (
    <div className="mn-week">
      <button type="button" className="mn-week-arrow" onClick={() => onChange(shiftDateKey(date, -7))} aria-label="Settimana precedente">
        <ChevronLeft size={18} />
      </button>
      {days.map((key, i) => {
        const kcal = dayTotals(diary[key]).kcal;
        const status = kcal <= 0 ? '' : kcal > (goals?.kcal || Infinity) * 1.05 ? 'is-over' : 'is-logged';
        return (
          <button
            key={key}
            type="button"
            className={`mn-day ${key === date ? 'is-selected' : ''} ${key === today ? 'is-today' : ''} ${key > today ? 'is-future' : ''}`}
            onClick={() => onChange(key)}
            aria-label={fromDateKey(key).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            aria-pressed={key === date}
          >
            <span className="mn-day-letter">{WEEKDAYS[i]}</span>
            <span className="mn-day-num">{fromDateKey(key).getDate()}</span>
            <i className={`mn-day-dot ${status}`} aria-hidden="true" />
          </button>
        );
      })}
      <button type="button" className="mn-week-arrow" onClick={() => onChange(shiftDateKey(date, 7))} aria-label="Settimana successiva">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// Riepilogo del giorno: un numero, una riga di contesto, la barra, tre macro
export function FuelCard({ date, onAnalysis }) {
  const day = useStore(state => state.foodDiary?.[date]);
  const goals = useStore(state => state.nutritionGoals);
  const history = useStore(state => state.history);
  const bodyweight = useStore(resolveBodyweight);

  const totals = dayTotals(day);
  const goalG = macroGoalsInGrams(goals, bodyweight);
  const training = estimateWorkoutKcal(history, date, bodyweight);
  const budget = goalG.kcal + training;
  const left = Math.round(budget - totals.kcal);

  return (
    <section className="mn-summary">
      <div className="mn-summary-top">
        <div>
          <p className={`mn-summary-big ${left < 0 ? 'is-over' : ''}`}>{fmtInt(Math.abs(left))}</p>
          <p className="mn-summary-sub">{left < 0 ? 'kcal oltre il budget' : 'kcal rimaste'}</p>
          <p className="mn-summary-meta">
            {fmtInt(totals.kcal)} di {fmtInt(budget)}
            {training > 0 && <span className="mn-summary-train"> · +{fmtInt(training)} allenamento</span>}
          </p>
        </div>
        <button type="button" className="ej-icon-btn mn-summary-btn" onClick={onAnalysis} aria-label="Analisi della giornata">
          <BarChart3 size={18} />
        </button>
      </div>

      <FuelBar totals={totals} budget={budget} height={8} />

      <div className="mn-macros">
        {MACROS.map(m => {
          const pct = goalG[m.id] ? Math.min(100, (totals[m.id] / goalG[m.id]) * 100) : 0;
          return (
            <div key={m.id} className={`mn-macro is-${m.id}`}>
              <span className="mn-macro-label">{m.label}</span>
              <span className="mn-macro-value"><strong>{fmtInt(totals[m.id])}</strong> / {fmtInt(goalG[m.id])} g</span>
              <span className="mn-macro-track"><i style={{ width: `${pct}%` }} /></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function portionText(entry) {
  const f = entry.food;
  if (f.source === 'quick') return 'inserimento rapido';
  const servings = f.servingSize > 0 ? entry.grams / f.servingSize : 0;
  if (servings > 0 && servings !== 1 && Math.abs(servings * 4 - Math.round(servings * 4)) < 0.01) {
    return `${fmtDec(servings)} porzioni`;
  }
  return `${fmtDec(entry.grams)} g`;
}

// I pasti in un unico elenco: intestazione con totale e +, sotto gli alimenti
export function MealList({ date, onAdd, onEdit }) {
  const day = useStore(state => state.foodDiary?.[date]);
  const yesterday = useStore(state => state.foodDiary?.[shiftDateKey(date, -1)]);
  const copyMeal = useStore(state => state.copyMeal);

  return (
    <section className="mn-meals">
      {MEALS.map(meal => {
        const Icon = MEAL_ICONS[meal.id];
        const entries = day?.[meal.id] || [];
        const kcal = sumNutrients(entries).kcal;
        const canRepeat = entries.length === 0 && (yesterday?.[meal.id] || []).length > 0;
        return (
          <div key={meal.id} className={`mn-meal ${entries.length ? '' : 'is-empty'}`}>
            <div className="mn-meal-head">
              <Icon size={17} className="mn-meal-icon" />
              <h3>{meal.label}</h3>
              {entries.length > 0 && <span className="mn-meal-kcal">{fmtInt(kcal)} kcal</span>}
              {canRepeat && (
                <button type="button" className="mn-meal-repeat" onClick={() => copyMeal(shiftDateKey(date, -1), date, meal.id)}>
                  come ieri
                </button>
              )}
              <button type="button" className="mn-meal-add" onClick={() => onAdd(meal.id)} aria-label={`Aggiungi a ${meal.label}`}>
                <Plus size={18} />
              </button>
            </div>
            {entries.map(entry => (
              <button key={entry.id} type="button" className="mn-item" onClick={() => onEdit(meal.id, entry)}>
                <span className="mn-item-name">{entry.food.name}</span>
                <span className="mn-item-qty">{portionText(entry)}</span>
                <span className="mn-item-kcal">{fmtInt(entryNutrients(entry).kcal)}</span>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
