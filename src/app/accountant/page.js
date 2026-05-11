'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/lib/firebase/client';
import CanBooksLogo from '@/components/CanBooksLogo';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatCurrency } from '@/lib/formatters';
import { calculateCorporateTax, calculateHSTSummary, getDeductibleAmount } from '@/lib/taxCalculations';
import styles from './page.module.css';

export default function AccountantPage() {
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const [isOwnerMode, setIsOwnerMode] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedFY, setSelectedFY] = useState(null);

  // Detect whether this is a business owner previewing the accountant view
  useEffect(() => {
    setIsOwnerMode(window.localStorage.getItem('accountant_mode') !== '1');
  }, []);

  // Reset FY when the selected company changes
  useEffect(() => {
    if (!selected) return;
    const keys = Object.keys(selected.data?.fiscalYears || {}).sort().reverse();
    setSelectedFY(keys[0] || null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authLoading) return;                        // wait for auth to resolve
    if (!user?.email) { setLoading(false); return; }
    setLoading(true);
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
  }, [user, authLoading]);

  const selected = companies.find(c => c.id === selectedId);

  const handleSignOut = () => {
    window.localStorage.removeItem('accountant_mode');
    firebaseSignOut(auth)
      .then(() => { window.location.href = '/accountant/login'; })
      .catch(() => { window.location.href = '/accountant/login'; });
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <CanBooksLogo size={32} />
            <div>
              <span className={styles.topBarTitle}>NorthBooks</span>
              <span className={styles.topBarSub}>Accountant Portal</span>
            </div>
          </div>
          <div className={styles.topBarRight}>
            {isOwnerMode && (
              <button
                className={styles.backBtn}
                onClick={() => window.history.length > 1 ? router.back() : router.replace('/dashboard')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to App
              </button>
            )}
            {user && <span className={styles.topBarEmail}>{user.email}</span>}
            <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </nav>

      <div className={styles.content}>
        <div className={styles.page}>
          {(authLoading || loading) ? (
            <p className={styles.empty}>Loading shared companies…</p>
          ) : !user ? (
            <p className={styles.empty}>You must be signed in to access this page.</p>
          ) : error ? (
            <p className={styles.empty}>Error: {error}</p>
          ) : !companies.length ? (
            <>
              <div className={styles.header}>
                <h1 className={styles.title}>Accountant View</h1>
                <p className={styles.sub}>No companies have granted you access yet.</p>
              </div>
              <div className={styles.emptyCard}>
                <p>Ask your client to go to <strong>Settings → Access</strong> and add your email address (<strong>{user.email}</strong>).</p>
              </div>
            </>
          ) : (
            <>
              <div className={styles.header}>
                <div>
                  <h1 className={styles.title}>Accountant View</h1>
                  <p className={styles.sub}>Read-only · {companies.length} client {companies.length === 1 ? 'company' : 'companies'} shared with you</p>
                </div>
                {selected && (
                  <div className={styles.fyBadge}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <select className={styles.fyBadgeSelect} value={selected ? (selectedFY || '') : ''} onChange={e => setSelectedFY(e.target.value)}>
                      {Object.keys((selected?.data?.fiscalYears) || {}).sort().reverse().map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                )}
              </div>

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

              {selected && <CompanyReadout company={selected} selectedFY={selectedFY} setSelectedFY={setSelectedFY} />}
            </>
          )}
        </div>
      </div>
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

function CompanyReadout({ company, selectedFY, setSelectedFY }) {
  const d = company.data || {};
  const settings     = d.settings || {};
  const businessType = d.businessType || 'ccpc';
  const province     = settings.province || 'ON';

  // Latest FY first (same order as sidebar)
  const allFyKeys = Object.keys(d.fiscalYears || {}).sort().reverse();
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

  // Invoice status breakdown
  const paidInvoices        = fyInvoices.filter(i => i.status === 'paid');
  const outstandingInvoices = fyInvoices.filter(i => i.status === 'sent').sort((a, b) => (a.issueDate || '').localeCompare(b.issueDate || ''));
  const draftInvoices       = fyInvoices.filter(i => i.status === 'draft');
  const paidRevenue         = paidInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
  const outstandingRevenue  = outstandingInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);

  // Expense category breakdown
  const categoryTotals = fyExpenses.reduce((acc, exp) => {
    const cat = exp.category || 'Uncategorized';
    acc[cat] = (acc[cat] || 0) + getDeductibleAmount(exp.amount || 0, exp.category, exp.businessUsePercent ?? 100);
    return acc;
  }, {});
  const categoryRows = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

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

  function exportAgedReceivables() {
    const today = new Date();
    const ageDays = date => !date ? 0 : Math.max(0, Math.floor((today - new Date(date + 'T00:00')) / 86400000));
    const bucket  = d => d <= 30 ? 'Current (0–30 days)' : d <= 60 ? '31–60 days' : d <= 90 ? '61–90 days' : d <= 120 ? '91–120 days' : 'Over 120 days';
    const rows = [
      [`Aged Receivables Report — ${company.name}`],
      ['As of', today.toLocaleDateString('en-CA')],
      ['Fiscal Year', selectedFY],
      [],
      ['Invoice #', 'Client', 'Issue Date', 'Days Outstanding', 'Aging Bucket', 'Amount (excl. HST)'],
      ...outstandingInvoices.map(i => {
        const d = ageDays(i.issueDate);
        return [i.invoiceNumber || i.id, i.clientName || '', i.issueDate || '', d, bucket(d), (i.subtotal || 0).toFixed(2)];
      }),
      [],
      ['TOTAL OUTSTANDING', '', '', '', '', outstandingRevenue.toFixed(2)],
    ];
    downloadCSV(`${company.name}_${selectedFY}_aged_receivables.csv`, rows);
  }

  function exportQuickBooksIIF() {
    const qbDate = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${m}/${d}/${y}`; };
    const lines = [
      '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
      '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
      '!ENDTRNS',
    ];
    for (const exp of fyExpenses) {
      const date = qbDate(exp.date);
      const amt  = (exp.amount || 0).toFixed(2);
      const cat  = (exp.category || 'Other Expense').replace(/\t/g, ' ');
      const name = (exp.description || '').replace(/\t/g, ' ');
      lines.push(`TRNS\tCHECK\t${date}\tChecking\t${name}\t-${amt}\t${cat}`);
      lines.push(`SPL\tCHECK\t${date}\t${cat}\t${name}\t${amt}\t${cat}`);
      lines.push('ENDTRNS');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `${company.name}_${selectedFY}_quickbooks.iif` }).click();
    URL.revokeObjectURL(url);
  }

  function exportWaveCSV() {
    const rows = [
      ['Transaction Date', 'Description', 'Withdrawal Amount', 'Deposit Amount', 'Currency'],
      ...fyInvoices.filter(i => i.status === 'paid').map(inv => [
        inv.issueDate || '',
        `Invoice ${inv.invoiceNumber || ''} — ${inv.clientName || ''}`.trim().replace(/—\s*$/, ''),
        '',
        (inv.subtotal || 0).toFixed(2),
        'CAD',
      ]),
      ...fyExpenses.map(exp => [
        exp.date || '',
        exp.description || exp.category || '',
        (exp.amount || 0).toFixed(2),
        '',
        'CAD',
      ]),
    ];
    downloadCSV(`${company.name}_${selectedFY}_wave.csv`, rows);
  }

  function exportT2Worksheet() {
    const rows = [
      ['T2 Corporate Income Tax Worksheet'],
      ['Company', company.name],
      ['Fiscal Year', selectedFY],
      ['Province', province],
      ['Business Type', businessType.toUpperCase()],
      ['HST Number', settings.hstNumber || ''],
      ['Business Number', settings.businessNumber || ''],
      ['Generated', new Date().toLocaleDateString('en-CA')],
      [],
      ['SCHEDULE 1 — NET INCOME FOR TAX PURPOSES'],
      [],
      ['INCOME'],
      ['Gross Revenue (excl. HST)', grossRevenue.toFixed(2)],
      [],
      ['DEDUCTIONS'],
      ...categoryRows.map(([cat, amt]) => [cat, amt.toFixed(2)]),
      [],
      ['Total Deductible Expenses', totalDeductibleExp.toFixed(2)],
      ['Net Income Before Tax', grossProfit.toFixed(2)],
      [],
      ...(taxInfo ? [
        ['TAX CALCULATION (ESTIMATED)'],
        ['Net Income for Tax Purposes', taxInfo.netIncome.toFixed(2)],
        ['Federal Tax (Part I)', taxInfo.fedTax.toFixed(2)],
        [`Provincial Tax (${province})`, taxInfo.provTax.toFixed(2)],
        ['Total Estimated Tax', taxInfo.totalTax.toFixed(2)],
        ['Effective Rate', taxInfo.effectiveRate != null ? `${(taxInfo.effectiveRate * 100).toFixed(2)}%` : ''],
        [],
      ] : []),
      ['NOTE', 'Estimates only. Verify all figures with your tax professional before filing.'],
    ];
    downloadCSV(`${company.name}_${selectedFY}_T2_worksheet.csv`, rows);
  }

  function exportHSTReturn() {
    if (!hstInfo) return;
    const totalSalesInclHST = fyInvoices
      .filter(i => i.status === 'paid' || i.status === 'sent')
      .reduce((s, i) => s + (i.total || (i.subtotal || 0) + (i.hstAmount || 0)), 0);
    const rows = [
      ['GST/HST Return Worksheet (GST34)'],
      ['Company', company.name],
      ['HST Registration Number', settings.hstNumber || 'N/A'],
      ['Fiscal Year', selectedFY],
      ['Generated', new Date().toLocaleDateString('en-CA')],
      [],
      ['LINE', 'DESCRIPTION', 'AMOUNT (CAD)'],
      ['101', 'Total sales and other revenue (incl. HST)', totalSalesInclHST.toFixed(2)],
      ['105', 'Total GST/HST collected or collectible', hstInfo.hstCollected.toFixed(2)],
      ['108', 'Total ITCs and adjustments (input tax credits)', hstInfo.itcTotal.toFixed(2)],
      ['109', 'Net tax owing / refundable (Line 105 − Line 108)', hstInfo.netRemittance.toFixed(2)],
      [],
      ['NOTE', 'Estimates from recorded data. Confirm all amounts before filing with CRA.'],
    ];
    downloadCSV(`${company.name}_${selectedFY}_HST_GST34.csv`, rows);
  }

  function exportT4ACSV() {
    const rows = [
      ['T4A Recipients Summary'],
      ['Company', company.name],
      ['Generated', new Date().toLocaleDateString('en-CA')],
      [],
      ['Recipient Name', 'SIN', 'Tax Year', 'Box 020 (Self-Employment)', 'Box 048 (Fees for Services)'],
      ...t4aRecs.map(r => [r.name || '', r.sin || '', r.taxYear || '', r.box020 || 0, r.box048 || 0]),
      [],
      ['TOTAL Box 020', '', '', t4aRecs.reduce((s, r) => s + (r.box020 || 0), 0).toFixed(2), ''],
      ['TOTAL Box 048', '', '', '', t4aRecs.reduce((s, r) => s + (r.box048 || 0), 0).toFixed(2)],
    ];
    downloadCSV(`${company.name}_T4A_recipients.csv`, rows);
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

      {/* Invoice Summary */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Invoice Summary — {selectedFY || '—'}</h3>
        <div className={styles.statusGrid}>
          <div className={`${styles.statusItem} ${styles.statusPaid}`}>
            <span className={styles.statusLabel}>Paid</span>
            <span className={styles.statusAmount}>{formatCurrency(paidRevenue)}</span>
            <span className={styles.statusCount}>{paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''}</span>
          </div>
          <div className={`${styles.statusItem} ${styles.statusOutstanding}`}>
            <span className={styles.statusLabel}>Outstanding</span>
            <span className={styles.statusAmount}>{formatCurrency(outstandingRevenue)}</span>
            <span className={styles.statusCount}>{outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Draft</span>
            <span className={styles.statusAmount}>{draftInvoices.length}</span>
            <span className={styles.statusCount}>not sent</span>
          </div>
        </div>
        {outstandingInvoices.length > 0 && (
          <div className={styles.outstandingList}>
            <span className={styles.outstandingHeader}>Outstanding invoices</span>
            {outstandingInvoices.slice(0, 10).map((inv, i) => (
              <div key={i} className={styles.outstandingItem}>
                <span className={styles.outstandingClient}>{inv.clientName || 'Unknown client'}</span>
                <span className={styles.outstandingDate}>{inv.issueDate || '—'}</span>
                <span className={styles.outstandingAmt}>{formatCurrency(inv.subtotal || 0)}</span>
              </div>
            ))}
            {outstandingInvoices.length > 10 && (
              <p className={styles.disclaimer}>+ {outstandingInvoices.length - 10} more outstanding</p>
            )}
          </div>
        )}
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

      {/* Expense Categories */}
      {categoryRows.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Expenses by Category — {selectedFY || '—'}</h3>
          <div className={styles.categoryList}>
            {categoryRows.map(([cat, amt]) => (
              <div key={cat} className={styles.categoryRow}>
                <span className={styles.categoryName}>{cat}</span>
                <span className={styles.categoryAmount}>{formatCurrency(amt)}</span>
              </div>
            ))}
            <div className={`${styles.categoryRow} ${styles.categoryTotal}`}>
              <span className={styles.categoryName}>Total Deductible</span>
              <span className={`${styles.categoryAmount} ${styles.pairHighlight}`}>{formatCurrency(totalDeductibleExp)}</span>
            </div>
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

      {/* Exports & Reports */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Exports &amp; Reports</h3>

        <div className={styles.exportGroup}>
          <span className={styles.exportGroupLabel}>Raw Data</span>
          <div className={styles.exportGroupBtns}>
            <button className={styles.exportBtn} onClick={exportInvoicesCSV} disabled={!fy}>Invoices CSV</button>
            <button className={styles.exportBtn} onClick={exportExpensesCSV} disabled={!fy}>Expenses CSV</button>
            {outstandingInvoices.length > 0 && (
              <button className={styles.exportBtn} onClick={exportAgedReceivables} disabled={!fy}>Aged Receivables</button>
            )}
            {t4aRecs.length > 0 && (
              <button className={styles.exportBtn} onClick={exportT4ACSV}>T4A Recipients</button>
            )}
          </div>
        </div>

        <div className={styles.exportGroup}>
          <span className={styles.exportGroupLabel}>Accounting Software</span>
          <div className={styles.exportGroupBtns}>
            <button className={styles.exportBtn} onClick={exportQuickBooksIIF} disabled={!fy}>QuickBooks IIF</button>
            <button className={styles.exportBtn} onClick={exportWaveCSV} disabled={!fy}>Wave Accounting CSV</button>
          </div>
        </div>

        {(taxInfo || hstInfo) && (
          <div className={styles.exportGroup}>
            <span className={styles.exportGroupLabel}>CRA &amp; Tax Prep</span>
            <div className={styles.exportGroupBtns}>
              {taxInfo && <button className={styles.exportBtn} onClick={exportT2Worksheet} disabled={!fy}>T2 Income Worksheet</button>}
              {hstInfo && <button className={styles.exportBtn} onClick={exportHSTReturn} disabled={!fy}>HST Return (GST34)</button>}
            </div>
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
