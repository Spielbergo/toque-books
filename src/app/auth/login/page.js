'use client';

import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import CanBooksLogo from '@/components/CanBooksLogo';
import styles from './page.module.css';

function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
    return 'Incorrect email or password.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try signing in instead.';
  if (code === 'auth/weak-password')        return 'Password must be at least 6 characters.';
  if (code === 'auth/invalid-email')        return 'Please enter a valid email address.';
  if (code === 'auth/user-disabled')        return 'This account has been disabled.';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in popup was closed. Please try again.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  if (code === 'auth/too-many-requests')    return 'Too many failed attempts. Please wait a moment and try again.';
  return err?.message?.replace(/^Firebase:\s*/i, '').replace(/\s*\(auth\/[^)]+\)\.?$/, '') || 'An error occurred. Please try again.';
}

export default function LoginPage() {
  const [tab, setTab]         = useState('login'); // 'login' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');

  const reset = () => { setError(''); setInfo(''); };

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
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = '/dashboard';
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        window.location.href = '/dashboard';
      }
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
      await signInWithPopup(auth, new GoogleAuthProvider());
      window.location.href = '/dashboard';
    } catch (err) {
      setError(friendlyAuthError(err));
      setGoogleLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoRow}>
          <CanBooksLogo size={48} />
          <div>
            <h1 className={styles.appName}>NorthBooks</h1>
            <p className={styles.appTagline}>Canadian corporate &amp; personal tax tracker</p>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tabBtn} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => { setTab('login'); reset(); }}>
            Sign in
          </button>
          <button className={`${styles.tabBtn} ${tab === 'signup' ? styles.tabActive : ''}`} onClick={() => { setTab('signup'); reset(); }}>
            Create account
          </button>
        </div>

        {/* Alerts */}
        {error && <div className={styles.alertError}>{error}</div>}
        {info  && <div className={styles.alertInfo}>{info}</div>}

        {/* Google */}
        <button className={styles.googleBtn} onClick={handleGoogle} disabled={googleLoading || loading} type="button">
          {googleLoading ? (
            <span className={styles.spinner} />
          ) : (
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

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className={styles.form}>
          {tab === 'signup' && (
            <div className={styles.field}>
              <label className={styles.label}>Full name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              Password
              {tab === 'login' && (
                <button type="button" className={styles.forgotLink} onClick={async () => {
                  if (!email) { setError('Enter your email first.'); return; }
                  setLoading(true);
                  try {
                    await sendPasswordResetEmail(auth, email);
                    setInfo('Password reset email sent.');
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}>
                  Forgot password?
                </button>
              )}
            </label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {tab === 'signup' && (
            <div className={styles.field}>
              <label className={styles.label}>Confirm password</label>
              <input
                className={styles.input}
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          )}
          <button className={styles.submitBtn} type="submit" disabled={loading || googleLoading}>
            {loading ? <span className={styles.spinner} /> : (tab === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  );
}
