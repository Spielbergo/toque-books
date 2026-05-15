'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import CanBooksLogo from '@/components/CanBooksLogo';
import styles from '../../auth/login/page.module.css';
import portalStyles from './portal.module.css';

function syncSessionCookie(hasSession) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const sameSite = '; SameSite=Lax';
  if (hasSession) {
    document.cookie = `app_session=1; path=/${sameSite}${secure}`;
  } else {
    document.cookie = `app_session=; path=/${sameSite}${secure}; Max-Age=0`;
  }
}

function friendlyAuthError(err) {
  const msg = err?.message || '';
  if (msg.includes('Invalid login credentials'))  return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed'))         return 'Please confirm your email before signing in.';
  if (msg.includes('User already registered'))     return 'An account with this email already exists. Try signing in instead.';
  if (msg.includes('Password should be'))          return 'Password must be at least 8 characters.';
  if (msg.includes('otp_expired') || msg.includes('Token has expired')) return 'This invite link has expired. Ask your client to send a new invite.';
  if (msg.includes('otp_disabled') || msg.includes('invalid'))          return 'This invite link has already been used or is invalid. Ask your client to send a new one.';
  return msg || 'An error occurred. Please try again.';
}

export default function AccountantLoginPage() {
  const [tab, setTab]           = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  // Magic link state
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');

  const reset = () => { setError(''); setInfo(''); };

  // Detect magic link (OTP token_hash) on page load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || type !== 'magiclink') return;

    setLoading(true);
    setInfo('Signing you in…');
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
      .then(({ error }) => {
        if (error) throw error;
        syncSessionCookie(true);
        window.localStorage.setItem('accountant_mode', '1');
        window.location.href = '/accountant';
      })
      .catch(err => {
        setError(friendlyAuthError(err) + ' Enter your email below.');
        setMagicLinkPending(true);
        setLoading(false);
        setInfo('');
      });
  }, []);

  const completeMagicLink = async e => {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: magicEmail.trim() });
      if (error) throw error;
      setInfo('Magic link sent! Check your email.');
      setMagicLinkPending(false);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async e => {
    e.preventDefault();
    reset();
    if (tab === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
      }
      syncSessionCookie(true);
      window.localStorage.setItem('accountant_mode', '1');
      window.location.href = '/accountant';
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    reset();
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?accountant=1` },
      });
      if (error) throw error;
    } catch (err) {
      setError(friendlyAuthError(err));
      setGoogleLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <CanBooksLogo size={48} />
          <div>
            <h1 className={styles.appName}>CanBooks</h1>
            <p className={styles.appTagline}>Accountant Portal</p>
          </div>
        </div>

        <div className={portalStyles.portalBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Read-only access · Your client must add your email in their Settings
        </div>

        {error && <div className={styles.alertError}>{error}</div>}
        {info  && <div className={styles.alertInfo}>{info}</div>}

        {/* Magic link email confirmation */}
        {magicLinkPending ? (
          <form onSubmit={completeMagicLink} className={styles.form}>
            <p className={portalStyles.magicPrompt}>
              Enter the email address your invite was sent to:
            </p>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email"
                placeholder="accountant@example.com"
                value={magicEmail}
                onChange={e => setMagicEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </div>
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Complete Sign-in'}
            </button>
          </form>
        ) : (
          <>
            <div className={styles.tabs}>
              <button className={`${styles.tabBtn} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => { setTab('login'); reset(); }}>Sign in</button>
              <button className={`${styles.tabBtn} ${tab === 'signup' ? styles.tabActive : ''}`} onClick={() => { setTab('signup'); reset(); }}>Create account</button>
            </div>

            <button className={styles.googleBtn} onClick={handleGoogle} disabled={googleLoading || loading} type="button">
              {googleLoading ? <span className={styles.spinner} /> : (
                <svg className={styles.googleIcon} viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <div className={styles.divider}><span>or</span></div>

            <form onSubmit={handleEmailAuth} className={styles.form}>
              {tab === 'signup' && (
                <div className={styles.field}>
                  <label className={styles.label}>Full name</label>
                  <input className={styles.input} type="text" placeholder="Jane Smith, CPA" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={styles.input} type="email" placeholder="accountant@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  Password
                  {tab === 'login' && (
                    <button type="button" className={styles.forgotLink} onClick={async () => {
                      if (!email) { setError('Enter your email first.'); return; }
                      setLoading(true);
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
                        });
                        if (error) throw error;
                        setInfo('Password reset email sent.');
                      }
                      catch (err) { setError(err.message); }
                      finally { setLoading(false); }
                    }}>Forgot password?</button>
                  )}
                </label>
                <input className={styles.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
              </div>
              {tab === 'signup' && (
                <div className={styles.field}>
                  <label className={styles.label}>Confirm password</label>
                  <input className={styles.input} type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
                </div>
              )}
              <button className={styles.submitBtn} type="submit" disabled={loading || googleLoading}>
                {loading ? <span className={styles.spinner} /> : (tab === 'login' ? 'Sign in to Portal' : 'Create Account')}
              </button>
            </form>
          </>
        )}

        <p className={portalStyles.backLink}>
          Business owner? <a href="/auth/login">Sign in here</a>
        </p>
      </div>
    </div>
  );
}
