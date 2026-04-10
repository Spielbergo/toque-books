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
} from '@/lib/exportHelpers';
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
        `Toque Books — Accountant Package`,
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
      </div>

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
