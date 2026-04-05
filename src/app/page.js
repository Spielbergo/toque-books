'use client';

import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { calculateCorporateTax, calculateHSTSummary, calculatePersonalTax, calculateHomeOfficeDeduction, getDeductibleAmount } from '@/lib/taxCalculations';
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatters';
import { StatCard } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import styles from './dashboard.module.css';
import { expandRecurringForFY } from '@/lib/recurringUtils';

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MON[+m - 1]} '${y.slice(2)}`;
}

function getStatusColor(status) {
  return { paid: 'success', sent: 'info', overdue: 'danger', draft: 'muted', void: 'muted' }[status] || 'muted';
}

// ── Main dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { state, activeFY, activePY } = useApp();
  const isAllTime = state.activeFiscalYear === 'all';

  // Pool ALL FY data — items may have landed in the wrong bucket on import
  const allFYData   = Object.values(state.fiscalYears || {});
  const allInvoices = allFYData.flatMap(fy => fy.invoices || []);
  const allExpenses = allFYData.flatMap(fy => fy.expenses || []);

  const { startDate, endDate } = activeFY || {};
  const inRange = date => !date || (!startDate && !endDate) || (
    (!startDate || date >= startDate) && (!endDate || date <= endDate)
  );

  const invoices          = isAllTime ? allInvoices : allInvoices.filter(inv => inRange(inv.issueDate));
  const baseExpenses       = isAllTime ? allExpenses : allExpenses.filter(exp => inRange(exp.date));
  const recurringForFY     = !isAllTime && startDate && endDate
    ? expandRecurringForFY(state.recurringExpenses || [], startDate, endDate)
    : [];
  const expenses           = [...baseExpenses, ...recurringForFY];
  const homeOffice         = isAllTime ? {} : (activeFY?.homeOffice || {});

  if (!isAllTime && !activeFY) return null;

  // ── Core financials ──────────────────────────────────────────────────────
  const totalRevenue       = invoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + inv.subtotal, 0);
  const homeOfficeCalc     = calculateHomeOfficeDeduction(homeOffice);
  const totalDeductibleExp = expenses.reduce((s, e) => s + getDeductibleAmount(e.amount || 0, e.category, e.businessUsePercent), 0) + homeOfficeCalc.deductible;
  const hst      = calculateHSTSummary(invoices, expenses);
  const corp     = calculateCorporateTax(totalRevenue, totalDeductibleExp);
  // Derive personal year from the active fiscal year's calendar year so that
  // blank fiscal years don't show personal tax data from a different year.
  const fyPersonalYear = activeFY?.endDate
    ? new Date(activeFY.endDate + 'T00:00:00').getFullYear()
    : activeFY?.startDate
      ? new Date(activeFY.startDate + 'T00:00:00').getFullYear()
      : state.activePersonalYear;
  const fyPY = isAllTime
    ? activePY
    : (state.personalYears?.[fyPersonalYear] ?? { nonEligibleDivs: 0, eligibleDivs: 0, otherIncome: 0, rrspDeduction: 0 });
  const personal = calculatePersonalTax({
    nonEligibleDivs: fyPY.nonEligibleDivs || 0,
    eligibleDivs:    fyPY.eligibleDivs    || 0,
    otherIncome:     fyPY.otherIncome     || 0,
    rrspDeduction:   fyPY.rrspDeduction   || 0,
  });
  const totalTaxOwing = corp.totalTax + personal.totalTax;

  // ── Payables / outstanding ───────────────────────────────────────────────
  const payables         = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status))
    .sort((a, b) => (a.dueDate || a.issueDate || '').localeCompare(b.dueDate || b.issueDate || ''));
  const totalOutstanding = payables.reduce((s, inv) => s + inv.total, 0);
  const overdueInvoices  = invoices.filter(inv => inv.status === 'overdue');

  // ── Monthly net income data ───────────────────────────────────────────────────
  const monthSet = new Set();
  invoices.filter(inv => inv.issueDate).forEach(inv => monthSet.add(inv.issueDate.slice(0, 7)));
  expenses.filter(exp => exp.date).forEach(exp => monthSet.add(exp.date.slice(0, 7)));
  const monthlyData = [...monthSet].sort().map(month => {
    const revenue  = invoices.filter(inv => inv.status === 'paid' && inv.issueDate?.startsWith(month)).reduce((s, inv) => s + (inv.subtotal || 0), 0);
    const expTotal = expenses.filter(e => e.date?.startsWith(month)).reduce((s, e) => s + (e.amount || 0), 0);
    return { month, revenue, expenses: expTotal, net: revenue - expTotal };
  });
  const niTotal = {
    rev: monthlyData.reduce((s, d) => s + d.revenue, 0),
    exp: monthlyData.reduce((s, d) => s + d.expenses, 0),
    net: monthlyData.reduce((s, d) => s + d.net, 0),
  };

  const recentInvoices = [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  // ── Tax set-aside widget ─────────────────────────────────────────────────
  const totalSetAside  = corp.totalTax + hst.netRemittance + personal.totalTax;
  const safeToSpend    = corp.netIncome - corp.totalTax - hst.netRemittance - personal.totalTax;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <span className={styles.fyLabel}>{isAllTime ? 'All Time' : (activeFY?.label || state.activeFiscalYear)}</span>
      </div>

      {/* Row 1 — Stat cards */}
      <div className={styles.statsGrid}>
        <StatCard label="Revenue (paid)" value={formatCurrency(totalRevenue)} sub={`${invoices.filter(i => i.status === 'paid').length} paid invoices`} color="success" icon="💰" />
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} sub={`${payables.length} invoices`} color={totalOutstanding > 0 ? 'warning' : 'default'} icon="⏳" />
        <StatCard label="Deductible Expenses" value={formatCurrency(totalDeductibleExp)} sub={`${expenses.length} entries`} color="info" icon="🧾" />
        <StatCard label="HST to Remit" value={formatCurrency(hst.netRemittance)} sub={`Collected ${formatCurrency(hst.hstCollected, { compact: true })} − ITC ${formatCurrency(hst.itcTotal, { compact: true })}`} color={hst.netRemittance > 0 ? 'warning' : 'default'} icon="🏦" />
        <StatCard label="Est. Tax Owing" value={formatCurrency(totalTaxOwing)} sub={`Corp ${formatCurrency(corp.totalTax, { compact: true })} + Personal ${formatCurrency(personal.totalTax, { compact: true })}`} color="danger" icon="🍁" />
      </div>

      {/* Tax Set-Aside Widget */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>💡 How much should I set aside for taxes?</h2>
          <Link href="/taxes"><Button variant="ghost" size="sm">Full report</Button></Link>
        </div>
        <div className={styles.taxBreakdown}>
          <div className={styles.taxItem}>
            <span className={styles.taxItemIcon}>🏢</span>
            <span className={styles.taxItemLabel}>Corporate Tax (T2)</span>
            <span className={styles.taxItemAmount}>{formatCurrency(corp.totalTax)}</span>
            <span className={styles.taxItemSub}>{formatPercent(corp.effectiveRate)} effective rate</span>
          </div>
          <div className={styles.taxItem}>
            <span className={styles.taxItemIcon}>🏦</span>
            <span className={styles.taxItemLabel}>HST to Remit</span>
            <span className={styles.taxItemAmount}>{formatCurrency(Math.max(0, hst.netRemittance))}</span>
            <span className={styles.taxItemSub}>Collected minus ITCs</span>
          </div>
          <div className={styles.taxItem}>
            <span className={styles.taxItemIcon}>🍁</span>
            <span className={styles.taxItemLabel}>Personal Tax on Dividends</span>
            <span className={styles.taxItemAmount}>{formatCurrency(personal.totalTax)}</span>
            <span className={styles.taxItemSub}>Based on dividends paid to self</span>
          </div>
          <div className={`${styles.taxItem} ${styles.taxItemTotal}`}>
            <span className={styles.taxItemIcon}>🏦</span>
            <span className={styles.taxItemLabel}>Recommended Savings</span>
            <span className={styles.taxItemAmount}>{formatCurrency(totalSetAside)}</span>
            <span className={styles.taxItemSub}>Keep this in a separate account</span>
          </div>
        </div>
        <div className={`${styles.taxSafeBar} ${safeToSpend >= 0 ? styles.taxSafePos : styles.taxSafeNeg}`}>
          <div>
            <span className={styles.taxSafeLabel}>Safe to spend after all tax obligations</span>
            <span className={styles.taxSafeSub}>{safeToSpend < 0 ? 'Your expenses and taxes exceed current revenue — review your financials.' : 'This is what remains after setting aside all taxes and covering deductible expenses.'}</span>
          </div>
          <span className={styles.taxSafeAmount}>{safeToSpend >= 0 ? formatCurrency(safeToSpend) : `(${formatCurrency(Math.abs(safeToSpend))})`}</span>
        </div>
      </div>

      {/* Row 2 — Net Income table + Quick Financials */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Net Income</h2>
          </div>
          {monthlyData.length === 0
            ? <EmptyState icon="📊" title="No data" description="Add invoices or expenses to see monthly income." />
            : (
              <div className={styles.tblScroll}>
                <table className={styles.niTbl}>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className={styles.right}>Revenue</th>
                      <th className={styles.right}>Expenses</th>
                      <th className={styles.right}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(d => (
                      <tr key={d.month}>
                        <td className={styles.niMon}>{monthLabel(d.month)}</td>
                        <td className={`${styles.right} ${styles.niRev}`}>{d.revenue > 0 ? formatCurrency(d.revenue) : '—'}</td>
                        <td className={`${styles.right} ${styles.niExp}`}>{d.expenses > 0 ? formatCurrency(d.expenses) : '—'}</td>
                        <td className={`${styles.right} ${d.net >= 0 ? styles.niPos : styles.niNeg}`}>
                          {d.net >= 0 ? '' : '('}{formatCurrency(Math.abs(d.net))}{d.net < 0 ? ')' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={styles.niTotalRow}>
                      <td><strong>Total</strong></td>
                      <td className={styles.right}><strong>{formatCurrency(niTotal.rev)}</strong></td>
                      <td className={styles.right}><strong>{formatCurrency(niTotal.exp)}</strong></td>
                      <td className={`${styles.right} ${niTotal.net >= 0 ? styles.niPos : styles.niNeg}`}>
                        <strong>{niTotal.net >= 0 ? '' : '('}{formatCurrency(Math.abs(niTotal.net))}{niTotal.net < 0 ? ')' : ''}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Quick Financials</h2>
            <Link href="/taxes"><Button variant="ghost" size="sm">Full report</Button></Link>
          </div>
          <div className={styles.financials}>
            <FinRow label="Gross Revenue"         value={formatCurrency(totalRevenue)} />
            <FinRow label="Total Deductions"       value={`− ${formatCurrency(totalDeductibleExp)}`} negative />
            <FinRow label="Net Business Income"    value={formatCurrency(corp.netIncome)} divider />
            <FinRow label="Corporate Tax (est.)"   value={`− ${formatCurrency(corp.totalTax)}`} negative />
            <FinRow label="Corp. effective rate"   value={formatPercent(corp.effectiveRate)} />
            <FinRow label="HST to Remit"           value={formatCurrency(hst.netRemittance)} divider />
            <FinRow label="Dividends Paid to Self" value={formatCurrency(activePY.nonEligibleDivs || 0)} />
            <FinRow label="Personal Tax (est.)"    value={`− ${formatCurrency(personal.totalTax)}`} negative />
            <FinRow label="Total Tax Owing"        value={formatCurrency(totalTaxOwing)} total />
          </div>
        </div>
      </div>

      {/* Row 5 — Payables Owing + Recent Invoices */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Payables Owing</h2>
            <Link href="/invoices"><Button variant="ghost" size="sm">View all</Button></Link>
          </div>
          {payables.length === 0
            ? <EmptyState icon="✅" title="All clear" description="No outstanding invoices." />
            : (
              <div className={styles.tblScroll}>
                <table className={styles.payTbl}>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Due</th>
                      <th className={styles.right}>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payables.map(inv => (
                      <tr key={inv.id} className={inv.status === 'overdue' ? styles.payOverdue : ''}>
                        <td className={styles.payNum}>{inv.invoiceNumber}</td>
                        <td className={styles.payCli}>{inv.client?.name || '—'}</td>
                        <td className={styles.payDue}>{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                        <td className={`${styles.right} ${styles.payAmt}`}>{formatCurrency(inv.total)}</td>
                        <td><Badge color={getStatusColor(inv.status)}>{inv.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={styles.payTotalRow}>
                      <td colSpan={3}><strong>Total outstanding</strong></td>
                      <td className={styles.right}><strong>{formatCurrency(totalOutstanding)}</strong></td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Recent Invoices</h2>
            <Link href="/invoices"><Button variant="ghost" size="sm">View all</Button></Link>
          </div>
          {recentInvoices.length === 0
            ? <EmptyState icon="📄" title="No invoices yet" description="Add your first invoice to get started." action={<Link href="/invoices"><Button size="sm">Add Invoice</Button></Link>} />
            : (
              <div className={styles.invoiceList}>
                {recentInvoices.map(inv => (
                  <div key={inv.id} className={styles.invoiceRow}>
                    <div className={styles.invLeft}>
                      <span className={styles.invNum}>{inv.invoiceNumber}</span>
                      <span className={styles.invClient}>{inv.client?.name || 'Unknown client'}</span>
                      <span className={styles.invDate}>{formatDate(inv.issueDate)}</span>
                    </div>
                    <div className={styles.invRight}>
                      <span className={styles.invAmount}>{formatCurrency(inv.total)}</span>
                      <Badge color={getStatusColor(inv.status)}>{inv.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Alerts */}
      {overdueInvoices.length > 0 && (
        <div className={styles.alert}>
          <span>⚠️</span>
          <div>
            <strong>{overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}</strong>{' — '}
            {formatCurrency(overdueInvoices.reduce((s, i) => s + i.total, 0))} outstanding.{' '}
            <Link href="/invoices">Manage invoices →</Link>
          </div>
        </div>
      )}

      {!state.settings.companyName && (
        <div className={`${styles.alert} ${styles.alertInfo}`}>
          <span>💡</span>
          <div>Set up your company info in <Link href="/settings">Settings</Link> to personalize invoices.</div>
        </div>
      )}
    </div>
  );
}

function FinRow({ label, value, negative, divider, total }) {
  return (
    <div className={`${styles.finRow} ${divider ? styles.finDivider : ''} ${total ? styles.finTotal : ''}`}>
      <span className={styles.finLabel}>{label}</span>
      <span className={`${styles.finValue} ${negative ? styles.negative : ''}`}>{value}</span>
    </div>
  );
}
