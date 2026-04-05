'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { calculatePersonalTax } from '@/lib/taxCalculations';
import { formatCurrency, formatDate, formatPercent, today } from '@/lib/formatters';
import { RRSP_LIMIT_2025 } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const TABS = ['Personal Income', 'Dividends Paid', 'T1 Estimate'];

// ─── Suggestion badge shown below auto-fillable fields ────────────────────────
function SuggestionBadge({ suggestion, current, isOverridden, onUse, onReset }) {
  if (suggestion == null) return null;
  const differs = Math.abs((current || 0) - (suggestion || 0)) > 0.005;
  if (!differs && suggestion > 0) return <span className={styles.sugSynced}>✓ Matches records</span>;
  if (isOverridden && differs) {
    return (
      <span className={styles.sugOverride}>
        ⚠ Modified — records show {formatCurrency(suggestion)}{' '}
        <button type="button" className={styles.sugLink} onClick={onReset}>reset</button>
      </span>
    );
  }
  if (differs && suggestion > 0) {
    return (
      <span className={styles.sugAvailable}>
        Detected from records: {formatCurrency(suggestion)}{' '}
        <button type="button" className={styles.sugLink} onClick={onUse}>→ use</button>
      </span>
    );
  }
  return null;
}

export default function PersonalPage() {
  const { state, activeFY, activePY, dispatch } = useApp();
  const { toast } = useToast();
  const [tab, setTab] = useState(0);
  const [pyForm, setPyForm] = useState({ ...activePY });
  const [pySaved, setPySaved] = useState(false);
  const [overrides, setOverrides] = useState(new Set());

  // Sync form when year changes
  useEffect(() => {
    const py = state.personalYears?.[state.activePersonalYear] ?? {};
    setPyForm({ ...py });
    setOverrides(new Set());
  }, [state.activePersonalYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dividend form
  const [showDivModal, setShowDivModal] = useState(false);
  const [divForm, setDivForm] = useState({ date: today(), amount: '', type: 'non_eligible', notes: '' });
  const [confirmDeleteDiv, setConfirmDeleteDiv] = useState(null);
  const [importSelected, setImportSelected] = useState(new Set()); // tx ids selected for import

  // ── Year navigation ──────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const saved = Object.keys(state.personalYears || {}).map(Number);
    const range = [currentYear - 1, currentYear];
    return [...new Set([...saved, ...range])].sort((a, b) => b - a);
  }, [state.personalYears, currentYear]);

  const setYear = y => dispatch({ type: 'SET_ACTIVE_PERSONAL_YEAR', payload: y });
  const activeYear = state.activePersonalYear;
  const yearIdx = yearOptions.indexOf(activeYear);

  // ── Compute suggestions from app data for the selected tax year ──────────
  const { suggestions, refData } = useMemo(() => {
    const yStart = `${activeYear}-01-01`;
    const yEnd   = `${activeYear}-12-31`;

    const inRange = date => date && date >= yStart && date <= yEnd;

    // Dividends paid during this calendar year (from Dividends tab)
    const allDivs = Object.values(state.fiscalYears || {}).flatMap(fy => fy.dividendsPaid || []);
    const yearDivs = allDivs.filter(d => inRange(d.date));
    const divNonElig = yearDivs.filter(d => d.type !== 'eligible').reduce((s, d) => s + (d.amount || 0), 0);
    const divElig    = yearDivs.filter(d => d.type === 'eligible').reduce((s, d) => s + (d.amount || 0), 0);

    // Bank statement keyword matching
    const keywords = (state.settings?.personalAccountKeywords || '')
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    const allStmts = Object.values(state.fiscalYears || {}).flatMap(fy => fy.bankStatements || []);
    const yearStmts = allStmts.filter(s => {
      const start = s.periodStart || s.uploadedAt?.slice(0, 10) || '';
      const end   = s.periodEnd   || s.periodStart || s.uploadedAt?.slice(0, 10) || '';
      return start <= yEnd && end >= yStart;
    });

    // Debit transactions matching any keyword within the calendar year
    const matchedTxns = keywords.length > 0
      ? yearStmts.flatMap(stmt =>
          (stmt.transactions || [])
            .map((tx, i) => ({ ...tx, id: tx.id || `${stmt.id}-${i}` }))
            .filter(tx => {
              if (tx.type !== 'debit') return false;
              if (!inRange(tx.date)) return false;
              const desc = (tx.description || '').toLowerCase();
              return keywords.some(k => desc.includes(k));
            })
            .map(tx => ({ ...tx, stmtPeriod: stmt.period || stmt.bank }))
        )
      : [];
    const bankMatchTotal = matchedTxns.reduce((s, tx) => s + Math.abs(tx.amount || 0), 0);

    // Suggested non-eligible dividends: prefer bank match if keywords set, else fall back to dividend records
    const sugNonElig = bankMatchTotal > 0 ? bankMatchTotal : divNonElig;
    const sugElig    = divElig;
    const sugSource  = bankMatchTotal > 0 ? 'bank' : 'dividends';

    // Paid invoices in this calendar year (corp revenue, informational)
    const allInvs = Object.values(state.fiscalYears || {}).flatMap(fy => fy.invoices || []);
    const paidInvs = allInvs.filter(inv => inv.status === 'paid' && inRange(inv.paidDate || inv.issueDate));
    const corpRevenue = paidInvs.reduce((s, inv) => s + (inv.subtotal || 0), 0);

    // Expenses in this calendar year (corp expenses, informational)
    const allExps = Object.values(state.fiscalYears || {}).flatMap(fy => fy.expenses || []);
    const yearExps = allExps.filter(e => inRange(e.date));
    const corpExpenses = yearExps.reduce((s, e) => s + (e.total || 0), 0);

    // Latest bank statement balance overlapping this year
    const sortedStmts = [...yearStmts].sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || ''));
    const latestStmt    = sortedStmts[0] || null;
    const latestBalance = latestStmt?.closingBalance ?? null;

    return {
      suggestions: { nonEligibleDivs: sugNonElig, eligibleDivs: sugElig },
      refData: {
        yearDivs, divNonElig, divElig,
        sugNonElig, sugElig, sugSource,
        matchedTxns, bankMatchTotal, keywords,
        corpRevenue, corpExpenses, paidInvs,
        latestBalance, latestStmt,
      },
    };
  }, [activeYear, state.fiscalYears, state.settings?.personalAccountKeywords]);

  // ── Dividends paid filtered to this calendar year (for the Dividends tab) ──
  const dividendsPaid = useMemo(() => {
    const yStart = `${activeYear}-01-01`;
    const yEnd   = `${activeYear}-12-31`;
    return Object.values(state.fiscalYears || {})
      .flatMap(fy => fy.dividendsPaid || [])
      .filter(d => (d.date || '') >= yStart && (d.date || '') <= yEnd);
  }, [activeYear, state.fiscalYears]);
  const totalDivPaid = dividendsPaid.reduce((s, d) => s + (d.amount || 0), 0);

  // ── Field change with override tracking ─────────────────────────────────
  const handleField = (field, value) => {
    const num = typeof value === 'string' ? (parseFloat(value) || 0) : value;
    setPyForm(f => ({ ...f, [field]: num }));
    if (field in suggestions) {
      setOverrides(o => {
        const n = new Set(o);
        Math.abs(num - (suggestions[field] || 0)) > 0.005 ? n.add(field) : n.delete(field);
        return n;
      });
    }
  };

  const syncFromRecords = () => {
    setPyForm(f => ({ ...f, ...suggestions }));
    setOverrides(new Set());
  };

  const resetField = field => {
    const val = suggestions[field] || 0;
    setPyForm(f => ({ ...f, [field]: val }));
    setOverrides(o => { const n = new Set(o); n.delete(field); return n; });
  };

  const useField = field => resetField(field);

  const savePY = e => {
    e.preventDefault();
    dispatch({ type: 'UPDATE_PERSONAL', payload: pyForm });
    setPySaved(true);
    setTimeout(() => setPySaved(false), 2500);
  };

  const saveDividend = e => {
    e.preventDefault();
    const amount = parseFloat(divForm.amount) || 0;
    dispatch({
      type: 'ADD_DIVIDEND',
      payload: {
        ...divForm,
        amount,
        personalYear: activeYear,
      },
    });
    toast({ message: `Dividend of ${formatCurrency(amount)} recorded`, detail: divForm.type === 'eligible' ? 'Eligible dividend' : 'Non-eligible dividend' });
    setShowDivModal(false);
    setDivForm({ date: today(), amount: '', type: 'non_eligible', notes: '' });
  };

  const deleteDiv = id => {
    dispatch({ type: 'DELETE_DIVIDEND', payload: id });
    setConfirmDeleteDiv(null);
    toast({ message: 'Dividend removed', type: 'info' });
  };

  // ── Import matched bank txns as dividend records ─────────────────────────
  // Which matched txns haven't been imported yet (no dividend with matching bankTxId)
  const allDividendsBankTxIds = useMemo(() => {
    const all = Object.values(state.fiscalYears || {}).flatMap(fy => fy.dividendsPaid || []);
    return new Set(all.map(d => d.bankTxId).filter(Boolean));
  }, [state.fiscalYears]);

  const unimportedTxns = useMemo(
    () => refData.matchedTxns.filter(tx => !allDividendsBankTxIds.has(tx.id)),
    [refData.matchedTxns, allDividendsBankTxIds]
  );

  // Pre-select all unimported txns when they change
  useEffect(() => {
    setImportSelected(new Set(unimportedTxns.map(tx => tx.id)));
  }, [unimportedTxns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleImportTx = id => setImportSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const importFromBank = () => {
    const toImport = unimportedTxns.filter(tx => importSelected.has(tx.id));
    toImport.forEach(tx => {
      dispatch({
        type: 'ADD_DIVIDEND',
        payload: {
          date: tx.date || today(),
          amount: Math.abs(tx.amount || 0),
          type: 'non_eligible',
          notes: tx.description || '',
          personalYear: activeYear,
          bankTxId: tx.id,
        },
      });
    });
  };

  // Tax calc uses saved activePY (not live form, to match what was last saved)
  const taxResult = calculatePersonalTax({
    nonEligibleDivs: activePY.nonEligibleDivs || 0,
    eligibleDivs:    activePY.eligibleDivs    || 0,
    otherIncome:     activePY.otherIncome     || 0,
    rrspDeduction:   activePY.rrspDeduction   || 0,
  });

  const hasSyncable = Object.keys(suggestions).some(k => (suggestions[k] || 0) > 0);

  return (
    <div className={styles.page}>
      {/* ── Year picker ── */}
      <div className={styles.yearPicker}>
        <span className={styles.yearPickerLabel}>Tax Year</span>
        <div className={styles.yearNav}>
          <button
            className={styles.yearArrow}
            onClick={() => yearIdx < yearOptions.length - 1 && setYear(yearOptions[yearIdx + 1])}
            disabled={yearIdx >= yearOptions.length - 1}
            aria-label="Previous year"
          >‹</button>
          <select
            className={styles.yearSelect}
            value={activeYear}
            onChange={e => setYear(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            className={styles.yearArrow}
            onClick={() => yearIdx > 0 && setYear(yearOptions[yearIdx - 1])}
            disabled={yearIdx <= 0}
            aria-label="Next year"
          >›</button>
        </div>
        <button
          className={styles.yearAdd}
          onClick={() => setYear(Math.max(...yearOptions) + 1)}
          title="Add next year"
        >+ {Math.max(...yearOptions) + 1}</button>
      </div>

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
            <h3>Personal Tax Information — {activeYear}</h3>
            <p>Your personal income for Jan 1 – Dec 31, {activeYear}. Fields marked with a suggestion can be auto-filled from your app records.</p>
          </div>

          {/* Sync bar */}
          {hasSyncable && (
            <div className={styles.syncBar}>
              <span className={styles.syncBarText}>
                {refData.sugSource === 'bank'
                  ? `🏦 ${refData.matchedTxns.length} bank transaction${refData.matchedTxns.length !== 1 ? 's' : ''} matched "${refData.keywords.join(', ')}" — ${formatCurrency(refData.bankMatchTotal)} detected`
                  : `📊 Dividend records found for ${activeYear}`
                }
              </span>
              <Button size="sm" variant="secondary" type="button" onClick={syncFromRecords}>
                ↻ Sync all from records
              </Button>
            </div>
          )}

          {!hasSyncable && refData.keywords.length > 0 && (
            <div className={styles.syncBarEmpty}>
              🔍 No bank transactions matched "{refData.keywords.join(', ')}" in {activeYear}. Upload statements or adjust keywords in{' '}
              <button type="button" className={styles.sugLink} onClick={() => {/* settings link handled by nav */}}>Settings → Company</button>.
            </div>
          )}

          <form onSubmit={savePY}>
            <div className={styles.formGrid}>
              <FormField
                label="Non-Eligible Dividends Received"
                hint="Dividends paid from your CCPC (taxed at small business rate)"
                extra={
                  <SuggestionBadge
                    suggestion={suggestions.nonEligibleDivs}
                    current={pyForm.nonEligibleDivs}
                    isOverridden={overrides.has('nonEligibleDivs')}
                    onUse={() => useField('nonEligibleDivs')}
                    onReset={() => resetField('nonEligibleDivs')}
                  />
                }
              >
                <Input
                  type="number" min="0" step="0.01" prefix="$"
                  value={pyForm.nonEligibleDivs || ''}
                  onChange={e => handleField('nonEligibleDivs', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField
                label="Eligible Dividends Received"
                hint="Dividends from public corporations (T5 slips from banks, mutual funds, etc.)"
                extra={
                  <SuggestionBadge
                    suggestion={suggestions.eligibleDivs}
                    current={pyForm.eligibleDivs}
                    isOverridden={overrides.has('eligibleDivs')}
                    onUse={() => useField('eligibleDivs')}
                    onReset={() => resetField('eligibleDivs')}
                  />
                }
              >
                <Input
                  type="number" min="0" step="0.01" prefix="$"
                  value={pyForm.eligibleDivs || ''}
                  onChange={e => handleField('eligibleDivs', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Other Employment / Business Income" hint="T4 salary, self-employment from other sources, rental income, etc.">
                <Input
                  type="number" min="0" step="0.01" prefix="$"
                  value={pyForm.otherIncome || ''}
                  onChange={e => handleField('otherIncome', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Tax Withheld at Source" hint="Box 22 on T4 slips — income tax already deducted by an employer">
                <Input
                  type="number" min="0" step="0.01" prefix="$"
                  value={pyForm.taxWithheld || ''}
                  onChange={e => handleField('taxWithheld', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="RRSP Deduction" hint={`2025 annual limit: ${formatCurrency(RRSP_LIMIT_2025)} — use your actual contribution amount`}>
                <Input
                  type="number" min="0" step="0.01" prefix="$"
                  value={pyForm.rrspDeduction || ''}
                  onChange={e => handleField('rrspDeduction', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Available RRSP Room" hint="Your total contribution room (from your latest NOA or CRA My Account)">
                <Input
                  type="number" min="0" step="0.01" prefix="$"
                  value={pyForm.rrspRoom || ''}
                  onChange={e => handleField('rrspRoom', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            </div>

            <div className={styles.actions}>
              <Button type="submit">Save</Button>
              {pySaved && <span className={styles.savedMsg}>✅ Saved!</span>}
            </div>
          </form>

          {/* App data reference card */}
          {(refData.corpRevenue > 0 || refData.latestBalance != null || refData.yearDivs.length > 0 || refData.matchedTxns.length > 0) && (
            <div className={styles.refCard}>
              <h4 className={styles.refCardTitle}>📊 {activeYear} App Records — Reference</h4>
              <p className={styles.refCardHint}>Informational only. Use Sync above to auto-fill fields.</p>
              <div className={styles.refGrid}>
                {refData.matchedTxns.length > 0 && (
                  <div className={styles.refItem}>
                    <span className={styles.refLabel}>Transfers to personal account</span>
                    <span className={styles.refValue}>{formatCurrency(refData.bankMatchTotal)}</span>
                    <span className={styles.refSub}>{refData.matchedTxns.length} tx · matched "{refData.keywords.join(', ')}"</span>
                  </div>
                )}
                {refData.yearDivs.length > 0 && (
                  <div className={styles.refItem}>
                    <span className={styles.refLabel}>Dividends recorded (Divs tab)</span>
                    <span className={styles.refValue}>{formatCurrency(refData.divNonElig + refData.divElig)}</span>
                    <span className={styles.refSub}>{refData.yearDivs.length} payment{refData.yearDivs.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {refData.corpRevenue > 0 && (
                  <div className={styles.refItem}>
                    <span className={styles.refLabel}>Corp revenue (paid invoices)</span>
                    <span className={styles.refValue}>{formatCurrency(refData.corpRevenue)}</span>
                    <span className={styles.refSub}>{refData.paidInvs.length} invoice{refData.paidInvs.length !== 1 ? 's' : ''} — excl. HST</span>
                  </div>
                )}
                {refData.corpExpenses > 0 && (
                  <div className={styles.refItem}>
                    <span className={styles.refLabel}>Corp expenses</span>
                    <span className={styles.refValue}>{formatCurrency(refData.corpExpenses)}</span>
                    <span className={styles.refSub}>By expense date</span>
                  </div>
                )}
                {refData.latestBalance != null && (
                  <div className={styles.refItem}>
                    <span className={styles.refLabel}>Bank balance (latest stmt)</span>
                    <span className={styles.refValue}>{formatCurrency(refData.latestBalance)}</span>
                    <span className={styles.refSub}>{refData.latestStmt?.period || refData.latestStmt?.bank || 'Bank statement'}</span>
                  </div>
                )}
              </div>

              {/* Matched transactions detail */}
              {refData.matchedTxns.length > 0 && (
                <details className={styles.refTxDetails}>
                  <summary className={styles.refTxSummary}>View {refData.matchedTxns.length} matched transaction{refData.matchedTxns.length !== 1 ? 's' : ''}</summary>
                  <table className={styles.refTxTable}>
                    <thead>
                      <tr><th>Date</th><th>Description</th><th>Statement</th><th className={styles.right}>Amount</th></tr>
                    </thead>
                    <tbody>
                      {[...refData.matchedTxns]
                        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                        .map((tx, i) => (
                          <tr key={tx.id || i}>
                            <td>{tx.date || '—'}</td>
                            <td>{tx.description || '—'}</td>
                            <td className={styles.refTxStmt}>{tx.stmtPeriod || '—'}</td>
                            <td className={`${styles.right} ${styles.refTxAmount}`}>{formatCurrency(Math.abs(tx.amount))}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}

          {/* Family profile card */}
          <FamilyProfileCard
            personalProfile={state.personalProfile}
            dependants={state.dependants}
            styles={styles}
          />

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
              <h3>Dividends Paid — {activeYear}</h3>
              <p className={styles.divSub}>Dividends paid from your corporation to yourself between Jan 1 – Dec 31, {activeYear}.</p>
            </div>
            <Button size="sm" onClick={() => setShowDivModal(true)}>+ Record Dividend</Button>
          </div>

          {/* Bank import panel */}
          {unimportedTxns.length > 0 && (
            <div className={styles.importPanel}>
              <div className={styles.importPanelHeader}>
                <div>
                  <span className={styles.importPanelTitle}>🏦 {unimportedTxns.length} bank transfer{unimportedTxns.length !== 1 ? 's' : ''} ready to import</span>
                  <span className={styles.importPanelSub}>Matched "{refData.keywords.join(', ')}" — will be added as non-eligible dividends</span>
                </div>
                <Button
                  size="sm"
                  onClick={importFromBank}
                  disabled={importSelected.size === 0}
                >
                  ↓ Import {importSelected.size > 0 ? importSelected.size : ''} Selected
                </Button>
              </div>
              <table className={styles.importTable}>
                <thead>
                  <tr>
                    <th className={styles.importChk}>
                      <input
                        type="checkbox"
                        checked={importSelected.size === unimportedTxns.length && unimportedTxns.length > 0}
                        onChange={e => setImportSelected(e.target.checked ? new Set(unimportedTxns.map(t => t.id)) : new Set())}
                      />
                    </th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Statement</th>
                    <th className={styles.right}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...unimportedTxns]
                    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                    .map(tx => (
                      <tr
                        key={tx.id}
                        className={importSelected.has(tx.id) ? styles.importRowSelected : ''}
                        onClick={() => toggleImportTx(tx.id)}
                      >
                        <td className={styles.importChk}>
                          <input
                            type="checkbox"
                            checked={importSelected.has(tx.id)}
                            onChange={() => toggleImportTx(tx.id)}
                            onClick={e => e.stopPropagation()}
                          />
                        </td>
                        <td>{tx.date || '—'}</td>
                        <td>{tx.description || '—'}</td>
                        <td className={styles.importStmt}>{tx.stmtPeriod || '—'}</td>
                        <td className={`${styles.right} ${styles.importAmount}`}>{formatCurrency(Math.abs(tx.amount))}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}

          {refData.matchedTxns.length > 0 && unimportedTxns.length === 0 && (
            <div className={styles.importDone}>
              ✅ All {refData.matchedTxns.length} matched bank transfer{refData.matchedTxns.length !== 1 ? 's' : ''} have been imported.
            </div>
          )}

          {refData.keywords.length > 0 && refData.matchedTxns.length === 0 && (
            <div className={styles.syncBarEmpty}>
              🔍 No bank transactions matched "{refData.keywords.join(', ')}" in {activeYear}. Upload statements or check keywords in Settings → Company.
            </div>
          )}

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
            <EmptyState icon="💸" title="No dividend payments yet" description="Record dividends paid from your corporation to yourself, or import from bank statements above." action={<Button size="sm" onClick={() => setShowDivModal(true)}>+ Record Dividend</Button>} />
          ) : (
            <div className={styles.divList}>
              {[...dividendsPaid].sort((a, b) => new Date(b.date) - new Date(a.date)).map(div => (
                <div key={div.id} className={styles.divRow}>
                  <div className={styles.divLeft}>
                    <span className={styles.divDate}>{formatDate(div.date)}</span>
                    <span className={styles.divType}>{div.type === 'non_eligible' ? 'Non-Eligible' : 'Eligible'} Dividend{div.bankTxId ? <span className={styles.divBankTag}>🏦 from bank</span> : ''}</span>
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
            <h3>Personal T1 Tax Estimate — {activeYear}</h3>
            <p>Ontario resident estimate based on saved values. Save your income details first to update this estimate. Does not account for all credits — consult a tax professional.</p>
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
              <strong>⚠️ This is an estimate only.</strong> It assumes Ontario residency, no other credits (medical, charitable, etc.), and uses {activeYear} rates. Filing deadline: April 30, {activeYear + 1}.
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

function FamilyProfileCard({ personalProfile, dependants, styles }) {
  const profile = personalProfile || {};
  const deps    = dependants    || [];

  const hasSpouse    = profile.maritalStatus === 'married' || profile.maritalStatus === 'common_law';
  const hasDeps      = deps.length > 0;
  const hasAnything  = profile.maritalStatus || hasDeps;

  if (!hasAnything) return null;

  const MARITAL_LABELS = {
    single: 'Single', married: 'Married', common_law: 'Common-law',
    separated: 'Separated', divorced: 'Divorced', widowed: 'Widowed',
  };

  const currentYear = new Date().getFullYear();
  const age = (birthYear) => birthYear ? currentYear - parseInt(birthYear) : null;

  const RELATIONSHIP_LABELS = {
    child: 'Child', parent: 'Parent', grandparent: 'Grandparent',
    sibling: 'Sibling', other: 'Dependant',
  };

  return (
    <div className={styles.familyCard}>
      <div className={styles.familyCardHeader}>
        <span className={styles.familyCardTitle}>👨‍👩‍👧 Family Profile</span>
        <a href="/settings" className={styles.familyCardEdit}>Edit in Settings</a>
      </div>

      <div className={styles.familyGrid}>
        {/* Marital status row */}
        {profile.maritalStatus && (
          <div className={styles.familyItem}>
            <span className={styles.familyItemIcon}>{hasSpouse ? '💑' : '🧍'}</span>
            <div className={styles.familyItemBody}>
              <div className={styles.familyItemLabel}>
                {MARITAL_LABELS[profile.maritalStatus] || profile.maritalStatus}
              </div>
              {hasSpouse && profile.spouseName && (
                <div className={styles.familyItemSub}>{profile.spouseName}</div>
              )}
              {hasSpouse && profile.spouseIncomeType && profile.spouseIncomeType !== 'none' && (
                <div className={styles.familyItemTag}>
                  {profile.spouseIncomeType === 'employed' ? 'T4 employed' : 'Self-employed'}
                  {profile.spouseEstIncome ? ` · est. $${Number(profile.spouseEstIncome).toLocaleString('en-CA', { maximumFractionDigits: 0 })}` : ''}
                </div>
              )}
              {hasSpouse && profile.spouseIncomeType === 'none' && (
                <div className={styles.familyItemTag}>Not working / retired</div>
              )}
            </div>
          </div>
        )}

        {/* Dependants */}
        {deps.map(dep => {
          const depAge = age(dep.birthYear);
          return (
            <div key={dep.id} className={styles.familyItem}>
              <span className={styles.familyItemIcon}>
                {dep.relationship === 'child' ? (depAge !== null && depAge <= 17 ? '🧒' : '🧑') : '👤'}
              </span>
              <div className={styles.familyItemBody}>
                <div className={styles.familyItemLabel}>
                  {dep.name || (RELATIONSHIP_LABELS[dep.relationship] || 'Dependant')}
                </div>
                <div className={styles.familyItemSub}>
                  {RELATIONSHIP_LABELS[dep.relationship] || 'Dependant'}
                  {depAge !== null ? ` · age ${depAge}` : dep.birthYear ? ` · b. ${dep.birthYear}` : ''}
                </div>
                {dep.disability && (
                  <div className={styles.familyItemTagDTC}>DTC eligible</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.familyCardNote}>
        This profile was set during onboarding. Update it anytime in{' '}
        <a href="/settings" className={styles.familyCardNoteLink}>Settings</a>.
        Spousal RRSP contributions and income-splitting calculations use these values.
      </p>
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
