import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ChevronLeft, Flame, Trophy, Dumbbell, Info } from 'lucide-react';
import { calculateWeeklyStreak, getMondayOfWeek } from '../../utils/gamification';
import './Activity.css';

const ITALIAN_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Activity() {
  const navigate = useNavigate();
  const history = useStore(state => state.history || []);
  const currentYear = new Date().getFullYear();

  // Mappa dei workout per data 'YYYY-MM-DD'
  const workoutsByDate = useMemo(() => {
    const map = new Map();
    history.forEach(w => {
      const time = Number(w.startTime || w.endTime);
      if (!time) return;
      const key = formatDateKey(new Date(time));
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(w);
    });
    return map;
  }, [history]);

  // Calcolo streak a settimane aggiornato
  const streakInfo = useMemo(() => {
    return calculateWeeklyStreak(history);
  }, [history]);

  // Calcolo dinamico delle settimane (52-53) e della posizione dei mesi allineata alle colonne
  const { weeksGrid, monthsConfig } = useMemo(() => {
    const jan1 = new Date(currentYear, 0, 1);
    const dec31 = new Date(currentYear, 11, 31);
    const firstMonday = getMondayOfWeek(jan1);

    const weeks = [];
    const todayStr = formatDateKey(new Date());
    const nowTime = new Date().setHours(23, 59, 59, 999);
    let currentMonday = new Date(firstMonday.getTime());

    while (currentMonday <= dec31 || weeks.length < 52) {
      const days = [];

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const d = new Date(currentMonday.getTime() + dayOffset * 86400000);
        const inYear = d.getFullYear() === currentYear;
        const dateKey = formatDateKey(d);
        const workouts = inYear ? (workoutsByDate.get(dateKey) || []) : [];
        const isFuture = d.getTime() > nowTime;
        const isToday = dateKey === todayStr;

        days.push({
          dateKey,
          inYear,
          hasWorkout: workouts.length > 0,
          isFuture,
          isToday
        });
      }

      weeks.push(days);
      currentMonday = new Date(currentMonday.getTime() + 7 * 86400000);
      if (currentMonday.getFullYear() > currentYear && weeks.length >= 52) {
        break;
      }
    }

    const totalCols = weeks.length;

    // Calcolo esatto delle colonne iniziali di ciascun mese in base alla prima settimana in cui ricade
    const rawMonths = [];
    for (let m = 0; m < 12; m++) {
      const mDate = new Date(currentYear, m, 1);
      const mMonday = getMondayOfWeek(mDate);
      const startCol = Math.max(0, Math.round((mMonday - firstMonday) / (7 * 86400000)));
      rawMonths.push({ name: ITALIAN_MONTHS[m], startCol });
    }

    // Calcolo dello span su griglia CSS per ogni mese in modo da non sovrapporsi e non tagliarsi mai
    const months = rawMonths.map((m, idx) => {
      const nextCol = idx < rawMonths.length - 1 ? rawMonths[idx + 1].startCol : totalCols;
      const span = Math.max(1, nextCol - m.startCol);
      return {
        name: m.name,
        gridCol: m.startCol + 1,
        span
      };
    });

    return { weeksGrid: weeks, monthsConfig: months };
  }, [currentYear, workoutsByDate]);

  // Totale workout dell'anno corrente
  const yearWorkoutsCount = useMemo(() => {
    let count = 0;
    workoutsByDate.forEach((workouts, dateKey) => {
      if (dateKey.startsWith(`${currentYear}-`)) {
        count += workouts.length;
      }
    });
    return count;
  }, [workoutsByDate, currentYear]);

  // Sessions per week for the last 8 weeks (current week last)
  const lastWeeks = useMemo(() => {
    const thisMonday = getMondayOfWeek(new Date()).getTime();
    const weekMs = 7 * 86400000;
    return Array.from({ length: 8 }, (_, i) => {
      const start = thisMonday - (7 - i) * weekMs;
      const end = start + weekMs;
      const count = history.filter(w => {
        const t = Number(w.startTime || w.endTime);
        return t >= start && t < end;
      }).length;
      return { start, count, isCurrent: i === 7 };
    });
  }, [history]);

  return (
    <div className="ej-page ac-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="ac-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round ac-back" onClick={() => navigate(-1)} aria-label="Torna indietro">
          <ChevronLeft size={20} />
        </button>
        <h1 className="ac-title">Attività</h1>
      </header>

      {/* Streak hero */}
      <section className={`ej-card ac-hero ${streakInfo.currentStreak > 0 ? 'is-active' : ''}`}>
        <Flame size={34} className="ac-hero-flame" fill={streakInfo.currentStreak > 0 ? 'currentColor' : 'none'} />
        <p className="ac-hero-value">
          {streakInfo.currentStreak} <span>{streakInfo.currentStreak === 1 ? 'settimana' : 'settimane'}</span>
        </p>
        <p className="ac-hero-sub">Settimane consecutive con almeno un allenamento</p>
      </section>

      {/* Stats */}
      <div className="ac-stats">
        <div className="ej-card ac-stat">
          <span className="ac-stat-label"><Flame size={13} className="is-streak" /> Streak</span>
          <strong>{streakInfo.currentStreak} sett.</strong>
        </div>
        <div className="ej-card ac-stat">
          <span className="ac-stat-label"><Trophy size={13} className="is-xp" /> Record</span>
          <strong>{streakInfo.highestStreak} sett.</strong>
        </div>
        <div className="ej-card ac-stat">
          <span className="ac-stat-label"><Dumbbell size={13} className="is-primary" /> Workout</span>
          <strong>{yearWorkoutsCount}</strong>
        </div>
      </div>

      {/* Yearly heatmap */}
      <section className="ej-card ac-heatmap">
        <div className="ac-heatmap-head">
          <span className="ac-year">{currentYear}</span>
          <span className="ac-year-count">{yearWorkoutsCount} allenamenti</span>
        </div>

        <div className="ac-months" style={{ gridTemplateColumns: `repeat(${weeksGrid.length}, 1fr)` }}>
          {monthsConfig.map(m => (
            <span key={m.name} style={{ gridColumn: `${m.gridCol} / span ${m.span}` }}>{m.name}</span>
          ))}
        </div>

        <div className="ac-grid">
          {[0, 1, 2, 3, 4, 5, 6].map(dayRowIdx => (
            <div key={dayRowIdx} className="ac-grid-row" style={{ gridTemplateColumns: `repeat(${weeksGrid.length}, 1fr)` }}>
              {weeksGrid.map((week, weekIdx) => {
                const day = week[dayRowIdx];
                if (!day || !day.inYear) return <span key={weekIdx} className="ac-dot is-empty" />;
                let cls = 'ac-dot';
                if (day.hasWorkout) cls += ' is-workout';
                else if (day.isFuture) cls += ' is-future';
                else cls += ' is-rest';
                if (day.isToday) cls += ' is-today';
                return <span key={weekIdx} className={cls} />;
              })}
            </div>
          ))}
        </div>

        <div className="ac-legend">
          <span><i className="ac-dot is-rest" /> Riposo</span>
          <span><i className="ac-dot is-workout" /> Allenamento</span>
        </div>
      </section>

      {/* Last 8 weeks */}
      <section className="ej-card ac-weeks">
        <h3 className="ac-weeks-title">Ultime 8 settimane</h3>
        <div className="ac-weeks-row">
          {lastWeeks.map(w => (
            <div key={w.start} className="ac-week">
              <span
                className={`ac-week-box ${w.count > 0 ? 'has-workout' : ''} ${w.isCurrent ? 'is-current' : ''}`}
                style={w.count > 0 ? { '--week-alpha': Math.min(1, 0.3 + w.count * 0.2) } : undefined}
              >
                {w.count > 0 ? w.count : '–'}
              </span>
              <span className="ac-week-label">{new Date(w.start).toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' })}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="ej-card ac-guide">
        <h3 className="ac-guide-title"><Info size={15} /> Come funziona la streak a settimane?</h3>
        <p>
          Ogni settimana (Lun–Dom) in cui ti alleni almeno una volta aggiunge <strong>+1 alla streak</strong>. Più sessioni nella stessa settimana mantengono la streak attiva. Se passano <strong>7 giorni consecutivi</strong> dall'ultimo allenamento, la streak si azzera.
        </p>
      </section>
    </div>
  );
}
