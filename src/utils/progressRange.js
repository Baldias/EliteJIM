// Time windows for the progress chart of a single exercise
export const EXERCISE_RANGES = [
  { id: '1m', label: '1M', months: 1, period: 'ultimo mese' },
  { id: '3m', label: '3M', months: 3, period: 'ultimi 3 mesi' },
  { id: '6m', label: '6M', months: 6, period: 'ultimi 6 mesi' },
  { id: '1y', label: '1A', months: 12, period: 'ultimo anno' },
  { id: 'max', label: 'Max', months: null, period: 'da sempre' },
];

// First timestamp included in the window ending at `now` (-Infinity for "Max")
export function rangeStart(rangeId, now) {
  const months = EXERCISE_RANGES.find(r => r.id === rangeId)?.months;
  if (!months) return -Infinity;
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

/**
 * Percentage change between the start and the end of a series, smoothed:
 * the mean of the first `size` values against the mean of the last `size`,
 * so a single good or bad day does not decide the result. With fewer than
 * 2 × size values the two groups shrink to stay separate (2-3 values → first vs last).
 */
export function smoothedChange(values, size = 3) {
  const list = (values || []).filter(Number.isFinite);
  if (list.length < 2) return null;
  const k = Math.min(size, Math.floor(list.length / 2));
  const mean = arr => arr.reduce((a, v) => a + v, 0) / arr.length;
  const start = mean(list.slice(0, k));
  const end = mean(list.slice(-k));
  if (!(start > 0)) return null;
  return { pct: ((end - start) / start) * 100, start, end, k };
}
