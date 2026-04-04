'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import styles from './AppShell.module.css';

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { appLoading, activeCompanyId } = useApp();
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
  useEffect(() => {
    if (authLoading || appLoading) return;
    if (!activeCompanyId && pathname !== '/companies') {
      router.replace('/companies');
    }
  }, [authLoading, appLoading, activeCompanyId, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <span className={styles.loadingEmoji}>🧀</span>
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
