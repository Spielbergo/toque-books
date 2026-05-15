'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { formatDate } from '@/lib/formatters';
import styles from './page.module.css';

// ─── Deadline builder ────────────────────────────────────────────────────────

function addMonths(isoDate, months) {
  if (!isoDate) return null;
  const d = new Date(isoDate + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function setDayOfYear(year, month, day) {
  // month is 1-indexed
  return new Date(year, month - 1, day).toISOString().slice(0, 10);
}

/**
 * Build the full deadline list for a given company configuration.
 */
function buildDeadlines({ fyEndDate, hasHST, hasPayroll, businessType, province, today }) {
  const deadlines = [];
  const nowYear  = new Date(today + 'T00:00:00').getFullYear();

  // ── 1. T2 Corporate filing (6 months after FY end) ───────────────────────
  if (fyEndDate) {
    const t2Filing = addMonths(fyEndDate, 6);
    deadlines.push({
      id: 't2-filing',
      title: 'T2 Corporate Return — Filing',
      date: t2Filing,
      desc: '6 months after fiscal year end. File using CRA-certified software or a CPA.',
      category: 'corporate',
      link: '/taxes',
    });

    // Corporate tax payment (2 months for non-CCPC, 3 months for CCPC using SBD)
    const ccpc = businessType !== 'other' && businessType !== 'pc';
    const corpPayMonths = ccpc ? 3 : 2;
    deadlines.push({
      id: 't2-payment',
      title: `T2 Corporate Tax — Balance Due`,
      date: addMonths(fyEndDate, corpPayMonths),
      desc: `${corpPayMonths} months after fiscal year end${ccpc ? ' (CCPC with SBD income)' : ''}. Remaining balance owing to CRA.`,
      category: 'corporate',
      link: '/taxes',
    });
  }

  // ── 2. T1 Personal filing & payment ─────────────────────────────────────
  for (let yr = nowYear - 1; yr <= nowYear; yr++) {
    deadlines.push({
      id: `t1-filing-${yr}`,
      title: `T1 Personal Return ${yr} — Filing`,
      date: setDayOfYear(yr + 1, 4, 30),
      desc: `April 30, ${yr + 1}. (June 15 if you or your spouse/common-law partner have self-employment income, but any balance owing is still due April 30.)`,
      category: 'personal',
      link: '/personal',
    });
    deadlines.push({
      id: `t1-payment-${yr}`,
      title: `T1 Personal Tax ${yr} — Balance Due`,
      date: setDayOfYear(yr + 1, 4, 30),
      desc: 'April 30. Interest accrues on any balance not paid by this date, even if you file June 15.',
      category: 'personal',
      link: '/personal',
    });
  }

  // ── 3. GST/HST quarterly remittances ────────────────────────────────────
  if (hasHST) {
    const isQC = province === 'QC';
    const taxName = isQC ? 'GST' : 'HST';
    // CRA quarterly remittance due dates: Apr 30, Jul 31, Oct 31, Jan 31
    const hstDates = [
      [4, 30], [7, 31], [10, 31], [1, 31],
    ];
    for (let yr = nowYear - 1; yr <= nowYear + 1; yr++) {
      hstDates.forEach(([month, day], i) => {
        const dateYear = month === 1 ? yr + 1 : yr;
        const date = setDayOfYear(dateYear, month, day);
        if (date >= addMonths(today, -3) && date <= addMonths(today, 12)) {
          deadlines.push({
            id: `hst-q${i + 1}-${yr}`,
            title: `${taxName} Quarterly Remittance — Q${i + 1} ${yr}`,
            date,
            desc: `Remit net ${taxName} to CRA by this date. Check your CRA My Business Account for your exact filing frequency.`,
            category: 'hst',
            link: '/hst-tracker',
          });
        }
      });
      // QST — Revenu Québec quarterly
      if (isQC) {
        hstDates.forEach(([month, day], i) => {
          const dateYear = month === 1 ? yr + 1 : yr;
          const date = setDayOfYear(dateYear, month, day);
          if (date >= addMonths(today, -3) && date <= addMonths(today, 12)) {
            deadlines.push({
              id: `qst-q${i + 1}-${yr}`,
              title: `QST Quarterly Remittance — Q${i + 1} ${yr}`,
              date,
              desc: 'Remit net QST to Revenu Québec. Filed separately from GST.',
              category: 'hst',
              link: '/taxes',
            });
          }
        });
      }
    }
  }

  // ── 4. CRA Instalment payments (March, June, Sep, Dec 15) ───────────────
  // Required if prior-year balance > $3,000 (or $1,800 in QC)
  const instalmentDates = [[3, 15], [6, 15], [9, 15], [12, 15]];
  for (const yr of [nowYear - 1, nowYear]) {
    instalmentDates.forEach(([month, day], i) => {
      const date = setDayOfYear(yr, month, day);
      if (date >= addMonths(today, -3) && date <= addMonths(today, 12)) {
        deadlines.push({
          id: `instalment-q${i + 1}-${yr}`,
          title: `Personal Tax Instalment — Q${i + 1} ${yr}`,
          date,
          desc: 'Required if your prior-year net tax owing exceeded $3,000. Avoids instalment interest charges.',
          category: 'instalment',
          link: '/personal',
        });
      }
    });
  }

  // ── 5. T4 slips (employers) ─────────────────────────────────────────────
  if (hasPayroll) {
    for (const yr of [nowYear - 1, nowYear]) {
      deadlines.push({
        id: `t4-${yr}`,
        title: `T4 Slips & T4 Summary ${yr} — Due CRA`,
        date: setDayOfYear(yr + 1, 2, 28),
        desc: 'Distribute T4 slips to employees AND file T4 Summary with CRA by the last day of February.',
        category: 'payroll',
        link: '/payroll',
      });
      deadlines.push({
        id: `t4a-${yr}`,
        title: `T4A Slips ${yr} — Due CRA`,
        date: setDayOfYear(yr + 1, 2, 28),
        desc: 'File T4A for contractors/vendors paid $500+ in fees for services (Box 048) or commissions.',
        category: 'payroll',
        link: '/payroll',
      });
    }
  }

  // ── 6. T5 slips (dividends) ──────────────────────────────────────────────
  for (const yr of [nowYear - 1, nowYear]) {
    deadlines.push({
      id: `t5-${yr}`,
      title: `T5 Dividend Slips ${yr} — Due CRA`,
      date: setDayOfYear(yr + 1, 2, 28),
      desc: 'File T5 Statement of Investment Income for dividends paid to shareholders.',
      category: 'corporate',
      link: '/taxes',
    });
  }

  return deadlines.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

// ─── Status helpers ──────────────────────────────────────────────────────────

function getStatus(date, today) {
  if (!date) return 'unknown';
  const daysUntil = Math.ceil((new Date(date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  if (daysUntil < 0) return 'past';
  if (daysUntil <= 14) return 'urgent';
  if (daysUntil <= 30) return 'soon';
  return 'upcoming';
}

const CATEGORY_LABELS = {
  corporate:  { label: 'Corporate',  color: '#6366f1' },
  personal:   { label: 'Personal',   color: '#3b82f6' },
  hst:        { label: 'HST / GST',  color: '#f59e0b' },
  instalment: { label: 'Instalments',color: '#8b5cf6' },
  payroll:    { label: 'Payroll',    color: '#10b981' },
};

const STATUS_META = {
  past:     { label: 'Past',    icon: '✓' },
  urgent:   { label: '≤14 days',icon: '🔴' },
  soon:     { label: '≤30 days',icon: '🟡' },
  upcoming: { label: 'Upcoming',icon: '🟢' },
  unknown:  { label: '—',       icon: '—' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DeadlinesPage() {
  const { state, activeFY } = useApp();

  const todayStr = new Date().toISOString().slice(0, 10);
  const fyEndDate   = activeFY?.endDate ?? null;
  const hasHST      = state.settings?.hstRegistered ?? true;
  const hasPayroll  = (state.employees?.length ?? 0) > 0;
  const businessType = state.businessType || 'ccpc';
  const province    = state.settings?.province || 'ON';

  const deadlines = useMemo(() => buildDeadlines({
    fyEndDate,
    hasHST,
    hasPayroll,
    businessType,
    province,
    today: todayStr,
  }), [fyEndDate, hasHST, hasPayroll, businessType, province, todayStr]);

  const upcoming  = deadlines.filter(d => getStatus(d.date, todayStr) !== 'past');
  const past      = deadlines.filter(d => getStatus(d.date, todayStr) === 'past');
  const urgent    = upcoming.filter(d => getStatus(d.date, todayStr) === 'urgent');
  const [pastOpen, setPastOpen] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tax Deadline Calendar</h1>
          <p className={styles.sub}>Key CRA filing and payment deadlines based on your company settings.</p>
        </div>
        <Link href="/settings" className={styles.settingsLink}>Update Settings →</Link>
      </div>

      {urgent.length > 0 && (
        <div className={styles.urgentBanner}>
          🔴 <strong>{urgent.length} deadline{urgent.length !== 1 ? 's' : ''}</strong> due within 14 days
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        {Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => (
          <span key={key} className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles[`legendDot_${key}`]}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Upcoming deadlines */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Upcoming</h2>
          <span className={styles.badge}>{upcoming.length}</span>
        </div>
        <div className={styles.list}>
          {upcoming.length === 0 && (
            <p className={styles.empty}>No upcoming deadlines found for this fiscal year configuration.</p>
          )}
          {upcoming.map(d => (
            <DeadlineRow key={d.id} deadline={d} today={todayStr} />
          ))}
        </div>
      </div>

      {/* Past deadlines */}
      {past.length > 0 && (
        <div className={styles.section}>
          <button className={`${styles.sectionHead} ${styles.sectionHeadButton}`} onClick={() => setPastOpen(o => !o)}>
            <h2 className={styles.sectionTitle}>Past Deadlines</h2>
            <span className={styles.badge}>{past.length}</span>
            <span className={styles.chevron}>{pastOpen ? '▲' : '▼'}</span>
          </button>
          {pastOpen && (
            <div className={styles.list}>
              {past.map(d => (
                <DeadlineRow key={d.id} deadline={d} today={todayStr} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className={styles.disclaimer}>
        ℹ️ Deadlines are estimates based on your settings. Always verify with your CRA My Business Account or a tax professional. Filing frequencies may differ from the defaults shown here.
      </p>
    </div>
  );
}

function DeadlineRow({ deadline, today }) {
  const status = getStatus(deadline.date, today);
  const meta   = STATUS_META[status];
  const cat    = CATEGORY_LABELS[deadline.category] ?? { label: deadline.category, color: '#6b7280' };
  const daysUntil = deadline.date
    ? Math.ceil((new Date(deadline.date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
    : null;

  return (
    <div className={`${styles.row} ${styles[`row_${status}`]}`}>
      <div className={styles.rowLeft}>
        <span className={styles.rowIcon}>{meta.icon}</span>
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            {deadline.link ? (
              <Link href={deadline.link} className={styles.rowLink}>{deadline.title}</Link>
            ) : deadline.title}
            <span className={`${styles.catBadge} ${styles[`catBadge_${deadline.category}`] || styles.catBadgeDefault}`}>{cat.label}</span>
          </div>
          <p className={styles.rowDesc}>{deadline.desc}</p>
        </div>
      </div>
      <div className={styles.rowRight}>
        <span className={styles.rowDate}>{deadline.date ? formatDate(deadline.date) : '—'}</span>
        {daysUntil !== null && status !== 'past' && (
          <span className={`${styles.rowDays} ${styles[`rowDays_${status}`]}`}>
            {daysUntil === 0 ? 'Today' : `${daysUntil}d away`}
          </span>
        )}
        {status === 'past' && (
          <span className={`${styles.rowDays} ${styles.rowDaysPast}`}>Passed</span>
        )}
      </div>
    </div>
  );
}
