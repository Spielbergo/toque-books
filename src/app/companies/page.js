'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import CanBooksLogo from '@/components/CanBooksLogo';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import styles from './page.module.css';

export default function CompaniesPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { companies, activeCompanyId, createCompany, selectCompany, updateCompanyName, deleteCompany, appLoading, activeCompany } = useApp();
  const { toast } = useToast();

  const [showCreate, setShowCreate]   = useState(false);
  const [newName, setNewName]         = useState('');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editName, setEditName]       = useState('');
  const [saving, setSaving]           = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting]           = useState(false);

  const handleCreate = async e => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await createCompany(newName.trim());
      setShowCreate(false);
      setNewName('');
      router.push('/');
    } catch (err) {
      setCreateError(err.message || 'Failed to create company.');
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = async id => {
    if (id === activeCompanyId) { router.push('/'); return; }
    await selectCompany(id);
    router.push('/');
  };

  const handleRename = async e => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateCompanyName(editingId, editName.trim());
      setEditingId(null);
    } catch (err) {
      toast({ message: err.message || 'Failed to rename.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCompany(confirmDelete);
      setConfirmDelete(null);
      if (companies.length <= 1) {
        // Will have no companies — stay on this page for onboarding
      }
    } catch (err) {
      toast({ message: err.message || 'Failed to delete.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const userInitials = (user?.displayName || user?.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const formatTs = ts => {
    if (!ts) return null;
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.brand}>
          {activeCompany?.badgeLogo
            ? <img src={activeCompany.badgeLogo} alt="logo" className={styles.brandBadge} />
            : <CanBooksLogo size={28} />}
          <span className={styles.brandName}>CanBooks</span>
        </div>
        <div className={styles.userRow}>
          <div className={styles.userAvatar} title={user?.email}>{userInitials}</div>
          <span className={styles.userEmail}>{user?.email}</span>
          <Button variant="ghost" size="xs" onClick={signOut}>Sign out</Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Your Companies</h1>
            <p className={styles.subtitle}>
              {companies.length === 0
                ? 'Create your first company to get started.'
                : 'Select a company to work in, or create a new one.'}
            </p>
          </div>
          <Button onClick={() => { setNewName(''); setCreateError(''); setShowCreate(true); }}>
            + New Company
          </Button>
        </div>

        {appLoading ? (
          <div className={styles.loading}>Loading…</div>
        ) : companies.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🏢</div>
            <h2 className={styles.emptyTitle}>No companies yet</h2>
            <p className={styles.emptyDesc}>
              Get started by creating your first company. If you've used CanBooks before,
              your existing data will be migrated automatically.
            </p>
            <Button onClick={() => { setNewName(''); setCreateError(''); setShowCreate(true); }}>
              Create Company
            </Button>
          </div>
        ) : (
          <div className={styles.grid}>
            {companies.map(company => {
              const isActive = company.id === activeCompanyId;
              const isEditing = editingId === company.id;
              return (
                <div key={company.id} className={`${styles.card} ${isActive ? styles.cardActive : ''}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIconWrap}>
                      {company.badgeLogo
                        ? <img src={company.badgeLogo} alt="logo" className={styles.cardBadgeImg} />
                        : <span className={styles.cardIcon}>🏢</span>}
                    </div>
                    <div className={styles.cardMeta}>
                      {isEditing ? (
                        <form onSubmit={handleRename} className={styles.renameForm}>
                          <input
                            className={styles.renameInput}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                            required
                          />
                          <div className={styles.renameActions}>
                            <Button type="submit" size="xs" loading={saving}>Save</Button>
                            <Button type="button" variant="ghost" size="xs" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        </form>
                      ) : (
                        <h3 className={styles.cardName}>{company.name}</h3>
                      )}
                      {formatTs(company.createdAt)
                        ? <span className={styles.cardDate}>Created {formatTs(company.createdAt)}</span>
                        : <span className={styles.cardDateNew}>New company</span>}
                    </div>
                    {isActive && <span className={styles.activeBadge}>● Active</span>}
                  </div>

                  <div className={styles.cardActions}>
                    <Button size="sm" variant={isActive ? 'secondary' : 'primary'} onClick={() => handleSelect(company.id)}>
                      {isActive ? '← Dashboard' : 'Open'}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => { setEditingId(company.id); setEditName(company.name); }}>
                      Rename
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(company.id)} title="Delete company">
                      🗑
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Add new card */}
            <button className={styles.addCard} onClick={() => { setNewName(''); setCreateError(''); setShowCreate(true); }}>
              <span className={styles.addIcon}>+</span>
              <span>New Company</span>
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Company" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" form="create-company-form" loading={creating}>Create</Button>
          </>
        }
      >
        <form id="create-company-form" onSubmit={handleCreate}>
          {createError && <p className={styles.formError}>{createError}</p>}
          <div className={styles.formField}>
            <label className={styles.formLabel}>Company Name</label>
            <input
              className={styles.formInput}
              placeholder="Acme Web Dev Inc."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
              autoFocus
            />
            {companies.length === 0 && (
              <p className={styles.formHint}>
                Any existing data from this browser will be imported automatically.
              </p>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Company?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          This will permanently delete the company and all its data (invoices, expenses, clients, etc.).
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
