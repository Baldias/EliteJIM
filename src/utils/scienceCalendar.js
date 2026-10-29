const addDays = (time, days) => {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.getTime();
};

export function scienceProgramWeekRange(program, week = program.currentWeek) {
  const saved = program.weeks?.find(w => w.week === week);
  if (saved) return { start: saved.start, end: saved.end };
  const current = program.weekStarts?.[program.currentWeek] ?? addDays(program.startDate, (program.currentWeek - 1) * 7);
  const start = program.weekStarts?.[week] ?? addDays(current, (week - program.currentWeek) * 7);
  return { start, end: addDays(start, 7) };
}

export function projectedScienceWeekRange(program, week, now) {
  if (week <= program.currentWeek || program.weekStarts?.[week] != null) return scienceProgramWeekRange(program, week);
  const end = Math.max(scienceProgramWeekRange(program).end, now);
  const start = addDays(end, (week - program.currentWeek - 1) * 7);
  return { start, end: addDays(start, 7) };
}

const dayNumber = time => {
  const d = new Date(time);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
};
export function scienceWeekTiming(program, now) {
  const range = scienceProgramWeekRange(program);
  const overdue = now >= range.end;
  const days = Math.max(0, dayNumber(range.end) - dayNumber(now));
  const lateDays = Math.max(0, dayNumber(now) - dayNumber(range.end));
  const label = now < range.start ? `Inizia tra ${Math.max(0, dayNumber(range.start) - dayNumber(now))} giorni` : overdue ? lateDays ? `In ritardo di ${lateDays} ${lateDays === 1 ? 'giorno' : 'giorni'}` : 'Settimana scaduta oggi' : days === 0 ? 'Termina oggi' : `Termina tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`;
  return { ...range, overdue, days, lateDays, label };
}

// Count remaining whole minutes without showing zero before the actual deadline.
export function scienceCountdown(end, now) {
  const minutesLeft = Math.max(0, Math.ceil((end - now) / 60000));
  return { days: Math.floor(minutesLeft / 1440), hours: Math.floor(minutesLeft % 1440 / 60), minutes: minutesLeft % 60 };
}
