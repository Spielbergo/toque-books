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
  const { appLoading, activeCompanyId, state } = useApp();
  const { user, authLoading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login');
    }
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /companies if no company selected (and not already there)
  // /accountant is exempt — accountant-only users have no company of their own
  useEffect(() => {
    if (authLoading || appLoading || !user) return;
    if (pathname === '/accountant') return;
    if (!activeCompanyId && pathname !== '/companies') {
      router.replace('/companies');
    }
  }, [authLoading, appLoading, user, activeCompanyId, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /onboarding for new companies that haven't been set up yet
  useEffect(() => {
    if (authLoading || appLoading || !user) return;
    if (pathname === '/accountant') return;
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
      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={styles.main}>
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
