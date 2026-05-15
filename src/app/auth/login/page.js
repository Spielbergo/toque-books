'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import styles from './page.module.css';

function syncSessionCookie(hasSession) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const sameSite = '; SameSite=Lax';
  if (hasSession) {
    document.cookie = `app_session=1; path=/${sameSite}${secure}`;
  } else {
    document.cookie = `app_session=; path=/${sameSite}${secure}; Max-Age=0`;
  }
}

function friendlyError(err) {
  const msg = err?.message || '';
  if (msg.includes('Network timeout'))            return 'Connection timed out. Please try again.';
  if (msg.includes('Invalid login credentials'))  return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed'))         return 'Please confirm your email before signing in.';
  if (msg.includes('User already registered'))     return 'An account with this email already exists.';
  if (msg.includes('Password should be'))          return 'Password must be at least 6 characters.';
  if (msg.includes('Too many requests'))           return 'Too many attempts. Please wait a moment.';
  return msg || 'Something went wrong. Please try again.';
}

export default function LoginPage() {
  const [tab,      setTab]      = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');
  const [debugAuth, setDebugAuth] = useState(false);
  const [debugStage, setDebugStage] = useState('idle');
  const [debugDetail, setDebugDetail] = useState('');
  const [forceStay, setForceStay] = useState(false);

  const trace = (stage, detail = '') => {
    setDebugStage(stage);
    setDebugDetail(detail || '');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === '1') setTab('signup');
    const debugEnabled = params.get('debugAuth') === '1';
    const shouldForceStay = params.get('forceStay') === '1';
    setDebugAuth(debugEnabled);
    setForceStay(shouldForceStay);

    if (debugEnabled) {
      const callbackStage = params.get('auth_stage');
      const callbackError = params.get('auth_error');
      if (callbackStage || callbackError) {
        trace(callbackStage || 'callback_returned_error', callbackError || 'No additional error message.');
      } else {
        trace('login_page_loaded', 'Diagnostics enabled.');
      }
    }

    // If an existing session is present, sync guard cookie and skip login screen.
    supabase.auth.getSession().then(({ data, error }) => {
      if (debugEnabled) {
        trace(
          'initial_getSession_complete',
          error?.message
            ? `error: ${error.message}`
            : `session_user=${data?.session?.user?.id ? 'yes' : 'no'}`,
        );
      }
      if (data?.session?.user) {
        if (debugEnabled && shouldForceStay) {
          trace('session_found_staying', 'Existing session detected but staying on login due to forceStay=1.');
        } else {
          if (debugEnabled) trace('session_found_redirecting', 'Existing session detected; redirecting to /dashboard.');
          syncSessionCookie(true);
          window.location.href = '/dashboard';
        }
      }
    }).catch((err) => {
      if (debugEnabled) trace('initial_getSession_failed', err?.message || 'Unknown getSession error');
    });
  }, []);

  const reset = () => { setError(''); setInfo(''); };

  async function handleSubmit(e) {
    e.preventDefault();
    reset();
    if (debugAuth) trace(tab === 'login' ? 'email_login_started' : 'signup_started');
    if (tab === 'signup' && password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (debugAuth) trace('email_login_success', 'Supabase accepted credentials. Syncing cookie and redirecting.');
        syncSessionCookie(true);
        window.location.href = '/dashboard';
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          if (debugAuth) trace('signup_success_with_session', 'Session returned immediately. Syncing cookie and redirecting.');
          syncSessionCookie(true);
          window.location.href = '/dashboard';
        }
        else {
          if (debugAuth) trace('signup_success_needs_confirmation', 'No session returned. Awaiting email confirmation.');
          setInfo('Check your email for a confirmation link.');
        }
      }
    } catch (err) {
      if (debugAuth) trace('email_auth_failed', err?.message || 'Unknown email auth error');
      setError(friendlyError(err));
    }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    reset();
    if (debugAuth) trace('google_oauth_started', 'Calling signInWithOAuth. Browser should redirect to provider.');
    setGLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback${debugAuth ? '?debugAuth=1' : ''}` },
      });
      if (error) throw error;
    } catch (err) {
      if (debugAuth) trace('google_oauth_failed', err?.message || 'Unknown OAuth error');
      setError(friendlyError(err));
      setGLoading(false);
    }
  }

  async function handleForgot() {
    if (!email) { setError('Enter your email first.'); return; }
    if (debugAuth) trace('password_reset_started');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery${debugAuth ? '&debugAuth=1' : ''}`,
      });
      if (error) throw error;
      if (debugAuth) trace('password_reset_sent', 'Supabase accepted reset request.');
      setInfo('Password reset email sent.');
    } catch (err) {
      if (debugAuth) trace('password_reset_failed', err?.message || 'Unknown reset error');
      setError(err.message);
    }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.page}>

      {/* -- LEFT PANEL -- */}
      <div className={styles.brand} aria-hidden="true" tabIndex="-1">
        <div className={styles.brandInner}>
          <Link href="/" className={styles.backLink}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            northbooks.ca
          </Link>

          <div className={styles.logoRow}>
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="rgba(255,255,255,0.12)"/>
              <path d="M7 8h7.5a4.5 4.5 0 0 1 0 9H7V8z" fill="white"/>
              <path d="M7 17h8a4.5 4.5 0 0 1 0 9v0H7v-9z" fill="white" opacity="0.6"/>
            </svg>
            <span className={styles.logoName}>NorthBooks</span>
          </div>

          <h1 className={styles.headline}>Books done.<br/>Taxes handled.<br/>Back to work.</h1>

          <ul className={styles.features}>
            {['HST/GST tracking & CRA deadline reminders','T2 corporate & T1 personal tax summaries','Invoices, expenses & bank import','Built exclusively for Canadian small business'].map(t => (
              <li key={t}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.15)"/><path d="M5 8l2.5 2.5L11 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {t}
              </li>
            ))}
          </ul>

          <p className={styles.canada}>Made in Canada</p>
        </div>
      </div>

      {/* -- RIGHT PANEL -- */}
      <div className={styles.form}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>{tab === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className={styles.formSub}>{tab === 'login' ? 'Sign in to continue to NorthBooks.' : 'Start free - no credit card required.'}</p>

          <div className={styles.tabs}>
            <button type="button" className={`${styles.tabBtn} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => { setTab('login'); reset(); }}>Sign in</button>
            <button type="button" className={`${styles.tabBtn} ${tab === 'signup' ? styles.tabActive : ''}`} onClick={() => { setTab('signup'); reset(); }}>Create account</button>
          </div>

          {debugAuth && (
            <div className={styles.debugPanel}>
              <div className={styles.debugTitle}>Auth Diagnostics (temporary)</div>
              <div className={styles.debugRow}><strong>Stage:</strong> {debugStage}</div>
              <div className={styles.debugRow}><strong>Detail:</strong> {debugDetail || 'n/a'}</div>
              <div className={styles.debugRow}><strong>forceStay:</strong> {forceStay ? 'enabled' : 'disabled'}</div>
              <div className={styles.debugRow}><strong>Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'n/a'}</div>
              <div className={styles.debugRow}><strong>Supabase URL set:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'yes' : 'no'}</div>
              <div className={styles.debugRow}><strong>Publishable key set:</strong> {process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? 'yes' : 'no'}</div>
              <div className={styles.debugRow}><strong>app_session cookie:</strong> {typeof document !== 'undefined' && document.cookie.includes('app_session=1') ? 'present' : 'missing'}</div>
            </div>
          )}

          {error && <div role="alert" className={styles.alertError}>{error}</div>}
          {info  && <div className={styles.alertInfo}>{info}</div>}

          <button type="button" className={styles.googleBtn} onClick={handleGoogle} disabled={gLoading || loading}>
            {gLoading ? <span className={styles.spinner}/> : (
              <svg className={styles.googleIcon} width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          <div className={styles.divider}><span>or</span></div>

          <form className={styles.emailForm} onSubmit={handleSubmit}>
            {tab === 'signup' && (
              <div className={styles.field}>
                <label className={styles.label}>Full name</label>
                <input className={styles.input} type="text" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required autoComplete="name"/>
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                Password
                {tab === 'login' && <button type="button" className={styles.forgotLink} onClick={handleForgot}>Forgot?</button>}
              </label>
              <input className={styles.input} type="password" placeholder="********" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={tab === 'login' ? 'current-password' : 'new-password'}/>
            </div>
            {tab === 'signup' && (
              <div className={styles.field}>
                <label className={styles.label}>Confirm password</label>
                <input className={styles.input} type="password" placeholder="********" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password"/>
              </div>
            )}
            <button className={styles.submitBtn} type="submit" disabled={loading || gLoading}>
              {loading ? <span className={styles.spinner}/> : (tab === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className={styles.switchNote}>
            {tab === 'login'
              ? <><span>No account? </span><button type="button" className={styles.switchBtn} onClick={() => { setTab('signup'); reset(); }}>Create one free</button></>
              : <><span>Have an account? </span><button type="button" className={styles.switchBtn} onClick={() => { setTab('login'); reset(); }}>Sign in</button></>
            }
          </p>
        </div>
      </div>
    </div>
  );
}
