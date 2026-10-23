import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, ChevronDown, Sparkles, X, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { toDateKey, formatDayLabel, dayEntries } from '../../utils/nutrition';
import { SetupWizard } from './SetupWizard';
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
  const dietSetup = useStore(state => state.dietSetup);
  // Primo accesso: test mai fatto né rimandato e nessun dato registrato
  const isBlankStart = useStore(state => !state.dietSetup?.completedAt && !state.dietSetup?.postponedAt
    && (state.weightLog || []).length === 0
    && !Object.values(state.foodDiary || {}).some(day => dayEntries(day).length > 0));
  const [sheet, setSheet] = useState(() => (isBlankStart ? { type: 'setup' } : null)); // { type: 'add' | 'edit' | 'analysis' | 'goals' | 'setup', ... }

  const updateFoodEntry = useStore(state => state.updateFoodEntry);
  const deleteFoodEntry = useStore(state => state.deleteFoodEntry);
  const hideDietSetupCard = useStore(state => state.hideDietSetupCard);
  const restoreFoodEntry = useStore(state => state.restoreFoodEntry);

  // Ultima voce eliminata col trascinamento, recuperabile per qualche secondo
  const [removed, setRemoved] = useState(null); // { date, meal, entry, index }
  const removedTimer = useRef(null);
  useEffect(() => () => clearTimeout(removedTimer.current), []);

  const removeEntry = (meal, entry, index) => {
    deleteFoodEntry(date, meal, entry.id);
    setRemoved({ date, meal, entry, index });
    clearTimeout(removedTimer.current);
    removedTimer.current = setTimeout(() => setRemoved(null), 5000);
    navigator.vibrate?.(30);
  };

  const undoRemove = () => {
    if (!removed) return;
    restoreFoodEntry(removed.date, removed.meal, removed.entry, removed.index);
    clearTimeout(removedTimer.current);
    setRemoved(null);
  };

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

      {!dietSetup?.completedAt && !dietSetup?.cardHidden && sheet?.type !== 'setup' && (
        <div className="mn-setup-card">
          <Sparkles size={22} />
          <button type="button" className="mn-setup-open" onClick={() => setSheet({ type: 'setup' })}>
            <strong>Calcola il tuo piano</strong>
            <span>Sette domande per calorie e macro su misura</span>
          </button>
          <button type="button" className="mn-setup-close" onClick={hideDietSetupCard} aria-label="Nascondi">
            <X size={16} />
          </button>
        </div>
      )}

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
            onDelete={removeEntry}
          />
          {removed && (
            <div className="mn-toast mn-toast--page" role="status">
              <Trash2 size={16} />
              <span><strong>{removed.entry.food.name}</strong> rimosso</span>
              <button type="button" onClick={undoRemove}>Annulla</button>
            </div>
          )}
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
      {sheet?.type === 'goals' && <GoalsSheet onClose={close} onRedoTest={() => setSheet({ type: 'setup' })} />}
      {sheet?.type === 'setup' && <SetupWizard onClose={close} />}
    </div>
  );
}
