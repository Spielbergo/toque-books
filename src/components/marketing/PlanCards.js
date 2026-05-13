'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import styles from './PlanCards.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

const FREE_FEATURES_FULL = [
  '10 invoices per month',
  'HST / GST / QST tracking',
  'ITC calculations',
  'Bank statement import (PDF)',
  'CRA deadline calendar',
  '1 company',
  'CSV export',
  'Email support',
];

const FREE_FEATURES_COMPACT = [
  '10 invoices / month',
  'HST/GST tracking',
  'Bank statement import',
  'CRA deadline calendar',
  '1 company',
];

const PRO_FEATURES_FULL = [
  'Unlimited invoices',
  'T2 corporate tax summary',
  'T1 personal tax summary',
  'Payroll & T4 / T4A slips',
  'Mileage log (CRA 2025 rates)',
  'Quick Method HST comparison',
  'Recurring invoice templates',
  'Multi-company (unlimited)',
  'Accountant read-only access',
  'CSV & PDF exports',
  'Priority support',
];

const PRO_FEATURES_COMPACT = [
  'Unlimited invoices',
  'T2 + T1 Tax Summary',
  'Payroll + T4/T4A slips',
  'Mileage log (CRA rates)',
  'Multi-company',
  'Accountant access',
];

const PRO_PLUS_FEATURES_FULL = [
  'Everything in Pro, plus:',
  'AI receipt & slip parsing (T4, T5, NOA)',
  'AI-reviewed tax summary (Gemini)',
  'AI transaction categorization',
  'AI invoice import (PDF)',
  '20+ export formats (TurboTax, FutureTax, QBO, GIFI, T2 XML…)',
];

const PRO_PLUS_FEATURES_COMPACT = [
  'Everything in Pro, plus:',
  'AI receipt & slip parsing',
  'AI tax review (Gemini)',
  '20+ export formats',
];

const PRO_MONTHLY   = 7;
const PRO_ANNUAL    = Math.round(PRO_MONTHLY  * 12 * 0.8 / 12); // $6
const PLUS_MONTHLY  = 9;
const PLUS_ANNUAL   = Math.round(PLUS_MONTHLY * 12 * 0.8 / 12); // $7

/**
 * PlanCards — shared pricing card grid.
 *
 * Props:
 *   compact      {boolean}  — compact 3-card grid for homepage teaser (default false)
 *   showToggle   {boolean}  — show monthly/annual toggle (default true)
 *   animate      {string}   — 'enter' (animate on mount) | 'scroll' (animate on scroll) | 'none'
 */
export default function PlanCards({
  compact = false,
  showToggle = true,
  animate = 'scroll',
}) {
  const [annual, setAnnual] = useState(false);

  const freeFeatures    = compact ? FREE_FEATURES_COMPACT    : FREE_FEATURES_FULL;
  const proFeatures     = compact ? PRO_FEATURES_COMPACT     : PRO_FEATURES_FULL;
  const plusFeatures    = compact ? PRO_PLUS_FEATURES_COMPACT : PRO_PLUS_FEATURES_FULL;

  const proPrice  = annual ? PRO_ANNUAL  : PRO_MONTHLY;
  const plusPrice = annual ? PLUS_ANNUAL : PLUS_MONTHLY;

  const motionProps = animate === 'enter'
    ? { initial: 'hidden', animate: 'visible', variants: stagger }
    : animate === 'scroll'
    ? { initial: 'hidden', whileInView: 'visible', viewport: { once: true, margin: '-60px' }, variants: stagger }
    : {};

  return (
    <div className={styles.wrapper}>
      {showToggle && (
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${!annual ? styles.toggleActive : ''}`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            className={`${styles.toggleBtn} ${annual ? styles.toggleActive : ''}`}
            onClick={() => setAnnual(true)}
          >
            Annual
            <span className={styles.toggleSave}>Save 20%</span>
          </button>
        </div>
      )}

      <motion.div className={`${styles.grid} ${compact ? styles.gridCompact : ''}`} {...motionProps}>

        {/* Free */}
        <motion.div className={styles.card} variants={fadeUp}>
          <div className={styles.cardTop}>
            <div className={styles.planName}>Free</div>
            <div className={styles.price}>
              <span className={styles.amount}>$0</span>
              <span className={styles.per}>/mo</span>
            </div>
            {!compact && <p className={styles.desc}>Everything you need to get started with corporate bookkeeping.</p>}
            <Link href="/auth/login?signup=1" className={styles.ctaOutline}>
              Get started — no card required
            </Link>
          </div>
          <ul className={styles.list}>
            {freeFeatures.map((f) => (
              <li key={f} className={styles.item}>
                <span className={styles.checkFree}>✓</span>{f}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Pro */}
        <motion.div className={`${styles.card} ${styles.cardPro}`} variants={fadeUp}>
          <div className={styles.badge}>Most popular</div>
          <div className={styles.cardTop}>
            <div className={styles.planName}>Pro</div>
            <div className={styles.price}>
              <span className={styles.amount}>${proPrice}</span>
              <span className={styles.per}>/mo</span>
            </div>
            {annual && !compact && (
              <p className={styles.annualNote}>
                Billed ${PRO_ANNUAL * 12}/year · saves ${(PRO_MONTHLY - PRO_ANNUAL) * 12}/year
              </p>
            )}
            {!compact && <p className={styles.desc}>Full T2 + T1 filing, payroll, and all compliance features.</p>}
            <Link href="/auth/login?signup=1" className={styles.ctaSolid}>
              Start Pro — 14-day free trial
            </Link>
          </div>
          <ul className={styles.list}>
            {proFeatures.map((f) => (
              <li key={f} className={styles.item}>
                <span className={styles.checkPro}>✓</span>{f}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Pro Plus */}
        <motion.div className={`${styles.card} ${styles.cardProPlus}`} variants={fadeUp}>
          <div className={`${styles.badge} ${styles.badgePlus}`}>Best value</div>
          <div className={styles.cardTop}>
            <div className={styles.planName}>Pro Plus</div>
            <div className={styles.price}>
              <span className={styles.amount}>${plusPrice}</span>
              <span className={styles.per}>/mo</span>
            </div>
            {annual && !compact && (
              <p className={styles.annualNote}>
                Billed ${PLUS_ANNUAL * 12}/year · saves ${(PLUS_MONTHLY - PLUS_ANNUAL) * 12}/year
              </p>
            )}
            {!compact && <p className={styles.desc}>All Pro features plus AI automation and advanced export formats.</p>}
            <Link href="/auth/login?signup=1" className={styles.ctaSolid}>
              Start Pro Plus — 14-day free trial
            </Link>
          </div>
          <ul className={styles.list}>
            {plusFeatures.map((f) => (
              <li key={f} className={`${styles.item} ${f.startsWith('Everything') ? styles.itemHeading : ''}`}>
                {!f.startsWith('Everything') && <span className={styles.checkPlus}>✓</span>}
                {f}
              </li>
            ))}
          </ul>
        </motion.div>

      </motion.div>
    </div>
  );
}
