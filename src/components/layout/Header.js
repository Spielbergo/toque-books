'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import styles from './Header.module.css';

const PAGE_TITLES = {
  '/':                 { title: 'Dashboard',        sub: 'Overview & quick stats' },
  '/invoices':         { title: 'Invoices',          sub: 'Create and manage client invoices' },
  '/clients':          { title: 'Clients',           sub: 'Manage client and payee records' },
  '/expenses':         { title: 'Expenses',          sub: 'Track business expenses & home office' },
  '/bank-statements':  { title: 'Bank Statements',   sub: 'Upload and parse bank statement PDFs' },
  '/personal':         { title: 'Personal Tax',      sub: 'Dividends & personal income' },
  '/taxes':            { title: 'Tax Summary',       sub: 'Corporate & personal tax estimates' },
  '/settings':         { title: 'Settings',          sub: 'Company & app preferences' },
  '/companies':        { title: 'Companies',         sub: 'Switch or manage your companies' },
};

export default function Header({ onMenuClick }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const info      = PAGE_TITLES[pathname] || PAGE_TITLES['/'];

  const { companies, activeCompany, selectCompany } = useApp();
  const { user, signOut } = useAuth();

  const [companyOpen, setCompanyOpen] = useState(false);
  const [userOpen, setUserOpen]       = useState(false);
  const companyRef = useRef(null);
  const userRef    = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = e => {
      if (companyRef.current && !companyRef.current.contains(e.target)) setCompanyOpen(false);
      if (userRef.current    && !userRef.current.contains(e.target))    setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectCompany = async id => {
    setCompanyOpen(false);
    if (id === activeCompany?.id) return;
    await selectCompany(id);
    router.push('/');
  };

  const userInitials = (user?.displayName || user?.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className={styles.pageInfo}>
          <h1 className={styles.pageTitle}>{info.title}</h1>
          <span className={styles.pageSub}>{info.sub}</span>
        </div>
      </div>

      <div className={styles.right}>
        <ThemeToggle />

        {/* Company selector */}
        {companies.length > 0 && (
          <div className={styles.dropdown} ref={companyRef}>
            <button
              className={styles.companyBtn}
              onClick={() => { setCompanyOpen(o => !o); setUserOpen(false); }}
              title="Switch company"
            >
              <span className={styles.companyName}>{activeCompany?.name || 'Select company'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {companyOpen && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownLabel}>Switch company</div>
                {companies.map(c => (
                  <button
                    key={c.id}
                    className={`${styles.dropdownItem} ${c.id === activeCompany?.id ? styles.dropdownItemActive : ''}`}
                    onClick={() => handleSelectCompany(c.id)}
                  >
                    <span className={styles.dropdownItemIcon}>🏢</span>
                    <span className={styles.dropdownItemText}>{c.name}</span>
                    {c.id === activeCompany?.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
                <div className={styles.dropdownSep} />
                <button className={styles.dropdownItem} onClick={() => { setCompanyOpen(false); router.push('/companies'); }}>
                  <span className={styles.dropdownItemIcon}>⚙️</span>
                  <span className={styles.dropdownItemText}>Manage companies</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* User menu */}
        <div className={styles.dropdown} ref={userRef}>
          <button
            className={styles.avatarBtn}
            onClick={() => { setUserOpen(o => !o); setCompanyOpen(false); }}
            title={user?.email}
            aria-label="User menu"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="avatar" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarInitials}>{userInitials}</span>
            )}
          </button>

          {userOpen && (
            <div className={`${styles.dropdownMenu} ${styles.dropdownMenuRight}`}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.displayName || 'Account'}</span>
                <span className={styles.userEmail}>{user?.email}</span>
              </div>
              <div className={styles.dropdownSep} />
              <button className={styles.dropdownItem} onClick={() => { setUserOpen(false); signOut(); }}>
                <span className={styles.dropdownItemIcon}>🚪</span>
                <span className={styles.dropdownItemText}>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
