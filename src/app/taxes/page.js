'use client';

import { useApp } from '@/contexts/AppContext';
import {
  calculateCorporateTax,
  calculatePersonalTax,
  calculateHSTSummary,
  calculateIntegration,
  getDeductibleAmount,
  calculateHomeOfficeDeduction,
} from '@/lib/taxCalculations';
import { formatCurrency, formatPercent, formatDate } from '@/lib/formatters';
import { CORPORATE_RATES_2025 } from '@/lib/constants';
import styles from './page.module.css';
import { expandRecurringForFY } from '@/lib/recurringUtils';

export default function TaxesPage() {
  const { state, activeFY, activePY } = useApp();

  if (state.activeFiscalYear === 'all') {
    return (
      <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Select a fiscal year to view tax estimates</p>
        <p style={{ fontSize: '0.875rem' }}>Corporate T2 and personal T1 estimates are calculated per fiscal year. Choose a year in the sidebar.</p>
      </div>
    );
  }

  if (!activeFY) return <p>No fiscal year data found.</p>;

  const allFYData = Object.values(state.fiscalYears || {});
  const { startDate, endDate } = activeFY;
  const inRange = date => !date || ((!startDate || date >= startDate) && (!endDate || date <= endDate));
  const invoices      = allFYData.flatMap(fy => fy.invoices || []).filter(inv => inRange(inv.issueDate));
  const baseExpenses   = allFYData.flatMap(fy => fy.expenses || []).filter(exp => inRange(exp.date));
  const recurringForFY = startDate && endDate
    ? expandRecurringForFY(state.recurringExpenses || [], startDate, endDate)
    : [];
  const expenses       = [...baseExpenses, ...recurringForFY];
  const homeOffice = activeFY.homeOffice ?? {};
  const dividendsPaid = activeFY.dividendsPaid ?? [];

  // Revenue
  const grossRevenue = invoices
    .filter(inv => ['sent', 'paid'].includes(inv.status))
    .reduce((s, inv) => s + (inv.subtotal || 0), 0);

  // Expenses — sum up all deductible amounts
  const totalDeductibleExp = expenses.reduce((s, exp) => {
    return s + getDeductibleAmount(exp.amount || 0, exp.category, exp.businessUsePercent ?? 100);
  }, 0);

  // Home office
  const hoResult = calculateHomeOfficeDeduction(homeOffice);
  const totalDeductionsWithHO = totalDeductibleExp + hoResult.deductible;

  // Corporate tax
  const corp = calculateCorporateTax(grossRevenue, totalDeductionsWithHO);

  // HST
  const hst = calculateHSTSummary(invoices, expenses);

  // Dividends paid total
  const totalDivsPaid = dividendsPaid.reduce((s, d) => s + (d.amount || 0), 0);

  // Personal tax
  const personal = calculatePersonalTax({
    nonEligibleDivs: activePY.nonEligibleDivs || 0,
    eligibleDivs: activePY.eligibleDivs || 0,
    otherIncome: activePY.otherIncome || 0,
    rrspDeduction: activePY.rrspDeduction || 0,
  });

  // Integration analysis
  const integrationIncome = corp.netIncome;
  const integration = calculateIntegration(integrationIncome, totalDivsPaid, activePY.rrspDeduction || 0);

  // Filing deadlines
  const fiscalEndYear = activeFY.endDate ? new Date(activeFY.endDate).getFullYear() : new Date().getFullYear();
  const t2Deadline = `${fiscalEndYear + 1}-05-31`;
  const t1Deadline = `${state.activePersonalYear + 1}-04-30`;
  const hstDeadline = 'Quarterly (Mar/Jun/Sep/Dec) or as per your filing frequency';

  const settings = state.settings;

  return (
    <div className={styles.page}>
      {/* Header summary */}
      <div className={styles.summaryRow}>
        <SummaryCard label="Corporate Tax Owing" value={formatCurrency(corp.totalTax)} color="danger" sub={`Effective rate: ${formatPercent(corp.effectiveRate)}`} />
        <SummaryCard label="HST Net Remittance" value={formatCurrency(hst.netRemittance)} color={hst.netRemittance >= 0 ? 'warning' : 'success'} sub={hst.netRemittance < 0 ? 'You have a refund' : 'Amount to remit'} />
        <SummaryCard label="Personal Tax Owing" value={formatCurrency(personal.totalTax)} color="danger" sub={`Effective rate: ${formatPercent(personal.effectiveRate)}`} />
        <SummaryCard label="Total Combined Tax" value={formatCurrency(corp.totalTax + personal.totalTax)} color="info" sub="Corporate + Personal" />
      </div>

      {/* ── Corporate T2 ── */}
      <Section title="Corporate — T2 Estimate" badge={state.activeFiscalYear}>
        <div className={styles.twoCol}>
          <div>
            <SubSection title="Income & Deductions">
              <Row label="Gross revenue" value={formatCurrency(corp.grossRevenue)} />
              <Row label="Total deductible expenses" value={`− ${formatCurrency(totalDeductibleExp)}`} />
              <Row label="Home office deduction" value={`− ${formatCurrency(hoResult.deductible)}`} />
              <Row label="Net income before tax" value={formatCurrency(corp.netIncome)} bold />
            </SubSection>

            <SubSection title="Income Classification">
              <Row label={`SBD income (≤ ${formatCurrency(CORPORATE_RATES_2025.sbd_limit)})`} value={formatCurrency(corp.sbdIncome)} />
              <Row label="General rate income" value={formatCurrency(corp.generalIncome)} />
            </SubSection>
          </div>
          <div>
            <SubSection title="Tax Breakdown">
              <Row label={`Federal SBD tax (${(CORPORATE_RATES_2025.fed_sbd_net * 100).toFixed(1)}%)`} value={formatCurrency(corp.fedTaxSBD)} />
              <Row label={`Federal general tax`} value={formatCurrency(corp.fedTaxGeneral)} />
              <Row label="Federal tax total" value={formatCurrency(corp.fedTax)} bold />
              <div className={styles.dividerRow} />
              <Row label={`Ontario SBD tax (${(CORPORATE_RATES_2025.on_small * 100).toFixed(1)}%)`} value={formatCurrency(corp.onTaxSBD)} />
              <Row label="Ontario general tax" value={formatCurrency(corp.onTaxGeneral)} />
              <Row label="Ontario tax total" value={formatCurrency(corp.onTax)} bold />
              <div className={styles.dividerRow} />
              <Row label="Total corporate tax" value={formatCurrency(corp.totalTax)} bold />
              <Row label="After-tax income" value={formatCurrency(corp.afterTaxIncome)} />
              <Row label="Dividends paid (this FY)" value={`− ${formatCurrency(totalDivsPaid)}`} />
              <Row label="Retained earnings" value={formatCurrency(Math.max(0, corp.afterTaxIncome - totalDivsPaid))} bold />
            </SubSection>
          </div>
        </div>
        <div className={styles.deadlineBar}>
          <span>📅 T2 filing deadline:</span>
          <strong>{formatDate(t2Deadline)}</strong>
          <span>(6 months after fiscal year end)</span>
        </div>
      </Section>

      {/* ── Personal T1 ── */}
      <Section title="Personal — T1 Estimate" badge={`${state.activePersonalYear} Tax Year`}>
        <div className={styles.twoCol}>
          <div>
            <SubSection title="Income">
              <Row label="Non-eligible dividends (actual cash)" value={formatCurrency(personal.nonEligibleDivs)} />
              <Row label="Non-eligible dividend gross-up (15%)" value={`+ ${formatCurrency(personal.neGrossedUp - personal.nonEligibleDivs)}`} />
              <Row label="Non-eligible grossed-up" value={formatCurrency(personal.neGrossedUp)} />
              <Row label="Eligible dividends (actual cash)" value={formatCurrency(personal.eligibleDivs)} />
              <Row label="Eligible dividend gross-up (38%)" value={`+ ${formatCurrency(personal.elGrossedUp - personal.eligibleDivs)}`} />
              <Row label="Other income" value={formatCurrency(personal.otherIncome)} />
              <Row label="RRSP deduction" value={`− ${formatCurrency(personal.rrspDeduction)}`} />
              <Row label="Net income (line 23600)" value={formatCurrency(personal.netIncome)} bold />
            </SubSection>
          </div>
          <div>
            <SubSection title="Federal Tax">
              <Row label="Gross federal income tax" value={formatCurrency(personal.fedGrossIncomeTax)} />
              <Row label="Basic personal amount credit" value={`− ${formatCurrency(personal.fedBPA_credit)}`} />
              <Row label="Non-eligible DTC" value={`− ${formatCurrency(personal.fedNeDTC)}`} />
              <Row label="Eligible DTC" value={`− ${formatCurrency(personal.fedElDTC)}`} />
              <Row label="Federal tax" value={formatCurrency(personal.fedTax)} bold />
            </SubSection>
            <SubSection title="Ontario Tax">
              <Row label="Gross Ontario income tax" value={formatCurrency(personal.onGrossIncomeTax)} />
              <Row label="Ontario BPA credit" value={`− ${formatCurrency(personal.onBPA_credit)}`} />
              <Row label="Non-eligible DTC (Ontario)" value={`− ${formatCurrency(personal.onNeDTC)}`} />
              <Row label="Eligible DTC (Ontario)" value={`− ${formatCurrency(personal.onElDTC)}`} />
              <Row label="Ontario basic tax" value={formatCurrency(personal.onBasicTax)} />
              <Row label="Ontario surtax" value={formatCurrency(personal.onSurtax)} />
              <Row label="Ontario Health Premium" value={formatCurrency(personal.ohp)} />
              <Row label="Ontario tax total" value={formatCurrency(personal.onTax)} bold />
            </SubSection>
            <div className={styles.totalBar}>
              <span>Total personal tax</span>
              <strong>{formatCurrency(personal.totalTax)}</strong>
            </div>
          </div>
        </div>
        <div className={styles.deadlineBar}>
          <span>📅 T1 filing deadline:</span>
          <strong>{formatDate(t1Deadline)}</strong>
          <span>(April 30 for most Canadians)</span>
        </div>
      </Section>

      {/* ── HST ── */}
      <Section title="HST Summary" badge="Ontario 13%">
        <div className={styles.hstGrid}>
          <div className={styles.hstCard}>
            <span className={styles.hstLabel}>HST Collected</span>
            <strong className={styles.hstValue}>{formatCurrency(hst.hstCollected)}</strong>
            <span className={styles.hstSub}>From invoices (sent + paid)</span>
          </div>
          <div className={styles.hstCard}>
            <span className={styles.hstLabel}>Input Tax Credits (ITCs)</span>
            <strong className={styles.hstValue} style={{ color: 'var(--success)' }}>{formatCurrency(hst.itcTotal)}</strong>
            <span className={styles.hstSub}>HST paid on business expenses</span>
          </div>
          <div className={`${styles.hstCard} ${styles.hstCardTotal}`}>
            <span className={styles.hstLabel}>Net Remittance</span>
            <strong className={`${styles.hstValue} ${hst.netRemittance < 0 ? styles.hstCredit : ''}`}>{formatCurrency(Math.abs(hst.netRemittance))}</strong>
            <span className={styles.hstSub}>{hst.netRemittance < 0 ? 'CRA owes you a refund' : 'Amount to remit to CRA'}</span>
          </div>
        </div>
        <div className={styles.deadlineBar}>
          <span>📅 HST remittance:</span>
          <strong>Quarterly</strong>
          <span>— check your CRA account for exact due dates</span>
        </div>
        {!settings.hstRegistered && (
          <div className={styles.alertBox}>⚠️ You are marked as not HST registered. Update in Settings if your revenue exceeds $30,000.</div>
        )}
      </Section>

      {/* ── Integration Analysis ── */}
      <Section title="Tax Integration Analysis" badge="Corp + Personal">
        <p className={styles.integrationBlurb}>
          Tax integration measures how efficiently income earned through a corporation is taxed when paid out as dividends vs. earning the same income personally.
        </p>
        <div className={styles.integrationGrid}>
          <IntItem label="Corporate tax on net income" value={formatCurrency(integration.corporateTax)} />
          <IntItem label="Personal tax on dividends" value={formatCurrency(integration.personalTax)} />
          <IntItem label="Combined corp + personal tax" value={formatCurrency(integration.combinedTax)} bold />
          <IntItem label="Tax if earned personally (no corp)" value={formatCurrency(integration.personalOnlyTax)} />
          <IntItem label="Tax difference (corp route minus personal)" value={formatCurrency(integration.taxDifference)} color={integration.taxDifference < 0 ? 'success' : integration.taxDifference > 0 ? 'danger' : ''} />
          <IntItem label="After-tax kept (corpo route)" value={`${integration.integrationEfficiency.toFixed(1)}% of corp income`} />
        </div>
        {Math.abs(integration.taxDifference) > 100 && (
          <div className={styles.integrationNote}>
            {integration.taxDifference < 0
              ? `✅ The corporate route saves ${formatCurrency(Math.abs(integration.taxDifference))} in total tax compared to earning this income personally. The deferral benefit from leaving money in the corp is not included here.`
              : `⚠️ The corporate route costs ${formatCurrency(integration.taxDifference)} more in combined tax. This may be due to timing of dividend payments or income level. Consider consulting a tax professional.`}
          </div>
        )}
      </Section>

      {/* ── Disclaimer ── */}
      <div className={styles.globalDisclaimer}>
        <strong>⚠️ Estimates only.</strong> This tool uses 2025 Canadian federal and Ontario provincial tax rates and simplifies many CRA rules. It does not account for instalment payments, prior-year balances, all credits, or complex situations. Always verify with a CPA or licensed tax professional before filing.
      </div>
    </div>
  );
}

function Section({ title, badge, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {badge && <span className={styles.sectionBadge}>{badge}</span>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div className={styles.subSection}>
      <div className={styles.subSectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`${styles.row} ${bold ? styles.rowBold : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, color, sub }) {
  return (
    <div className={`${styles.summaryCard} ${styles[`summaryCard_${color}`]}`}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
      {sub && <span className={styles.summarySub}>{sub}</span>}
    </div>
  );
}

function IntItem({ label, value, bold, color }) {
  return (
    <div className={`${styles.intItem} ${bold ? styles.intItemBold : ''} ${color ? styles[`intItem_${color}`] : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
