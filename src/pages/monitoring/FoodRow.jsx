import React from 'react';
import { Plus, Check, X, Pencil } from 'lucide-react';
import { KCAL_PER_G, fmtInt, fmtDec } from '../../utils/nutrition';
import { MacroStrip } from './Fuel';

const isHighProtein = (per100) => {
  const kcal = per100?.kcal || 0;
  return kcal > 0 && ((per100.protein || 0) * KCAL_PER_G.protein) / kcal >= 0.3;
};

// Riga di un alimento nei risultati: tocco per il dettaglio, + per aggiungerlo subito
export function FoodRow({ food, grams, onOpen, onQuickAdd, onDelete, onEdit, justAdded }) {
  const kcal = (food.per100.kcal * grams) / 100;
  const protein = ((food.per100.protein || 0) * grams) / 100;
  const portion = food.source === 'recipe' && food.servingSize && Math.abs(grams - food.servingSize) < 0.5
    ? food.servingLabel
    : `${fmtDec(grams)} g`;
  return (
    <li className="mn-row">
      <button type="button" className="mn-row-main" onClick={() => onOpen(food)}>
        <span className="mn-row-name">
          {food.name}
          {food.source === 'recipe' && <em className="mn-badge mn-badge--recipe">Pasto</em>}
          {isHighProtein(food.per100) && <em className="mn-badge">Proteico</em>}
        </span>
        <span className="mn-row-meta">
          <MacroStrip per100={food.per100} />
          {[food.brand, portion, `${fmtInt(kcal)} kcal`, `${fmtInt(protein)} g P`].filter(Boolean).join(' · ')}
        </span>
      </button>
      {onEdit && (
        <button type="button" className="mn-row-btn is-ghost" onClick={() => onEdit(food)} aria-label={`Modifica ${food.name}`}>
          <Pencil size={15} />
        </button>
      )}
      {onDelete && (
        <button type="button" className="mn-row-btn is-danger" onClick={() => onDelete(food)} aria-label={`Elimina ${food.name}`}>
          <X size={16} />
        </button>
      )}
      <button
        type="button"
        className={`mn-row-btn ${justAdded ? 'is-done' : ''}`}
        onClick={() => onQuickAdd(food, grams)}
        aria-label={`Aggiungi ${fmtDec(grams)} g di ${food.name}`}
      >
        {justAdded ? <Check size={18} /> : <Plus size={18} />}
      </button>
    </li>
  );
}
