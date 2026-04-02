// Formatting utilities

export function formatCurrency(amount, opts = {}) {
  const { showCents = true, compact = false } = opts;
  if (amount == null || isNaN(amount)) return '$0.00';
  
  if (compact && Math.abs(amount) >= 1000) {
    const k = amount / 1000;
    return `$${k.toFixed(1)}k`;
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}

export function formatPercent(value, decimals = 1) {
  if (value == null || isNaN(value)) return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '';
  const { style = 'medium' } = opts;
  const d = new Date(dateStr + 'T00:00:00'); // avoid TZ shifts
  if (isNaN(d.getTime())) return dateStr;

  if (style === 'short') {
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }
  if (style === 'full') {
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateISO(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function isOverdue(dueDateStr) {
  if (!dueDateStr) return false;
  return dueDateStr < today();
}

export function truncate(str, max = 40) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function titleCase(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
