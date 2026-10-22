import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CookingPot, Plus, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MACROS, fmtInt, fmtDec } from '../../utils/nutrition';
import { MacroStrip } from './Fuel';
import { RecipeSheet } from './RecipeSheet';
import './Monitoring.css';

// Impostazioni → I tuoi pasti: crea e gestisci i pasti composti fuori dal Diario
export default function MyMeals() {
  const navigate = useNavigate();
  // filtro fuori dal selettore: un array nuovo a ogni lettura farebbe ri-renderizzare all'infinito
  const customFoods = useStore(state => state.customFoods);
  const recipes = useMemo(() => (customFoods || []).filter(f => f.source === 'recipe'), [customFoods]);
  const [editing, setEditing] = useState(undefined); // undefined = chiuso, null = nuovo, food = modifica
  const [savedName, setSavedName] = useState('');

  return (
    <div className="ej-page mn-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="mn-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round mn-header-btn" onClick={() => navigate(-1)} aria-label="Indietro">
          <ChevronLeft size={20} />
        </button>
        <h1 className="mn-title">I tuoi pasti</h1>
      </header>

      <p className="mn-meals-intro">
        Componi un pasto con gli alimenti che conosci (pancake, porridge, la tua insalata) e salvalo: lo ritrovi nel Diario, in Aggiungi → Creati da te.
      </p>

      <button type="button" className="mn-add-ingredient" onClick={() => { setSavedName(''); setEditing(null); }}>
        <Plus size={18} /> Crea un nuovo pasto
      </button>

      {savedName && <p className="mn-hint mn-hint--center">“{savedName}” salvato.</p>}

      {recipes.length === 0 ? (
        <div className="mn-wt-empty">
          <CookingPot size={34} />
          <h3>Ancora nessun pasto</h3>
          <p>Quando mangi spesso la stessa ricetta, crearla una volta ti fa risparmiare tempo: dopo basta un tocco per aggiungerla.</p>
        </div>
      ) : (
        <ul className="mn-saved-meals">
          {recipes.map(r => {
            const per = Object.fromEntries(MACROS.map(m => [m.id, ((r.per100[m.id] || 0) * (r.servingSize || 100)) / 100]));
            const kcal = (r.per100.kcal * (r.servingSize || 100)) / 100;
            return (
              <li key={r.id}>
                <button type="button" className="mn-saved-meal" onClick={() => { setSavedName(''); setEditing(r); }}>
                  <span className="mn-saved-meal-icon"><CookingPot size={18} /></span>
                  <span className="mn-saved-meal-text">
                    <strong>{r.name}</strong>
                    <span>
                      {r.servingLabel} · {fmtDec(r.servingSize)} g · {fmtInt(kcal)} kcal
                    </span>
                    <span className="mn-saved-meal-macros">
                      <MacroStrip per100={r.per100} />
                      P {fmtInt(per.protein)} · C {fmtInt(per.carbs)} · G {fmtInt(per.fat)} g · {r.recipe?.ingredients?.length || 0} ingredienti
                    </span>
                  </span>
                  <ChevronRight size={18} className="mn-saved-meal-chevron" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== undefined && (
        <RecipeSheet
          recipe={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(food) => { setSavedName(food.name); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
