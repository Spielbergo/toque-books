'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { calculateHSTSummary } from '@/lib/taxCalculations';
import { formatCurrency, formatDate, today } from '@/lib/formatters';
import { expandRecurringForFY } from '@/lib/recurringUtils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const BLANK = { period: '', amtCollected: '', itc: '', netRemittance: '', remittedDate: '', confirmationNo: '', notes: '' };

export default function HSTTrackerPage() {
  const { state, dispatch, activeFY } = useApp();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [autoFill, setAutoFill] = useState(false);

  if (state.activeFiscalYear === 'all') {
    return (
      <div className={styles.empty}>
        <p>Select a fiscal year to view HST remittances.</p>
      </div>
    );
  }

  const remittances = activeFY?.hstRemittances || [];

  // Calculate expected HST from books
  const allFYData = Object.values(state.fiscalYears || {});
  const { startDate, endDate } = activeFY || {};
  const inRange = d => !d || ((!startDate || d >= startDate) && (!endDate || d <= endDate));
  const invoices = allFYData.flatMap(f => f.invoices || []).filter(inv => inRange(inv.issueDate));
  const baseExpenses = allFYData.flatMap(f => f.expenses || []).filter(e => inRange(e.date));
  const recurringForFY = startDate && endDate
    ? expandRecurringForFY(state.recurringExpenses || [], startDate, endDate) : [];
  const expenses = [...baseExpenses, ...recurringForFY];
  const hst = calculateHSTSummary(invoices, expenses);

  const totalRemitted = remittances.reduce((s, r) => s + (parseFloat(r.netRemittance) || 0), 0);
  const balance = hst.netRemittance - totalRemitted;

  const openCreate = () => {
    setEditId(null);
    setForm({ ...BLANK, period: activeFY?.label || '', amtCollected: hst.hstCollected.toFixed(2), itc: hst.itcTotal.toFixed(2), netRemittance: hst.netRemittance.toFixed(2) });
    setAutoFill(true);
    setShowModal(true);
  };

  const openEdit = r => {
    setEditId(r.id);
    setForm({ period: r.period || '', amtCollected: r.amtCollected || '', itc: r.itc || '', netRemittance: r.netRemittance || '', remittedDate: r.remittedDate || '', confirmationNo: r.confirmationNo || '', notes: r.notes || '' });
    setAutoFill(false);
    setShowModal(true);
  };

  const handleSave = () => {
    const payload = {
      ...form,
      amtCollected: parseFloat(form.amtCollected) || 0,
      itc: parseFloat(form.itc) || 0,
      netRemittance: parseFloat(form.netRemittance) || 0,
    };
    dispatch({ type: editId ? 'UPDATE_HST_REMITTANCE' : 'ADD_HST_REMITTANCE', payload: editId ? { id: editId, ...payload } : payload });
    toast({ message: editId ? 'Remittance updated' : 'Remittance recorded', type: 'success' });
    setShowModal(false);
  };

  const handleDelete = id => {
    dispatch({ type: 'DELETE_HST_REMITTANCE', payload: id });
    toast({ message: 'Remittance deleted', type: 'info' });
  };

  return (
    <div className={styles.page}>
      {/* Summary */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>HST Collected</span>
          <span className={styles.summaryValue}>{formatCurrency(hst.hstCollected)}</span>
          <span className={styles.summarySub}>From invoices this FY</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Input Tax Credits</span>
          <span className={styles.summaryValue} style={{ color: 'var(--success)' }}>{formatCurrency(hst.itcTotal)}</span>
          <span className={styles.summarySub}>HST paid on expenses</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Net Owing to CRA</span>
          <span className={styles.summaryValue} style={{ color: hst.netRemittance < 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(hst.netRemittance)}</span>
          <span className={styles.summarySub}>{hst.netRemittance < 0 ? 'Refund owed to you' : 'Amount to remit'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Remitted</span>
          <span className={styles.summaryValue}>{formatCurrency(totalRemitted)}</span>
          <span className={styles.summarySub}>Recorded payments</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Outstanding Balance</span>
          <span className={styles.summaryValue} style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(Math.abs(balance))}</span>
          <span className={styles.summarySub}>{balance > 0 ? 'Still owed to CRA' : balance < 0 ? 'Overpaid / refund' : 'Fully remitted'}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <h2 className={styles.tableTitle}>Remittance History — {state.activeFiscalYear}</h2>
        <Button size="sm" onClick={openCreate}>+ Record Remittance</Button>
      </div>

      {/* Table */}
      {remittances.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="No remittances recorded"
          description="Record your HST remittance payments to CRA to track your balance."
          action={<Button onClick={openCreate}>+ Record Remittance</Button>}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Period</th>
                <th className={styles.right}>Collected</th>
                <th className={styles.right}>ITC</th>
                <th className={styles.right}>Net Remittance</th>
                <th>Remitted Date</th>
                <th>Confirmation #</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...remittances].sort((a, b) => (a.remittedDate > b.remittedDate ? -1 : 1)).map(r => (
                <tr key={r.id} className={styles.row}>
                  <td>{r.period || '—'}</td>
                  <td className={styles.right}>{formatCurrency(parseFloat(r.amtCollected) || 0)}</td>
                  <td className={styles.right} style={{ color: 'var(--success)' }}>{formatCurrency(parseFloat(r.itc) || 0)}</td>
                  <td className={styles.right}><strong>{formatCurrency(parseFloat(r.netRemittance) || 0)}</strong></td>
                  <td>{r.remittedDate ? formatDate(r.remittedDate) : '—'}</td>
                  <td className={styles.confNo}>{r.confirmationNo || '—'}</td>
                  <td className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => openEdit(r)}>Edit</button>
                    <button className={styles.delBtn} onClick={() => handleDelete(r.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.disclaimer}>
        💡 HST collected and ITC figures are calculated from your invoices and expenses. Record each remittance payment after you file with CRA to track your outstanding balance.
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Remittance' : 'Record HST Remittance'} size="md">
        <div className={styles.modalGrid}>
          <FormField label="Reporting Period" hint="e.g. Q1 2025, Jan–Mar 2025">
            <Input type="text" placeholder="FY2024-25 Q1" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
          </FormField>
          <FormField label="Remittance Date">
            <Input type="date" value={form.remittedDate} onChange={e => setForm(f => ({ ...f, remittedDate: e.target.value }))} />
          </FormField>
          <FormField label="HST Collected" hint="Line 103">
            <Input type="number" prefix="$" step="0.01" value={form.amtCollected} onChange={e => setForm(f => ({ ...f, amtCollected: e.target.value }))} />
          </FormField>
          <FormField label="Input Tax Credits" hint="Line 106">
            <Input type="number" prefix="$" step="0.01" value={form.itc} onChange={e => setForm(f => ({ ...f, itc: e.target.value }))} />
          </FormField>
          <FormField label="Net Remittance" hint="Line 109 — amount actually paid">
            <Input type="number" prefix="$" step="0.01" value={form.netRemittance} onChange={e => setForm(f => ({ ...f, netRemittance: e.target.value }))} />
          </FormField>
          <FormField label="CRA Confirmation #">
            <Input type="text" placeholder="e.g. 123456789" value={form.confirmationNo} onChange={e => setForm(f => ({ ...f, confirmationNo: e.target.value }))} />
          </FormField>
          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Notes">
              <Textarea rows={2} placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </div>
        </div>
        {autoFill && (
          <p className={styles.autoFillNote}>📋 Amounts pre-filled from your books. Adjust if your actual filing differed.</p>
        )}
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
