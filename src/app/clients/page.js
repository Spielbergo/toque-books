'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDate } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

function makeBlankClient() {
  return {
    name: '', email: '', phone: '',
    address: '', city: '', province: 'ON', postalCode: '',
    hstNumber: '', website: '', notes: '',
  };
}

export default function ClientsPage() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();
  const clients = state.clients || [];

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [form, setForm] = useState(makeBlankClient());
  const [confirmDelete, setConfirmDelete] = useState(null);

  const openCreate = () => {
    setEditClient(null);
    setForm(makeBlankClient());
    setShowModal(true);
  };

  const openEdit = c => {
    setEditClient(c);
    setForm({ ...c });
    setShowModal(true);
  };

  const handleSave = e => {
    e.preventDefault();
    if (editClient) {
      dispatch({ type: 'UPDATE_CLIENT', payload: { ...form, id: editClient.id } });
      toast({ message: `${form.name} updated` });
    } else {
      dispatch({ type: 'ADD_CLIENT', payload: form });
      toast({ message: `${form.name} added as a client` });
    }
    setShowModal(false);
  };

  const handleDelete = id => {
    const client = clients.find(c => c.id === id);
    dispatch({ type: 'DELETE_CLIENT', payload: id });
    setConfirmDelete(null);
    toast({ message: `${client?.name || 'Client'} removed`, type: 'info' });
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div className={styles.page}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button size="sm" onClick={openCreate}>+ New Client</Button>
      </div>

      {/* Stats */}
      {clients.length > 0 && (
        <div className={styles.statsBar}>
          <span>{clients.length} client{clients.length !== 1 ? 's' : ''} saved</span>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No clients yet"
          description={clients.length === 0
            ? "Add your first client to quickly select them when creating invoices."
            : "No clients match your search."}
          action={clients.length === 0 ? <Button size="sm" onClick={openCreate}>+ New Client</Button> : null}
        />
      ) : (
        <div className={styles.clientGrid}>
          {filtered.map(c => (
            <div key={c.id} className={styles.clientCard}>
              <div className={styles.clientTop}>
                <div className={styles.clientAvatar}>
                  {(c.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className={styles.clientInfo}>
                  <h3 className={styles.clientName}>{c.name}</h3>
                  {c.email && <span className={styles.clientEmail}>{c.email}</span>}
                </div>
              </div>
              <div className={styles.clientDetails}>
                {c.phone && (
                  <div className={styles.clientDetail}>
                    <span className={styles.detailIcon}>📞</span> {c.phone}
                  </div>
                )}
                {(c.city || c.address) && (
                  <div className={styles.clientDetail}>
                    <span className={styles.detailIcon}>📍</span>
                    {[c.address, c.city, c.province].filter(Boolean).join(', ')}
                  </div>
                )}
                {c.hstNumber && (
                  <div className={styles.clientDetail}>
                    <span className={styles.detailIcon}>🏢</span> HST: {c.hstNumber}
                  </div>
                )}
                {c.website && (
                  <div className={styles.clientDetail}>
                    <span className={styles.detailIcon}>🌐</span> {c.website}
                  </div>
                )}
                {c.notes && (
                  <div className={`${styles.clientDetail} ${styles.clientNotes}`}>
                    {c.notes}
                  </div>
                )}
              </div>
              <div className={styles.clientActions}>
                <Button variant="secondary" size="xs" onClick={() => openEdit(c)}>Edit</Button>
                <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(c.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Client Form Modal ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editClient ? `Edit — ${editClient.name}` : 'New Client'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" form="client-form">
              {editClient ? 'Save Changes' : 'Add Client'}
            </Button>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSave}>
          <div className={styles.formGrid}>
            <FormField label="Company / Client Name" className={styles.colSpan2} required>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Acme Corp"
                required
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="billing@client.com"
              />
            </FormField>
            <FormField label="Phone">
              <Input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="416-555-0100"
              />
            </FormField>
            <FormField label="Street Address" className={styles.colSpan2}>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="123 Main Street, Suite 400"
              />
            </FormField>
            <FormField label="City">
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Toronto"
              />
            </FormField>
            <FormField label="Province / Postal">
              <div className={styles.inlineFields}>
                <Input
                  value={form.province}
                  onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                  placeholder="ON"
                  style={{ width: '60px' }}
                  maxLength={2}
                />
                <Input
                  value={form.postalCode}
                  onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
                  placeholder="M5V 0A1"
                />
              </div>
            </FormField>
            <FormField label="HST Registration Number" hint="Client's HST number for B2B invoices">
              <Input
                value={form.hstNumber}
                onChange={e => setForm(f => ({ ...f, hstNumber: e.target.value }))}
                placeholder="123456789 RT0001"
              />
            </FormField>
            <FormField label="Website">
              <Input
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://client.com"
              />
            </FormField>
            <FormField label="Internal Notes" className={styles.colSpan2}>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Payment terms, preferences, etc."
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Client?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Delete</Button>
          </>
        }
      >
        <p>This client record will be removed. Existing invoices that reference this client are not affected.</p>
      </Modal>
    </div>
  );
}
