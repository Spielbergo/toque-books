'use client';

import { usePathname } from 'next/navigation';
import { AppProvider } from '@/contexts/AppContext';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { ToastProvider } from '@/contexts/ToastContext';
import AppShell from '@/components/layout/AppShell';

/**
 * Renders AuthProvider > AppProvider > AppShell for all app routes,
 * but renders bare children for /auth/* routes (no sidebar/header needed).
 * /onboarding gets AppProvider but no shell (full-screen wizard layout).
 */
export default function ConditionalShell({ children }) {
  const pathname = usePathname();

  if (
    pathname === '/' ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/accountant') ||
    pathname?.startsWith('/pricing') ||
    pathname?.startsWith('/features') ||
    pathname?.startsWith('/about') ||
    pathname?.startsWith('/contact') ||
    pathname?.startsWith('/blog') ||
    pathname?.startsWith('/privacy') ||
    pathname?.startsWith('/terms')
  ) {
    // Standalone pages — marketing shell / no app sidebar
    return <>{children}</>;
  }

  if (pathname?.startsWith('/onboarding')) {
    // Onboarding pages need data context but no sidebar/header
    return (
      <ToastProvider>
        <UserProfileProvider>
          <AppProvider>{children}</AppProvider>
        </UserProfileProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <UserProfileProvider>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </UserProfileProvider>
    </ToastProvider>
  );
}
