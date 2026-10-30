import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useStore } from '../../store/useStore';
import { resolveBodyweight } from '../../utils/oneRepMax';
import {
  MEALS, MACROS, NUTRIENTS, KCAL_PER_G, dayTotals, dayEntries, entryNutrients, sumNutrients, macroGoalsInGrams, macroSplit,
  shiftDateKey, fromDateKey, fmtInt, fmtDec
} from '../../utils/nutrition';
import { Sheet } from './Sheet';
import { locale, tr, translated } from '../../i18n';

// Riferimenti OMS/LARN: le fibre sono un minimo, il resto sono limiti massimi
const MICROS = translated([
  { id: 'fiber', label: 'Fibre', ref: 30, kind: 'min' },
  { id: 'sugar', label: 'Zuccheri', ref: 50, kind: 'max' },
  { id: 'satFat', label: 'Grassi saturi', ref: 20, kind: 'max' },
  { id: 'salt', label: 'Sale', ref: 5, kind: 'max' },
]);
const MEAL_TONES = { breakfast: 1, lunch: 0.75, dinner: 0.5, snacks: 0.3 };

function WeekTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="pg-tooltip">
      <p className="pg-tooltip-date">{d.full}</p>
      <p className="pg-tooltip-value">{fmtInt(d.value)} {unit}</p>
    </div>
  );
}

