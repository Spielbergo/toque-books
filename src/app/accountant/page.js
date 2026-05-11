'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatCurrency } from '@/lib/formatters';
import { calculateCorporateTax, calculateHSTSummary, getDeductibleAmount } from '@/lib/taxCalculations';
import styles from './page.module.css';

export default function AccountantPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    const email = user.email.toLowerCase().trim();
    getDocs(
      query(collection(db, 'companies'), where('accountantEmails', 'array-contains', email))
    ).then(snap => {
      const list = snap.docs.map(doc => {
        const d = doc.data();
        return { id: doc.id, name: d.name, ownerUid: d.userId, updatedAt: d.updatedAt, data: d.data };
      });
      setCompanies(list);
      if (list.length) setSelectedId(list[0].id);
    }).catch(e => setError(e.message))
    .finally(() => setLoading(false));
  }, [user]);

  const selected = companies.find(c => c.id === selectedId);

  if (!user) {
    return <div className={styles.page}><p className={styles.empty}>You must be signed in to access this page.</p></div>;
  }

  if (loading) {
    return <div className={styles.page}><p className={styles.empty}>Loading shared companies…</p></div>;
  }

  if (error) {
    return <div className={styles.page}><p className={styles.empty}>Error: {error}</p></div>;
  }

  if (!companies.length) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Accountant View</h1>
          <p className={styles.sub}>No companies have granted you access yet.</p>
        </div>
        <div className={styles.emptyCard}>
          <p>Ask your client to go to <strong>Settings → Access</strong> and add your email address (<strong>{user.email}</strong>).</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Accountant View</h1>
          <p className={styles.sub}>Read-only access to client companies shared with {user.email}</p>
        </div>
      </div>

      {/* Company selector */}
      {companies.length > 1 && (
        <div className={styles.selectorRow}>
          <label className={styles.selectorLabel}>Client Company:</label>
          <select
            className={styles.selector}
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {selected && <CompanyReadout company={selected} />}
    </div>
  );
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  // Firestore Timestamp has .toDate(), plain JS Date/string also handled
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-CA');
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function CompanyReadout({ company }) {
  const d = company.data || {};
  const settings     = d.settings || {};
  const businessType = d.businessType || 'ccpc';
  const province     = settings.province || 'ON';

  // Latest FY first (same order as sidebar)
  const allFyKeys = Object.keys(d.fiscalYears || {}).sort().reverse();
  const [selectedFY, setSelectedFY] = useState(allFyKeys[0] || null);
  const fy = selectedFY ? d.fiscalYears[selectedFY] : null;

  // Same approach as taxes page: flatMap ALL FY buckets, filter by selected FY date range
  const { startDate, endDate } = fy || {};
  const inRange = date => !date || ((!startDate || date >= startDate) && (!endDate || date <= endDate));

  const allInvoices = Object.values(d.fiscalYears || {}).flatMap(f => f.invoices || []);
  const allExpenses = Object.values(d.fiscalYears || {}).flatMap(f => f.expenses || []);

  const fyInvoices = allInvoices.filter(inv => inRange(inv.issueDate));
  const fyExpenses = allExpenses
    .filter(exp => inRange(exp.date))
    .filter(exp => !(exp.notes && exp.notes.startsWith('Mileage log auto-calculated')));

  // Revenue — subtotal (pre-HST) for paid/sent invoices
  const grossRevenue = fyInvoices
    .filter(i => i.status === 'paid' || i.status === 'sent')
    .reduce((s, i) => s + (i.subtotal || 0), 0);

  // Expenses — flat array, apply deductible %
  const totalDeductibleExp = fyExpenses.reduce((s, exp) =>
    s + getDeductibleAmount(exp.amount || 0, exp.category, exp.businessUsePercent ?? 100), 0);

  const grossProfit = grossRevenue - totalDeductibleExp;

  // Tax estimate
  let taxInfo = null;
  if (businessType === 'ccpc' || businessType === 'pc') {
    try { taxInfo = calculateCorporateTax(grossRevenue, totalDeductibleExp, province); } catch (_) {}
  }

  // HST — scoped to selected FY date range
  let hstInfo = null;
  try {
    hstInfo = calculateHSTSummary(fyInvoices, fyExpenses);
  } catch (_) {}

  const employees    = d.employees || [];
  const t4aRecs      = d.t4aRecipients || [];
  const clients      = d.clients || [];

  function exportInvoicesCSV() {
    const rows = [
      ['Invoice #', 'Client', 'Issue Date', 'Status', 'Subtotal', 'HST', 'Total'],
      ...(fy?.invoices || []).map(inv => [
        inv.invoiceNumber || inv.id,
        inv.clientName || '',
        inv.issueDate || '',
        inv.status || '',
        inv.subtotal ?? '',
        inv.hstAmount ?? '',
        inv.total ?? '',
      ]),
    ];
    downloadCSV(`${company.name}_${selectedFY}_invoices.csv`, rows);
  }

  function exportExpensesCSV() {
    const rows = [
      ['Date', 'Description', 'Category', 'Amount', 'HST', 'Business Use %', 'Deductible Amount'],
      ...fyExpenses.map(exp => [
        exp.date || '',
        exp.description || '',
        exp.category || '',
        exp.amount ?? '',
        exp.hst ?? '',
        exp.businessUsePercent ?? 100,
        getDeductibleAmount(exp.amount || 0, exp.category, exp.businessUsePercent ?? 100).toFixed(2),
      ]),
    ];
    downloadCSV(`${company.name}_${selectedFY}_expenses.csv`, rows);
  }

  return (
    <div className={styles.readout}>
      {/* Company info */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{company.name}</h2>
        <div className={styles.metaGrid}>
          <Pair label="Province"      value={province} />
          <Pair label="Business Type" value={businessType.toUpperCase()} />
          <Pair label="HST Number"    value={settings.hstNumber || '—'} />
          <Pair label="Business #"    value={settings.businessNumber || '—'} />
          <Pair label="Last Updated"  value={formatTimestamp(company.updatedAt)} />
        </div>
      </div>

      {/* FY selector + export */}
      <div className={styles.fyRow}>
        <div className={styles.fyBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <select className={styles.fyBadgeSelect} value={selectedFY || ''} onChange={e => setSelectedFY(e.target.value)}>
            {allFyKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className={styles.exportBtns}>
          <button className={styles.exportBtn} onClick={exportInvoicesCSV} disabled={!fy}>Export Invoices CSV</button>
          <button className={styles.exportBtn} onClick={exportExpensesCSV} disabled={!fy}>Export Expenses CSV</button>
        </div>
      </div>

      {/* P&L */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Income &amp; Expenses — {selectedFY || '—'}</h3>
        <div className={styles.metaGrid}>
          <Pair label="Revenue (excl. HST)"  value={formatCurrency(grossRevenue)} highlight />
          <Pair label="Deductible Expenses"  value={formatCurrency(totalDeductibleExp)} />
          <Pair label="Gross Profit"         value={formatCurrency(grossProfit)} highlight />
        </div>
      </div>

      {/* Tax */}
      {taxInfo && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Estimated Corporate Tax</h3>
          <div className={styles.metaGrid}>
            <Pair label="Net Income"       value={formatCurrency(taxInfo.netIncome)} />
            <Pair label="Federal Tax"      value={formatCurrency(taxInfo.fedTax)} />
            <Pair label="Provincial Tax"   value={formatCurrency(taxInfo.provTax)} />
            <Pair label="Total Tax Est."   value={formatCurrency(taxInfo.totalTax)} highlight />
            <Pair label="Effective Rate"   value={taxInfo.effectiveRate != null ? `${(taxInfo.effectiveRate * 100).toFixed(1)}%` : '—'} />
          </div>
        </div>
      )}

      {/* HST */}
      {hstInfo && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>HST Summary — {selectedFY || '—'}</h3>
          <div className={styles.metaGrid}>
            <Pair label="HST Collected"   value={formatCurrency(hstInfo.hstCollected)} />
            <Pair label="ITCs (HST Paid)" value={formatCurrency(hstInfo.itcTotal)} />
            <Pair label="Net HST Owing"   value={formatCurrency(hstInfo.netRemittance)} highlight />
          </div>
        </div>
      )}

      {/* Staff */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Staff &amp; Contractors</h3>
        <div className={styles.metaGrid}>
          <Pair label="Employees"      value={employees.length} />
          <Pair label="T4A Recipients" value={t4aRecs.length} />
          <Pair label="Clients"        value={clients.length} />
        </div>
        {t4aRecs.length > 0 && (
          <div className={styles.subList}>
            {t4aRecs.map((r, i) => (
              <div key={i} className={styles.subItem}>
                <span>{r.name}</span>
                <span>{r.taxYear}</span>
                <span>{r.box048 > 0 ? `Box 048: ${formatCurrency(r.box048)}` : r.box020 > 0 ? `Box 020: ${formatCurrency(r.box020)}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className={styles.disclaimer}>Read-only view. Data as of last sync. Contact your client for any updates.</p>
    </div>
  );
}

function Pair({ label, value, highlight }) {
  return (
    <div className={styles.pair}>
      <span className={styles.pairLabel}>{label}</span>
      <span className={`${styles.pairValue} ${highlight ? styles.pairHighlight : ''}`}>{value ?? '—'}</span>
    </div>
  );
}
