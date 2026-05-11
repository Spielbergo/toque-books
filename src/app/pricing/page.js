'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, PRO_FEATURES } from '@/contexts/SubscriptionContext';
import CanBooksLogo from '@/components/CanBooksLogo';
import styles from './page.module.css';

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPro } = useSubscription();

  function handleUpgrade() {
    if (!user) {
      router.push('/auth/login?redirect=/settings?tab=billing');
    } else {
      router.push('/settings?tab=billing');
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={user ? '/dashboard' : '/'} className={styles.logo}>
          <CanBooksLogo size={32} />
          <span className={styles.logoText}>NorthBooks</span>
        </Link>
        <nav className={styles.headerNav}>
          {user ? (
            <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
          ) : (
            <Link href="/auth/login" className={styles.navLink}>Sign in</Link>
          )}
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <span className={styles.heroBadge}>🇨🇦 Built for Canada</span>
          <h1 className={styles.heroTitle}>Simple, honest pricing</h1>
          <p className={styles.heroSub}>
            One plan. No surprises. Processed by{' '}
            <a href="https://www.helcim.com" target="_blank" rel="noreferrer" className={styles.helcimLink}>
              Helcim
            </a>{' '}
            — a Canadian payment company.
          </p>
        </div>

        <div className={styles.cards}>
          {/* Free */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.planLabel}>Free</span>
              <div className={styles.price}>
                <span className={styles.priceAmount}>$0</span>
                <span className={styles.pricePeriod}>/mo</span>
              </div>
            </div>
            <ul className={styles.featureList}>
              <li className={styles.featureItem}>
                <CheckIcon /> 1 company
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> 10 invoices per month
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> Expenses &amp; HST tracking
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> Tax summary (T1 &amp; T2)
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> CSV exports
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> Accountant access sharing
              </li>
              <li className={`${styles.featureItem} ${styles.featureLocked}`}>
                <LockIcon /> PDF exports (T5, T4, T2 worksheet)
              </li>
              <li className={`${styles.featureItem} ${styles.featureLocked}`}>
                <LockIcon /> AI receipt parsing
              </li>
              <li className={`${styles.featureItem} ${styles.featureLocked}`}>
                <LockIcon /> Mileage log
              </li>
              <li className={`${styles.featureItem} ${styles.featureLocked}`}>
                <LockIcon /> Multiple companies
              </li>
            </ul>
            {user ? (
              isPro ? null : (
                <div className={styles.currentPlan}>Your current plan</div>
              )
            ) : (
              <Link href="/auth/login" className={styles.btnSecondary}>Get started free</Link>
            )}
          </div>

          {/* Pro */}
          <div className={`${styles.card} ${styles.cardPro}`}>
            <div className={styles.proRibbon}>Most Popular</div>
            <div className={styles.cardHeader}>
              <span className={styles.planLabel}>Pro</span>
              <div className={styles.price}>
                <span className={styles.priceAmount}>$7</span>
                <span className={styles.pricePeriod}>/mo CAD</span>
              </div>
              <p className={styles.priceNote}>+HST where applicable</p>
            </div>
            <ul className={styles.featureList}>
              <li className={styles.featureItem}>
                <CheckIcon /> Everything in Free
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> Unlimited companies
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> Unlimited invoices
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> PDF exports (T5, T4, T2 worksheet, Schedule 1)
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> AI receipt parsing
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> Mileage log
              </li>
              <li className={styles.featureItem}>
                <CheckIcon /> Priority support
              </li>
            </ul>

            {user && isPro ? (
              <div className={styles.currentPlanPro}>✓ Your current plan</div>
            ) : (
              <button onClick={handleUpgrade} className={styles.btnPrimary}>
                {user ? 'Upgrade to Pro' : 'Start with Pro'}
              </button>
            )}
          </div>
        </div>

        <div className={styles.trust}>
          <p className={styles.trustText}>
            Payments processed securely by{' '}
            <a href="https://www.helcim.com" target="_blank" rel="noreferrer" className={styles.helcimLink}>
              Helcim Inc.
            </a>
            , a Calgary-based Canadian payment company.
            Cancel anytime — no long-term contracts.
          </p>
          <div className={styles.trustBadges}>
            <span className={styles.trustBadge}>🇨🇦 Canadian company</span>
            <span className={styles.trustBadge}>🔒 PCI compliant</span>
            <span className={styles.trustBadge}>↩ Cancel anytime</span>
          </div>
        </div>
      </main>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
