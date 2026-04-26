'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  exportJSON,
  exportExpensesCSV,
  exportInvoicesCSV,
  exportGST34CSV,
  exportT2XML,
  exportT1XML,
  exportQuickBooksIIF,
  exportQBO,
  exportBankTransactionsCSV,
  exportTSlipsCSV,
  exportTurboTaxXML,
  exportWealthsimpleCSV,
  exportSage50CSV,
  exportTaxSummaryCSV,
  exportT5PDF,
  exportT4PDF,
  exportTaxWorksheetPDF,
  exportGIFI,
  exportFutureTaxS100CSV,
  exportFutureTaxS125CSV,
  exportFutureTaxCorpInfo,
  exportFutureTaxS141CSV,
  exportFutureTaxT1Info,
} from '@/lib/exportHelpers';
import { calculatePersonalTax } from '@/lib/taxCalculations';
import Modal from '@/components/ui/Modal';
import styles from './page.module.css';

// ─── Export catalogue ────────────────────────────────────────────────────────

const EXPORT_GROUPS = [
  {
    id: 'tax',
    label: 'Tax Filing',
    description: 'Exports for CRA, tax software, and accountants',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    items: [
      {
        id: 'tax_summary_csv',
        label: 'Full Tax Summary',
        sub: 'CSV — both T2 corporate and T1 personal in one file',
        badge: 'recommended',
        scope: 'both',
        fn: (state, fyKey, userProfile) => exportTaxSummaryCSV(state, fyKey, userProfile),
      },
      {
        id: 't2_xml',
        label: 'T2 Corporate Return',
        sub: 'XML — Schedule 8 CCA, shareholder loan, retained earnings',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportT2XML(state, fyKey),
      },
      {
        id: 'ufile_t2',
        label: 'UFile T2 / H&R Block Business',
        sub: 'XML — same T2 data formatted for UFile T2 reference',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportT2XML(state, fyKey),
      },
      {
        id: 'gifi',
        label: 'GIFI Financial Statements',
        sub: 'GFI — Schedule 100 & 125 for UFile T2, TaxPrep, Cantax, ProFile',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportGIFI(state, fyKey),
      },
      {
        id: 'futuretax_s100',
        label: 'FutureTax — S100 Balance Sheet',
        sub: 'CSV — import via Tools › Import CSV/GFI File › S100',
        badge: 'FutureTax',
        scope: 'fy',
        fn: (state, fyKey) => exportFutureTaxS100CSV(state, fyKey),
      },
      {
        id: 'futuretax_s125',
        label: 'FutureTax — S125 Income Statement',
        sub: 'CSV — import via Tools › Import CSV/GFI File › S125',
        badge: 'FutureTax',
        scope: 'fy',
        fn: (state, fyKey) => exportFutureTaxS125CSV(state, fyKey),
      },
      {
        id: 'futuretax_corpinfo',
        label: 'FutureTax — Corporation Info',
        sub: 'TXT — BN, name, address, fiscal dates to copy into T2 Page 1',
        badge: 'FutureTax',
        scope: 'fy',
        fn: (state, fyKey) => exportFutureTaxCorpInfo(state, fyKey),
      },
      {
        id: 'futuretax_s141',
        label: 'FutureTax — S141 Additional Info',
        sub: 'CSV — import via Tools › Import CSV/GFI File › S141 (self-prepared defaults)',
        badge: 'FutureTax',
        scope: 'fy',
        fn: (state, fyKey) => exportFutureTaxS141CSV(state, fyKey),
      },
      {
        id: 'futuretax_t1info',
        label: 'FutureTax — T1 Personal Info',
        sub: 'TXT — Line 10100, 12000, 12010, 20800, 43500 for manual FutureTax Personal entry',
        badge: 'FutureTax',
        scope: 'personal',
        fn: (state, fyKey, userProfile) => exportFutureTaxT1Info(userProfile, fyKey),
      },
      {
        id: 't1_xml',
        label: 'T1 Personal Return',
        sub: 'XML — income, dividends, RRSP, tax credits',
        badge: null,
        scope: 'personal',
        fn: (state, fyKey, userProfile) => exportT1XML(userProfile, fyKey, state.settings.companyName),
      },
      {
        id: 'turbotax_xml',
        label: 'TurboTax / TurboImpôt',
        sub: 'XML — T1 line items mapped to TurboTax fields',
        badge: null,
        scope: 'personal',
        fn: (state, fyKey, userProfile) => exportTurboTaxXML(userProfile, fyKey),
      },
      {
        id: 'wealthsimple_csv',
        label: 'Wealthsimple Tax',
        sub: 'CSV — dividend and income fields for SimpleTax / Wealthsimple',
        badge: null,
        scope: 'personal',
        fn: (state, fyKey, userProfile) => exportWealthsimpleCSV(userProfile, fyKey),
      },
      {
        id: 't5_slips',
        label: 'T5 Dividend Slips',
        sub: 'CSV — actual / taxable amounts and DTC for TurboTax, UFile, StudioTax',
        badge: null,
        scope: 'personal',
        fn: (state, fyKey, userProfile) => exportTSlipsCSV(userProfile, fyKey),
      },
      {
        id: 'gst34',
        label: 'HST/GST Return (GST34)',
        sub: 'CSV — lines 103, 106, 109 for CRA filing',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportGST34CSV(state, fyKey),
      },
      {
        id: 't5_pdf',
        label: 'T5 Slip PDF',
        sub: 'PDF — CRA-styled T5 Statement of Investment Income (2 copies)',
        badge: 'PDF',
        scope: 'both',
        fn: (state, fyKey, userProfile) => exportT5PDF(state, fyKey, userProfile),
      },
      {
        id: 't4_pdf',
        label: 'T4 Slip PDF',
        sub: 'PDF — CRA-styled T4 Statement of Remuneration Paid (requires employment income)',
        badge: 'PDF',
        scope: 'both',
        fn: (state, fyKey, userProfile) => exportT4PDF(state, fyKey, userProfile),
      },
      {
        id: 'worksheet_pdf',
        label: 'T1/T2 Tax Worksheet PDF',
        sub: 'PDF — Combined corporate + personal worksheet with CRA line numbers, for your accountant',
        badge: 'PDF',
        scope: 'both',
        fn: (state, fyKey, userProfile) => exportTaxWorksheetPDF(state, fyKey, userProfile),
      },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting Software',
    description: 'Import directly into QuickBooks, Wave, Xero, and more',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    items: [
      {
        id: 'qbo',
        label: 'QuickBooks Online',
        sub: 'QBO/OFX — import transactions via Banking > File Upload',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportQBO(state, fyKey),
      },
      {
        id: 'quickbooks_iif',
        label: 'QuickBooks Desktop',
        sub: 'IIF — import via File > Utilities > Import > IIF Files',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportQuickBooksIIF(state, fyKey),
      },
      {
        id: 'xero_csv',
        label: 'Xero',
        sub: 'CSV — import via Accounting > Bank Accounts > Import',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportBankTransactionsCSV(state, fyKey, 'xero'),
      },
      {
        id: 'wave_csv',
        label: 'Wave Accounting',
        sub: 'CSV — import via Accounting > Transactions > Import',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportBankTransactionsCSV(state, fyKey, 'wave'),
      },
      {
        id: 'freshbooks_csv',
        label: 'FreshBooks',
        sub: 'CSV — import expenses via Expenses > Import Expenses',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportBankTransactionsCSV(state, fyKey, 'freshbooks'),
      },
      {
        id: 'sage50_csv',
        label: 'Sage 50 / Simply Accounting',
        sub: 'CSV — journal entries for Sales and Purchase journals',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportSage50CSV(state, fyKey),
      },
      {
        id: 'generic_csv',
        label: 'Generic Ledger (Zoho / Kashoo / Bench)',
        sub: 'CSV — universal transaction format for any bookkeeping tool',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportBankTransactionsCSV(state, fyKey, 'generic'),
      },
    ],
  },
  {
    id: 'data',
    label: 'Raw Data',
    description: 'Invoices, expenses, and full backups',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
    items: [
      {
        id: 'invoices_csv',
        label: 'Invoices',
        sub: 'CSV — all invoices with client, amounts, status, paid date',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportInvoicesCSV(state, fyKey),
      },
      {
        id: 'expenses_csv',
        label: 'Expenses',
        sub: 'CSV — all expenses with category, HST, deductible amount',
        badge: null,
        scope: 'fy',
        fn: (state, fyKey) => exportExpensesCSV(state, fyKey),
      },
      {
        id: 'json_backup',
        label: 'Full JSON Backup',
        sub: 'JSON — complete fiscal year data for archiving or re-import',
        badge: null,
        scope: 'both',
        fn: (state, fyKey, userProfile) => exportJSON(state, userProfile, fyKey),
      },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const { state } = useApp();
  const { userProfile } = useUserProfile();
  const [done, setDone] = useState({});
  const [zipLoading, setZipLoading] = useState(false);
  const [corpInfoOpen, setCorpInfoOpen] = useState(false);
  const [t1InfoOpen, setT1InfoOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistTab, setChecklistTab] = useState('t2');
  const [copied, setCopied] = useState({});

  function copyField(key, value) {
    if (!value) return;
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 1800);
    });
  }

  async function handleAccountantZip() {
    setZipLoading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Helper to capture CSV text instead of immediately downloading
      function captureCSV(label, fn, ...args) {
        try {
          // exportHelpers normally trigger a download; we capture the blob via a DataTransfer trick.
          // Instead, call the function but intercept the anchor click.
          let blobUrl = null;
          const origCreate = URL.createObjectURL.bind(URL);
          const origRevoke = URL.revokeObjectURL.bind(URL);
          const blobs = [];
          URL.createObjectURL = b => { blobs.push(b); return origCreate(b); };
          fn(...args);
          URL.createObjectURL = origCreate;
          URL.revokeObjectURL = origRevoke;
          // If a blob was captured, read it
          if (blobs.length) return blobs[0].text();
        } catch { /* ignore */ }
        return Promise.resolve('');
      }

      // Tax summary CSV
      const taxCSV = captureCSV('tax', exportTaxSummaryCSV, state, activeFYKey, userProfile);
      // Invoices CSV
      const invCSV = captureCSV('inv', exportInvoicesCSV, state, activeFYKey);
      // Expenses CSV
      const expCSV = captureCSV('exp', exportExpensesCSV, state, activeFYKey);
      // GIFI
      const gifiCSV = captureCSV('gifi', exportGIFI, state, activeFYKey);
      // HST/GST
      const hstCSV = captureCSV('hst', exportGST34CSV, state, activeFYKey);

      const results = await Promise.all([taxCSV, invCSV, expCSV, gifiCSV, hstCSV]);
      const files = [
        { name: `tax-summary-${activeFYKey}.csv`, content: results[0] },
        { name: `invoices-${activeFYKey}.csv`, content: results[1] },
        { name: `expenses-${activeFYKey}.csv`, content: results[2] },
        { name: `gifi-${activeFYKey}.csv`, content: results[3] },
        { name: `hst-gst34-${activeFYKey}.csv`, content: results[4] },
      ];

      for (const f of files) {
        if (f.content) zip.file(f.name, f.content);
      }

      // README
      zip.file('README.txt', [
        `CanBooks — Accountant Package`,
        `Fiscal Year: ${fyLabel}`,
        `Generated: ${new Date().toLocaleString('en-CA')}`,
        ``,
        `Files included:`,
        `  tax-summary-${activeFYKey}.csv      — Full T2/T1 tax summary`,
        `  invoices-${activeFYKey}.csv          — All invoices for the period`,
        `  expenses-${activeFYKey}.csv          — All expenses for the period`,
        `  gifi-${activeFYKey}.csv              — GIFI Schedule 100/125`,
        `  hst-gst34-${activeFYKey}.csv         — HST/GST34 return lines`,
        ``,
        `All figures are estimates. Please verify with a CPA before filing.`,
      ].join('\n'));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accountant-package-${activeFYKey}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Accountant zip failed', e);
    } finally {
      setZipLoading(false);
    }
  }

  const activeFYKey = state.activeFiscalYear === 'all'
    ? Object.keys(state.fiscalYears || {}).filter(k => k !== 'all').sort().at(-1) ?? null
    : state.activeFiscalYear;

  const fyLabel = state.fiscalYears?.[activeFYKey]?.label ?? activeFYKey ?? '—';

  const t1Year = parseInt((activeFYKey ?? '').replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const t1Py = userProfile?.personalYears?.[t1Year] ?? {};
  const t1Personal = calculatePersonalTax({
    nonEligibleDivs:  t1Py.nonEligibleDivs  ?? 0,
    eligibleDivs:     t1Py.eligibleDivs     ?? 0,
    employmentIncome: t1Py.employmentIncome ?? 0,
    otherIncome:      t1Py.otherIncome      ?? 0,
    rrspDeduction:    t1Py.rrspDeduction    ?? 0,
    taxWithheld:      t1Py.taxWithheld      ?? 0,
    cppContributions: t1Py.cppContributions ?? 0,
    eiPremiums:       t1Py.eiPremiums       ?? 0,
    spouseNetIncome:  t1Py.spouseNetIncome  ?? null,
  });
  const t1Fmt = v => (Math.round((v ?? 0) * 100) / 100).toFixed(2);

  function handleExport(item) {
    try {
      item.fn(state, activeFYKey, userProfile);
      setDone(prev => ({ ...prev, [item.id]: true }));
      setTimeout(() => setDone(prev => ({ ...prev, [item.id]: false })), 3000);
    } catch (e) {
      console.error('Export failed', e);
    }
  }

  if (!activeFYKey) {
    return (
      <div className={styles.empty}>
        <p>No fiscal year data found. Complete onboarding first.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Export</h1>
          <p className={styles.pageSub}>
            Exporting data for <strong>{fyLabel}</strong>. Change the fiscal year in the sidebar to export a different period.
          </p>
        </div>
        <div className={styles.headerBtns}>
          <button className={styles.corpInfoBtn} onClick={() => { setChecklistTab('t2'); setChecklistOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            Filing Checklist
          </button>
          <button className={styles.corpInfoBtn} onClick={() => setT1InfoOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            T1 Personal Info
          </button>
          <button className={styles.corpInfoBtn} onClick={() => setCorpInfoOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="9" x2="15" y2="9"/>
              <line x1="9" y1="13" x2="15" y2="13"/>
              <line x1="9" y1="17" x2="13" y2="17"/>
            </svg>
            Corporation Info
          </button>
        </div>
      </div>

      {/* ── Corp Info Modal ── */}
      <Modal isOpen={corpInfoOpen} onClose={() => setCorpInfoOpen(false)} title="Corporation Information" size="md">
        <p className={styles.corpInfoNote}>Click any field to copy it to the clipboard for quick manual entry into FutureTax or other tax software.</p>
        <div className={styles.corpInfoGrid}>
          {[
            { label: 'Corporation Name',       key: 'companyName',       value: state.settings?.companyName },
            { label: 'Legal Name',             key: 'legalName',         value: state.settings?.legalName },
            { label: 'Business Number (BN)',   key: 'businessNumber',    value: state.settings?.businessNumber },
            { label: 'HST / GST Number',       key: 'hstNumber',         value: state.settings?.hstNumber },
            { label: 'Province',               key: 'province',          value: state.settings?.province },
            { label: 'Address',                key: 'address',           value: state.settings?.address },
            { label: 'City',                   key: 'city',              value: state.settings?.city },
            { label: 'Postal Code',            key: 'postalCode',        value: state.settings?.postalCode },
            { label: 'Phone',                  key: 'phone',             value: state.settings?.phone },
            { label: 'Email',                  key: 'email',             value: state.settings?.email },
            { label: 'Website',                key: 'website',           value: state.settings?.website },
            { label: 'Incorporation Year',     key: 'incorporationYear', value: state.settings?.incorporationYear },
            { label: 'Fiscal Year Start',      key: 'fyStart',           value: state.fiscalYears?.[activeFYKey]?.startDate },
            { label: 'Fiscal Year End',        key: 'fyEnd',             value: state.fiscalYears?.[activeFYKey]?.endDate },
          ].map(({ label, key, value }) => (
            <div key={key} className={styles.corpInfoRow}>
              <span className={styles.corpInfoLabel}>{label}</span>
              <div className={styles.corpInfoValueWrap}>
                <span className={styles.corpInfoValue}>{value || <em className={styles.corpInfoEmpty}>not set</em>}</span>
                {value ? (
                  <button
                    className={`${styles.copyBtn} ${copied[key] ? styles.copyBtnDone : ''}`}
                    onClick={() => copyField(key, value)}
                    title={`Copy ${label}`}
                  >
                    {copied[key] ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                    {copied[key] ? 'Copied' : 'Copy'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── T1 Personal Info Modal ── */}
      <Modal isOpen={t1InfoOpen} onClose={() => setT1InfoOpen(false)} title={`T1 Personal Info — ${t1Year}`} size="md">
        <p className={styles.corpInfoNote}>Key T1 line numbers for manual entry into FutureTax Personal or any T1 software. Click any field to copy.</p>
        <div className={styles.corpInfoGrid}>
          {[
            { label: 'Line 10100 — Employment Income',      key: 't1_10100', value: t1Fmt(t1Py.employmentIncome) },
            { label: 'Line 12000 — Taxable NE Dividends',  key: 't1_12000', value: t1Fmt(t1Personal.neGrossedUp),  note: `actual $${t1Fmt(t1Py.nonEligibleDivs ?? 0)} × 1.15` },
            { label: 'Line 12010 — Taxable Eligible Divs', key: 't1_12010', value: t1Fmt(t1Personal.elGrossedUp),  note: `actual $${t1Fmt(t1Py.eligibleDivs ?? 0)} × 1.38` },
            { label: 'Line 13000 — Other Income',          key: 't1_13000', value: t1Fmt(t1Py.otherIncome) },
            { label: 'Line 15000 — Total Income',          key: 't1_15000', value: t1Fmt(t1Personal.totalIncome) },
            { label: 'Line 20800 — RRSP Deduction',        key: 't1_20800', value: t1Fmt(t1Py.rrspDeduction) },
            { label: 'Line 23600 — Net Income',            key: 't1_23600', value: t1Fmt(t1Personal.netIncome) },
            { label: 'T4 Box 22 — Tax Withheld',           key: 't1_box22', value: t1Fmt(t1Py.taxWithheld) },
            { label: 'T4 Box 16 — CPP Contributions',      key: 't1_box16', value: t1Fmt(t1Py.cppContributions) },
            { label: 'T4 Box 18 — EI Premiums',            key: 't1_box18', value: t1Fmt(t1Py.eiPremiums) },
            { label: 'Line 43500 — Total Tax Payable',     key: 't1_43500', value: t1Fmt(t1Personal.totalTax) },
            {
              label: t1Personal.balanceOwing >= 0 ? 'Line 48500 — Balance Owing' : 'Line 48400 — Refund',
              key: 't1_balance',
              value: t1Fmt(Math.abs(t1Personal.balanceOwing)),
            },
          ].map(({ label, key, value, note }) => (
            <div key={key} className={styles.corpInfoRow}>
              <span className={styles.corpInfoLabel}>
                {label}
                {note && <em className={styles.t1FieldNote}> ({note})</em>}
              </span>
              <div className={styles.corpInfoValueWrap}>
                <span className={styles.corpInfoValue}>${value}</span>
                <button
                  className={`${styles.copyBtn} ${copied[key] ? styles.copyBtnDone : ''}`}
                  onClick={() => copyField(key, value)}
                  title={`Copy ${label}`}
                >
                  {copied[key] ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                  {copied[key] ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className={styles.t1DownloadLink} onClick={() => exportFutureTaxT1Info(userProfile, activeFYKey)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download as TXT
        </button>
      </Modal>

      {/* ── Filing Checklist Modal ── */}
      <Modal isOpen={checklistOpen} onClose={() => setChecklistOpen(false)} title="FutureTax Filing Checklist" size="md">
        <p className={styles.corpInfoNote}>Follow these steps to complete your T2 and T1 returns in FutureTax.</p>
        <div className={styles.checklistTabs}>
          <button
            className={`${styles.checklistTab} ${checklistTab === 't2' ? styles.checklistTabActive : ''}`}
            onClick={() => setChecklistTab('t2')}
          >T2 Corporate</button>
          <button
            className={`${styles.checklistTab} ${checklistTab === 't1' ? styles.checklistTabActive : ''}`}
            onClick={() => setChecklistTab('t1')}
          >T1 Personal</button>
        </div>
        {checklistTab === 't2' && (
          <div className={styles.checklistSteps}>
            {[
              { title: 'Create a new T2 return', note: 'Open FutureTax → New → T2 Corporation. Enter the tax year matching your fiscal year end.' },
              { title: 'Fill in Corporation Info (T2 Page 1)', note: 'Use the Corporation Info button to copy your BN, legal name, address, fiscal year start/end, and province.' },
              { title: 'Import S100 Balance Sheet', note: 'Tools → Import CSV/GFI File → select your FutureTax-S100-*.csv file. Verify totals after import.' },
              { title: 'Import S125 Income Statement', note: 'Tools → Import CSV/GFI File → select your FutureTax-S125-*.csv file. Verify revenue and expense totals.' },
              { title: 'Import S141 Additional Info', note: 'Tools → Import CSV/GFI File → select your FutureTax-S141-*.csv file. Review Part 4 questions before accepting.' },
              { title: 'Review Schedule 8 (CCA)', note: 'Manually enter capital cost allowance for any equipment, vehicles, or leasehold improvements. Verify class rates match your assets.' },
              { title: 'Run error check and NETFILE', note: 'Use the built-in error check. Once clear, NETFILE the T2 or print and provide to your CPA for review.' },
            ].map((step, i) => (
              <div key={i} className={styles.checklistStep}>
                <div className={styles.checklistStepNum}>{i + 1}</div>
                <div className={styles.checklistStepBody}>
                  <div className={styles.checklistStepTitle}>{step.title}</div>
                  <div className={styles.checklistStepNote}>{step.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {checklistTab === 't1' && (
          <div className={styles.checklistSteps}>
            {[
              { title: 'Create a new T1 return', note: 'Open FutureTax Personal (or UFile, Wealthsimple Tax, TurboTax). Start a new T1 for the correct tax year.' },
              { title: 'Enter personal information', note: 'Name, SIN, date of birth, province of residence, and marital status.' },
              { title: 'Enter employment income (T4)', note: 'Line 10100 — Box 14. Enter Box 22 (tax withheld), Box 16 (CPP), Box 18 (EI). Use the T1 Personal Info button for amounts.' },
              { title: 'Enter dividends from corporation', note: 'Line 12000 — taxable non-eligible dividends (actual × 1.15). Line 12010 — taxable eligible dividends (actual × 1.38). Amounts are in T1 Personal Info.' },
              { title: 'Enter RRSP deduction (if any)', note: 'Line 20800 — enter amount contributed and deducted this year. Verify against your RRSP contribution receipts from your institution.' },
              { title: 'Review Line 43500 — Total Tax Payable', note: 'Confirm this matches the estimate in T1 Personal Info. Small differences are normal due to additional credits or rounding.' },
              { title: 'NETFILE your T1', note: 'Run the built-in review. If no errors, NETFILE. Allow 2–6 weeks for CRA to process and issue your Notice of Assessment.' },
            ].map((step, i) => (
              <div key={i} className={styles.checklistStep}>
                <div className={styles.checklistStepNum}>{i + 1}</div>
                <div className={styles.checklistStepBody}>
                  <div className={styles.checklistStepTitle}>{step.title}</div>
                  <div className={styles.checklistStepNote}>{step.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className={styles.checklistDisclaimer}>
          CanBooks estimates are for guidance only. Always verify all figures against your official CRA T4/T5 slips before filing.
        </p>
      </Modal>

      <div className={styles.banner}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bannerIcon}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          Exports are generated locally in your browser — no data is sent to any third-party service.
          Tax XML files are <strong>reference summaries</strong> for your accountant or to assist manual entry;
          always file the official return using CRA-certified software.
        </span>
      </div>

      {EXPORT_GROUPS.map(group => (
        <div key={group.id} className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupIcon}>{group.icon}</span>
            <div>
              <h2 className={styles.groupTitle}>{group.label}</h2>
              <p className={styles.groupSub}>{group.description}</p>
            </div>
          </div>
          <div className={styles.grid}>
            {group.items.map(item => (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardLabels}>
                    <span className={styles.cardTitle}>{item.label}</span>
                    {item.badge === 'recommended' && (
                      <span className={styles.badgeRecommended}>Recommended</span>
                    )}
                    {item.badge === 'PDF' && (
                      <span className={styles.badgePdf}>PDF</span>
                    )}
                    {item.badge === 'FutureTax' && (
                      <span className={styles.badgeFutureTax}>FutureTax</span>
                    )}
                  </div>
                  <p className={styles.cardSub}>{item.sub}</p>
                </div>
                <button
                  className={`${styles.downloadBtn} ${done[item.id] ? styles.downloadBtnDone : ''}`}
                  onClick={() => handleExport(item)}>
                  {done[item.id] ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Downloaded
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Accountant Package ── */}
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </span>
          <div>
            <h2 className={styles.groupTitle}>Accountant Package</h2>
            <p className={styles.groupSub}>Bundle all key exports into a single ZIP file for your accountant or bookkeeper</p>
          </div>
        </div>
        <div className={styles.acctPackageBox}>
          <p className={styles.acctPackageDesc}>
            Generates a <strong>.zip</strong> containing: Tax Summary CSV, Invoices CSV, Expenses CSV, GIFI Schedule 100/125, and HST GST34 return. All figures are estimates — always verify with a CPA.
          </p>
          <button
            className={styles.downloadBtn}
            onClick={handleAccountantZip}
            disabled={zipLoading}
          >
            {zipLoading ? (
              'Generating…'
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <polyline points="9 12 12 15 15 12"/>
                  <line x1="12" y1="8" x2="12" y2="15"/>
                </svg>
                Download Accountant Package (.zip)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
