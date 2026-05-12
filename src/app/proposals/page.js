'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDate, formatCurrency, today, addDays } from '@/lib/formatters';
import { HST_RATES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function nextProposalNumber(proposals) {
  const nums = proposals.map(p => parseInt(p.number, 10)).filter(n => !isNaN(n));
  return String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(4, '0');
}

function makeLineItem() {
  return { id: uuidv4(), description: '', quantity: 1, rate: 0, amount: 0 };
}

function makeBlankProposal(proposals, hstRate) {
  return {
    number:    nextProposalNumber(proposals),
    clientId:  '',
    title:     '',
    description: '',
    lineItems: [makeLineItem()],
    subtotal:  0,
    hstRate:   hstRate,
    hstAmount: 0,
    total:     0,
    status:    'draft',
    validUntil: addDays(today(), 30),
    notes:     '',
    publicToken: uuidv4(),
  };
}

function calcTotals(lineItems, hstRate) {
  const subtotal  = lineItems.reduce((s, li) => s + (li.amount || 0), 0);
  const hstAmount = Math.round(subtotal * hstRate * 100) / 100;
  const total     = subtotal + hstAmount;
  return { subtotal, hstAmount, total };
}

const STATUS_OPTIONS = [
  { value: 'draft',    label: 'Draft' },
  { value: 'sent',     label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired',  label: 'Expired' },
];

const STATUS_BADGE = {
  draft:    'muted',
  sent:     'info',
  accepted: 'success',
  declined: 'danger',
  expired:  'warning',
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();

  const clients   = state.clients   || [];
  const proposals = state.proposals || [];
  const hstRate   = HST_RATES[state.settings?.province] ?? 0.13;

  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');

  // ── Proposal modal ────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editProposal, setEditProposal] = useState(null);
  const [form, setForm] = useState(() => makeBlankProposal(proposals, hstRate));
  const [confirmDel, setConfirmDel] = useState(null);

  const set = useCallback(k => v => setForm(f => ({ ...f, [k]: v })), []);

  const openCreate = () => {
    setEditProposal(null);
    setForm(makeBlankProposal(proposals, hstRate));
    setShowModal(true);
  };
  const openEdit = p => {
    setEditProposal(p);
    setForm({ ...p });
    setShowModal(true);
  };

  // ── Line item helpers ─────────────────────────────────────────────────────
  const updateLineItem = (id, field, value) => {
    setForm(f => {
      const lineItems = f.lineItems.map(li => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        updated.amount = Math.round((parseFloat(updated.quantity) || 0) * (parseFloat(updated.rate) || 0) * 100) / 100;
        return updated;
      });
      return { ...f, lineItems, ...calcTotals(lineItems, f.hstRate) };
    });
  };

  const addLineItem    = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, makeLineItem()] }));
  const removeLineItem = id => setForm(f => {
    const lineItems = f.lineItems.filter(li => li.id !== id);
    return { ...f, lineItems, ...calcTotals(lineItems, f.hstRate) };
  });

  const handleSave = e => {
    e.preventDefault();
    const payload = { ...form, ...calcTotals(form.lineItems, form.hstRate) };
    if (editProposal) {
      dispatch({ type: 'UPDATE_PROPOSAL', payload: { ...payload, id: editProposal.id } });
      toast({ message: `Proposal #${form.number} updated` });
    } else {
      dispatch({ type: 'ADD_PROPOSAL', payload });
      toast({ message: `Proposal #${form.number} created` });
    }
    setShowModal(false);
  };

  const handleDelete = id => {
    const p = proposals.find(x => x.id === id);
    dispatch({ type: 'DELETE_PROPOSAL', payload: id });
    setConfirmDel(null);
    toast({ message: `Proposal #${p?.number} deleted`, type: 'info' });
  };

  // ── Convert to Invoice ────────────────────────────────────────────────────
  const convertToInvoice = proposal => {
    const client = clients.find(c => c.id === proposal.clientId);
    dispatch({
      type: 'ADD_INVOICE',
      payload: {
        client: client ? {
          name: client.name, email: client.email || '', address: client.address || '',
          city: client.city || '', province: client.province || '', postalCode: client.postalCode || '',
          phone: client.phone || '', hstNumber: client.hstNumber || '',
        } : { name: '', email: '', address: '', city: '', province: '', postalCode: '', phone: '', hstNumber: '' },
        lineItems: proposal.lineItems,
        notes: proposal.notes || '',
        status: 'draft',
      },
    });
    dispatch({ type: 'UPDATE_PROPOSAL', payload: { ...proposal, status: 'accepted' } });
    toast({ message: `Invoice created from Proposal #${proposal.number}` });
  };

  // ── Copy public link ──────────────────────────────────────────────────────
  const copyLink = proposal => {
    const url = `${window.location.origin}/proposals/${proposal.publicToken}/accept`;
    navigator.clipboard.writeText(url).then(() => toast({ message: 'Acceptance link copied' }));
  };

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = proposals
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.number?.includes(search))
    .slice()
    .sort((a, b) => b.number?.localeCompare(a.number));

  const clientOptions = [{ value: '', label: 'No client' }, ...clients.map(c => ({ value: c.id, label: c.name }))];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Proposals</h1>
          <p className={styles.sub}>Create and send proposals that clients can accept online.</p>
        </div>
        <Button onClick={openCreate}>+ New Proposal</Button>
      </div>

      {/* ── Filters ── */}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search proposals…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filterTabs}>
          {['all', 'draft', 'sent', 'accepted', 'declined'].map(s => (
            <button
              key={s}
              className={`${styles.filterTab} ${statusFilter === s ? styles.filterTabActive : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary stats ── */}
      {proposals.length > 0 && (
        <div className={styles.stats}>
          {['draft', 'sent', 'accepted', 'declined'].map(s => {
            const count = proposals.filter(p => p.status === s).length;
            const value = proposals.filter(p => p.status === s).reduce((acc, p) => acc + (p.total || 0), 0);
            return (
              <div key={s} className={styles.stat}>
                <span className={styles.statLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                <span className={styles.statValue}>{count}</span>
                <span className={styles.statSub}>{formatCurrency(value)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No proposals found' : 'No proposals yet'}
          description={search ? 'Try adjusting your search.' : 'Create your first proposal — clients can accept it online with a link.'}
          action={!search ? { label: '+ New Proposal', onClick: openCreate } : undefined}
        />
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>#</span>
            <span>Title</span>
            <span>Client</span>
            <span>Total</span>
            <span>Valid Until</span>
            <span>Status</span>
            <span></span>
          </div>
          {filtered.map(p => {
            const client = clients.find(c => c.id === p.clientId);
            return (
              <div key={p.id} className={styles.tableRow}>
                <span className={styles.cellNum}>#{p.number}</span>
                <span className={styles.cellTitle}>{p.title || <em className={styles.muted}>Untitled</em>}</span>
                <span className={styles.cellClient}>{client?.name || <span className={styles.muted}>—</span>}</span>
                <span className={styles.cellTotal}>{formatCurrency(p.total)}</span>
                <span className={styles.cellDate}>{p.validUntil ? formatDate(p.validUntil) : <span className={styles.muted}>—</span>}</span>
                <span className={styles.cellStatus}><Badge variant={STATUS_BADGE[p.status] || 'muted'}>{p.status}</Badge></span>
                <span className={styles.cellActions}>
                  <button className={styles.actionBtn} onClick={() => copyLink(p)} title="Copy acceptance link">🔗</button>
                  {p.status === 'accepted' && <button className={styles.actionBtn} onClick={() => convertToInvoice(p)} title="Convert to invoice">📄</button>}
                  <button className={styles.actionBtn} onClick={() => openEdit(p)} title="Edit">✏️</button>
                  <button className={styles.actionBtn} onClick={() => setConfirmDel(p.id)} title="Delete">🗑</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editProposal ? `Edit Proposal #${form.number}` : 'New Proposal'} size="lg">
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Proposal #">
              <Input value={form.number} onChange={set('number')} required />
            </FormField>
            <FormField label="Client">
              <Select value={form.clientId} onChange={set('clientId')} options={clientOptions} />
            </FormField>
          </div>
          <FormField label="Title">
            <Input value={form.title} onChange={set('title')} placeholder="e.g. Website Redesign Proposal" required />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Status">
              <Select value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
            </FormField>
            <FormField label="Valid Until">
              <Input type="date" value={form.validUntil} onChange={set('validUntil')} />
            </FormField>
          </div>
          <FormField label="Description / Intro">
            <Textarea value={form.description} onChange={set('description')} placeholder="Brief intro or scope summary shown to client…" rows={3} />
          </FormField>

          {/* Line items */}
          <div className={styles.lineItemsSection}>
            <div className={styles.lineItemsHeader}>
              <span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span></span>
            </div>
            {form.lineItems.map(li => (
              <div key={li.id} className={styles.lineItemRow}>
                <input
                  className={styles.liInput}
                  placeholder="Item description"
                  value={li.description}
                  onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                />
                <input
                  className={`${styles.liInput} ${styles.liNum}`}
                  type="number" min="0" step="0.01"
                  value={li.quantity}
                  onChange={e => updateLineItem(li.id, 'quantity', e.target.value)}
                />
                <input
                  className={`${styles.liInput} ${styles.liNum}`}
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={li.rate || ''}
                  onChange={e => updateLineItem(li.id, 'rate', e.target.value)}
                />
                <span className={styles.liAmount}>{formatCurrency(li.amount)}</span>
                <button type="button" className={styles.liRemove} onClick={() => removeLineItem(li.id)} disabled={form.lineItems.length === 1}>✕</button>
              </div>
            ))}
            <button type="button" className={styles.addLineBtn} onClick={addLineItem}>+ Add line</button>

            <div className={styles.totals}>
              <div className={styles.totalRow}><span>Subtotal</span><span>{formatCurrency(form.subtotal)}</span></div>
              <div className={styles.totalRow}><span>HST ({Math.round(form.hstRate * 100)}%)</span><span>{formatCurrency(form.hstAmount)}</span></div>
              <div className={`${styles.totalRow} ${styles.totalRowFinal}`}><span>Total</span><span>{formatCurrency(form.total)}</span></div>
            </div>
          </div>

          <FormField label="Notes / Terms">
            <Textarea value={form.notes} onChange={set('notes')} placeholder="Payment terms, conditions, or notes…" rows={3} />
          </FormField>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit">{editProposal ? 'Save Changes' : 'Create Proposal'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete Proposal?" size="sm">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>This proposal will be permanently deleted.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDel)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
