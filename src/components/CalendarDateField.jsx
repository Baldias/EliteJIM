import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fromDateKey } from '../utils/nutrition';
import { shiftWeightMonth, weightCalendarDays } from '../utils/weightCalendar';
import './CalendarDateField.css';

// App-owned calendar works with past and future dates, including embedded browsers.
export default function CalendarDateField({ value, onChange, max }) {
  const [month, setMonth] = useState(value.slice(0, 7));
  return <div className="calendar-date-field"><div className="calendar-date-head"><button type="button" className="ej-icon-btn" aria-label="Mese precedente" onClick={() => setMonth(m => shiftWeightMonth(m, -1))}><ChevronLeft size={18} /></button><span aria-live="polite">{fromDateKey(`${month}-01`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</span><button type="button" className="ej-icon-btn" aria-label="Mese successivo" disabled={Boolean(max && month >= max.slice(0, 7))} onClick={() => setMonth(m => shiftWeightMonth(m, 1))}><ChevronRight size={18} /></button></div><div className="calendar-date-grid">{['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, i) => <span key={`weekday-${i}`} aria-hidden="true">{day}</span>)}{weightCalendarDays(month).map((date, i) => date ? <button type="button" key={date} disabled={Boolean(max && date > max)} aria-pressed={date === value} aria-label={fromDateKey(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} onClick={() => onChange(date)}>{Number(date.slice(-2))}</button> : <span key={`blank-${i}`} />)}</div><p aria-live="polite">Partenza: <strong>{fromDateKey(value).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p></div>;
}
