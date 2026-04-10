'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { calculateHomeOfficeDeduction, getDeductibleAmount } from '@/lib/taxCalculations';
import { formatCurrency, formatDate, today } from '@/lib/formatters';
import { fyLabelForDate } from '@/lib/fyUtils';
import { EXPENSE_CATEGORIES, PARTIAL_DEDUCTION_CATEGORIES, HST_RATES } from '@/lib/constants';
import { exportExpensesCSV } from '@/lib/exportHelpers';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import FileDropzone from '@/components/ui/FileDropzone';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';
import { expandRecurringForFY } from '@/lib/recurringUtils';

const TABS = ['Expenses', 'Recurring', 'Home Office'];

const FREQUENCIES = [
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual',    label: 'Annual' },
];

function makeBlankRecurring() {
  return {
    vendor: '',
    description: '',
    category: 'software_subscriptions',
    businessUsePercent: 100,
    amount: '',
    hst: '',
    frequency: 'monthly',
    startDate: today(),
    endDate: '',
    notes: '',
  };
}

function recurringMonthlyAmount(rec) {
  const amt = parseFloat(rec.amount) || 0;
  if (rec.frequency === 'quarterly') return amt / 3;
  if (rec.frequency === 'annual')    return amt / 12;
  return amt;
}

function isRecurringActive(rec, asOf) {
  if (!rec.startDate || rec.startDate > asOf) return false;
  if (rec.endDate && rec.endDate < asOf) return false;
  return true;
}

function makeBlankExpense() {
  return {
    date: today(),
    category: 'software_subscriptions',
    vendor: '',
    description: '',
    amount: '',
    hst: '',
    shipping: '',
    businessUsePercent: 100,
    notes: '',
    isRecurring: false,
    months: 12,
    currency: 'CAD',
    exchangeRateToCAD: 1,
  };
}

// Total pre-tax cost (monthly x months for recurring, else just amount)
function expTotal(exp) {
  const base = exp.amount || 0;
  return exp.isRecurring ? base * (exp.months || 1) : base;
}

function expHSTTotal(exp) {
  const base = exp.hst || 0;
  return exp.isRecurring ? base * (exp.months || 1) : base;
}

