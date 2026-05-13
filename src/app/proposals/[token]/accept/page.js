'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

/**
 * Public proposal acceptance page.
 * URL: /proposals/[token]/accept
 *
 * Because proposal data lives in client-side localStorage (AppContext),
 * we can't look it up server-side. Instead:
 *  1. We show a simple acceptance confirmation form.
 *  2. On submit, we POST to /api/proposals/accept with the token + acceptor name.
 *  3. The API route records acceptance in a Supabase table.
 *  4. The proposal owner is notified by email (if Resend is configured).
 *
 * The proposal owner can see accepted status in their dashboard.
 */
export default function ProposalAcceptPage({ params }) {
  const { token } = params;
  const [name,      setName]      = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleAccept = async e => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proposals/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acceptorName: name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Something went wrong.');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className={styles.successTitle}>Proposal Accepted</h1>
          <p className={styles.successDesc}>
            Thank you, <strong>{name}</strong>. Your acceptance has been recorded and the sender has been notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#1B3A5C"/>
            <path d="M7 8h7.5a4.5 4.5 0 0 1 0 9H7V8z" fill="white"/>
            <path d="M7 17h8a4.5 4.5 0 0 1 0 9v0H7v-9z" fill="white" opacity="0.6"/>
          </svg>
          <span className={styles.logoName}>NorthBooks</span>
        </div>
        <h1 className={styles.title}>Accept Proposal</h1>
        <p className={styles.desc}>
          You have been sent a proposal. Enter your name below to confirm acceptance.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleAccept} className={styles.form}>
          <label className={styles.label}>Your Full Name</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Submitting…' : 'Accept Proposal'}
          </button>
        </form>
      </div>
    </div>
  );
}