function SplitBar({ label, split }) {
  return (
    <div className="mn-split">
      <span className="mn-split-label">{label}</span>
      <div className="mn-split-bar">
        {MACROS.map(m => split[m.id] > 0 && (
          <span key={m.id} className={`is-${m.id}`} style={{ width: `${split[m.id]}%` }}>
            {split[m.id] >= 12 && `${Math.round(split[m.id])}%`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalysisSheet({ date, onClose }) {
  const diary = useStore(state => state.foodDiary || {});
  const goals = useStore(state => state.nutritionGoals);
  const bodyweight = useStore(resolveBodyweight);
  const [view, setView] = useState('day');
  const [metric, setMetric] = useState('kcal');

  const goalG = macroGoalsInGrams(goals, bodyweight);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const key = shiftDateKey(date, i - 6);
    const d = fromDateKey(key);
    return {
      key,
      label: d.toLocaleDateString(locale(), { weekday: 'short' }).slice(0, 3),
      full: d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }),
      totals: dayTotals(diary[key]),
    };
  }), [diary, date]);

  const logged = useMemo(() => week.filter(d => d.totals.kcal > 0), [week]);
  const totals = useMemo(() => {
    if (view === 'day') return dayTotals(diary[date]);
    const div = Math.max(1, logged.length);
    return Object.fromEntries(NUTRIENTS.map(n => [n.id, logged.reduce((a, d) => a + d.totals[n.id], 0) / div]));
  }, [view, diary, date, logged]);

  const chartData = week.map(d => ({ ...d, value: Math.round(d.totals[metric]) }));
  const chartGoal = goalG[metric];
  const unit = metric === 'kcal' ? 'kcal' : 'g';
  const onTarget = logged.filter(d => Math.abs(d.totals.kcal - goalG.kcal) <= goalG.kcal * 0.1).length;
  const proteinHit = logged.filter(d => d.totals.protein >= goalG.protein * 0.9).length;

  // kcal per livello di lavorazione (NOVA): lo conoscono solo i prodotti di Open Food Facts
  const processing = useMemo(() => {
    const out = { minimal: 0, processed: 0, ultra: 0, unknown: 0 };
    const keys = view === 'day' ? [date] : week.map(d => d.key);
    for (const key of keys) {
      for (const entry of dayEntries(diary[key])) {
        const kcal = entryNutrients(entry).kcal;
        const nova = entry.food?.quality?.nova;
        if (!nova) out.unknown += kcal;
        else if (nova === 4) out.ultra += kcal;
        else if (nova === 3) out.processed += kcal;
        else out.minimal += kcal;
      }
    }
    out.known = out.minimal + out.processed + out.ultra;
    return out;
  }, [view, date, week, diary]);

  const goalSplit = macroSplit({ protein: goalG.protein, carbs: goalG.carbs, fat: goalG.fat });
  const byMeal = MEALS.map(m => ({ ...m, kcal: sumNutrients(diary[date]?.[m.id] || []).kcal }));
  const dayKcal = byMeal.reduce((a, m) => a + m.kcal, 0);

  return (
    <Sheet title={tr('Analisi')} onClose={onClose} full>
      <div className="mn-analysis">
        <div className="mn-seg">
          <button type="button" className={view === 'day' ? 'is-active' : ''} onClick={() => setView('day')}>{tr('Giorno')}</button>
          <button type="button" className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')}>{tr('Ultimi 7 giorni')}</button>
        </div>

        {view === 'week' && (
          <section className="mn-panel">
            <div className="mn-panel-head">
              <div className="mn-seg mn-seg--tiny">
                <button type="button" className={metric === 'kcal' ? 'is-active' : ''} onClick={() => setMetric('kcal')}>{tr('Calorie')}</button>
                <button type="button" className={metric === 'protein' ? 'is-active' : ''} onClick={() => setMetric('protein')}>{tr('Proteine')}</button>
              </div>
              <span className="mn-panel-meta">{tr('media')} {fmtInt(logged.length ? logged.reduce((a, d) => a + d.totals[metric], 0) / logged.length : 0)} {unit}</span>
            </div>
            <div className="mn-chart">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={chartData} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="var(--c-text-dim)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, (max) => Math.ceil((Math.max(max, chartGoal) * 1.1) / 10) * 10]} stroke="var(--c-text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<WeekTooltip unit={unit} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <ReferenceLine y={chartGoal} stroke="var(--c-text-muted)" strokeDasharray="4 4" />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map(d => {
                      const color = metric === 'protein' ? 'var(--mn-protein)' : d.value > chartGoal * 1.1 ? 'var(--c-accent)' : 'var(--c-primary)';
                      return <Cell key={d.key} fill={color} fillOpacity={d.key === date ? 1 : 0.55} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mn-stats">
              <div><strong>{onTarget}/7</strong><span>{tr('giorni nel budget ±10%')}</span></div>
              <div><strong>{proteinHit}/7</strong><span>{tr('giorni con proteine centrate')}</span></div>
            </div>
          </section>
        )}

        <section className="mn-panel">
          <div className="mn-panel-head">
            <h3>{tr('Da dove arrivano le calorie')}</h3>
          </div>
          <SplitBar label={tr('Tu')} split={macroSplit(totals)} />
          <SplitBar label={tr('Obiettivo')} split={goalSplit} />
          <div className="mn-legend">
            {MACROS.map(m => <span key={m.id}><i className={`is-${m.id}`} /> {m.label} {fmtInt(totals[m.id])} g</span>)}
          </div>
        </section>

        <section className="mn-panel">
          <div className="mn-panel-head">
            <h3>{tr('Qualità')}</h3>
            <span className="mn-panel-meta">{tr('riferimenti OMS/LARN')}</span>
          </div>
          <div className="mn-micros">
            {MICROS.map(m => {
              const v = totals[m.id];
              const ratio = v / m.ref;
              const status = m.kind === 'min' ? (ratio >= 1 ? 'is-good' : '') : (ratio > 1 ? 'is-bad' : '');
              return (
                <div key={m.id} className={`mn-micro ${status}`}>
                  <span>{m.label}</span>
                  <strong>{fmtDec(v)}<small> / {m.ref} g</small></strong>
                  <div className="mn-micro-track"><span style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
                  <em>{m.kind === 'min' ? tr('almeno') : tr('non oltre')}</em>
                </div>
              );
            })}
          </div>
        </section>

        {processing.known > 0 && (
          <section className="mn-panel">
            <div className="mn-panel-head">
              <h3>{tr('Lavorazione')}</h3>
              <span className="mn-panel-meta">{tr('prodotti confezionati')}</span>
            </div>
            <p className="mn-processing-big">
              <strong>{Math.round((processing.ultra / processing.known) * 100)}%</strong> {tr('delle kcal da ultra-processati')}
            </p>
            <div className="mn-split-bar mn-split-bar--processing">
              {[['minimal', processing.minimal], ['processed', processing.processed], ['ultra', processing.ultra]].map(([k, v]) => v > 0 && (
                <span key={k} className={`is-${k}`} style={{ width: `${(v / processing.known) * 100}%` }} />
              ))}
            </div>
            <div className="mn-legend">
              <span><i className="is-minimal" /> {tr('Poco lavorati')} {fmtInt(processing.minimal)} kcal</span>
              <span><i className="is-processed" /> {tr('Trasformati')} {fmtInt(processing.processed)} kcal</span>
              <span><i className="is-ultra" /> {tr('Ultra-processati')} {fmtInt(processing.ultra)} kcal</span>
            </div>
            {processing.unknown > 0 && (
              <p className="mn-hint">
                {tr('Calcolato sui prodotti con dati di lavorazione: {kcal} kcal (alimenti di base, pasti composti, inserimenti rapidi) restano fuori.', { kcal: fmtInt(processing.unknown) })}
              </p>
            )}
          </section>
        )}

        {view === 'day' && dayKcal > 0 && (
          <section className="mn-panel">
            <div className="mn-panel-head">
              <h3>{tr('Ritmo della giornata')}</h3>
              <span className="mn-panel-meta">{fmtInt(dayKcal)} kcal</span>
            </div>
            <div className="mn-split-bar mn-split-bar--meals">
              {byMeal.map(m => m.kcal > 0 && (
                <span key={m.id} style={{ width: `${(m.kcal / dayKcal) * 100}%`, opacity: MEAL_TONES[m.id] }} />
              ))}
            </div>
            <ul className="mn-meal-split">
              {byMeal.map(m => (
                <li key={m.id}>
                  <i style={{ opacity: MEAL_TONES[m.id] }} />
                  <span>{m.label}</span>
                  <strong>{Math.round((m.kcal / dayKcal) * 100)}%</strong>
                  <small>{fmtInt(m.kcal)} kcal · {fmtInt((sumNutrients(diary[date]?.[m.id] || []).protein))} g {tr('P')}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mn-hint mn-hint--center">{tr('{p} kcal per g di proteine e carboidrati, {f} per g di grassi.', { p: KCAL_PER_G.protein, f: KCAL_PER_G.fat })}</p>
      </div>
    </Sheet>
  );
}
