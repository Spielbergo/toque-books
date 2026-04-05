/**
 * Returns the fiscal year label (e.g. "FY2024-25") whose startDate/endDate
 * range contains the given date string (YYYY-MM-DD).
 * Returns null if no fiscal year matches.
 */
export function fyLabelForDate(dateStr, fiscalYears) {
  if (!dateStr) return null;
  const entry = Object.entries(fiscalYears || {}).find(
    ([, fy]) => fy.startDate && fy.endDate && dateStr >= fy.startDate && dateStr <= fy.endDate
  );
  return entry?.[0] ?? null;
}
