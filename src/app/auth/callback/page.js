'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import CanBooksLogo from '@/components/CanBooksLogo';
import styles from './page.module.css';

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
    const debugAuth    = params.get('debugAuth') === '1';

    const redirectToLoginWithError = (stage, message) => {
      if (!debugAuth) {
        window.location.href = '/auth/login';
        return;
      }
      const q = new URLSearchParams({
        debugAuth: '1',
        auth_stage: stage,
        auth_error: message || 'Unknown callback failure',
      });
      window.location.href = `/auth/login?${q.toString()}`;
    };

    const redirect = (session) => {
      if (!session) {
        redirectToLoginWithError('callback_no_session', 'Supabase callback completed but no session was returned.');
        return;
      }
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `app_session=1; path=/; SameSite=Lax${secure}`;
      if (isRecovery)   { window.location.href = '/settings?tab=security'; return; }
      if (isAccountant) { window.localStorage.setItem('accountant_mode', '1'); window.location.href = '/accountant'; return; }
      window.location.href = '/dashboard';
    };

    if (code) {
      // Email confirmation / magic link (PKCE): exchange code for session
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          redirect(error ? null : data.session);
        })
        .catch((err) => {
          redirectToLoginWithError('callback_exchange_failed', err?.message || 'exchangeCodeForSession failed');
        });
    } else {
      // OAuth (Google): session already in URL hash, getSession() picks it up
      supabase.auth.getSession()
        .then(({ data: { session }, error }) => {
          redirect(error ? null : session);
        })
        .catch((err) => {
          redirectToLoginWithError('callback_getSession_failed', err?.message || 'getSession failed');
        });
    }
  }, []);

  return (
    <div className={styles.centeredPage}>
      <CanBooksLogo size={48} />
      <p className={styles.signingText}>Signing you in…</p>
    </div>
  );
}
