import { fromDateKey, toDateKey } from './nutrition';

export function weightCalendarDays(month) {
  const first = fromDateKey(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => toDateKey(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
}
export function shiftWeightMonth(month, change) {
  const date = fromDateKey(`${month}-01`);
  date.setMonth(date.getMonth() + change);
  return toDateKey(date).slice(0, 7);
}
