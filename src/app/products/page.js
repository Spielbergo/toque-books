'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const CATEGORIES = [
  { value: 'service',   label: 'Service' },
  { value: 'digital',   label: 'Digital Product' },
  { value: 'physical',  label: 'Physical Product' },
  { value: 'labour',    label: 'Labour / Hourly' },
  { value: 'retainer',  label: 'Retainer' },
  { value: 'other',     label: 'Other' },
];

const UNITS = [
  { value: 'each',  label: 'Each' },
  { value: 'hour',  label: 'Hour' },
  { value: 'day',   label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'flat',  label: 'Flat rate' },
];

function makeBlank() {
  return { name: '', description: '', category: 'service', defaultRate: '', unit: 'each', notes: '' };
}

export default function ProductsPage() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();
  const products = state.products || [];

  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null); // null = add new
  const [form, setForm]           = useState(makeBlank());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = products.filter(p => {
    const matchCat = catFilter === 'all' || p.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const openAdd = () => {
    setEditing(null);
    setForm(makeBlank());
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name:        product.name || '',
      description: product.description || '',
      category:    product.category || 'service',
      defaultRate: product.defaultRate !== undefined ? product.defaultRate : '',
      unit:        product.unit || 'each',
      notes:       product.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast('Product name is required', 'error'); return; }
    const payload = {
      ...form,
      defaultRate: form.defaultRate !== '' ? parseFloat(form.defaultRate) || 0 : null,
    };
    if (editing) {
      dispatch({ type: 'UPDATE_PRODUCT', payload: { ...payload, id: editing.id } });
      toast('Product updated');
    } else {
      dispatch({ type: 'ADD_PRODUCT', payload });
      toast('Product added');
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_PRODUCT', payload: deleteTarget.id });
    toast('Product deleted');
    setDeleteTarget(null);
  };

  const catLabel = val => CATEGORIES.find(c => c.value === val)?.label || val;
  const catColor = val => ({ service: 'info', digital: 'accent', physical: 'muted', labour: 'warning', retainer: 'success', other: 'muted' }[val] || 'muted');

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.filterRow}>
          <input
            className={styles.search}
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div className={styles.toolbarActions}>
            <Button onClick={openAdd}>+ Add Product</Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📦"
          title={search || catFilter !== 'all' ? 'No results' : 'No products yet'}
          description={search || catFilter !== 'all' ? 'Try a different search or filter.' : 'Add your products and services to quickly populate invoice line items.'}
          action={!search && catFilter === 'all' && <Button onClick={openAdd}>+ Add Product</Button>}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Unit</th>
                <th className={styles.right}>Default Rate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={styles.tableRow}>
                  <td className={styles.prodName}>{p.name}</td>
                  <td className={styles.prodDesc}>{p.description || <span className={styles.none}>—</span>}</td>
                  <td><Badge color={catColor(p.category)}>{catLabel(p.category)}</Badge></td>
                  <td className={styles.prodUnit}>{UNITS.find(u => u.value === p.unit)?.label || p.unit}</td>
                  <td className={styles.right}>
                    {p.defaultRate != null ? formatCurrency(p.defaultRate) : <span className={styles.none}>—</span>}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button variant="ghost" size="xs" onClick={() => openEdit(p)}>Edit</Button>
                      <Button variant="ghost" size="xs" onClick={() => setDeleteTarget(p)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className={styles.mobileList}>
          {filtered.map(p => (
            <div key={p.id} className={styles.mobileCard}>
              <div className={styles.mobileTop}>
                <span className={styles.mobileName}>{p.name}</span>
                <Badge color={catColor(p.category)}>{catLabel(p.category)}</Badge>
              </div>
              {p.description && <p className={styles.mobileDesc}>{p.description}</p>}
              <div className={styles.mobileMeta}>
                <span>{UNITS.find(u => u.value === p.unit)?.label || p.unit}</span>
                {p.defaultRate != null && <span className={styles.mobileRate}>{formatCurrency(p.defaultRate)}</span>}
              </div>
              <div className={styles.mobileActions}>
                <Button variant="secondary" size="xs" onClick={() => openEdit(p)}>Edit</Button>
                <Button variant="ghost" size="xs" onClick={() => setDeleteTarget(p)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product / Service' : 'Add Product / Service'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Product'}</Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <FormField label="Name *" className={styles.colSpan2}>
            <Input
              placeholder="e.g. Web Design, Logo Package, Hour of Consulting"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </FormField>

          <FormField label="Category">
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </FormField>

          <FormField label="Unit">
            <Select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </Select>
          </FormField>

          <FormField label="Default Rate" hint="Pre-fills the rate when selected on an invoice">
            <Input
              type="number"
              min="0"
              step="0.01"
              prefix="$"
              placeholder="0.00"
              value={form.defaultRate}
              onChange={e => setForm(f => ({ ...f, defaultRate: e.target.value }))}
            />
          </FormField>

          <FormField label="Short Description" className={styles.colSpan2} hint="Shown on the invoice line item">
            <Input
              placeholder="Brief description shown on invoices"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </FormField>

          <FormField label="Internal Notes" className={styles.colSpan2}>
            <Textarea
              rows={2}
              placeholder="Private notes (not shown on invoices)"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Delete <strong>{deleteTarget?.name}</strong>? This won't affect existing invoices.
        </p>
      </Modal>
    </div>
  );
}
