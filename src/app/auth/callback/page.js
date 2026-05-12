'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import CanBooksLogo from '@/components/CanBooksLogo';

/**
 * Auth callback handler — handles both:
 *   1. OAuth (Google) — session in URL hash, picked up by getSession()
 *   2. Email confirmation / magic link — 'code' query param (PKCE flow)
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    const params      = new URLSearchParams(window.location.search);
    const code        = params.get('code');
    const isAccountant = params.get('accountant') === '1';
    const isRecovery   = params.get('type') === 'recovery';

    const redirect = (session) => {
      if (!session) { window.location.href = '/auth/login'; return; }
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `app_session=1; path=/; SameSite=Strict${secure}`;
      if (isRecovery)   { window.location.href = '/settings?tab=security'; return; }
      if (isAccountant) { window.localStorage.setItem('accountant_mode', '1'); window.location.href = '/accountant'; return; }
      window.location.href = '/dashboard';
    };

    if (code) {
      // Email confirmation / magic link (PKCE): exchange code for session
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        redirect(error ? null : data.session);
      });
    } else {
      // OAuth (Google): session already in URL hash, getSession() picks it up
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        redirect(error ? null : session);
      });
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
      <CanBooksLogo size={48} />
      <p style={{ color: 'var(--text-secondary)' }}>Signing you in…</p>
    </div>
  );
}
