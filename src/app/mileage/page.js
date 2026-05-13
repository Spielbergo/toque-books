'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDate, today } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';
import { useSubscription } from '@/contexts/SubscriptionContext';
import Link from 'next/link';

// CRA 2025 automobile allowance rate: first 5,000 km = $0.72/km, balance = $0.66/km
const CRA_RATE_1 = 0.72;
const CRA_RATE_2 = 0.66;
const CRA_THRESHOLD = 5000;

function craAllowance(km) {
  if (km <= CRA_THRESHOLD) return km * CRA_RATE_1;
  return CRA_THRESHOLD * CRA_RATE_1 + (km - CRA_THRESHOLD) * CRA_RATE_2;
}

const BLANK = { date: '', startOdo: '', endOdo: '', km: '', purpose: '', client: '', notes: '' };

export default function MileagePage() {
  const { state, dispatch, activeFY } = useApp();
  const { toast } = useToast();
  const { isPro, loading: subLoading } = useSubscription();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (state.activeFiscalYear === 'all') {
    return <div className={styles.empty}><p>Select a fiscal year to view mileage logs.</p></div>;
  }

  const logs = (activeFY?.mileageLogs || []).slice().sort((a, b) => (a.date > b.date ? -1 : 1));
  const clients = state.clients || [];

  const totalKm = logs.reduce((s, l) => s + (parseFloat(l.km) || 0), 0);
  const totalAllowance = craAllowance(totalKm);

  const filtered = search
    ? logs.filter(l => l.purpose?.toLowerCase().includes(search.toLowerCase()) || l.client?.toLowerCase().includes(search.toLowerCase()))
    : logs;

  // Auto-calculate km from odometer readings
  const handleOdoChange = (field, val) => {
    const updated = { ...form, [field]: val };
    const start = parseFloat(updated.startOdo);
    const end = parseFloat(updated.endOdo);
    if (!isNaN(start) && !isNaN(end) && end > start) {
      updated.km = (end - start).toFixed(1);
    }
    setForm(updated);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...BLANK, date: today() });
    setShowModal(true);
  };

  const openEdit = log => {
    setEditId(log.id);
    setForm({ date: log.date || '', startOdo: log.startOdo || '', endOdo: log.endOdo || '', km: log.km || '', purpose: log.purpose || '', client: log.client || '', notes: log.notes || '' });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.date || !form.km) { toast({ message: 'Date and km are required', type: 'error' }); return; }
    const payload = { ...form, km: parseFloat(form.km) || 0, startOdo: parseFloat(form.startOdo) || undefined, endOdo: parseFloat(form.endOdo) || undefined };
    dispatch({ type: editId ? 'UPDATE_MILEAGE' : 'ADD_MILEAGE', payload: editId ? { id: editId, ...payload } : payload });
    toast({ message: editId ? 'Trip updated' : 'Trip logged' });
    setShowModal(false);
  };

  const handleDelete = id => {
    dispatch({ type: 'DELETE_MILEAGE', payload: id });
    toast({ message: 'Trip deleted', type: 'info' });
    setConfirmDelete(null);
  };

  // Push total mileage allowance as an expense entry
  const handleAddAsExpense = () => {
    if (totalKm === 0) { toast({ message: 'No mileage to add', type: 'error' }); return; }
    dispatch({
      type: 'ADD_EXPENSE',
      payload: {
        date: activeFY?.endDate || today(),
        vendor: 'Mileage / Vehicle',
        category: 'auto',
        description: `CRA mileage allowance — ${totalKm.toFixed(0)} km × $${CRA_RATE_1}/$${CRA_RATE_2}/km`,
        amount: parseFloat(totalAllowance.toFixed(2)),
        hst: 0,
        hstRate: 'exempt',
        businessUsePercent: 100,
        notes: `Mileage log auto-calculated: ${totalKm.toFixed(0)} km`,
      },
    });
    toast({ message: 'Mileage expense added to expenses', type: 'success' });
  };

  return (
    <div className={styles.page}>
      {!subLoading && !isPro ? (
        <div className={styles.proGate}>
          <div className={styles.proGateInner}>
            <span className={styles.proGateIcon}>&#128663;</span>
            <h2 className={styles.proGateTitle}>Mileage Log is a Pro feature</h2>
            <p className={styles.proGateDesc}>
              Track CRA-compliant vehicle trips and calculate your automobile allowance.
              Upgrade to Pro to unlock the mileage log.
            </p>
            <Link href="/settings?tab=billing" className={styles.proGateBtn}>Upgrade to Pro — $7/mo</Link>
          </div>
        </div>
      ) : (
        <>
      {/* Summary */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Trips</span>
          <span className={styles.summaryValue}>{logs.length}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total KM</span>
          <span className={styles.summaryValue}>{totalKm.toFixed(0)} km</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>CRA Allowance</span>
          <span className={styles.summaryValue}>${totalAllowance.toFixed(2)}</span>
          <span className={styles.summarySub}>@ $0.72/km first 5,000 km</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search purpose or client…"
          aria-label="Search mileage entries"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.toolbarActions}>
          {totalKm > 0 && (
            <Button variant="secondary" size="sm" onClick={handleAddAsExpense} title="Add total CRA mileage allowance as an expense entry">
              ➕ Add as Expense
            </Button>
          )}
          <Button size="sm" onClick={openCreate}>+ Log Trip</Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="No mileage logged"
          description="Log business trips to calculate your CRA mileage allowance."
          action={<Button onClick={openCreate}>+ Log Trip</Button>}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Purpose</th>
                <th>Client</th>
                <th className={styles.right}>Start Odo</th>
                <th className={styles.right}>End Odo</th>
                <th className={styles.right}>KM</th>
                <th className={styles.right}>Allowance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => {
                const km = parseFloat(log.km) || 0;
                return (
                  <tr key={log.id} className={styles.row}>
                    <td>{formatDate(log.date)}</td>
                    <td>{log.purpose || '—'}</td>
                    <td>{log.client || '—'}</td>
                    <td className={styles.right}>{log.startOdo ? log.startOdo.toLocaleString() : '—'}</td>
                    <td className={styles.right}>{log.endOdo ? log.endOdo.toLocaleString() : '—'}</td>
                    <td className={styles.right}><strong>{km.toFixed(1)} km</strong></td>
                    <td className={styles.right}>${craAllowance(km).toFixed(2)}</td>
                    <td className={styles.actions}>
                      <button className={styles.editBtn} onClick={() => openEdit(log)}>Edit</button>
                      <button className={styles.delBtn} onClick={() => setConfirmDelete(log.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={styles.footerRow}>
                <td colSpan={5}><strong>Total</strong></td>
                <td className={styles.right}><strong>{totalKm.toFixed(1)} km</strong></td>
                <td className={styles.right}><strong>${totalAllowance.toFixed(2)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className={styles.disclaimer}>
        💡 CRA 2025 rates: $0.72/km for the first 5,000 km, $0.66/km thereafter. Click "Add as Expense" to push the total allowance to your expenses for the fiscal year.
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Trip' : 'Log Trip'} size="md">
        <div className={styles.modalGrid}>
          <FormField label="Date">
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </FormField>
          <FormField label="KM Driven" hint="Or fill odometer readings below">
            <Input type="number" step="0.1" value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} placeholder="e.g. 42.5" />
          </FormField>
          <FormField label="Start Odometer">
            <Input type="number" value={form.startOdo} onChange={e => handleOdoChange('startOdo', e.target.value)} placeholder="km" />
          </FormField>
          <FormField label="End Odometer">
            <Input type="number" value={form.endOdo} onChange={e => handleOdoChange('endOdo', e.target.value)} placeholder="km" />
          </FormField>
          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Purpose">
              <Input type="text" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. Client meeting, supply run" />
            </FormField>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Client (optional)">
              <Input type="text" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="Client name" list="mileage-clients" />
              <datalist id="mileage-clients">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </FormField>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Notes">
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </div>
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Trip?" size="sm">
        <p>This trip will be permanently removed.</p>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Delete</Button>
        </div>
      </Modal>
        </>
      )}
    </div>
  );
}