export default function ExpensesPage() {
  const { state, activeFY, dispatch } = useApp();
  const { user } = useAuth();
  const hstRate = HST_RATES[state.settings.province ?? 'ON'];
  const isAllTime = state.activeFiscalYear === 'all';
  const allExpenses = Object.values(state.fiscalYears || {}).flatMap(fy => fy.expenses || []);
  const { startDate, endDate } = activeFY || {};
  const expenses = isAllTime
    ? allExpenses
    : allExpenses.filter(exp =>
        (!startDate || (exp.date ?? '') >= startDate) &&
        (!endDate   || (exp.date ?? '') <= endDate)
      );
  const homeOffice = activeFY?.homeOffice ?? {};
  const { toast } = useToast();
  const recurringExpenses = state.recurringExpenses || [];
  const todayStr = today();
  const activeRecurring = recurringExpenses.filter(r => isRecurringActive(r, todayStr));
  const monthlyRecurringTotal = activeRecurring.reduce((s, r) => s + recurringMonthlyAmount(r), 0);

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editExp, setEditExp] = useState(null);
  const [form, setForm] = useState(makeBlankExpense());
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState([]);
  const [importIdx, setImportIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importSaveMode, setImportSaveMode] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  // Recurring modal state
  const [showRecurModal, setShowRecurModal] = useState(false);
  const [editRecur, setEditRecur] = useState(null);
  const [recurForm, setRecurForm] = useState(makeBlankRecurring());
  const [confirmDeleteRecur, setConfirmDeleteRecur] = useState(null);

  const openCreateRecur = () => { setEditRecur(null); setRecurForm(makeBlankRecurring()); setShowRecurModal(true); };
  const openEditRecur = r => { setEditRecur(r); setRecurForm({ ...r }); setShowRecurModal(true); };
  const closeRecurModal = () => { setShowRecurModal(false); setEditRecur(null); };

  const handleSaveRecur = e => {
    e.preventDefault();
    const payload = {
      ...recurForm,
      amount: parseFloat(recurForm.amount) || 0,
      hst: parseFloat(recurForm.hst) || 0,
      businessUsePercent: parseFloat(recurForm.businessUsePercent) || 100,
    };
    if (editRecur) {
      dispatch({ type: 'UPDATE_RECURRING', payload: { ...payload, id: editRecur.id } });
      toast({ message: `${payload.vendor || 'Recurring expense'} updated` });
    } else {
      dispatch({ type: 'ADD_RECURRING', payload });
      const freqLabel = FREQUENCIES.find(f => f.value === payload.frequency)?.label ?? payload.frequency;
      toast({
        message: `${payload.vendor || 'Recurring expense'} added`,
        detail: `${formatCurrency(payload.amount)} / ${freqLabel.toLowerCase()} starting ${payload.startDate}`,
      });
    }
    closeRecurModal();
  };

  const handleDeleteRecur = id => {
    dispatch({ type: 'DELETE_RECURRING', payload: id });
    setConfirmDeleteRecur(null);
    toast({ message: 'Recurring expense removed', type: 'info' });
  };

  const handleRecurAmountChange = val => {
    const amt = parseFloat(val) || 0;
    const hst = state.settings.hstRegistered ? (amt * hstRate).toFixed(2) : '';
    setRecurForm(f => ({ ...f, amount: val, hst: hst }));
  };

  // Home office form state
  const [hoForm, setHoForm] = useState(homeOffice);
  const [hoSaved, setHoSaved] = useState(false);

  const openCreate = () => { setEditExp(null); setForm(makeBlankExpense()); setShowModal(true); };
  const openEdit = exp => { setEditExp(exp); setForm({ ...exp }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditExp(null); };

  const handleSave = e => {
    e.preventDefault();
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
      hst: parseFloat(form.hst) || 0,
      businessUsePercent: parseFloat(form.businessUsePercent) || 100,
    };
    if (editExp) {
      dispatch({ type: 'UPDATE_EXPENSE', payload: { ...payload, id: editExp.id } });
      toast({ message: 'Expense updated' });
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload });
      const activeFyLabel = state.activeFiscalYear;
      const dateFy = fyLabelForDate(payload.date, state.fiscalYears);
      if (dateFy && activeFyLabel !== 'all' && dateFy !== activeFyLabel) {
        toast({
          message: 'Expense saved',
          detail: `The date (${payload.date}) falls in ${dateFy}. Switch fiscal years to see it there.`,
          type: 'info',
        });
      } else {
        toast({ message: 'Expense added', detail: `${payload.vendor || payload.description || 'New expense'} · ${formatCurrency(payload.amount)}` });
      }
    }
    // If we're stepping through an import queue, mark saved and advance
    if (importSaveMode) {
      const savedIdx = importIdx;
      setImportResults(prev => prev.map((r, i) => i === savedIdx ? { ...r, saved: true } : r));
      const next = importResults.findIndex((r, i) => i > savedIdx && !r.saved && !r.error);
      if (next >= 0) {
        setImportIdx(next);
        const p = importResults[next].parsed || {};
        const rawSubtotal = p.subtotal;
        const rawTotal = p.total;
        let subAmt, hstAmt;
        if (rawSubtotal) {
          subAmt = rawSubtotal;
          hstAmt = p.hst != null ? p.hst : rawTotal && rawTotal > rawSubtotal ? +(rawTotal - rawSubtotal).toFixed(2) : +(rawSubtotal * hstRate).toFixed(2);
        } else {
          const total = rawTotal || 0;
          hstAmt = p.hst != null ? p.hst : +(total * hstRate / (1 + hstRate)).toFixed(2);
          subAmt = +(total - hstAmt).toFixed(2);
        }
        setEditExp(null);
        setForm({
          ...makeBlankExpense(),
          date: p.date || today(),
          vendor: p.vendor || p.client || '',
          description: importResults[next].firstDesc || '',
          amount: String(subAmt || ''),
          hst: String(hstAmt || ''),
          shipping: p.shipping ? String(p.shipping) : '',
          notes: p.documentNumber ? `Ref: ${p.documentNumber}` : '',
        });
        return; // stay in modal with next item's data
      }
      setImportSaveMode(false);
      setShowImport(false);
    }
    closeModal();
  };

  const handleDelete = id => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
    setConfirmDelete(null);
    toast({ message: 'Expense deleted', type: 'info' });
  };

  // Auto-calc HST when amount changes
  const handleAmountChange = val => {
    const amt = parseFloat(val) || 0;
    const hst = state.settings.hstRegistered ? (amt * hstRate).toFixed(2) : '';
    setForm(f => ({ ...f, amount: val, hst: hst }));
  };

  // PDF import — multi-file
  const handleImportFiles = useCallback(async files => {
    setImporting(true);
    setImportResults([]);
    setImportIdx(0);
    const fd = new FormData();
    for (const f of files) fd.append('file', f);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd, headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const results = (data.results || []).map(r => {
        const p = r.parsed || {};
        const firstDesc = '';
        return { filename: r.filename, parsed: p, text: r.text, firstDesc, error: r.error };
      });
      setImportResults(results);
    } catch (err) {
      setImportResults([{ error: err.message }]);
    } finally {
      setImporting(false);
    }
  }, []);

  const handleUseImported = () => {
    const result = importResults[importIdx];
    if (!result || result.error || result.saved) return;
    const p = result.parsed || {};
    const rawSubtotal = p.subtotal;
    const rawTotal = p.total;
    let subAmt, hstAmt;
    if (rawSubtotal) {
      subAmt = rawSubtotal;
      hstAmt = p.hst != null ? p.hst : rawTotal && rawTotal > rawSubtotal ? +(rawTotal - rawSubtotal).toFixed(2) : +(rawSubtotal * hstRate).toFixed(2);
    } else {
      const total = rawTotal || 0;
      hstAmt = p.hst != null ? p.hst : +(total * hstRate / (1 + hstRate)).toFixed(2);
      subAmt = +(total - hstAmt).toFixed(2);
    }
    setEditExp(null);
    setImportSaveMode(true);
    setForm({
      ...makeBlankExpense(),
      date: p.date || today(),
      vendor: p.vendor || p.client || '',
      description: result.firstDesc || '',
      amount: String(subAmt || ''),
      hst: String(hstAmt || ''),
      shipping: p.shipping ? String(p.shipping) : '',
      notes: p.documentNumber ? `Ref: ${p.documentNumber}` : '',
    });
    setShowModal(true);
  };

  const handleSkipImport = () => {
    setImportIdx(i => Math.min(importResults.length - 1, i + 1));
  };

  // Save home office
  const saveHomeOffice = e => {
    e.preventDefault();
    dispatch({ type: 'UPDATE_HOME_OFFICE', payload: hoForm });
    setHoSaved(true);
    setTimeout(() => setHoSaved(false), 2500);
  };

  const hoCalc = calculateHomeOfficeDeduction(hoForm);

  // Filter expenses
  const filtered = expenses.filter(exp => {
    const matchCat = catFilter === 'all' || exp.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || exp.vendor?.toLowerCase().includes(q) || exp.description?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const recurringOccurrences = !isAllTime && startDate && endDate
    ? expandRecurringForFY(state.recurringExpenses || [], startDate, endDate)
    : [];
  const expensesForTotals = [...expenses, ...recurringOccurrences];
  const totalDeductible = expensesForTotals.reduce((s, e) =>
    s + getDeductibleAmount(expTotal(e), e.category, e.businessUsePercent), 0);
  const totalHST = expensesForTotals.reduce((s, e) => s + expHSTTotal(e), 0);

  const catLabel = v => EXPENSE_CATEGORIES.find(c => c.value === v)?.label || v;

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

      {/* ═══ EXPENSES TAB ═══ */}
      {tab === 0 && (
        <>
          <div className={styles.summaryBar}>
            <SummaryItem label="Total Deductible" value={formatCurrency(totalDeductible)} />
            <SummaryItem label="HST Paid (ITCs)" value={formatCurrency(totalHST)} />
            <SummaryItem label="Home Office Deduction" value={formatCurrency(hoCalc.deductible)} />
            <SummaryItem label="Combined Deductions" value={formatCurrency(totalDeductible + hoCalc.deductible)} accent />
          </div>

          <div className={styles.toolbar}>
            <input className={styles.search} type="search" placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={styles.filterSelect}>
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <div className={styles.toolbarActions}>
              <Button variant="secondary" size="sm" onClick={() => exportExpensesCSV(state, state.activeFiscalYear !== 'all' ? state.activeFiscalYear : Object.keys(state.fiscalYears).sort().pop())}>
                ⬇ CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setImportResults([]); setImportIdx(0); setShowImport(true); }}>📎 Import Receipts</Button>
              <Button size="sm" onClick={openCreate}>+ Add Expense</Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="🧾" title="No expenses yet" description="Add expenses manually or import a receipt PDF." action={<Button onClick={openCreate}>+ Add Expense</Button>} />
          ) : (
            <>
              {/* Desktop table */}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th><th>Vendor</th><th>Category</th><th>Description</th>
                      <th className={styles.right}>Amount</th><th className={styles.right}>HST</th>
                      <th className={styles.right}>Deductible</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(exp => {
                      const total = expTotal(exp);
                      const deductible = getDeductibleAmount(total, exp.category, exp.businessUsePercent);
                      const isPartial = PARTIAL_DEDUCTION_CATEGORIES[exp.category];
                      return (
                        <tr key={exp.id} className={styles.tableRow}>
                          <td>{formatDate(exp.date)}</td>
                          <td>{exp.vendor || '—'}</td>
                          <td>
                            <Badge color="default">{catLabel(exp.category)}</Badge>
                            {isPartial && <span className={styles.partial}> (50%)</span>}
                            {exp.isRecurring && <span className={styles.recurBadge}>↻ ×{exp.months}mo</span>}
                          </td>
                          <td className={styles.descCell} title={exp.description || undefined}>{exp.description || '—'}</td>
                          <td className={styles.right}>
                            {exp.isRecurring
                              ? <span title={`${formatCurrency(exp.amount)}/mo`}>{formatCurrency(total)}</span>
                              : formatCurrency(exp.amount)
                            }
                            {exp.currency && exp.currency !== 'CAD' && (
                              <span className={styles.currencyBadge}>{exp.currency}</span>
                            )}
                          </td>
                          <td className={styles.right}>{expHSTTotal(exp) ? formatCurrency(expHSTTotal(exp)) : '—'}</td>
                          <td className={styles.right}>{formatCurrency(deductible)}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <Button variant="ghost" size="xs" onClick={() => openEdit(exp)}>Edit</Button>
                              <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(exp.id)}>🗑</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className={styles.mobileList}>
                {filtered.map(exp => {
                  const total = expTotal(exp);
                  const deductible = getDeductibleAmount(total, exp.category, exp.businessUsePercent);
                  return (
                    <div key={exp.id} className={styles.mobileCard}>
                      <div className={styles.mobileTop}>
                        <Badge color="default">{catLabel(exp.category)}</Badge>
                        <span className={styles.mobileDate}>{formatDate(exp.date)}</span>
                      </div>
                      <div className={styles.mobileVendor}>
                        {exp.vendor || exp.description || 'Expense'}
                        {exp.isRecurring && <span className={styles.recurBadge}> ↻ ×{exp.months}mo</span>}
                      </div>
                      <div className={styles.mobileMeta}>
                        <span>
                          {formatCurrency(total)}
                          {exp.isRecurring && <span className={styles.recurMonthly}> ({formatCurrency(exp.amount)}/mo)</span>}
                        </span>
                        <span className={styles.mobileDeductible}>Deductible: {formatCurrency(deductible)}</span>
                      </div>
                      <div className={styles.mobileActions}>
                        <Button variant="secondary" size="xs" onClick={() => openEdit(exp)}>Edit</Button>
                        <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(exp.id)}>Delete</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ RECURRING TAB ═══ */}
      {tab === 1 && (
        <>
          <div className={styles.recurSummaryBar}>
            <div className={styles.recurStat}>
              <span className={styles.recurStatLabel}>Active Subscriptions</span>
              <span className={styles.recurStatValue}>{activeRecurring.length}</span>
            </div>
            <div className={styles.recurStat}>
              <span className={styles.recurStatLabel}>Monthly Total</span>
              <span className={styles.recurStatValue}>{formatCurrency(monthlyRecurringTotal)}</span>
            </div>
            <div className={styles.recurStat}>
              <span className={styles.recurStatLabel}>Annual Total</span>
              <span className={styles.recurStatValue}>{formatCurrency(monthlyRecurringTotal * 12)}</span>
            </div>
          </div>

          <div className={styles.recurToolbar}>
            <p className={styles.recurHint}>
              Track your subscriptions and fixed recurring costs here. Active items are automatically counted in your monthly overhead.
            </p>
            <Button size="sm" onClick={openCreateRecur}>+ Add Recurring</Button>
          </div>

          {recurringExpenses.length === 0 ? (
            <EmptyState
              icon="🔁"
              title="No recurring expenses"
              description="Add subscriptions, bank fees, software plans, and other fixed monthly costs."
              action={<Button onClick={openCreateRecur}>+ Add Recurring</Button>}
            />
          ) : (
            <div className={styles.recurList}>
              {recurringExpenses.map(rec => {
                const active = isRecurringActive(rec, todayStr);
                const monthly = recurringMonthlyAmount(rec);
                const freqLabel = FREQUENCIES.find(f => f.value === rec.frequency)?.label ?? rec.frequency;
                return (
                  <div key={rec.id} className={`${styles.recurCard} ${active ? '' : styles.recurCardInactive}`}>
                    <div className={styles.recurCardTop}>
                      <div className={styles.recurCardLeft}>
                        <span className={`${styles.recurActivePill} ${active ? styles.recurActivePillOn : styles.recurActivePillOff}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                        <span className={styles.recurVendor}>{rec.vendor || rec.description || 'Recurring expense'}</span>
                        {rec.description && rec.vendor && (
                          <span className={styles.recurDesc}>{rec.description}</span>
                        )}
                      </div>
                      <div className={styles.recurCardRight}>
                        <span className={styles.recurAmount}>{formatCurrency(rec.amount)}</span>
                        <span className={styles.recurFreq}>/ {freqLabel.toLowerCase()}</span>
                        {rec.frequency !== 'monthly' && (
                          <span className={styles.recurMonthlyEq}>≈ {formatCurrency(monthly)}/mo</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.recurCardMeta}>
                      <Badge color="default">{catLabel(rec.category)}</Badge>
                      {rec.businessUsePercent < 100 && (
                        <span className={styles.recurBizPct}>{rec.businessUsePercent}% business</span>
                      )}
                      <span className={styles.recurDates}>
                        Started {rec.startDate ? formatDate(rec.startDate) : '—'}
                        {rec.endDate ? ` → ${formatDate(rec.endDate)}` : ' (ongoing)'}
                      </span>
                    </div>
                    <div className={styles.recurCardActions}>
                      <Button variant="ghost" size="xs" onClick={() => openEditRecur(rec)}>Edit</Button>
                      <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteRecur(rec.id)}>🗑</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ HOME OFFICE TAB ═══ */}
      {tab === 2 && (
        <div className={styles.homeOfficePane}>
          <div className={styles.hoInfo}>
            <h3>Home Office Deduction</h3>
            <p>For a corporation, you can deduct a portion of your home expenses based on the size of your dedicated workspace relative to your total home size.</p>
          </div>

          <form onSubmit={saveHomeOffice}>
            <div className={styles.hoGrid}>
              <div className={styles.hoSection}>
                <h4 className={styles.hoSectionTitle}>Space</h4>
                <div className={styles.hoFields}>
                  <FormField label="Total Home Square Footage" hint="Total living area of your home">
                    <Input type="number" min="0" step="1" value={hoForm.totalHomeSqFt || ''} onChange={e => setHoForm(f => ({ ...f, totalHomeSqFt: parseFloat(e.target.value) || 0 }))} placeholder="1200" suffix="sq ft" />
                  </FormField>
                  <FormField label="Office/Work Area Square Footage" hint="Space used exclusively for work">
                    <Input type="number" min="0" step="1" value={hoForm.officeSqFt || ''} onChange={e => setHoForm(f => ({ ...f, officeSqFt: parseFloat(e.target.value) || 0 }))} placeholder="150" suffix="sq ft" />
                  </FormField>
                  <FormField label="Months in Period">
                    <Input type="number" min="1" max="12" step="1" value={hoForm.months || 12} onChange={e => setHoForm(f => ({ ...f, months: parseInt(e.target.value) || 12 }))} />
                  </FormField>
                </div>
              </div>

              <div className={styles.hoSection}>
                <h4 className={styles.hoSectionTitle}>Monthly Home Expenses</h4>
                <div className={styles.hoFields}>
                  <FormField label="Rent (if renting)">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.rent || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, rent: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                  <FormField label="Mortgage Interest (if owning)" hint="Interest portion only, not principal">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.mortgageInterest || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, mortgageInterest: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                  <FormField label="Utilities (hydro, water, etc.)">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.utilities || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, utilities: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                  <FormField label="Heat">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.heat || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, heat: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                  <FormField label="Internet">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.internet || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, internet: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                  <FormField label="Property Tax (owners)" hint="Prorated monthly amount">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.propertyTax || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, propertyTax: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                  <FormField label="Maintenance & Repairs">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.maintenance || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, maintenance: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                  <FormField label="Condo Fees">
                    <Input type="number" min="0" step="0.01" prefix="$" value={hoForm.monthlyExpenses?.condoFees || ''} onChange={e => setHoForm(f => ({ ...f, monthlyExpenses: { ...f.monthlyExpenses, condoFees: parseFloat(e.target.value) || 0 } }))} placeholder="0.00" />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Calculated result */}
            <div className={styles.hoResult}>
              <div className={styles.hoResultRow}>
                <span>Workspace percentage</span>
                <strong>{hoCalc.percentDisplay}%</strong>
              </div>
              <div className={styles.hoResultRow}>
                <span>Monthly home expenses</span>
                <strong>{formatCurrency(hoCalc.monthlyTotal)}</strong>
              </div>
              <div className={styles.hoResultRow}>
                <span>Annual total ({hoCalc.months} months)</span>
                <strong>{formatCurrency(hoCalc.annualTotal)}</strong>
              </div>
              <div className={`${styles.hoResultRow} ${styles.hoResultTotal}`}>
                <span>Deductible amount</span>
                <strong>{formatCurrency(hoCalc.deductible)}</strong>
              </div>
            </div>

            <div className={styles.hoActions}>
              <Button type="submit">Save Home Office Settings</Button>
              {hoSaved && <span className={styles.savedMsg}>✅ Saved!</span>}
            </div>
          </form>
        </div>
      )}

      {/* ── Expense Form Modal ── */}
      <Modal isOpen={showModal} onClose={closeModal} title={editExp ? 'Edit Expense' : 'Add Expense'} size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" form="expense-form">Save</Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={handleSave}>
          <div className={styles.expFormGrid}>
            <FormField label="Date" required>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </FormField>
            <FormField label="Category" required>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </FormField>
            <div className={styles.vendorBizRow}>
              <FormField label="Vendor / Merchant" className={styles.vendorField}>
                <Input placeholder="Adobe Inc., Rogers, etc." value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
              </FormField>
              <FormField label="Business Use %" className={styles.bizField}>
                <Input type="number" min="0" max="100" step="1" suffix="%" value={form.businessUsePercent} onChange={e => setForm(f => ({ ...f, businessUsePercent: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Description" className={styles.colSpan2}>
              <Input placeholder="Brief description of the expense" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </FormField>
            <FormField label="Amount (before HST)" required>
              <Input type="number" min="0" step="0.01" prefix="$" value={form.amount} onChange={e => handleAmountChange(e.target.value)} required />
            </FormField>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0 0 0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>Currency</label>
              <Select
                value={form.currency || 'CAD'}
                style={{ width: '6rem' }}
                onChange={async e => {
                  const cur = e.target.value;
                  setForm(f => ({ ...f, currency: cur, exchangeRateToCAD: cur === 'CAD' ? 1 : f.exchangeRateToCAD }));
                  if (cur !== 'CAD') {
                    setRateLoading(true);
                    try {
                      const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${cur}&to=CAD`);
                      const data = await res.json();
                      if (data.rates?.CAD) setForm(f => ({ ...f, exchangeRateToCAD: data.rates.CAD }));
                    } catch { /* silent — user can edit manually */ }
                    finally { setRateLoading(false); }
                  }
                }}
              >
                {['CAD','USD','EUR','GBP','AUD','MXN','JPY','CHF','CNY'].map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              {(form.currency && form.currency !== 'CAD') && (
                <>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>1 {form.currency} =</span>
                  <Input
                    type="number" min="0" step="any"
                    value={form.exchangeRateToCAD || ''}
                    onChange={e => setForm(f => ({ ...f, exchangeRateToCAD: parseFloat(e.target.value) || 1 }))}
                    placeholder={rateLoading ? 'Fetching…' : 'Rate'}
                    style={{ width: '6rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CAD</span>
                </>
              )}
            </div>
            <FormField label="HST Paid">
              <Input type="number" min="0" step="0.01" prefix="$" value={form.hst} onChange={e => setForm(f => ({ ...f, hst: e.target.value }))} />
            </FormField>
            <FormField label="Shipping">
              <Input type="number" min="0" step="0.01" prefix="$" value={form.shipping} onChange={e => setForm(f => ({ ...f, shipping: e.target.value }))} />
            </FormField>

            {/* Recurring toggle */}
            <div className={`${styles.colSpan2} ${styles.recurRow}`}>
              <label className={styles.recurToggle}>
                <input
                  type="checkbox"
                  checked={!!form.isRecurring}
                  onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))}
                />
                <span>Recurring / subscription (monthly charge)</span>
              </label>
              {form.isRecurring && (
                <div className={styles.recurMonthsWrap}>
                  <FormField label="Months in this fiscal period" hint="How many months this expense recurs (max 12)">
                    <Input
                      type="number" min="1" max="12" step="1"
                      value={form.months}
                      onChange={e => setForm(f => ({ ...f, months: parseInt(e.target.value) || 1 }))}
                      suffix="mo"
                    />
                  </FormField>
                  <p className={styles.recurTotal}>
                    Total: <strong>{formatCurrency((parseFloat(form.amount) || 0) * (form.months || 1))}</strong>
                    {(parseFloat(form.hst) || 0) > 0 && (
                      <> + <strong>{formatCurrency((parseFloat(form.hst) || 0) * (form.months || 1))}</strong> HST</>
                    )}
                    {' '}over {form.months} month{form.months !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            {PARTIAL_DEDUCTION_CATEGORIES[form.category] && (
              <div className={`${styles.colSpan2} ${styles.noteBox}`}>
                ℹ️ <strong>{catLabel(form.category)}</strong> is only 50% deductible under CRA rules.
              </div>
            )}
            <FormField label="Notes" className={styles.colSpan2}>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reference number, receipt details…" rows={2} />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Import Modal ── */}
      {(() => {
        const currentImport = importResults[importIdx];
        const importTotalValid = importResults.filter(r => !r.error).length;
        const importSavedCount = importResults.filter(r => r.saved).length;
        const allImportsDone = importTotalValid > 0 && importSavedCount >= importTotalValid;
        return (
          <Modal isOpen={showImport && !showModal} onClose={() => { setShowImport(false); setImportSaveMode(false); }} title="Import Receipts from PDF" size="lg"
            footer={
              <>
                <Button variant="secondary" onClick={() => { setShowImport(false); setImportSaveMode(false); }}>
                  {allImportsDone ? 'Done ✓' : 'Close'}
                </Button>
                {importResults.length > 1 && (
                  <div className={styles.importNav}>
                    <Button variant="secondary" size="xs" onClick={() => setImportIdx(i => Math.max(0, i - 1))} disabled={importIdx === 0}>←</Button>
                    <span>{importIdx + 1} / {importResults.length}</span>
                    <Button variant="secondary" size="xs" onClick={() => setImportIdx(i => Math.min(importResults.length - 1, i + 1))} disabled={importIdx === importResults.length - 1}>→</Button>
                  </div>
                )}
                {currentImport && !currentImport.error && !currentImport.saved && (
                  <>
                    {importResults.length > 1 && (
                      <Button variant="secondary" onClick={handleSkipImport} disabled={importIdx === importResults.length - 1}>Skip</Button>
                    )}
                    <Button onClick={handleUseImported}>Edit &amp; Save →</Button>
                  </>
                )}
                {currentImport?.saved && <span className={styles.importSavedBadge}>✅ Saved</span>}
              </>
            }
          >
            <div className={styles.importBody}>
              {importResults.length === 0 && (
                <FileDropzone
                  onFiles={handleImportFiles}
                  label={importing ? 'Parsing files…' : 'Drop one or more receipt PDFs here'}
                  hint="Supports PDF, PNG, JPG. Vendor, amount, HST and description are pre-filled from extracted text."
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                />
              )}
              {importing && <p className={styles.importStatus}>⏳ Extracting text…</p>}
              {importResults.length > 0 && (
                <>
                  {currentImport?.error ? (
                    <p className={styles.importError}>\u274c {currentImport.filename}: {currentImport.error}</p>
                  ) : (
                    <div className={styles.importPreview}>
                      <div className={styles.importPreviewHeader}>
                        <p className={styles.importPreviewTitle}>
                          {currentImport?.saved ? '✅ Saved: ' : '🧾 Extracted from: '}
                          <strong>{currentImport?.filename}</strong>
                        </p>
                        {importTotalValid > 1 && (
                          <p className={styles.importProgress}>{importSavedCount} of {importTotalValid} saved</p>
                        )}
                      </div>
                      {currentImport?.firstDesc && (
                        <div className={styles.importRow}>
                          <span className={styles.importKey}>item:</span>
                          <span className={styles.importVal}>{currentImport.firstDesc}</span>
                        </div>
                      )}
                      {Object.entries(currentImport?.parsed || {})
                        .filter(([k, v]) => v != null && k !== 'lineItems' && k !== 'vendor' && k !== 'description')
                        .map(([k, v]) => (
                          <div key={k} className={styles.importRow}>
                            <span className={styles.importKey}>{k}:</span>
                            <span className={styles.importVal}>{String(v)}</span>
                          </div>
                        ))}
                      {currentImport?.parsed?.vendor && (
                        <div className={styles.importRow}>
                          <span className={styles.importKey}>vendor:</span>
                          <span className={styles.importVal}>{currentImport.parsed.vendor}</span>
                        </div>
                      )}
                      {currentImport?.text && (
                        <details className={styles.rawText}>
                          <summary>Raw extracted text</summary>
                          <pre>{currentImport.text.slice(0, 1000)}</pre>
                        </details>
                      )}
                    </div>
                  )}
                  <div className={styles.importReset}>
                    <Button variant="ghost" size="xs" onClick={() => { setImportResults([]); setImportIdx(0); }}>
                      ← Upload different files
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ── Confirm Delete Expense ── */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Expense?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Delete</Button>
          </>
        }
      >
        <p className={styles.confirmText}>This expense will be permanently deleted.</p>
      </Modal>

      {/* ── Recurring Expense Modal ── */}
      <Modal
        isOpen={showRecurModal}
        onClose={closeRecurModal}
        title={editRecur ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeRecurModal}>Cancel</Button>
            <Button type="submit" form="recur-form">Save</Button>
          </>
        }
      >
        <form id="recur-form" onSubmit={handleSaveRecur}>
          <div className={styles.expFormGrid}>
            <FormField label="Vendor / Merchant" className={styles.colSpan2}>
              <Input
                placeholder="Rogers, AWS, Notion, etc."
                value={recurForm.vendor}
                onChange={e => setRecurForm(f => ({ ...f, vendor: e.target.value }))}
              />
            </FormField>
            <FormField label="Description">
              <Input
                placeholder="Monthly bank fee, hosting plan…"
                value={recurForm.description}
                onChange={e => setRecurForm(f => ({ ...f, description: e.target.value }))}
              />
            </FormField>
            <FormField label="Category">
              <Select value={recurForm.category} onChange={e => setRecurForm(f => ({ ...f, category: e.target.value }))}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Frequency" required>
              <Select value={recurForm.frequency} onChange={e => setRecurForm(f => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Business Use %">
              <Input
                type="number" min="0" max="100" step="1" suffix="%"
                value={recurForm.businessUsePercent}
                onChange={e => setRecurForm(f => ({ ...f, businessUsePercent: e.target.value }))}
              />
            </FormField>
            <FormField label="Amount (before HST)" required>
              <Input
                type="number" min="0" step="0.01" prefix="$"
                placeholder={`per ${recurForm.frequency === 'monthly' ? 'month' : recurForm.frequency === 'quarterly' ? 'quarter' : 'year'}`}
                value={recurForm.amount}
                onChange={e => handleRecurAmountChange(e.target.value)}
                required
              />
            </FormField>
            <FormField label="HST per period">
              <Input
                type="number" min="0" step="0.01" prefix="$"
                value={recurForm.hst}
                onChange={e => setRecurForm(f => ({ ...f, hst: e.target.value }))}
              />
            </FormField>
            <FormField label="Start Date" required hint="When this charge began">
              <Input
                type="date"
                value={recurForm.startDate}
                onChange={e => setRecurForm(f => ({ ...f, startDate: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="End Date" hint="Leave blank if still active">
              <Input
                type="date"
                value={recurForm.endDate}
                onChange={e => setRecurForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </FormField>
            {(parseFloat(recurForm.amount) > 0) && (
              <div className={`${styles.colSpan2} ${styles.recurCalcBox}`}>
                <span>
                  {formatCurrency(parseFloat(recurForm.amount) || 0)} /{recurForm.frequency === 'monthly' ? 'mo' : recurForm.frequency === 'quarterly' ? 'qtr' : 'yr'}
                  {recurForm.frequency !== 'monthly' && (
                    <> &nbsp;≈&nbsp;<strong>{formatCurrency(recurringMonthlyAmount(recurForm))}/mo</strong></>
                  )}
                  &nbsp;·&nbsp;<strong>{formatCurrency((recurringMonthlyAmount(recurForm)) * 12)}/yr</strong>
                </span>
              </div>
            )}
            <FormField label="Notes" className={styles.colSpan2}>
              <Textarea
                value={recurForm.notes}
                onChange={e => setRecurForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Contract number, plan details…"
                rows={2}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete Recurring ── */}
      <Modal isOpen={!!confirmDeleteRecur} onClose={() => setConfirmDeleteRecur(null)} title="Remove Recurring Expense?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteRecur(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDeleteRecur(confirmDeleteRecur)}>Remove</Button>
          </>
        }
      >
        <p className={styles.confirmText}>This recurring expense will be removed from your registry.</p>
      </Modal>
    </div>
  );
}

function SummaryItem({ label, value, accent }) {
  return (
    <div className={styles.summaryItem}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={`${styles.summaryValue} ${accent ? styles.summaryAccent : ''}`}>{value}</span>
    </div>
  );
}

function catLabel(v) {
  return EXPENSE_CATEGORIES.find(c => c.value === v)?.label || v;
}
