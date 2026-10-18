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

