'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import FAQAccordion from '@/components/marketing/FAQAccordion';
import PlanCards from '@/components/marketing/PlanCards';
import styles from './page.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

const FAQ_ITEMS = [
  {
    question: 'Is NorthBooks only for corporations?',
    answer:
      'NorthBooks is purpose-built for Canadian incorporated businesses — sole-director corporations (CCPCs) are the primary focus. If you\'re a sole proprietor, some features like HST tracking and invoicing still apply, but the T2 corporate tax module won\'t be relevant to you.',
  },
  {
    question: 'How does the free plan work?',
    answer:
      'The free plan is genuinely free — no credit card required. You get 10 invoices per month, full HST/GST/QST tracking with ITC calculations, bank statement import, and the CRA deadline calendar. You can upgrade to Pro at any time from Settings → Billing.',
  },
  {
    question: 'Can I cancel my Pro subscription at any time?',
    answer:
      'Yes. You can cancel from Settings → Billing at any time. You\'ll keep Pro access until the end of the billing period. Your data is never deleted — you\'ll just revert to the free plan limits.',
  },
  {
    question: 'Is my financial data secure and stored in Canada?',
    answer:
      'Yes. NorthBooks uses Supabase with Canadian data centre hosting and is PIPEDA-compliant. Your bookkeeping data never leaves Canadian servers. See our Privacy Policy for the full breakdown.',
  },
  {
    question: 'Does NorthBooks replace my accountant?',
    answer:
      'NorthBooks handles the day-to-day bookkeeping and produces CRA-ready outputs (T2 XML, T1 data, GIFI schedules). Most users still have their accountant review the final filing — but with NorthBooks, that review takes an hour instead of a week, which cuts the bill significantly. You can also share read-only accountant access directly through the app.',
  },
  {
    question: 'What export formats does Pro support?',
    answer:
      'Pro exports include: T2 XML (CRA e-file), T1 data, FutureTax import, TurboTax Business import, Wealthsimple Tax import, QuickBooks Online (QBO), GIFI Schedule 100/125/141, T4/T4A/T5 XML slips, PDF invoices, CSV transactions, and more. The Export Hub in the app lists all available formats for your current plan.',
  },
  {
    question: 'Does NorthBooks handle payroll?',
    answer:
      'Yes — the Pro plan includes payroll management for small corporations. You can run payroll for employees (including owner-employees), calculate CPP and EI deductions, generate T4 and T4A slips, and produce the XML files for CRA T4 filing. It\'s designed for businesses with 1–5 employees, not large payroll operations.',
  },
];

export default function PricingContent() {
  return (
    <>
      {/* ── Header ────────────────────────────── */}
      <section className={styles.header}>
        <div className={styles.container}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className={styles.headerInner}
          >
            <motion.p className={styles.eyebrow} variants={fadeUp}>Pricing</motion.p>
            <motion.h1 className={styles.title} variants={fadeUp}>
              Simple, honest pricing.<br />
              <em>Start free. Always.</em>
            </motion.h1>
            <motion.p className={styles.sub} variants={fadeUp}>
              No setup fees. No per-seat pricing. No surprise invoices from us.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── Plan Cards ────────────────────────── */}
      <section className={styles.plans}>
        <div className={styles.container}>
          <PlanCards showToggle animate="enter" />
        </div>
      </section>

      {/* ── Feature Comparison Table ──────────── */}
      <section className={styles.compare}>
        <div className={styles.container}>
          <motion.h2
            className={styles.compareTitle}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Full feature comparison
          </motion.h2>
          <motion.div
            className={styles.table}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <div className={styles.tableFeature}>Feature</div>
              <div className={styles.tableCell}>Free</div>
              <div className={`${styles.tableCell} ${styles.tablePro}`}>Pro</div>
              <div className={`${styles.tableCell} ${styles.tableProPlus}`}>Pro Plus</div>
            </div>
            {[
              ['Invoices / month', '10', 'Unlimited', 'Unlimited'],
              ['Invoice PDF export', '✓', '✓', '✓'],
              ['Recurring invoice templates', '—', '✓', '✓'],
              ['AI invoice import (PDF)', '—', '—', '✓'],
              ['HST / GST / QST tracking', '✓', '✓', '✓'],
              ['ITC calculations', '✓', '✓', '✓'],
              ['Quick Method comparison', '—', '✓', '✓'],
              ['Remittance history', '✓', '✓', '✓'],
              ['Bank statement import', '✓', '✓', '✓'],
              ['AI transaction categorization', '—', '—', '✓'],
              ['T2 corporate tax summary', '—', '✓', '✓'],
              ['T1 personal tax summary', '—', '✓', '✓'],
              ['AI tax review (Gemini)', '—', '—', '✓'],
              ['T2 XML / GIFI export', '—', '✓', '✓'],
              ['Payroll & T4 / T4A slips', '—', '✓', '✓'],
              ['Mileage log (CRA rates)', '—', '✓', '✓'],
              ['AI receipt & slip parsing', '—', '—', '✓'],
              ['CRA deadline calendar', '✓', '✓', '✓'],
              ['CSV export', '✓', '✓', '✓'],
              ['20+ export formats', '—', '—', '✓'],
              ['Number of companies', '1', 'Unlimited', 'Unlimited'],
              ['Accountant read-only access', '—', '✓', '✓'],
              ['Priority support', '—', '✓', '✓'],
            ].map(([feat, free, pro, plus]) => (
              <div key={feat} className={styles.tableRow}>
                <div className={styles.tableFeature}>{feat}</div>
                <div className={styles.tableCell}>{free}</div>
                <div className={`${styles.tableCell} ${styles.tablePro}`}>{pro}</div>
                <div className={`${styles.tableCell} ${styles.tableProPlus}`}>{plus}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────── */}
      <section className={styles.faq}>
        <div className={styles.container}>
          <motion.div
            className={styles.faqInner}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div className={styles.faqHeader} variants={fadeUp}>
              <p className={styles.eyebrow}>FAQ</p>
              <h2 className={styles.faqTitle}>Common questions</h2>
            </motion.div>
            <motion.div variants={fadeUp}>
              <FAQAccordion items={FAQ_ITEMS} />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────── */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <motion.div
            className={styles.ctaInner}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className={styles.ctaTitle}>
              Ready to take back your evenings?
            </h2>
            <p className={styles.ctaSub}>
              Start with the free plan — upgrade any time. No credit card, no commitment.
            </p>
            <Link href="/auth/login?signup=1" className={styles.ctaBtn}>
              Create your free account
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
