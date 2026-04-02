'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/contexts/AppContext';
import { calculatePersonalTax } from '@/lib/taxCalculations';
import { formatCurrency, formatDate, formatPercent, today } from '@/lib/formatters';
import { RRSP_LIMIT_2025 } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const TABS = ['Personal Income', 'Dividends Paid', 'T1 Estimate'];

export default function PersonalPage() {
  const { state, activeFY, activePY, dispatch } = useApp();
  const [tab, setTab] = useState(0);
  const [pyForm, setPyForm] = useState({ ...activePY });
  const [pySaved, setPySaved] = useState(false);

  // Dividend form
  const [showDivModal, setShowDivModal] = useState(false);
  const [divForm, setDivForm] = useState({ date: today(), amount: '', type: 'non_eligible', notes: '' });
  const [confirmDeleteDiv, setConfirmDeleteDiv] = useState(null);

  const dividendsPaid = activeFY?.dividendsPaid ?? [];
  const totalDivPaid = dividendsPaid.reduce((s, d) => s + (d.amount || 0), 0);

  const savePY = e => {
    e.preventDefault();
    dispatch({ type: 'UPDATE_PERSONAL', payload: pyForm });
    setPySaved(true);
    setTimeout(() => setPySaved(false), 2500);
  };

  const saveDividend = e => {
    e.preventDefault();
    dispatch({
      type: 'ADD_DIVIDEND',
      payload: {
        ...divForm,
        amount: parseFloat(divForm.amount) || 0,
        personalYear: state.activePersonalYear,
      },
    });
    setShowDivModal(false);
    setDivForm({ date: today(), amount: '', type: 'non_eligible', notes: '' });
  };

  const deleteDiv = id => {
    dispatch({ type: 'DELETE_DIVIDEND', payload: id });
    setConfirmDeleteDiv(null);
  };

  // Tax calc
  const taxResult = calculatePersonalTax({
    nonEligibleDivs: activePY.nonEligibleDivs || 0,
    eligibleDivs: activePY.eligibleDivs || 0,
    otherIncome: activePY.otherIncome || 0,
    rrspDeduction: activePY.rrspDeduction || 0,
  });

  return (
    <div className={styles.page}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((t, i) => (
          <button key={t} className={`${styles.tab} ${tab === i ? styles.tabActive : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {/* ═══ TAB 0: Personal Income ═══ */}
      {tab === 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Personal Tax Information — {state.activePersonalYear}</h3>
            <p>Enter your personal income details for the {state.activePersonalYear} tax year. Dividend amounts are automatically synced from the Dividends Paid tab.</p>
          </div>

          <form onSubmit={savePY}>
            <div className={styles.formGrid}>
              <FormField label="Non-Eligible Dividends Received" hint="Dividends from your CCPC (taxed at small business rate). Auto-filled from dividends tab.">
                <Input type="number" min="0" step="0.01" prefix="$" value={pyForm.nonEligibleDivs || ''} onChange={e => setPyForm(f => ({ ...f, nonEligibleDivs: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
              </FormField>

              <FormField label="Eligible Dividends Received" hint="Dividends from public corporations (T5 slips from banks, etc.)">
                <Input type="number" min="0" step="0.01" prefix="$" value={pyForm.eligibleDivs || ''} onChange={e => setPyForm(f => ({ ...f, eligibleDivs: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
              </FormField>

              <FormField label="Other Employment / Business Income" hint="T4 income, self-employment from other sources, etc.">
                <Input type="number" min="0" step="0.01" prefix="$" value={pyForm.otherIncome || ''} onChange={e => setPyForm(f => ({ ...f, otherIncome: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
              </FormField>

              <FormField label="RRSP Deduction" hint={`Maximum contribution room for ${state.activePersonalYear}: ${formatCurrency(RRSP_LIMIT_2025)}`}>
                <Input type="number" min="0" step="0.01" prefix="$" value={pyForm.rrspDeduction || ''} onChange={e => setPyForm(f => ({ ...f, rrspDeduction: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
              </FormField>

              <FormField label="Available RRSP Room" hint="Your carryforward room from prior years">
                <Input type="number" min="0" step="0.01" prefix="$" value={pyForm.rrspRoom || ''} onChange={e => setPyForm(f => ({ ...f, rrspRoom: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
              </FormField>
            </div>

            <div className={styles.actions}>
              <Button type="submit">Save</Button>
              {pySaved && <span className={styles.savedMsg}>✅ Saved!</span>}
            </div>
          </form>

          <div className={styles.explainerBox}>
            <h4>How dividends work for Ontario CCPC owners</h4>
            <ul>
              <li><strong>Non-eligible dividends</strong> are paid from income taxed at the small business rate (9% federal + 3.2% Ontario = 12.2%). You get a smaller dividend tax credit.</li>
              <li><strong>Eligible dividends</strong> are paid from income taxed at the general corporate rate, and come with a larger personal dividend tax credit.</li>
              <li>For most web dev CCPCs, all dividends will be <strong>non-eligible</strong>.</li>
              <li>Dividends have no CPP or EI contributions — a major advantage over salary.</li>
              <li>The dividend gross-up means your taxable income is higher than cash received, but the DTC offsets this.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ═══ TAB 1: Dividends Paid ═══ */}
      {tab === 1 && (
        <div className={styles.section}>
          <div className={styles.divHeader}>
            <div>
              <h3>Dividends Paid — {state.activeFiscalYear}</h3>
              <p className={styles.divSub}>Record dividend payments from your corporation to yourself.</p>
            </div>
            <Button size="sm" onClick={() => setShowDivModal(true)}>+ Record Dividend</Button>
          </div>

          <div className={styles.divSummary}>
            <div className={styles.divSummaryItem}>
              <span>Total Dividends Paid</span>
              <strong>{formatCurrency(totalDivPaid)}</strong>
            </div>
            <div className={styles.divSummaryItem}>
              <span>Number of payments</span>
              <strong>{dividendsPaid.length}</strong>
            </div>
          </div>

          {dividendsPaid.length === 0 ? (
            <EmptyState icon="💸" title="No dividend payments yet" description="Record dividends paid from your corporation to yourself." action={<Button size="sm" onClick={() => setShowDivModal(true)}>+ Record Dividend</Button>} />
          ) : (
            <div className={styles.divList}>
              {[...dividendsPaid].sort((a, b) => new Date(b.date) - new Date(a.date)).map(div => (
                <div key={div.id} className={styles.divRow}>
                  <div className={styles.divLeft}>
                    <span className={styles.divDate}>{formatDate(div.date)}</span>
                    <span className={styles.divType}>{div.type === 'non_eligible' ? 'Non-Eligible' : 'Eligible'} Dividend</span>
                    {div.notes && <span className={styles.divNotes}>{div.notes}</span>}
                  </div>
                  <div className={styles.divRight}>
                    <span className={styles.divAmount}>{formatCurrency(div.amount)}</span>
                    <button className={styles.divDelete} onClick={() => setConfirmDeleteDiv(div.id)} aria-label="Delete">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 2: T1 Estimate ═══ */}
      {tab === 2 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Personal T1 Tax Estimate — {state.activePersonalYear}</h3>
            <p>Ontario resident estimate. Does not account for all credits and deductions. Consult a tax professional for your final return.</p>
          </div>

          <div className={styles.taxBreakdown}>
            <TaxSection title="Income">
              <TaxRow label="Non-eligible dividends (actual)" value={formatCurrency(taxResult.nonEligibleDivs)} />
              <TaxRow label="Non-eligible dividend gross-up (15%)" value={`+ ${formatCurrency(taxResult.neGrossedUp - taxResult.nonEligibleDivs)}`} />
              <TaxRow label="Eligible dividends (actual)" value={formatCurrency(taxResult.eligibleDivs)} />
              <TaxRow label="Eligible dividend gross-up (38%)" value={`+ ${formatCurrency(taxResult.elGrossedUp - taxResult.eligibleDivs)}`} />
              <TaxRow label="Other income" value={formatCurrency(taxResult.otherIncome)} />
              <TaxRow label="RRSP deduction" value={`− ${formatCurrency(taxResult.rrspDeduction)}`} />
              <TaxRow label="Net income (line 23600)" value={formatCurrency(taxResult.netIncome)} bold />
            </TaxSection>

            <TaxSection title="Federal Tax">
              <TaxRow label="Gross federal tax" value={formatCurrency(taxResult.fedGrossIncomeTax)} />
              <TaxRow label="Basic personal amount credit" value={`− ${formatCurrency(taxResult.fedBPA_credit)}`} />
              <TaxRow label="Non-eligible dividend tax credit" value={`− ${formatCurrency(taxResult.fedNeDTC)}`} />
              <TaxRow label="Eligible dividend tax credit" value={`− ${formatCurrency(taxResult.fedElDTC)}`} />
              <TaxRow label="Federal tax" value={formatCurrency(taxResult.fedTax)} bold />
            </TaxSection>

            <TaxSection title="Ontario Tax">
              <TaxRow label="Gross Ontario tax" value={formatCurrency(taxResult.onGrossIncomeTax)} />
              <TaxRow label="Basic personal amount credit" value={`− ${formatCurrency(taxResult.onBPA_credit)}`} />
              <TaxRow label="Non-eligible dividend tax credit" value={`− ${formatCurrency(taxResult.onNeDTC)}`} />
              <TaxRow label="Eligible dividend tax credit" value={`− ${formatCurrency(taxResult.onElDTC)}`} />
              <TaxRow label="Ontario basic tax" value={formatCurrency(taxResult.onBasicTax)} />
              <TaxRow label="Ontario surtax" value={formatCurrency(taxResult.onSurtax)} />
              <TaxRow label="Ontario Health Premium" value={formatCurrency(taxResult.ohp)} />
              <TaxRow label="Ontario tax total" value={formatCurrency(taxResult.onTax)} bold />
            </TaxSection>

            <div className={styles.taxTotal}>
              <div className={styles.taxTotalRow}>
                <span>Total estimated tax</span>
                <strong>{formatCurrency(taxResult.totalTax)}</strong>
              </div>
              <div className={styles.taxTotalRow}>
                <span>Effective rate on grossed-up income</span>
                <strong>{formatPercent(taxResult.effectiveRate)}</strong>
              </div>
              <div className={styles.taxTotalRow}>
                <span>After-tax income</span>
                <strong>{formatCurrency(taxResult.afterTaxIncome)}</strong>
              </div>
            </div>

            <div className={styles.t1Disclaimer}>
              <strong>⚠️ This is an estimate only.</strong> It assumes Ontario residency, no other credits (medical, charitable, etc.), and uses {state.activePersonalYear} rates. Filing deadline: April 30, {state.activePersonalYear + 1}.
            </div>
          </div>
        </div>
      )}

      {/* ── Dividend Modal ── */}
      <Modal isOpen={showDivModal} onClose={() => setShowDivModal(false)} title="Record Dividend Payment" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDivModal(false)}>Cancel</Button>
            <Button type="submit" form="div-form">Save</Button>
          </>
        }
      >
        <form id="div-form" onSubmit={saveDividend}>
          <div className={styles.divFormGrid}>
            <FormField label="Payment Date" required>
              <Input type="date" value={divForm.date} onChange={e => setDivForm(f => ({ ...f, date: e.target.value }))} required />
            </FormField>
            <FormField label="Amount" required>
              <Input type="number" min="0" step="0.01" prefix="$" value={divForm.amount} onChange={e => setDivForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
            </FormField>
            <FormField label="Dividend Type" className={styles.colSpan2} hint="Most CCPC dividends are non-eligible">
              <Select value={divForm.type} onChange={e => setDivForm(f => ({ ...f, type: e.target.value }))}>
                <option value="non_eligible">Non-Eligible (CCPC small business income)</option>
                <option value="eligible">Eligible (general rate income)</option>
              </Select>
            </FormField>
            <FormField label="Notes" className={styles.colSpan2}>
              <Textarea rows={2} value={divForm.notes} onChange={e => setDivForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal isOpen={!!confirmDeleteDiv} onClose={() => setConfirmDeleteDiv(null)} title="Remove Dividend?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteDiv(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteDiv(confirmDeleteDiv)}>Remove</Button>
          </>
        }
      >
        <p>This dividend record will be removed and the personal tax amounts updated.</p>
      </Modal>
    </div>
  );
}

function TaxSection({ title, children }) {
  return (
    <div className={styles.taxSection}>
      <h4 className={styles.taxSectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

function TaxRow({ label, value, bold }) {
  return (
    <div className={`${styles.taxRow} ${bold ? styles.taxRowBold : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
