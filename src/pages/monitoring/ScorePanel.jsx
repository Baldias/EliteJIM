import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, ChevronDown, Loader2, ArrowUpRight } from 'lucide-react';
import { searchAlternatives } from '../../utils/foodApi';
import { athleteScore } from '../../utils/athleteScore';
import { fmtInt } from '../../utils/nutrition';
import { MacroStrip } from './Fuel';
import './ScorePanel.css';
import { tr } from '../../i18n';

// Numero del voto in un cerchio colorato per fascia
export function ScoreBadge({ result, size = 'md' }) {
  if (!result) return null;
  return (
    <span className={`mn-score is-${result.level.id} is-${size}`} title={`${tr(tr('Voto atleta'))} ${result.score}/100 · ${result.level.label}`}>
      {result.score}
    </span>
  );
}

// Voto atleta nel dettaglio di un prodotto: fascia, motivi e come si calcola
export function ScorePanel({ result }) {
  const [open, setOpen] = useState(false);
  if (!result) return null;
  return (
    <section className={`mn-score-panel is-${result.level.id}`}>
      <div className="mn-score-head">
        <ScoreBadge result={result} size="lg" />
        <div>
          <p className="mn-score-title">{tr('Voto atleta')}</p>
          <p className="mn-score-level">{result.level.label}{result.partial && <small> · {tr('dati parziali')}</small>}</p>
        </div>
      </div>
      {(result.pros.length > 0 || result.cons.length > 0) && (
        <ul className="mn-score-reasons">
          {result.pros.map(t => <li key={t} className="is-pro"><Check size={14} />{t}</li>)}
          {result.cons.map(t => <li key={t} className="is-con"><AlertCircle size={14} />{t}</li>)}
        </ul>
      )}
      <button type="button" className={`mn-facts-toggle ${open ? 'is-open' : ''}`} onClick={() => setOpen(o => !o)}>
        {tr('Come si calcola')} <ChevronDown size={16} />
      </button>
      {open && (
        <div className="mn-score-parts">
          {result.parts.map(p => (
            <div key={p.id}>
              <div className="mn-score-part-head">
                <span>{p.label}</span>
                <strong>{fmtInt(p.value)}/{p.max}</strong>
              </div>
              <div className="mn-score-track"><i style={{ width: `${(p.value / p.max) * 100}%` }} /></div>
              <small>{p.note}</small>
            </div>
          ))}
          <p className="mn-hint">
            {tr("Dati di Open Food Facts; additivi secondo le valutazioni EFSA. Un'indicazione per scegliere tra prodotti simili, non un consiglio medico.")}
          </p>
        </div>
      )}
    </section>
  );
}

// Prodotti della stessa categoria con voto più alto
export function BetterAlternatives({ food, result, onPick }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });

  useEffect(() => {
    const ctrl = new AbortController();
    searchAlternatives(food, { signal: ctrl.signal })
      .then(list => {
        const items = list
          .map(f => ({ food: f, result: athleteScore(f) }))
          .filter(x => x.result && x.result.score >= result.score + 5)
          .sort((a, b) => b.result.score - a.result.score)
          .slice(0, 5);
        setState({ loading: false, items, error: '' });
      })
      .catch(err => {
        if (err.name !== 'AbortError') setState({ loading: false, items: [], error: tr('Alternative non disponibili al momento.') });
      });
    return () => ctrl.abort();
  }, [food, result.score]);

  if (!state.loading && !state.error && state.items.length === 0) return null;

  return (
    <section className="mn-alternatives">
      <h3 className="mn-label">
        {tr('Alternative migliori')} {state.loading && <Loader2 size={13} className="mn-spin" />}
      </h3>
      {state.error && <p className="mn-hint">{state.error}</p>}
      <ul>
        {state.items.map(({ food: f, result: r }) => (
          <li key={f.id}>
            <button type="button" className="mn-alt" onClick={() => onPick(f)}>
              <ScoreBadge result={r} size="sm" />
              <span className="mn-alt-text">
                <strong>{f.name}</strong>
                <span><MacroStrip per100={f.per100} />{[f.brand, `${fmtInt(f.per100.kcal)} kcal/100 g`].filter(Boolean).join(' · ')}</span>
              </span>
              <ArrowUpRight size={16} className="mn-alt-go" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
