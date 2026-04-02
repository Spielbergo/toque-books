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

function getStatusColor(status) {
  const map = { paid: 'success', sent: 'info', overdue: 'danger', draft: 'muted', void: 'muted' };
  return map[status] || 'muted';
}

export default function DashboardPage() {
  const { state, activeFY, activePY } = useApp();

  if (!activeFY) return null;

  const { invoices = [], expenses = [], homeOffice = {}, dividendsPaid = [] } = activeFY;

  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((s, inv) => s + inv.subtotal, 0);

  const totalOutstanding = invoices
    .filter(inv => ['sent', 'overdue'].includes(inv.status))
    .reduce((s, inv) => s + inv.total, 0);

  const homeOfficeCalc = calculateHomeOfficeDeduction(homeOffice);
  const totalDeductibleExp = expenses.reduce((s, e) => {
    return s + getDeductibleAmount(e.amount || 0, e.category, e.businessUsePercent);
  }, 0) + homeOfficeCalc.deductible;

  const hst = calculateHSTSummary(invoices, expenses);
  const corp = calculateCorporateTax(totalRevenue, totalDeductibleExp);
  const personal = calculatePersonalTax({
    nonEligibleDivs: activePY.nonEligibleDivs || 0,
    eligibleDivs: activePY.eligibleDivs || 0,
    otherIncome: activePY.otherIncome || 0,
    rrspDeduction: activePY.rrspDeduction || 0,
  });

  const totalTaxOwing = corp.totalTax + personal.totalTax;
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        <StatCard label="Revenue (paid)" value={formatCurrency(totalRevenue)} sub={`${invoices.filter(i => i.status === 'paid').length} paid invoices`} color="success" icon="💰" />
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} sub={`${invoices.filter(i => ['sent','overdue'].includes(i.status)).length} invoices`} color={totalOutstanding > 0 ? 'warning' : 'default'} icon="⏳" />
        <StatCard label="Deductible Expenses" value={formatCurrency(totalDeductibleExp)} sub={`${expenses.length} entries`} color="info" icon="🧾" />
        <StatCard label="Est. Tax Owing" value={formatCurrency(totalTaxOwing)} sub={`Corp ${formatCurrency(corp.totalTax, { compact: true })} + Personal ${formatCurrency(personal.totalTax, { compact: true })}`} color="danger" icon="🍁" />
      </div>

      <div className={styles.twoCol}>
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Recent Invoices</h2>
            <Link href="/invoices"><Button variant="ghost" size="sm">View all</Button></Link>
          </div>
          {recentInvoices.length === 0 ? (
            <EmptyState icon="📄" title="No invoices yet" description="Add your first invoice to get started." action={<Link href="/invoices"><Button size="sm">Add Invoice</Button></Link>} />
          ) : (
            <div className={styles.invoiceList}>
              {recentInvoices.map(inv => (
                <div key={inv.id} className={styles.invoiceRow}>
                  <div className={styles.invLeft}>
                    <span className={styles.invNum}>{inv.invoiceNumber}</span>
                    <span className={styles.invClient}>{inv.client?.name || 'Unknown client'}</span>
                    <span className={styles.invDate}>{formatDate(inv.issueDate, { style: 'short' })}</span>
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

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Quick Financials</h2>
            <Link href="/taxes"><Button variant="ghost" size="sm">Full report</Button></Link>
          </div>
          <div className={styles.financials}>
            <FinRow label="Gross Revenue" value={formatCurrency(totalRevenue)} />
            <FinRow label="Total Deductions" value={`− ${formatCurrency(totalDeductibleExp)}`} negative />
            <FinRow label="Net Business Income" value={formatCurrency(corp.netIncome)} divider />
            <FinRow label="Corporate Tax (est.)" value={`− ${formatCurrency(corp.totalTax)}`} negative />
            <FinRow label="Corp. effective rate" value={formatPercent(corp.effectiveRate)} />
            <FinRow label="HST to Remit" value={formatCurrency(hst.netRemittance)} divider />
            <FinRow label="Dividends Paid to Self" value={formatCurrency(activePY.nonEligibleDivs || 0)} />
            <FinRow label="Personal Tax (est.)" value={`− ${formatCurrency(personal.totalTax)}`} negative />
            <FinRow label="Total Tax Owing" value={formatCurrency(totalTaxOwing)} total />
          </div>
        </div>
      </div>

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
