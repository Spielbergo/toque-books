'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change / resize
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo} aria-label="NorthBooks home">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#2D7DD2" />
            <path d="M7 8h7.5a4.5 4.5 0 0 1 0 9H7V8z" fill="white" opacity="0.9" />
            <path d="M7 17h8a4.5 4.5 0 0 1 0 9v0H7v-9z" fill="white" opacity="0.6" />
            <path d="M14.5 9v7" stroke="#2D7DD2" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className={styles.logoText}>NorthBooks</span>
        </Link>

        <ul className={styles.links}>
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={styles.link}>{label}</Link>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Link href="/auth/login" className={styles.signIn}>Sign In</Link>
          <Link href="/auth/login?signup=1" className={styles.cta}>Start for Free</Link>
        </div>

        <button
          className={`${styles.hamburger} ${menuOpen ? styles.open : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ''}`} aria-hidden={!menuOpen}>
        <ul className={styles.drawerLinks}>
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={styles.drawerLink} onClick={() => setMenuOpen(false)}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.drawerActions}>
          <Link href="/auth/login" className={styles.drawerSignIn} onClick={() => setMenuOpen(false)}>Sign In</Link>
          <Link href="/auth/login?signup=1" className={styles.drawerCta} onClick={() => setMenuOpen(false)}>
            Start for Free
          </Link>
        </div>
      </div>
    </header>
  );
}
