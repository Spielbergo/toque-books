'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import CanBooksLogo from '@/components/CanBooksLogo';
import Header from './Header';
import styles from './AppShell.module.css';

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { appLoading, activeCompanyId, state } = useApp();
  const { user, authLoading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (!isDesktop) return;
    setSidebarCollapsed(window.localStorage.getItem('sidebar_collapsed') === '1');
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login');
    }
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accountant-mode users have no business in the main app — send them straight to /accountant
  useEffect(() => {
    if (authLoading || !user) return;
    if (window.localStorage.getItem('accountant_mode') === '1') {
      router.replace('/accountant');
    }
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /companies if no company selected
  useEffect(() => {
    if (authLoading || appLoading || !user) return;
    if (window.localStorage.getItem('accountant_mode') === '1') return;
    if (!activeCompanyId && pathname !== '/companies') {
      router.replace('/companies');
    }
  }, [authLoading, appLoading, user, activeCompanyId, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /onboarding for new companies that haven't been set up yet
  useEffect(() => {
    if (authLoading || appLoading || !user) return;
    if (window.localStorage.getItem('accountant_mode') === '1') return;
    if (!activeCompanyId) return;
    if (!state?.onboardingCompleted && pathname !== '/onboarding' && pathname !== '/companies') {
      router.replace('/onboarding');
    }
  }, [authLoading, appLoading, user, activeCompanyId, state?.onboardingCompleted, state?.settings?.companyName, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close sidebar on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Full-screen loading while companies / company data load
  if (appLoading) {
    return (
      <div className={styles.loadingScreen}>
        <CanBooksLogo size={64} />
        <p className={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {/* Skip navigation — visible on keyboard focus only */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => {
          setSidebarCollapsed(prev => {
            const next = !prev;
            window.localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
            return next;
          });
        }}
      />

      <div className={`${styles.main} ${sidebarCollapsed ? styles.mainCollapsed : ''}`}>
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main id="main-content" className={styles.content} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
