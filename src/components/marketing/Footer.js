import Link from 'next/link';
import styles from './Footer.module.css';

const PRODUCT_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/auth/login?signup=1', label: 'Get Started Free' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo} aria-label="NorthBooks home">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="#2D7DD2" />
              <path d="M7 8h7.5a4.5 4.5 0 0 1 0 9H7V8z" fill="white" opacity="0.9" />
              <path d="M7 17h8a4.5 4.5 0 0 1 0 9v0H7v-9z" fill="white" opacity="0.6" />
            </svg>
            <span className={styles.logoText}>NorthBooks</span>
          </Link>
          <p className={styles.tagline}>
            Books done. Taxes handled.<br />Back to work.
          </p>
          <p className={styles.madeIn}>Made in Canada 🍁</p>
        </div>

        <div className={styles.columns}>
          <div className={styles.column}>
            <h3 className={styles.columnHead}>Product</h3>
            <ul className={styles.columnList}>
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}><Link href={href} className={styles.columnLink}>{label}</Link></li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnHead}>Company</h3>
            <ul className={styles.columnList}>
              {COMPANY_LINKS.map(({ href, label }) => (
                <li key={href}><Link href={href} className={styles.columnLink}>{label}</Link></li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnHead}>Legal</h3>
            <ul className={styles.columnList}>
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}><Link href={href} className={styles.columnLink}>{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <p className={styles.copy}>© {new Date().getFullYear()} NorthBooks Inc. All rights reserved.</p>
          <p className={styles.legal}>
            For Canadian incorporated businesses. Not affiliated with the CRA.
          </p>
        </div>
      </div>
    </footer>
  );
}
