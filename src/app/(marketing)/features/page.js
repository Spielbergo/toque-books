import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'Features',
  description:
    'NorthBooks features — invoicing, HST/GST tracking, T2 corporate tax summary, T1 personal tax, bank import, payroll, T4 slips, mileage log, AI parsing, and 20+ export formats for Canadian corporations.',
};

const FEATURES = [
  {
    id: 'invoices',
    icon: '📄',
    title: 'Invoices & Accounts Receivable',
    tag: 'Free + Pro',
    body: `Create and send professional invoices with your logo, payment terms, and HST line items. Track payment status across sent, viewed, overdue, and paid states. Set up recurring invoice templates for retainer clients. Export to PDF. Import AI-parsed invoices from PDFs you receive.`,
    bullets: [
      'Custom branding, logo, and payment terms',
      'HST / GST / QST line item calculations',
      'Invoice status tracking (sent, viewed, overdue, paid)',
      'Recurring invoice templates',
      'AI-powered invoice PDF import',
      'Email delivery with read tracking',
      '10 invoices/month on Free — unlimited on Pro',
    ],
  },
  {
    id: 'hst',
    icon: '🍁',
    title: 'HST / GST / QST Tracking',
    tag: 'Free + Pro',
    body: `NorthBooks handles every Canadian tax jurisdiction. Transactions are tagged to the correct rate automatically. Input Tax Credits (ITCs) are tracked as you enter expenses. At remittance time, your net tax owing is calculated instantly.`,
    bullets: [
      'GST, HST, QST, PST rates for all provinces',
      'Automatic ITC calculation on expenses',
      'Quick Method HST comparison (Pro)',
      'Remittance history and filing schedule',
      'Quarterly and annual period support',
      'Instalment schedule reminders',
    ],
  },
  {
    id: 'tax',
    icon: '📋',
    title: 'T2 Corporate + T1 Personal Tax Summary',
    tag: 'Pro',
    body: `The most powerful feature in NorthBooks. As you record revenue, expenses, and salary/dividends paid to yourself, the app maintains a running T2 corporate tax calculation and T1 personal tax estimate. Export to T2 XML, GIFI schedules, or FutureTax / TurboTax format for final filing.`,
    bullets: [
      'Real-time T2 Schedule 1 & 125 calculations',
      'T1 personal tax estimate from dividends/salary',
      'GIFI Schedule 100 / 125 / 141',
      'T2 XML export for CRA e-file',
      'FutureTax, TurboTax Business import',
      'AI tax review (Gemini) flags issues before you file',
      'Accountant read-only access for review',
    ],
  },
  {
    id: 'bank',
    icon: '🏦',
    title: 'Bank Statement Import',
    tag: 'Free + Pro',
    body: `Upload PDF bank statements from any Canadian bank. NorthBooks extracts transactions using AI, categorizes them, and lets you review and match them to existing invoices or expenses. Reconciliation that used to take hours takes minutes.`,
    bullets: [
      'PDF upload from any Canadian financial institution',
      'AI transaction extraction and categorization',
      'One-click match to existing invoices',
      'Duplicate detection',
      'Multi-account support',
      'Running balance reconciliation',
    ],
  },
  {
    id: 'payroll',
    icon: '💼',
    title: 'Payroll & T4 / T4A Slips',
    tag: 'Pro',
    body: `Run payroll for yourself and up to five employees. NorthBooks calculates CPP, EI, and income tax withholdings using CRA tables. Generate T4 (employment) and T4A (contractor/dividend) slips in CRA-accepted XML format ready for e-filing.`,
    bullets: [
      'CPP, EI, and income tax withholding calculations',
      'T4 and T4A slip generation',
      'T4 XML for CRA e-file',
      'Payroll history and remittance tracking',
      'Owner-employee salary optimization suggestions',
    ],
  },
  {
    id: 'mileage',
    icon: '🚗',
    title: 'Mileage Log',
    tag: 'Pro',
    body: `Log business trips with start, end, purpose, and distance. NorthBooks applies the CRA per-kilometre rate (updated annually) to calculate your deductible vehicle expense. Export a CRA-compliant mileage log at year-end.`,
    bullets: [
      'CRA 2025 per-km rate built in',
      'Business purpose and trip categorization',
      'Annual deductible expense total',
      'CRA-compliant log export',
    ],
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'AI Receipt & Slip Parsing',
    tag: 'Pro',
    body: `Upload T4s, T5s, Notices of Assessment, and expense receipts. NorthBooks uses AI to extract the key numbers and pre-fill the relevant fields. Stop re-typing CRA documents.`,
    bullets: [
      'T4, T5, NOA slip parsing',
      'Expense receipt extraction',
      'Auto-fill income and deduction fields',
      'Confidence scoring on extracted data',
    ],
  },
  {
    id: 'export',
    icon: '📤',
    title: 'Export Hub',
    tag: 'Pro',
    body: `Over 20 export formats covering every tool your accountant, tax software, or CRA might need. Free plan gets CSV; Pro unlocks everything else.`,
    bullets: [
      'T2 XML (CRA e-file)',
      'T1 data export',
      'FutureTax import',
      'TurboTax Business import',
      'Wealthsimple Tax import',
      'QuickBooks Online (QBO)',
      'GIFI Schedule 100 / 125 / 141',
      'T4 / T4A / T5 XML slips',
      'PDF invoices',
      'CSV transactions',
    ],
  },
  {
    id: 'calendar',
    icon: '📅',
    title: 'CRA Deadline Calendar',
    tag: 'Free + Pro',
    body: `Never miss a CRA deadline. The calendar shows your T2 corporate filing date, T4/T4A/T5 slip deadlines, HST quarterly remittance dates, personal tax instalment dates, and more — all calculated for your fiscal year.`,
    bullets: [
      'T2 return deadline (6 months after fiscal year-end)',
      'HST quarterly remittance dates',
      'T4/T4A/T5 slip deadline (February 28)',
      'Personal tax instalment dates',
      'Payroll remittance deadlines',
      'In-app reminders',
    ],
  },
  {
    id: 'accountant',
    icon: '👤',
    title: 'Accountant Access',
    tag: 'Pro',
    body: `Share read-only access to your NorthBooks account with your accountant. They can review your books, download exports, and provide feedback — without you needing to email spreadsheets back and forth.`,
    bullets: [
      'Read-only access token',
      'Full books and export visibility',
      'No accountant login required',
      'Revoke access any time',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* ── Header ────────────────────────────── */}
      <section className={styles.header}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Features</p>
          <h1 className={styles.title}>
            Everything your corporation needs<br />
            <em>to stay compliant and get paid.</em>
          </h1>
          <p className={styles.sub}>
            NorthBooks is purpose-built for the specific obligations of Canadian incorporated businesses.
            Every feature addresses a real pain point — not a generic checklist.
          </p>
          <div className={styles.headerCtas}>
            <Link href="/auth/login?signup=1" className={styles.ctaPrimary}>Start for Free</Link>
            <Link href="/pricing" className={styles.ctaSecondary}>See pricing →</Link>
          </div>
        </div>
      </section>

      {/* ── Feature Sections ──────────────────── */}
      {FEATURES.map((f, i) => (
        <section
          key={f.id}
          id={f.id}
          className={`${styles.feature} ${i % 2 === 1 ? styles.featureAlt : ''}`}
        >
          <div className={styles.container}>
            <div className={styles.featureInner}>
              <div className={styles.featureContent}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureTag}>{f.tag}</div>
                <h2 className={styles.featureTitle}>{f.title}</h2>
                <p className={styles.featureBody}>{f.body}</p>
                <ul className={styles.featureBullets}>
                  {f.bullets.map((b) => (
                    <li key={b} className={styles.featureBullet}>
                      <span className={styles.bulletCheck}>✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.featureVisual} aria-hidden="true">
                <div className={styles.visualPlaceholder}>
                  <span className={styles.visualIcon}>{f.icon}</span>
                  <span className={styles.visualLabel}>{f.title}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ── CTA ───────────────────────────────── */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>
              All of this, starting at $0/month.
            </h2>
            <p className={styles.ctaSub}>
              The free plan covers invoicing and HST tracking. Upgrade to Pro for T2 tax, payroll,
              AI parsing, and 20+ export formats.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/auth/login?signup=1" className={styles.ctaBtn}>
                Start for Free — no card required
              </Link>
              <Link href="/pricing" className={styles.ctaBtnOutline}>
                Compare plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
