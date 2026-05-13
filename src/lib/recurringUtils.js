/**
 * Expands recurring expense definitions into discrete expense occurrences
 * that fall within a given fiscal year date range.
 *
 * @param {Array}  recurringList  - state.recurringExpenses
 * @param {string} fyStart        - 'YYYY-MM-DD' inclusive start
 * @param {string} fyEnd          - 'YYYY-MM-DD' inclusive end
 * @returns {Array} synthetic expense objects (one per occurrence)
 */
export function expandRecurringForFY(recurringList, fyStart, fyEnd) {
  if (!fyStart || !fyEnd || !recurringList?.length) return [];

  const result = [];

  for (const rec of recurringList) {
    if (!rec.startDate) continue;

    const recEffEnd = rec.endDate || '9999-12-31';

    // Quick overlap check — skip if no overlap with this FY
    if (rec.startDate > fyEnd || recEffEnd < fyStart) continue;

    // Start walking from rec.startDate
    let cur = new Date(rec.startDate + 'T12:00:00');
    const fyStartDt = new Date(fyStart + 'T12:00:00');

    // Fast-forward to first occurrence on or after fyStart
    if (cur < fyStartDt) {
      const [sy, sm] = rec.startDate.split('-').map(Number);
      const [fy, fm] = fyStart.split('-').map(Number);

      let stepsToSkip = 0;
      if (rec.frequency === 'monthly') {
        stepsToSkip = Math.max(0, (fy - sy) * 12 + (fm - sm) - 1);
        cur.setMonth(cur.getMonth() + stepsToSkip);
      } else if (rec.frequency === 'quarterly') {
        stepsToSkip = Math.max(0, Math.floor(((fy - sy) * 12 + (fm - sm)) / 3) - 1);
        cur.setMonth(cur.getMonth() + stepsToSkip * 3);
      } else {
        // annual
        stepsToSkip = Math.max(0, fy - sy - 1);
        cur.setFullYear(cur.getFullYear() + stepsToSkip);
      }

      // Fine-step until on or after fyStart
      while (cur < fyStartDt) {
        if (rec.frequency === 'monthly') cur.setMonth(cur.getMonth() + 1);
        else if (rec.frequency === 'quarterly') cur.setMonth(cur.getMonth() + 3);
        else cur.setFullYear(cur.getFullYear() + 1);
      }
    }

    // Emit one synthetic expense per occurrence within [fyStart, fyEnd]
    while (true) {
      const dateStr = cur.toISOString().split('T')[0];
      if (dateStr > fyEnd || dateStr > recEffEnd) break;

      result.push({
        id: `recurring-${rec.id}-${dateStr}`,
        date: dateStr,
        category: rec.category,
        vendor: rec.vendor || '',
        description: rec.description || rec.vendor || '',
        amount: parseFloat(rec.amount) || 0,
        hst: parseFloat(rec.hst) || 0,
        businessUsePercent: rec.businessUsePercent ?? 100,
        isRecurring: true,
        recurringId: rec.id,
      });

      if (rec.frequency === 'monthly') cur.setMonth(cur.getMonth() + 1);
      else if (rec.frequency === 'quarterly') cur.setMonth(cur.getMonth() + 3);
      else cur.setFullYear(cur.getFullYear() + 1);
    }
  }

  return result;
}
