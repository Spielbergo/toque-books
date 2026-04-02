'use client';

import { usePathname } from 'next/navigation';
import { AppProvider } from '@/contexts/AppContext';
import AppShell from '@/components/layout/AppShell';

/**
 * Renders AuthProvider > AppProvider > AppShell for all app routes,
 * but renders bare children for /auth/* routes (no sidebar/header needed).
 */
export default function ConditionalShell({ children }) {
  const pathname = usePathname();

  if (pathname?.startsWith('/auth')) {
    // Auth pages are standalone — no sidebar/header
    return <>{children}</>;
  }

  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
