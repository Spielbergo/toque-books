'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatCurrency } from '@/lib/formatters';
import { calculateCorporateTax, calculateHSTSummary } from '@/lib/taxCalculations';
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

function CompanyReadout({ company }) {
  const d = company.data || {};
  const settings     = d.settings || {};
  const businessType = d.businessType || 'ccpc';
  const province     = settings.province || 'ON';
  const fyKeys       = Object.keys(d.fiscalYears || {});
  const latestFyKey  = fyKeys.sort().at(-1);
  const fy           = latestFyKey ? d.fiscalYears[latestFyKey] : null;

  // Basic P&L
  const invoiceTotal = (fy?.invoices || [])
    .filter(i => i.status === 'paid' || i.status === 'sent')
    .reduce((s, i) => s + (i.total || 0), 0);
  const expenseTotal = Object.values(fy?.expenses || {})
    .flat()
    .reduce((s, e) => s + (e.amount || 0), 0);
  const grossProfit  = invoiceTotal - expenseTotal;

  // Tax estimate
  let taxInfo = null;
  if (businessType === 'ccpc' || businessType === 'pc') {
    try { taxInfo = calculateCorporateTax(invoiceTotal, expenseTotal, province); } catch (_) {}
  }

  // HST
  let hstInfo = null;
  try {
    const allInvoices = fyKeys.flatMap(k => d.fiscalYears[k].invoices || []);
    hstInfo = calculateHSTSummary(allInvoices, settings.hstNumber);
  } catch (_) {}

  const employees    = d.employees || [];
  const t4aRecs      = d.t4aRecipients || [];
  const clients      = d.clients || [];

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
          <Pair label="Fiscal Year"   value={latestFyKey || '—'} />
          <Pair label="Last Updated"  value={company.updatedAt ? new Date(company.updatedAt).toLocaleDateString('en-CA') : '—'} />
        </div>
      </div>

      {/* P&L */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Income &amp; Expenses — {latestFyKey || 'Latest FY'}</h3>
        <div className={styles.metaGrid}>
          <Pair label="Revenue (invoiced)"  value={formatCurrency(invoiceTotal)} highlight />
          <Pair label="Total Expenses"       value={formatCurrency(expenseTotal)} />
          <Pair label="Gross Profit"         value={formatCurrency(grossProfit)} highlight />
        </div>
      </div>

      {/* Tax */}
      {taxInfo && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Estimated Corporate Tax</h3>
          <div className={styles.metaGrid}>
            <Pair label="Taxable Income"    value={formatCurrency(taxInfo.taxableIncome)} />
            <Pair label="Federal Tax"       value={formatCurrency(taxInfo.federalTax)} />
            <Pair label="Provincial Tax"    value={formatCurrency(taxInfo.provincialTax)} />
            <Pair label="Total Tax Est."    value={formatCurrency(taxInfo.totalTax)} highlight />
            <Pair label="Effective Rate"    value={taxInfo.effectiveRate != null ? `${(taxInfo.effectiveRate * 100).toFixed(1)}%` : '—'} />
          </div>
        </div>
      )}

      {/* HST */}
      {hstInfo && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>HST Summary</h3>
          <div className={styles.metaGrid}>
            <Pair label="HST Collected"  value={formatCurrency(hstInfo.hstCollected)} />
            <Pair label="HST Paid (ITCs)" value={formatCurrency(hstInfo.hstPaid)} />
            <Pair label="Net HST Owing"  value={formatCurrency(hstInfo.netHST)} highlight />
          </div>
        </div>
      )}

      {/* Staff */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Staff &amp; Contractors</h3>
        <div className={styles.metaGrid}>
          <Pair label="Employees"         value={employees.length} />
          <Pair label="T4A Recipients"    value={t4aRecs.length} />
          <Pair label="Clients"           value={clients.length} />
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
