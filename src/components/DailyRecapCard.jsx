import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Scale, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { resolveBodyweight } from '../utils/oneRepMax';
import {
  toDateKey, dayTotals, macroGoalsInGrams, estimateWorkoutKcal, weightTrend, fmtInt, fmtDec
} from '../utils/nutrition';
import { FuelBar } from '../pages/monitoring/Fuel';
import './DailyRecapCard.css';

// Riepilogo giornaliero in Home: porta alla sezione Diario
export function DailyRecapCard() {
  const navigate = useNavigate();
  const today = toDateKey();
  const day = useStore(state => state.foodDiary?.[today]);
  const goals = useStore(state => state.nutritionGoals);
  const history = useStore(state => state.history);
  const bodyweight = useStore(resolveBodyweight);
  const weightLog = useStore(state => state.weightLog || []);

  const totals = dayTotals(day);
  const goalG = macroGoalsInGrams(goals, bodyweight);
  const budget = goalG.kcal + estimateWorkoutKcal(history, today, bodyweight);
  const left = Math.round(budget - totals.kcal);
  const trend = weightLog.length ? weightTrend(weightLog).at(-1).trend : null;
  const proteinPct = goalG.protein ? Math.min(100, (totals.protein / goalG.protein) * 100) : 0;
  const empty = totals.kcal === 0;

  return (
    <button type="button" className="drc" onClick={() => navigate('/diario')}>
      <div className="drc-head">
        <span className="drc-eyebrow">Carburante di oggi</span>
        {trend != null && (
          <span className="drc-weight"><Scale size={12} /> {fmtDec(trend)} kg</span>
        )}
        <ChevronRight size={18} className="drc-chevron" />
      </div>

      {empty ? (
        <div className="drc-empty">
          <div>
            <strong>{fmtInt(budget)} kcal</strong>
            <span>da distribuire oggi, di cui {fmtInt(goalG.protein)} g di proteine</span>
          </div>
          <span className="drc-plus"><Plus size={20} /></span>
        </div>
      ) : (
        <>
          <div className="drc-numbers">
            <p className={`drc-big ${left < 0 ? 'is-over' : ''}`}>
              {fmtInt(Math.abs(left))}
              <span>{left < 0 ? 'kcal oltre' : 'kcal disponibili'}</span>
            </p>
            <div className="drc-protein">
              <span><b>{fmtInt(totals.protein)}</b>/{fmtInt(goalG.protein)} g</span>
              <div className="drc-protein-track"><i style={{ width: `${proteinPct}%` }} /></div>
              <small>proteine</small>
            </div>
          </div>
          <FuelBar totals={totals} budget={budget} height={10} />
        </>
      )}
    </button>
  );
}
