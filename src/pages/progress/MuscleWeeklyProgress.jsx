import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { progressRange, weeklyMuscleProgress } from '../../utils/muscleProgress';
import { localScienceDate } from '../../utils/sciencePlanning';

const dateLabel = time => new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' });

export default function MuscleWeeklyProgress({ muscle, history, db, science }) {
  const [period, setPeriod] = useState('3');
  const [now] = useState(() => Date.now());
  const [customStart, setCustomStart] = useState(() => localScienceDate(progressRange('1', history, now).start));
  const [customEnd, setCustomEnd] = useState(() => localScienceDate(now));
  const range = useMemo(() => progressRange(period, history, now, customStart, customEnd), [period, history, now, customStart, customEnd]);
  const stats = useMemo(() => weeklyMuscleProgress(history, db, science, muscle, range), [history, db, science, muscle, range]);
  return <section className="ej-card pg-weekly">
    <div className="pg-weekly-heading"><div><p className="pg-kicker">{muscle}</p><h2>Serie settimanali</h2></div>
    </div>
    <div className="pg-periods" role="group" aria-label="Intervallo dello storico serie">
      {[['3', '3 mesi'], ['6', '6 mesi'], ['12', '1 anno'], ['all', 'Max'], ['custom', 'Personalizzato']].map(([value, label]) => (
        <button type="button" key={value} aria-pressed={period === value} className={`pg-period-btn ${period === value ? 'is-active' : ''}`} onClick={() => setPeriod(value)}>{label}</button>
      ))}
    </div>
    {period === 'custom' && <div className="pg-date-range">
      <label>Dal<input type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)} /></label>
      <label>Al<input type="date" value={customEnd} min={customStart} max={localScienceDate(now)} onChange={e => setCustomEnd(e.target.value)} /></label>
    </div>}
    {!range ? <p role="status">Scegli un intervallo di date valido.</p> : <>
      <div className="pg-insights">
        {[['Media serie / settimana', stats.average.toLocaleString('it-IT', { maximumFractionDigits: 1 })], ['Serie totali', stats.total], ['Massimo settimanale', stats.best]].map(([label, value]) => <div className="pg-insight" key={label}><span className="pg-insight-value">{value}</span><span className="pg-insight-label">{label}</span></div>)}
      </div>
      <div className="pg-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.weeks} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
            <XAxis dataKey="time" tickFormatter={dateLabel} fontSize={10} stroke="var(--c-text-dim)" minTickGap={28} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={10} stroke="var(--c-text-dim)" tickLine={false} axisLine={false} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="pg-tooltip"><p className="pg-tooltip-date">Settimana del {dateLabel(payload[0].payload.time)}</p><p className="pg-tooltip-value">{payload[0].value} serie</p></div> : null} cursor={{ fill: 'var(--c-surface-2)' }} />
            <Bar dataKey="sets" fill="var(--c-primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {stats.total === 0 && <p className="pg-hero-note">Nessuna serie completata in questo intervallo.</p>}
      <p className="pg-hero-note">{stats.activeWeeks} settimane attive su {stats.weeks.length}. Media sulle settimane coperte dallo storico: incluse le settimane vuote tra gli allenamenti e quelle parziali. Serie dirette completate, anche senza RIR; esclusi riscaldamento, dropset e rest-pause.</p>
    </>}
  </section>;
}
