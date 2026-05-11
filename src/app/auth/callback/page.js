'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import CanBooksLogo from '@/components/CanBooksLogo';

/**
 * OAuth callback handler — Supabase redirects here after Google sign-in.
 * Exchanges the URL code for a session, then redirects to the app.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isAccountant = params.get('accountant') === '1';
    const isRecovery   = params.get('type') === 'recovery';

    // Supabase injects the session into the URL hash automatically.
    // getSession() picks it up after the page loads.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        window.location.href = '/auth/login';
        return;
      }
      if (isRecovery) {
        window.location.href = '/settings?tab=security';
        return;
      }
      if (isAccountant) {
        window.localStorage.setItem('accountant_mode', '1');
        window.location.href = '/accountant';
        return;
      }
      window.location.href = '/dashboard';
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
      <CanBooksLogo size={48} />
      <p style={{ color: 'var(--text-secondary)' }}>Signing you in…</p>
    </div>
  );
}
