import React from 'react';
import { KCAL_PER_G, MACROS, fmtInt } from '../../utils/nutrition';
import './Fuel.css';
import { tr } from '../../i18n';

// Barra "carburante": le kcal assunte, divise per macro, rispetto al budget
// del giorno. `preview` (facoltativo) mostra in trasparenza l'alimento che
// si sta per aggiungere; oltre il budget la barra si allunga e compare la tacca.
export function FuelBar({ totals, budget, preview, height = 14 }) {
  const segments = [];
  const push = (values, isPreview) => {
    const macroKcal = MACROS.reduce((a, m) => a + (values[m.id] || 0) * KCAL_PER_G[m.id], 0);
    // le kcal dichiarate possono differire dalla somma dei macro (fibre, alcol, arrotondamenti)
    const scale = macroKcal > 0 ? (values.kcal || macroKcal) / macroKcal : 0;
    for (const m of MACROS) {
      const kcal = (values[m.id] || 0) * KCAL_PER_G[m.id] * scale;
      if (kcal > 0) segments.push({ key: `${m.id}-${isPreview ? 'p' : 'n'}`, macro: m.id, kcal, isPreview });
    }
  };
  push(totals, false);
  if (preview) push(preview, true);

  const used = segments.reduce((a, s) => a + s.kcal, 0);
  const full = Math.max(budget, used, 1);

  return (
    <div className="mn-fuel" style={{ height }}>
      <div className="mn-fuel-track">
        {segments.map(s => (
          <span
            key={s.key}
            className={`mn-fuel-seg is-${s.macro} ${s.isPreview ? 'is-preview' : ''}`}
            style={{ width: `${(s.kcal / full) * 100}%` }}
          />
        ))}
      </div>
      {used > budget && budget > 0 && (
        <i className="mn-fuel-mark" style={{ left: `${(budget / full) * 100}%` }} aria-hidden="true" />
      )}
    </div>
  );
}

// Avanzamento di un singolo macro in grammi, con anteprima facoltativa
export function MacroMeter({ macro, value, goal, preview = 0, featured = false }) {
  const info = MACROS.find(m => m.id === macro);
  const full = Math.max(goal, value + preview, 1);
  const left = Math.round(goal - value - preview);
  return (
    <div className={`mn-meter is-${macro} ${featured ? 'is-featured' : ''}`}>
      <div className="mn-meter-head">
        <span className="mn-meter-label">{info.label}</span>
        <span className="mn-meter-value">
          <strong>{fmtInt(value + preview)}</strong>/{fmtInt(goal)} g
        </span>
      </div>
      <div className="mn-meter-track">
        <span style={{ width: `${(value / full) * 100}%` }} />
        {preview > 0 && <span className="is-preview" style={{ width: `${(preview / full) * 100}%` }} />}
      </div>
      {featured && (
        <p className="mn-meter-note">
          {left > 0 ? tr('Ne mancano {g} g per l\'obiettivo', { g: fmtInt(left) }) : tr('Obiettivo proteico raggiunto')}
        </p>
      )}
    </div>
  );
}

// Mini barra della composizione di un alimento (quota di kcal per macro)
export function MacroStrip({ per100 }) {
  const parts = MACROS.map(m => ({ id: m.id, kcal: (per100?.[m.id] || 0) * KCAL_PER_G[m.id] }));
  const tot = parts.reduce((a, p) => a + p.kcal, 0);
  if (tot <= 0) return <span className="mn-strip is-empty" />;
  return (
    <span className="mn-strip" aria-hidden="true">
      {parts.map(p => p.kcal > 0 && <span key={p.id} className={`is-${p.id}`} style={{ width: `${(p.kcal / tot) * 100}%` }} />)}
    </span>
  );
}
