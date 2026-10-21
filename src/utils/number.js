/**
 * Sanitizes a decimal typed by the user (e.g. kg).
 * Accepts the Italian decimal comma ("82,5" → "82.5"), drops any other
 * character and keeps only the first decimal separator.
 */
export const sanitizeDecimalInput = (value) => {
  const cleaned = String(value ?? '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
};

/**
 * Parses a non-negative integer (e.g. rest time in seconds).
 * Unlike `parseInt(v) || fallback`, a legitimate 0 is preserved.
 */
export const parseNonNegativeInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
