import React, { useMemo, useState } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Minus, Plus, Scale, Trash2, Check, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { toDateKey, fromDateKey, shiftDateKey, fmtDec, weightTrend, weeklyRate } from '../../utils/nutrition';
import { Sheet } from './Sheet';
import { shiftWeightMonth, weightCalendarDays } from '../../utils/weightCalendar';

const RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1A', days: 365 },
  { id: 'all', label: 'Tutto', days: null },
];

const fmtAxisDate = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '');
const fmtLongDate = (key) => fromDateKey(key).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtSigned = (raw) => {
  const n = Math.round(raw * 10) / 10;
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtDec(Math.abs(n))}`;
};
const relDay = (key) => {
  const today = toDateKey();
  if (key === today) return 'Oggi';
  if (key === shiftDateKey(today, -1)) return 'Ieri';
  return fmtLongDate(key);
};

function WeightTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="pg-tooltip">
      <p className="pg-tooltip-date">{fmtLongDate(d.date)}</p>
      <p className="pg-tooltip-value">{fmtDec(d.kg)} kg</p>
      <p className="pg-tooltip-set">tendenza {fmtDec(d.trend)} kg</p>
    </div>
  );
}

function WeightCalendar({ value, max, onChange }) {
  const [month, setMonth] = useState(value.slice(0, 7));
  return <div className="mn-weight-calendar" id="weighin-date" aria-label="Calendario della pesata"><div className="mn-weight-calendar-head"><button type="button" className="ej-icon-btn" aria-label="Mese precedente per la pesata" onClick={() => setMonth(m => shiftWeightMonth(m, -1))}><ChevronLeft size={18} /></button><strong aria-live="polite">{fromDateKey(`${month}-01`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</strong><button type="button" className="ej-icon-btn" aria-label="Mese successivo per la pesata" disabled={month >= max.slice(0, 7)} onClick={() => setMonth(m => shiftWeightMonth(m, 1))}><ChevronRight size={18} /></button></div><div className="mn-weight-calendar-days">{['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, i) => <span key={`day-${i}`} aria-hidden="true">{day}</span>)}{weightCalendarDays(month).map((key, i) => key ? <button type="button" key={key} disabled={key > max} aria-pressed={key === value} aria-label={fromDateKey(key).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} onClick={() => onChange(key)}>{Number(key.slice(-2))}</button> : <span key={`blank-${i}`} />)}</div></div>;
}

// Registrazione della pesata: numero grande, ±100 g, giorno a scelta
export function WeighInSheet({ initialDate, onClose }) {
  const weightLog = useStore(state => state.weightLog || []);
  const addWeightEntry = useStore(state => state.addWeightEntry);
  const deleteWeightEntry = useStore(state => state.deleteWeightEntry);

  const today = toDateKey();
  const [date, setDate] = useState(initialDate || today);
  const existing = weightLog.find(e => e.date === date);
  const latest = weightLog[weightLog.length - 1];
  const [kg, setKg] = useState(existing?.kg ?? latest?.kg ?? 75);
  const [draft, setDraft] = useState(null);
  const [chooseDate, setChooseDate] = useState(false);

  const pickDate = (key) => {
    setDate(key);
    setDraft(null);
    const entry = weightLog.find(e => e.date === key);
    if (entry) setKg(entry.kg);
  };
  const bump = (d) => setKg(v => Math.round((v + d) * 10) / 10);
  const valid = kg > 20 && kg < 400 && date <= today;

  return (
    <Sheet
      title={existing ? 'Correggi la pesata' : 'Nuova pesata'}
      onClose={onClose}
      footer={(
        <div className="mn-detail-actions">
          {existing && (
            <button type="button" className="mn-btn-ghost-danger" aria-label="Elimina pesata"
              onClick={() => { deleteWeightEntry(date); onClose(); }}>
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className="mn-cta" disabled={!valid} onClick={() => { addWeightEntry(date, kg); onClose(); }}>
            Salva {fmtDec(kg)} kg
          </button>
        </div>
      )}
    >
      <div className="mn-weighin">
        <div className="mn-chips">
          <button type="button" className={`mn-chip ${date === today ? 'is-active' : ''}`} onClick={() => pickDate(today)}>Oggi</button>
          <button type="button" className={`mn-chip ${date === shiftDateKey(today, -1) ? 'is-active' : ''}`} onClick={() => pickDate(shiftDateKey(today, -1))}>Ieri</button>
          <button type="button" className={`mn-chip ${chooseDate || date < shiftDateKey(today, -1) ? 'is-active' : ''}`} onClick={() => setChooseDate(v => !v)} aria-expanded={chooseDate} aria-controls="weighin-date">
            <CalendarDays size={14} />Altro giorno
          </button>
        </div>
        {chooseDate && <WeightCalendar value={date} max={today} onChange={key => { pickDate(key); setChooseDate(false); }} />}
        <p className="mn-weighin-selected"><CalendarDays size={15} />{relDay(date)} · {fromDateKey(date).toLocaleDateString('it-IT')}</p>

        <div className="mn-stepper mn-stepper--big">
          <button type="button" onClick={() => bump(-0.1)} aria-label="Meno 100 grammi"><Minus size={22} /></button>
          <label className="mn-stepper-value">
            <input
              inputMode="decimal"
              value={draft ?? fmtDec(kg)}
              onChange={(e) => {
                setDraft(e.target.value);
                const n = parseFloat(e.target.value.replace(',', '.'));
                if (Number.isFinite(n)) setKg(Math.round(n * 10) / 10);
              }}
              onFocus={(e) => e.target.select()}
              onBlur={() => setDraft(null)}
              aria-label="Peso in kg"
            />
            <span>chilogrammi</span>
          </label>
          <button type="button" onClick={() => bump(0.1)} aria-label="Più 100 grammi"><Plus size={22} /></button>
        </div>
        <p className="mn-hint mn-hint--center">
          {existing ? `Avevi registrato ${fmtDec(existing.kg)} kg per questo giorno.` : 'Pesati al mattino, a digiuno e dopo il bagno: i dati sono più confrontabili.'}
        </p>
      </div>
    </Sheet>
  );
}

export function WeightTab() {
  const weightLog = useStore(state => state.weightLog || []);
  const goals = useStore(state => state.nutritionGoals);

  const today = toDateKey();
  const [range, setRange] = useState('3m');
  const [weighIn, setWeighIn] = useState(null); // data da registrare/correggere
  const [showAll, setShowAll] = useState(false);

  const trendLog = useMemo(() => weightTrend(weightLog), [weightLog]);
  const rate = useMemo(() => weeklyRate(trendLog), [trendLog]);
  const current = trendLog[trendLog.length - 1];
  const first = trendLog[0];
  const target = Number(goals.targetWeight) > 0 ? Number(goals.targetWeight) : null;
  const wantsDown = target ? target < (first?.kg ?? target) : (goals.weeklyGoal ?? 0) <= 0;

  const data = useMemo(() => {
    const days = RANGES.find(r => r.id === range)?.days;
    const from = days ? shiftDateKey(today, -days) : '';
    return trendLog.filter(e => e.date >= from).map(e => ({ ...e, time: fromDateKey(e.date).getTime() }));
  }, [trendLog, range, today]);

  const domain = useMemo(() => {
    const values = data.flatMap(d => [d.kg, d.trend]);
    if (target) values.push(target);
    if (!values.length) return ['auto', 'auto'];
    return [Math.floor(Math.min(...values) - 0.5), Math.ceil(Math.max(...values) + 0.5)];
  }, [data, target]);

  // Percorso dalla prima pesata all'obiettivo e data prevista al ritmo attuale
  let journey = null;
  if (current && first && target && first.kg !== target) {
    const pct = Math.min(1, Math.max(0, (first.kg - current.trend) / (first.kg - target)));
    let eta = null;
    if (rate && Math.abs(rate) >= 0.05 && Math.sign(target - current.trend) === Math.sign(rate)) {
      const weeks = (target - current.trend) / rate;
      if (weeks < 104) eta = fromDateKey(shiftDateKey(today, Math.round(weeks * 7)));
    }
    journey = { pct, eta, reached: Math.abs(current.trend - target) < 0.2 || pct >= 1 };
  }

  const rateGood = rate != null && (wantsDown ? rate <= 0 : rate >= 0);
  const list = [...weightLog].reverse();
  const todayEntry = weightLog.find(e => e.date === today);

  if (!current) {
    return (
      <>
        <section className="mn-wt-empty">
          <Scale size={34} />
          <h3>Inizia dal numero di oggi</h3>
          <p>Con qualche pesata a settimana calcolo il tuo peso di tendenza, che ignora le oscillazioni di acqua e sale, e il ritmo con cui ti muovi verso l'obiettivo.</p>
          <button type="button" className="mn-cta" onClick={() => setWeighIn(today)}>Registra la prima pesata</button>
        </section>
        {weighIn && <WeighInSheet initialDate={weighIn} onClose={() => setWeighIn(null)} />}
      </>
    );
  }

  return (
    <>
      <section className="mn-wt-hero">
        <div className="mn-wt-top">
          <div>
            <p className="mn-wt-big">{fmtDec(current.trend)}<small>kg</small></p>
            <p className="mn-wt-sub">peso di tendenza</p>
            <p className="mn-wt-rate">
              {rate != null ? (
                <span className={Math.abs(rate) < 0.05 ? '' : rateGood ? 'is-good' : 'is-bad'}>
                  {Math.abs(rate) < 0.05 ? 'stabile' : `${fmtSigned(rate)} kg a settimana`}
                </span>
              ) : 'ritmo in calcolo'}
            </p>
          </div>
          <button type="button" className="mn-wt-add" onClick={() => setWeighIn(today)}>
            {todayEntry ? <><Check size={16} /> Oggi</> : <><Plus size={16} /> Pesati</>}
          </button>
        </div>

        {journey && (
          <div className="mn-journey">
            <div className="mn-journey-track">
              <span style={{ width: `${journey.pct * 100}%` }} />
            </div>
            <p>
              {journey.reached
                ? 'Obiettivo raggiunto: aggiornalo per la prossima fase.'
                : <>Mancano <strong>{fmtDec(Math.abs(current.trend - target))} kg</strong> a {fmtDec(target)} kg</>}
              {!journey.reached && journey.eta && (
                <> · previsto il {journey.eta.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</>
              )}
            </p>
          </div>
        )}
      </section>

      <section className="mn-panel">
        <div className="mn-panel-head">
          <h3>Andamento</h3>
          <div className="mn-seg mn-seg--tiny">
            {RANGES.map(r => (
              <button key={r.id} type="button" className={range === r.id ? 'is-active' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
        {data.length === 0 ? (
          <p className="mn-empty">Nessuna pesata in questo periodo.</p>
        ) : (
          <>
            <div className="mn-chart">
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={data} margin={{ top: 10, right: 6, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mnTrendArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtAxisDate}
                    stroke="var(--c-text-dim)" fontSize={10} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis domain={domain} stroke="var(--c-text-dim)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<WeightTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                  {target && <ReferenceLine y={target} stroke="var(--c-success)" strokeDasharray="5 5" />}
                  <Area type="monotone" dataKey="trend" stroke="var(--c-primary)" strokeWidth={2.5} fill="url(#mnTrendArea)" dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="kg" stroke="transparent" isAnimationActive={false}
                    dot={{ r: 2.5, fill: 'var(--c-text-muted)', stroke: 'none' }} activeDot={{ r: 4, fill: 'var(--c-text)' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mn-hint">La linea è la tendenza, i punti sono le singole pesate.</p>
          </>
        )}
      </section>

      <section className="mn-panel">
        <div className="mn-panel-head">
          <h3>Pesate</h3>
          <span className="mn-panel-meta">{list.length}</span>
        </div>
        <ul className="mn-weighins">
          {(showAll ? list : list.slice(0, 4)).map((e, i) => {
            const prev = list[i + 1];
            const diff = prev ? e.kg - prev.kg : null;
            return (
              <li key={e.date}>
                <button type="button" onClick={() => setWeighIn(e.date)}>
                  <span className="mn-weighins-date">{relDay(e.date)}</span>
                  {diff != null && (
                    <span className={`mn-weighins-diff ${Math.abs(diff) < 0.05 ? '' : (diff < 0) === wantsDown ? 'is-good' : 'is-bad'}`}>{fmtSigned(diff)}</span>
                  )}
                  <strong>{fmtDec(e.kg)} kg</strong>
                </button>
              </li>
            );
          })}
        </ul>
        {list.length > 4 && (
          <button type="button" className="mn-link" onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Mostra meno' : `Mostra tutte (${list.length})`}
          </button>
        )}
      </section>

      {weighIn && <WeighInSheet initialDate={weighIn} onClose={() => setWeighIn(null)} />}
    </>
  );
}
