import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, ChevronDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { toDateKey, formatDayLabel } from '../../utils/nutrition';
import { WeekStrip, FuelCard, MealList } from './DayView';
import { WeightTab } from './WeightTab';
import { GoalsSheet } from './GoalsSheet';
import { AnalysisSheet } from './AnalysisSheet';
import { FoodSearchSheet } from './FoodSearchSheet';
import { FoodDetailSheet } from './FoodDetailSheet';
import './Monitoring.css';

const VIEWS = [
  { id: 'cibo', label: 'Cibo' },
  { id: 'peso', label: 'Peso' },
];

export default function Monitoring() {
  const [params, setParams] = useSearchParams();
  const view = params.get('tab') === 'peso' ? 'peso' : 'cibo';
  const [date, setDate] = useState(toDateKey());
  const [sheet, setSheet] = useState(null); // { type: 'add' | 'edit' | 'analysis' | 'goals', ... }

  const updateFoodEntry = useStore(state => state.updateFoodEntry);
  const deleteFoodEntry = useStore(state => state.deleteFoodEntry);

  const setView = (id) => setParams(id === 'cibo' ? {} : { tab: id }, { replace: true });
  const close = () => setSheet(null);
  const today = toDateKey();

  return (
    <div className="ej-page mn-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="mn-header">
        <h1 className="mn-title">Diario</h1>
        <div className="mn-switch" role="tablist" aria-label="Sezioni">
          {VIEWS.map(({ id, label }) => (
            <button key={id} type="button" role="tab" className={view === id ? 'is-active' : ''} onClick={() => setView(id)} aria-selected={view === id}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="ej-icon-btn ej-icon-btn--round mn-header-btn" onClick={() => setSheet({ type: 'goals' })} aria-label="I tuoi obiettivi">
          <Target size={18} />
        </button>
      </header>

      {view === 'cibo' ? (
        <>
          <div className="mn-dayline">
            <label className="mn-dayline-date">
              {formatDayLabel(date)}
              <ChevronDown size={16} />
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Scegli il giorno" />
            </label>
            {date !== today && (
              <button type="button" className="mn-link" onClick={() => setDate(today)}>Torna a oggi</button>
            )}
          </div>
          <WeekStrip date={date} onChange={setDate} />
          <FuelCard date={date} onAnalysis={() => setSheet({ type: 'analysis' })} />
          <MealList
            date={date}
            onAdd={(meal) => setSheet({ type: 'add', meal })}
            onEdit={(meal, entry) => setSheet({ type: 'edit', meal, entry })}
          />
        </>
      ) : (
        <WeightTab />
      )}

      {sheet?.type === 'add' && <FoodSearchSheet date={date} initialMeal={sheet.meal} onClose={close} />}
      {sheet?.type === 'edit' && (
        <FoodDetailSheet
          mode="edit"
          date={date}
          food={sheet.entry.food}
          initialGrams={sheet.entry.grams}
          initialMeal={sheet.meal}
          onClose={close}
          onSubmit={({ grams, meal }) => { updateFoodEntry(date, sheet.meal, sheet.entry.id, { grams, meal }); close(); }}
          onDelete={() => { deleteFoodEntry(date, sheet.meal, sheet.entry.id); close(); }}
        />
      )}
      {sheet?.type === 'analysis' && <AnalysisSheet date={date} onClose={close} />}
      {sheet?.type === 'goals' && <GoalsSheet onClose={close} />}
    </div>
  );
}
