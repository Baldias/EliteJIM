import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ChevronLeft, Flame, Trophy, Dumbbell } from 'lucide-react';
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

  return (
    <div className="activity-page">
      {/* Header compatto con freccia indietro */}
      <header className="activity-page-header">
        <button
          type="button"
          className="activity-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Torna indietro"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="activity-page-title">Attività</h1>
      </header>

      <main className="activity-page-content">
        {/* Statistiche compatte - mai tagliate */}
        <div className="activity-stats-bar">
          <div className="activity-stat-pill streak-pill">
            <Flame size={16} className="stat-icon flame-icon" />
            <span className="stat-label">Streak:</span>
            <strong className="stat-val flame-val">
              {streakInfo.currentStreak} {streakInfo.currentStreak === 1 ? 'sett.' : 'sett.'}
            </strong>
          </div>

          <div className="activity-stat-pill">
            <Trophy size={15} className="stat-icon trophy-icon" />
            <span className="stat-label">Record:</span>
            <strong className="stat-val">{streakInfo.highestStreak} sett.</strong>
          </div>

          <div className="activity-stat-pill">
            <Dumbbell size={15} className="stat-icon dumbbell-icon" />
            <span className="stat-label">Workout:</span>
            <strong className="stat-val">{yearWorkoutsCount}</strong>
          </div>
        </div>

        {/* Heatmap dell'anno corrente (senza scroll, 100% integrata) */}
        <section className="activity-heatmap-card">
          <div className="activity-year-title">{currentYear}</div>

          {/* Intestazione mesi allineata colonna per colonna alla griglia sottostante */}
          <div
            className="activity-months-grid"
            style={{ gridTemplateColumns: `repeat(${weeksGrid.length}, 1fr)` }}
          >
            {monthsConfig.map(m => (
              <span
                key={m.name}
                className="activity-month-label"
                style={{
                  gridColumn: `${m.gridCol} / span ${m.span}`
                }}
              >
                {m.name}
              </span>
            ))}
          </div>

          {/* Griglia dei 7 giorni x settimane (senza scroll, puramente visiva) */}
          <div className="activity-grid-fit">
            {[0, 1, 2, 3, 4, 5, 6].map(dayRowIdx => (
              <div
                key={dayRowIdx}
                className="activity-fit-row"
                style={{ gridTemplateColumns: `repeat(${weeksGrid.length}, 1fr)` }}
              >
                {weeksGrid.map((week, weekIdx) => {
                  const day = week[dayRowIdx];
                  if (!day || !day.inYear) {
                    return <span key={weekIdx} className="activity-fit-dot dot-empty" />;
                  }

                  let dotClass = 'activity-fit-dot';
                  if (day.hasWorkout) {
                    dotClass += ' dot-workout';
                  } else if (day.isFuture) {
                    dotClass += ' dot-future';
                  } else {
                    dotClass += ' dot-rest';
                  }

                  if (day.isToday) {
                    dotClass += ' dot-today';
                  }

                  return <span key={weekIdx} className={dotClass} />;
                })}
              </div>
            ))}
          </div>

          {/* Legenda in basso a destra */}
          <div className="activity-inspo-legend">
            <div className="activity-legend-item">
              <span className="activity-legend-circle dot-rest" />
              <span className="activity-legend-label">Riposo</span>
            </div>
            <div className="activity-legend-item">
              <span className="activity-legend-circle dot-workout" />
              <span className="activity-legend-label">Allenamento</span>
            </div>
          </div>
        </section>

        {/* Mini-Tutorial in basso */}
        <div className="settings-guide-box activity-tutorial-box">
          <p className="settings-guide-title">
            <Flame size={15} />
            <span>Come funziona la streak a settimane?</span>
          </p>
          <p className="settings-guide-text">
            Ogni settimana (Lun–Dom) in cui ti alleni almeno una volta aggiunge <strong>+1 alla streak</strong>. Più sessioni nella stessa settimana mantengono la streak attiva. Se passano <strong>7 giorni consecutivi</strong> dall'ultimo allenamento, la streak si azzera.
          </p>
        </div>
      </main>
    </div>
  );
}
