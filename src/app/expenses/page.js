'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { calculateHomeOfficeDeduction, getDeductibleAmount } from '@/lib/taxCalculations';
import { formatCurrency, formatDate, today } from '@/lib/formatters';
import { EXPENSE_CATEGORIES, PARTIAL_DEDUCTION_CATEGORIES, HST_RATES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import FileDropzone from '@/components/ui/FileDropzone';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const TABS = ['Expenses', 'Home Office'];

function makeBlankExpense() {
  return {
    date: today(),
    category: 'software_subscriptions',
    vendor: '',
    description: '',
    amount: '',
    hst: '',
    businessUsePercent: 100,
    notes: '',
  };
}

export default function ExpensesPage() {
  const { state, activeFY, dispatch } = useApp();
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

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editExp, setEditExp] = useState(null);
  const [form, setForm] = useState(makeBlankExpense());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

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
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload });
    }
    closeModal();
  };

  const handleDelete = id => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
    setConfirmDelete(null);
  };

  // Auto-calc HST when amount changes
  const handleAmountChange = val => {
    const amt = parseFloat(val) || 0;
    const hst = state.settings.hstRegistered ? +(amt * hstRate).toFixed(2) : 0;
    setForm(f => ({ ...f, amount: val, hst: String(hst) }));
  };

  // PDF import
  const handleImportFiles = useCallback(async files => {
    setImporting(true);
    setImportResult(null);
    const file = files[0];
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImportResult(data);
      const p = data.parsed || {};
      // Determine if HST is included in total or if total is before tax
      const total = p.total || 0;
      const hstAmt = p.hst || +(total * hstRate / (1 + hstRate)).toFixed(2);
      const amtBeforeTax = p.subtotal || +(total / (1 + hstRate)).toFixed(2);
      setForm(f => ({
        ...makeBlankExpense(),
        date: p.date || today(),
        vendor: p.vendor || p.client || '',
        description: p.description || '',
        amount: String(amtBeforeTax || ''),
        hst: String(hstAmt || ''),
        notes: p.documentNumber ? `Ref: ${p.documentNumber}` : '',
      }));
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  }, [hstRate, state.settings.hstRegistered]);

  const handleUseImported = () => { setShowImport(false); setEditExp(null); setShowModal(true); };

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

  const totalDeductible = expenses.reduce((s, e) =>
    s + getDeductibleAmount(e.amount || 0, e.category, e.businessUsePercent), 0);
  const totalHST = expenses.reduce((s, e) => s + (e.hst || 0), 0);

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
              <Button variant="secondary" size="sm" onClick={() => { setImportResult(null); setShowImport(true); }}>📎 Import Receipt</Button>
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
                      const deductible = getDeductibleAmount(exp.amount || 0, exp.category, exp.businessUsePercent);
                      const isPartial = PARTIAL_DEDUCTION_CATEGORIES[exp.category];
                      return (
                        <tr key={exp.id} className={styles.tableRow}>
                          <td>{formatDate(exp.date, { style: 'short' })}</td>
                          <td>{exp.vendor || '—'}</td>
                          <td>
                            <Badge color="default">{catLabel(exp.category)}</Badge>
                            {isPartial && <span className={styles.partial}> (50%)</span>}
                          </td>
                          <td className={styles.descCell}>{exp.description || '—'}</td>
                          <td className={styles.right}>{formatCurrency(exp.amount)}</td>
                          <td className={styles.right}>{exp.hst ? formatCurrency(exp.hst) : '—'}</td>
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
                  const deductible = getDeductibleAmount(exp.amount || 0, exp.category, exp.businessUsePercent);
                  return (
                    <div key={exp.id} className={styles.mobileCard}>
                      <div className={styles.mobileTop}>
                        <Badge color="default">{catLabel(exp.category)}</Badge>
                        <span className={styles.mobileDate}>{formatDate(exp.date, { style: 'short' })}</span>
                      </div>
                      <div className={styles.mobileVendor}>{exp.vendor || exp.description || 'Expense'}</div>
                      <div className={styles.mobileMeta}>
                        <span>{formatCurrency(exp.amount)}</span>
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

      {/* ═══ HOME OFFICE TAB ═══ */}
      {tab === 1 && (
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
            <FormField label="Vendor / Merchant" className={styles.colSpan2}>
              <Input placeholder="Adobe Inc., Rogers, etc." value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
            </FormField>
            <FormField label="Description" className={styles.colSpan2}>
              <Input placeholder="Brief description of the expense" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </FormField>
            <FormField label="Amount (before HST)" required>
              <Input type="number" min="0" step="0.01" prefix="$" value={form.amount} onChange={e => handleAmountChange(e.target.value)} required />
            </FormField>
            <FormField label="HST Paid" hint="Leave 0 if no HST receipt">
              <Input type="number" min="0" step="0.01" prefix="$" value={form.hst} onChange={e => setForm(f => ({ ...f, hst: e.target.value }))} />
            </FormField>
            <FormField label="Business Use %" hint="100% unless mixed personal/business" className={styles.colSpan2}>
              <Input type="number" min="0" max="100" step="1" suffix="%" value={form.businessUsePercent} onChange={e => setForm(f => ({ ...f, businessUsePercent: e.target.value }))} />
            </FormField>
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
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Receipt" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>Cancel</Button>
            {importResult && !importResult.error && (
              <Button onClick={handleUseImported}>Use extracted data →</Button>
            )}
          </>
        }
      >
        <div className={styles.importBody}>
          <FileDropzone onFiles={handleImportFiles} label={importing ? 'Extracting…' : 'Drop receipt PDF or image here'} hint="Supports PDF, PNG, JPG" />
          {importing && <p className={styles.importStatus}>⏳ Parsing…</p>}
          {importResult?.error && <p className={styles.importError}>❌ {importResult.error}</p>}
          {importResult && !importResult.error && (
            <div className={styles.importPreview}>
              <p className={styles.importPreviewTitle}>✅ Extracted fields:</p>
              {Object.entries(importResult.parsed || {}).map(([k, v]) => v != null && (
                <div key={k} className={styles.importRow}>
                  <span className={styles.importKey}>{k}:</span>
                  <span className={styles.importVal}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Confirm Delete ── */}
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
