'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  calculateCorporateTax,
  calculatePersonalTax,
  calculateHSTSummary,
  calculateIntegration,
  getDeductibleAmount,
  calculateHomeOfficeDeduction,
} from '@/lib/taxCalculations';
import { formatCurrency, formatPercent, formatDate, today } from '@/lib/formatters';
import { CORPORATE_RATES_2025 } from '@/lib/constants';
import styles from './page.module.css';
import { expandRecurringForFY } from '@/lib/recurringUtils';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { FormField, Input, Select } from '@/components/ui/FormField';

export default function TaxesPage() {
  const { state, dispatch, activeFY, activePY, activePersonalYear } = useApp();

  const [showCCAModal, setShowCCAModal] = useState(false);
  const [ccaEditId,    setCCAEditId]    = useState(null);
  const [ccaForm,      setCCAForm]      = useState({ classNumber: '', description: '', rate: '', openingUCC: '0', additions: '0', disposals: '0', claimedAmount: '0' });
  const [showSLModal,  setShowSLModal]  = useState(false);
  const [slEditId,     setSLEditId]     = useState(null);
  const [slForm,       setSLForm]       = useState({ date: '', description: '', amount: '', type: 'withdrawal' });

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
  const homeOffice     = activeFY.homeOffice ?? {};
  const dividendsPaid  = activeFY.dividendsPaid ?? [];
  const ccaClasses     = activeFY.ccaClasses ?? [];
  const shareholderLoan = activeFY.shareholderLoan ?? { openingBalance: 0, transactions: [] };
  const slTransactions  = shareholderLoan.transactions || [];
  const slClosingBalance = (shareholderLoan.openingBalance || 0) +
    slTransactions.reduce((sum, t) => t.type === 'withdrawal' ? sum + (t.amount || 0) : sum - (t.amount || 0), 0);
  const openingRE  = activeFY.openingRetainedEarnings ?? 0;
  const totalCCA   = ccaClasses.reduce((s, c) => s + (c.claimedAmount || 0), 0);

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
  const totalDeductionsWithHO = totalDeductibleExp + hoResult.deductible + totalCCA;

  // Corporate tax
  const corp = calculateCorporateTax(grossRevenue, totalDeductionsWithHO);

  // HST
  const hst = calculateHSTSummary(invoices, expenses);

  // Dividends paid total
  const totalDivsPaid = dividendsPaid.reduce((s, d) => s + (d.amount || 0), 0);
  const closingRE = openingRE + corp.afterTaxIncome - totalDivsPaid;
  const sortedFYKeys = Object.keys(state.fiscalYears || {}).filter(k => k !== 'all').sort();
  const currentFYIdx = sortedFYKeys.indexOf(state.activeFiscalYear);
  const nextFYKey = currentFYIdx >= 0 && currentFYIdx < sortedFYKeys.length - 1
    ? sortedFYKeys[currentFYIdx + 1] : null;

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
  const t1Deadline = `${activePersonalYear + 1}-04-30`;
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
              {totalCCA > 0 && <Row label="CCA — Schedule 8" value={`− ${formatCurrency(totalCCA)}`} />}
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
              <div className={styles.dividerRow} />
              <RowEditable
                label="Opening retained earnings"
                amount={openingRE}
                onSave={v => dispatch({ type: 'SET_FY_OPENING_RE', payload: { fyKey: state.activeFiscalYear, amount: v } })}
              />
              <Row label="+ After-tax income" value={`+ ${formatCurrency(corp.afterTaxIncome)}`} />
              <Row label="− Dividends paid (this FY)" value={`− ${formatCurrency(totalDivsPaid)}`} />
              <Row label="Closing retained earnings" value={formatCurrency(closingRE)} bold />
              {nextFYKey && (
                <div className={styles.carryRow}>
                  <button
                    className={styles.carryBtn}
                    onClick={() => dispatch({ type: 'SET_FY_OPENING_RE', payload: { fyKey: nextFYKey, amount: closingRE } })}
                  >
                    Copy {formatCurrency(closingRE)} → {nextFYKey} opening RE
                  </button>
                </div>
              )}
            </SubSection>
          </div>
        </div>
        <SubSection title="Shareholder Loans — s.15(2)">
          <div className={styles.slBody}>
            <div className={styles.slBalRow}>
              <span>Opening balance (shareholder owes corp)</span>
              <strong>{formatCurrency(shareholderLoan.openingBalance || 0)}</strong>
            </div>
            {slTransactions.length > 0 ? (
              <table className={styles.slTable}>
                <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {slTransactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.date || '—'}</td>
                      <td>{t.description || '—'}</td>
                      <td><span className={`${styles.slPill} ${t.type === 'withdrawal' ? styles.slPillW : styles.slPillR}`}>{t.type === 'withdrawal' ? 'Withdrawal' : 'Repayment'}</span></td>
                      <td className={styles.slAmt}>{t.type === 'withdrawal' ? '+' : '−'} {formatCurrency(t.amount || 0)}</td>
                      <td>
                        <button className={styles.slDel} onClick={() => dispatch({ type: 'DELETE_SHAREHOLDER_TX', payload: t.id })}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.slEmpty}>No transactions recorded this fiscal year.</p>
            )}
            <div className={styles.slFooter}>
              <button
                className={styles.slAddBtn}
                onClick={() => { setSLEditId(null); setSLForm({ date: today(), description: '', amount: '', type: 'withdrawal' }); setShowSLModal(true); }}
              >
                + Add Transaction
              </button>
              <span>Closing balance: <strong>{formatCurrency(slClosingBalance)}</strong></span>
            </div>
            {slClosingBalance > 0 && (
              <div className={styles.slWarning}>
                ⚠️ Shareholder debit balance of {formatCurrency(slClosingBalance)}. Under s.15(2), this must be repaid within 1 year of the corporate fiscal year end or it becomes employment income.
              </div>
            )}
          </div>
        </SubSection>
        <div className={styles.deadlineBar}>
          <span>📅 T2 filing deadline:</span>
          <strong>{formatDate(t2Deadline)}</strong>
          <span>(6 months after fiscal year end)</span>
        </div>
      </Section>

      {/* ── CCA Schedule 8 ── */}
      <Section title="Capital Cost Allowance — Schedule 8" badge={state.activeFiscalYear}>
        {ccaClasses.length === 0 ? (
          <p className={styles.ccaEmpty}>No CCA asset classes added yet.</p>
        ) : (
          <div className={styles.ccaScroll}>
            <table className={styles.ccaTable}>
              <thead>
                <tr><th>Class</th><th>Description</th><th>Rate</th><th>Opening UCC</th><th>Additions</th><th>Disposals</th><th>CCA Claimed</th><th>Closing UCC</th><th></th></tr>
              </thead>
              <tbody>
                {ccaClasses.map(c => {
                  const maxC = getMaxCCA(c);
                  const closUCC = getClosingUCC(c);
                  return (
                    <tr key={c.id}>
                      <td><strong>Class {c.classNumber}</strong></td>
                      <td>{c.description || '—'}</td>
                      <td>{((c.rate || 0) * 100).toFixed(0)}%</td>
                      <td>{formatCurrency(c.openingUCC || 0)}</td>
                      <td>{formatCurrency(c.additions || 0)}</td>
                      <td>{formatCurrency(c.disposals || 0)}</td>
                      <td>
                        {formatCurrency(c.claimedAmount || 0)}
                        <span className={styles.ccaMaxNote}> / {formatCurrency(maxC)}</span>
                      </td>
                      <td>{formatCurrency(closUCC)}</td>
                      <td className={styles.ccaRowActions}>
                        <button className={styles.ccaEditBtn} onClick={() => {
                          setCCAEditId(c.id);
                          setCCAForm({ classNumber: c.classNumber, description: c.description || '', rate: ((c.rate || 0) * 100).toString(), openingUCC: (c.openingUCC || 0).toString(), additions: (c.additions || 0).toString(), disposals: (c.disposals || 0).toString(), claimedAmount: (c.claimedAmount || 0).toString() });
                          setShowCCAModal(true);
                        }}>Edit</button>
                        <button className={styles.ccaDelBtn} onClick={() => dispatch({ type: 'DELETE_CCA_CLASS', payload: c.id })}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.ccaFooter}>
          <button className={styles.ccaAddBtn} onClick={() => { setCCAEditId(null); setCCAForm({ classNumber: '', description: '', rate: '', openingUCC: '0', additions: '0', disposals: '0', claimedAmount: '0' }); setShowCCAModal(true); }}>
            + Add Asset Class
          </button>
          {ccaClasses.length > 0 && (
            <div className={styles.ccaTotalRow}>
              Total CCA claimed: <strong>{formatCurrency(totalCCA)}</strong>
              <span className={styles.ccaTotalNote}> — deducted in T2 net income above</span>
            </div>
          )}
        </div>
      </Section>

      {/* ── Personal T1 ── */}
      <Section title="Personal — T1 Estimate" badge={`${activePersonalYear} Tax Year`}>
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

      {/* ── Shareholder Loan Modal ── */}
      <Modal isOpen={showSLModal} onClose={() => setShowSLModal(false)} title={slEditId ? 'Edit Transaction' : 'Add SHL Transaction'} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <FormField label="Date"><Input type="date" value={slForm.date} onChange={e => setSLForm(f => ({ ...f, date: e.target.value }))} /></FormField>
          <FormField label="Description"><Input type="text" placeholder="e.g. Owner withdrawal" value={slForm.description} onChange={e => setSLForm(f => ({ ...f, description: e.target.value }))} /></FormField>
          <FormField label="Amount"><Input type="number" prefix="$" step="0.01" value={slForm.amount} onChange={e => setSLForm(f => ({ ...f, amount: e.target.value }))} /></FormField>
          <FormField label="Type">
            <Select value={slForm.type} onChange={e => setSLForm(f => ({ ...f, type: e.target.value }))}>
              <option value="withdrawal">Withdrawal (SH takes from corp)</option>
              <option value="repayment">Repayment (SH pays corp back)</option>
            </Select>
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <Button variant="ghost" onClick={() => setShowSLModal(false)}>Cancel</Button>
          <Button onClick={() => {
            const amt = parseFloat(slForm.amount);
            if (isNaN(amt) || amt <= 0) return;
            dispatch({ type: slEditId ? 'UPDATE_SHAREHOLDER_TX' : 'ADD_SHAREHOLDER_TX', payload: { ...(slEditId ? { id: slEditId } : {}), ...slForm, amount: amt } });
            setShowSLModal(false);
          }}>Save</Button>
        </div>
      </Modal>

      {/* ── CCA Modal ── */}
      <Modal isOpen={showCCAModal} onClose={() => setShowCCAModal(false)} title={ccaEditId ? 'Edit Asset Class' : 'Add CCA Asset Class'} size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <FormField label="CCA Class #" hint="e.g. 8, 10, 50">
            <Input type="text" placeholder="8" value={ccaForm.classNumber} onChange={e => {
              const m = CCA_COMMON_CLASSES.find(c => c.num === e.target.value);
              setCCAForm(f => ({ ...f, classNumber: e.target.value, rate: m ? (m.rate * 100).toString() : f.rate }));
            }} />
          </FormField>
          <FormField label="Rate (%)" hint="e.g. 20 for 20%">
            <Input type="number" step="0.01" value={ccaForm.rate} onChange={e => setCCAForm(f => ({ ...f, rate: e.target.value }))} />
          </FormField>
          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Description">
              <Input type="text" placeholder="e.g. Office furniture, MacBook Pro" value={ccaForm.description} onChange={e => setCCAForm(f => ({ ...f, description: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Opening UCC" hint="UCC at start of FY">
            <Input type="number" prefix="$" step="0.01" value={ccaForm.openingUCC} onChange={e => setCCAForm(f => ({ ...f, openingUCC: e.target.value }))} />
          </FormField>
          <FormField label="Additions this FY">
            <Input type="number" prefix="$" step="0.01" value={ccaForm.additions} onChange={e => setCCAForm(f => ({ ...f, additions: e.target.value }))} />
          </FormField>
          <FormField label="Disposals this FY">
            <Input type="number" prefix="$" step="0.01" value={ccaForm.disposals} onChange={e => setCCAForm(f => ({ ...f, disposals: e.target.value }))} />
          </FormField>
          <FormField
            label="CCA Claimed"
            hint={`Max: ${formatCurrency(getMaxCCA({ rate: parseFloat(ccaForm.rate) / 100 || 0, openingUCC: parseFloat(ccaForm.openingUCC) || 0, additions: parseFloat(ccaForm.additions) || 0, disposals: parseFloat(ccaForm.disposals) || 0 }))}`}
          >
            <Input type="number" prefix="$" step="0.01" value={ccaForm.claimedAmount} onChange={e => setCCAForm(f => ({ ...f, claimedAmount: e.target.value }))} />
          </FormField>
        </div>
        <div className={styles.ccaClassChips}>
          {CCA_COMMON_CLASSES.map(c => (
            <button key={c.num} className={styles.ccaChip} type="button"
              onClick={() => setCCAForm(f => ({ ...f, classNumber: c.num, rate: (c.rate * 100).toString() }))}>
              Class {c.num} — {c.label} ({(c.rate * 100).toFixed(0)}%)
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <Button variant="ghost" onClick={() => setShowCCAModal(false)}>Cancel</Button>
          <Button onClick={() => {
            const rate = parseFloat(ccaForm.rate) / 100;
            const payload = {
              classNumber: ccaForm.classNumber,
              description: ccaForm.description,
              rate: isNaN(rate) ? 0 : rate,
              openingUCC: parseFloat(ccaForm.openingUCC) || 0,
              additions: parseFloat(ccaForm.additions) || 0,
              disposals: parseFloat(ccaForm.disposals) || 0,
              claimedAmount: parseFloat(ccaForm.claimedAmount) || 0,
            };
            dispatch({ type: ccaEditId ? 'UPDATE_CCA_CLASS' : 'ADD_CCA_CLASS', payload: ccaEditId ? { id: ccaEditId, ...payload } : payload });
            setShowCCAModal(false);
          }}>Save</Button>
        </div>
      </Modal>
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

function RowEditable({ label, amount, onSave }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState('');
  const commit = () => { const n = parseFloat(input); if (!isNaN(n)) onSave(n); setEditing(false); };
  if (editing) {
    return (
      <div className={styles.row}>
        <span>{label}</span>
        <input
          className={styles.reInput}
          type="number"
          step="0.01"
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
      </div>
    );
  }
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <span className={styles.reEditWrap}>
        {formatCurrency(amount)}
        <button className={styles.reEditBtn} onClick={() => { setInput(amount.toString()); setEditing(true); }} title="Edit">✎</button>
      </span>
    </div>
  );
}

const CCA_COMMON_CLASSES = [
  { num: '1',    rate: 0.04,  label: 'Buildings' },
  { num: '8',    rate: 0.20,  label: 'Office equip / furniture' },
  { num: '10',   rate: 0.30,  label: 'Motor vehicles' },
  { num: '10.1', rate: 0.30,  label: 'Passenger vehicles (>$37k cap)' },
  { num: '12',   rate: 1.00,  label: 'Small tools (<$500)' },
  { num: '14.1', rate: 0.05,  label: 'Goodwill / intangibles' },
  { num: '50',   rate: 0.55,  label: 'Computers / data equip' },
  { num: '53',   rate: 0.50,  label: 'M&P machinery' },
  { num: '54',   rate: 0.30,  label: 'Zero-emission vehicles' },
];

function getMaxCCA(c) {
  const netAdd = (c.additions || 0) - (c.disposals || 0);
  const base = netAdd >= 0
    ? (c.openingUCC || 0) + netAdd * 0.5   // half-year rule on net additions
    : Math.max(0, (c.openingUCC || 0) + netAdd);
  return Math.max(0, base * (c.rate || 0));
}

function getClosingUCC(c) {
  return Math.max(0, (c.openingUCC || 0) + (c.additions || 0) - (c.disposals || 0) - (c.claimedAmount || 0));
}
