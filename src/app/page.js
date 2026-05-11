'use client';

import Link from 'next/link';
import NorthBooksLogo from '@/components/CanBooksLogo';

export default function HomePage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-app)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      gap: '1.5rem',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <NorthBooksLogo size={64} />
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          NorthBooks
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0 }}>
          Canadian accounting software for small businesses.
        </p>
      </div>
      <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0 }}>
        Website coming soon.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/auth/login"
          style={{
            padding: '0.6rem 1.5rem',
            background: '#4f46e5',
            color: '#fff',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            textDecoration: 'none',
          }}
        >
          Sign in
        </Link>
        <Link
          href="/accountant/login"
          style={{
            padding: '0.6rem 1.5rem',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            textDecoration: 'none',
          }}
        >
          Accountant portal
        </Link>
      </div>
    </main>
  );
}
import { calculateCorporateTax, calculateHSTSummary, calculatePersonalTax, calculateHomeOfficeDeduction, getDeductibleAmount, checkHSTThreshold } from '@/lib/taxCalculations';
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatters';
import { StatCard } from '@/components/ui/Card';