'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, today } from '@/lib/formatters';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const TABS = ['Personal', 'Business'];

const PERSONAL_CATEGORIES = [
  { value: 'streaming',  label: 'Streaming' },
  { value: 'music',      label: 'Music' },
  { value: 'software',   label: 'Software' },
  { value: 'gaming',     label: 'Gaming' },
  { value: 'news_media', label: 'News & Media' },
  { value: 'fitness',    label: 'Fitness & Health' },
  { value: 'shopping',   label: 'Shopping' },
  { value: 'finance',    label: 'Finance' },
  { value: 'education',  label: 'Education' },
  { value: 'cloud',      label: 'Cloud Storage' },
  { value: 'utilities',  label: 'Utilities' },
  { value: 'vpn',        label: 'VPN & Security' },
  { value: 'other',      label: 'Other' },
];

const CURRENCIES = [
  { value: 'CAD', label: 'CAD' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];

const FREQUENCIES = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual',    label: 'Annual' },
];

function toMonthly(amount, frequency) {
  const amt = parseFloat(amount) || 0;
  if (frequency === 'weekly')    return (amt * 52) / 12;
  if (frequency === 'quarterly') return amt / 3;
  if (frequency === 'annual')    return amt / 12;
  return amt;
}

function freqLabel(frequency) {
  return FREQUENCIES.find(f => f.value === frequency)?.label ?? frequency;
}

function personalCatLabel(value) {
  return PERSONAL_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

function bizCatLabel(value) {
  return EXPENSE_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

function isRecurActive(rec) {
  const now = today();
  if (!rec.startDate || rec.startDate > now) return false;
  if (rec.endDate && rec.endDate < now) return false;
  return true;
}

function recurMonthly(rec) {
  const amt = parseFloat(rec.amount) || 0;
  if (rec.frequency === 'quarterly') return amt / 3;
  if (rec.frequency === 'annual')    return amt / 12;
  return amt;
}

// Renewal notice thresholds (days)
const RENEWAL_NOTICE_DAYS = { weekly: 2, monthly: 7, quarterly: 30, annual: 30 };

// Next renewal date for a personal sub
function nextPersonalRenewal(sub) {
  if (sub.renewalDate) return new Date(sub.renewalDate + 'T00:00:00');
  if (sub.frequency === 'monthly' && sub.billingDay) {
    const day = parseInt(sub.billingDay);
    if (day >= 1 && day <= 31) {
      const now = new Date();
      let d = new Date(now.getFullYear(), now.getMonth(), day);
      if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
      return d;
    }
  }
  return null;
}

// Next renewal date for a business recurring expense
function nextRecurRenewal(startDate, frequency) {
  if (!startDate) return null;
  const now = new Date();
  const d = new Date(startDate + 'T00:00:00');
  if (isNaN(d)) return null;
  if (frequency === 'weekly') {
    const diffMs = now - d;
    if (diffMs < 0) return d;
    const weeksElapsed = Math.floor(diffMs / (7 * 86400000));
    const next = new Date(d);
    next.setDate(next.getDate() + (weeksElapsed + 1) * 7);
    return next;
  }
  const next = new Date(d);
  const advance = () => {
    if (frequency === 'monthly')   next.setMonth(next.getMonth() + 1);
    else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
    else if (frequency === 'annual')    next.setFullYear(next.getFullYear() + 1);
  };
  while (next <= now) advance();
  return next;
}

// Days until a date (0 = today)
function daysUntil(date) {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((date - now) / 86400000);
}

// Returns { nextDate, daysLeft, soon }
function getRenewalInfo(nextDate, frequency) {
  if (!nextDate) return { nextDate: null, daysLeft: null, soon: false };
  const daysLeft = daysUntil(nextDate);
  const threshold = RENEWAL_NOTICE_DAYS[frequency] ?? 7;
  const soon = daysLeft !== null && daysLeft >= 0 && daysLeft <= threshold;
  return { nextDate, daysLeft, soon };
}

function fmtRenewalDate(date) {
  if (!date) return null;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function makeBlank() {
  return {
    name: '',
    url: '',
    amount: '',
    currency: 'CAD',
    frequency: 'monthly',
    billingDay: '',
    renewalDate: '',
    category: 'other',
    notes: '',
    active: true,
  };
}

export default function SubscriptionsPage() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();

  const [tab,           setTab]           = useState('Personal');
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editId,        setEditId]        = useState(null);
  const [form,          setForm]          = useState(makeBlank());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [view,          setView]          = useState('card');
  const [sortKey,       setSortKey]       = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const personalSubs  = state.personalSubs || [];
  const recurringExps = state.recurringExpenses || [];

  const q = search.toLowerCase();

  const basePersonal = personalSubs
    .filter(s => !q || s.name.toLowerCase().includes(q) || (s.notes || '').toLowerCase().includes(q))
    .filter(s => statusFilter === 'all' || (statusFilter === 'active' ? s.active : !s.active));

  const sortedPersonal = [...basePersonal].sort((a, b) => {
    if (view === 'card') {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const aSoon = getRenewalInfo(nextPersonalRenewal(a), a.frequency).soon;
      const bSoon = getRenewalInfo(nextPersonalRenewal(b), b.frequency).soon;
      if (aSoon !== bSoon) return aSoon ? -1 : 1;
      return a.name.localeCompare(b.name);
    }
    let aVal, bVal;
    switch (sortKey) {
      case 'status':    aVal = a.active ? 0 : 1;                      bVal = b.active ? 0 : 1; break;
      case 'name':      aVal = a.name.toLowerCase();                  bVal = b.name.toLowerCase(); break;
      case 'category':  aVal = personalCatLabel(a.category).toLowerCase(); bVal = personalCatLabel(b.category).toLowerCase(); break;
      case 'frequency': aVal = a.frequency;                           bVal = b.frequency; break;
      case 'monthly':   aVal = toMonthly(a.amount, a.frequency);     bVal = toMonthly(b.amount, b.frequency); break;
      case 'renewal': {
        const an = nextPersonalRenewal(a); const bn = nextPersonalRenewal(b);
        aVal = an ? an.getTime() : Infinity; bVal = bn ? bn.getTime() : Infinity; break;
      }
      default: aVal = 0; bVal = 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  const baseBiz = recurringExps
    .filter(r => !q || (r.vendor || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
    .filter(r => statusFilter === 'all' || (statusFilter === 'active' ? isRecurActive(r) : !isRecurActive(r)));

  const sortedBiz = [...baseBiz].sort((a, b) => {
    if (view === 'card') {
      const aActive = isRecurActive(a); const bActive = isRecurActive(b);
      if (aActive !== bActive) return aActive ? -1 : 1;
      const aSoon = getRenewalInfo(nextRecurRenewal(a.startDate, a.frequency), a.frequency).soon;
      const bSoon = getRenewalInfo(nextRecurRenewal(b.startDate, b.frequency), b.frequency).soon;
      if (aSoon !== bSoon) return aSoon ? -1 : 1;
      return (a.vendor || '').localeCompare(b.vendor || '');
    }
    let aVal, bVal;
    switch (sortKey) {
      case 'status':    aVal = isRecurActive(a) ? 0 : 1;             bVal = isRecurActive(b) ? 0 : 1; break;
      case 'name':      aVal = (a.vendor || '').toLowerCase();        bVal = (b.vendor || '').toLowerCase(); break;
      case 'category':  aVal = bizCatLabel(a.category).toLowerCase(); bVal = bizCatLabel(b.category).toLowerCase(); break;
      case 'frequency': aVal = a.frequency;                           bVal = b.frequency; break;
      case 'monthly':   aVal = recurMonthly(a);                      bVal = recurMonthly(b); break;
      case 'renewal': {
        const an = nextRecurRenewal(a.startDate, a.frequency);
        const bn = nextRecurRenewal(b.startDate, b.frequency);
        aVal = an ? an.getTime() : Infinity; bVal = bn ? bn.getTime() : Infinity; break;
      }
      default: aVal = 0; bVal = 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  // Items renewing soon (unfiltered, active only)
  const personalSoonItems = personalSubs.filter(s => {
    if (!s.active) return false;
    return getRenewalInfo(nextPersonalRenewal(s), s.frequency).soon;
  });
  const bizSoonItems = recurringExps.filter(r => {
    if (!isRecurActive(r)) return false;
    return getRenewalInfo(nextRecurRenewal(r.startDate, r.frequency), r.frequency).soon;
  });

  // Totals (unfiltered, active only)
  const personalActive  = personalSubs.filter(s => s.active);
  const personalMonthly = personalActive.reduce((s, p) => s + toMonthly(p.amount, p.frequency), 0);
  const bizActive       = recurringExps.filter(isRecurActive);
  const bizMonthly      = bizActive.reduce((s, r) => s + recurMonthly(r), 0);

  function openAdd() {
    setEditId(null);
    setForm(makeBlank());
    setModalOpen(true);
  }

  function openEdit(sub) {
    setEditId(sub.id);
    setForm({ ...sub });
    setModalOpen(true);
  }

  function save() {
    if (!form.name.trim()) {
      toast({ message: 'Name is required', type: 'error' });
      return;
    }
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      toast({ message: 'A valid amount is required', type: 'error' });
      return;
    }
    if (editId) {
      dispatch({ type: 'UPDATE_PERSONAL_SUB', payload: { ...form, id: editId } });
      toast({ message: `${form.name} updated` });
    } else {
      dispatch({ type: 'ADD_PERSONAL_SUB', payload: form });
      toast({
        message: `${form.name} added`,
        detail: `${form.currency} ${formatCurrency(amt)} / ${freqLabel(form.frequency).toLowerCase()}`,
      });
    }
    setModalOpen(false);
  }

  function toggleActive(sub) {
    dispatch({ type: 'UPDATE_PERSONAL_SUB', payload: { ...sub, active: !sub.active } });
  }

  function doDelete(id) {
    dispatch({ type: 'DELETE_PERSONAL_SUB', payload: id });
    setDeleteConfirm(null);
    toast({ message: 'Subscription removed', type: 'info' });
  }

  const isEmpty = tab === 'Personal' ? sortedPersonal.length === 0 : sortedBiz.length === 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Subscription Tracker</h1>
          <p className={styles.pageSub}>Track your personal and business subscriptions in one place.</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Personal / month</span>
          <span className={`${styles.summaryValue} ${styles.summaryPersonal}`}>{formatCurrency(personalMonthly)}</span>
          <span className={styles.summarySub}>{personalActive.length} active · {formatCurrency(personalMonthly * 12)} / yr</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Business / month</span>
          <span className={styles.summaryValue}>{formatCurrency(bizMonthly)}</span>
          <span className={styles.summarySub}>{bizActive.length} active · {formatCurrency(bizMonthly * 12)} / yr</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Combined / month</span>
          <span className={`${styles.summaryValue} ${styles.summaryBold}`}>{formatCurrency(personalMonthly + bizMonthly)}</span>
          <span className={styles.summarySub}>{formatCurrency((personalMonthly + bizMonthly) * 12)} / yr</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
            <span className={styles.tabCount}>
              {t === 'Personal' ? personalSubs.length : recurringExps.length}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder={tab === 'Personal' ? 'Search personal subscriptions…' : 'Search recurring expenses…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'card' ? styles.viewBtnActive : ''}`} onClick={() => setView('card')} title="Card view">⊞</button>
          <button className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`} onClick={() => setView('table')} title="Table view">☰</button>
        </div>
        {tab === 'Personal'
          ? <Button size="sm" onClick={openAdd}>+ Add Subscription</Button>
          : <Link href="/expenses"><Button size="sm" variant="secondary">Manage Recurring →</Button></Link>
        }
      </div>

      {/* Info banners */}
      {tab === 'Personal' && (
        <div className={styles.infoBanner}>
          Personal subscriptions are <strong>not included in tax calculations</strong>. If a subscription has a business purpose, add it under{' '}
          <Link href="/expenses" className={styles.bannerLink}>Expenses → Recurring</Link> instead.
        </div>
      )}
      {tab === 'Business' && (
        <div className={`${styles.infoBanner} ${styles.infoBannerBiz}`}>
          Business subscriptions are sourced from <strong>Expenses → Recurring</strong> and are automatically included in your tax deductions.{' '}
          <Link href="/expenses" className={styles.bannerLink}>Manage recurring expenses →</Link>
        </div>
      )}

      {/* Renewing soon banner */}
      {tab === 'Personal' && personalSoonItems.length > 0 && (
        <div className={styles.renewalBanner}>
          <span className={styles.renewalBannerTitle}>🔔 Renewing soon</span>
          <div className={styles.renewalBannerItems}>
            {personalSoonItems.map(s => {
              const info = getRenewalInfo(nextPersonalRenewal(s), s.frequency);
              return (
                <span key={s.id} className={styles.renewalBannerItem}>
                  <strong>{s.name}</strong>
                  {' — '}{s.currency !== 'CAD' ? `${s.currency} ` : ''}{formatCurrency(parseFloat(s.amount) || 0)} in {info.daysLeft === 0 ? 'today' : `${info.daysLeft}d`}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'Business' && bizSoonItems.length > 0 && (
        <div className={styles.renewalBanner}>
          <span className={styles.renewalBannerTitle}>🔔 Renewing soon</span>
          <div className={styles.renewalBannerItems}>
            {bizSoonItems.map(r => {
              const info = getRenewalInfo(nextRecurRenewal(r.startDate, r.frequency), r.frequency);
              return (
                <span key={r.id} className={styles.renewalBannerItem}>
                  <strong>{r.vendor || r.description}</strong>
                  {' — '}{formatCurrency(parseFloat(r.amount) || 0)} in {info.daysLeft === 0 ? 'today' : `${info.daysLeft}d`}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {tab === 'Personal' && sortedPersonal.length === 0 && (
        search
          ? <EmptyState icon="🔍" title="No results" description="No subscriptions match your search." />
          : <EmptyState icon="💳" title="No personal subscriptions yet" description="Track Netflix, Spotify, Adobe CC and more. Personal subs won't affect your taxes." action={<Button onClick={openAdd}>Add Subscription</Button>} />
      )}
      {tab === 'Business' && sortedBiz.length === 0 && (
        search
          ? <EmptyState icon="🔍" title="No results" description="No recurring expenses match your search." />
          : <EmptyState icon="🔄" title="No recurring expenses" description="Add recurring expenses in the Expenses tab to track business subscriptions here." action={<Link href="/expenses"><Button>Add Recurring Expense</Button></Link>} />
      )}

      {/* Card view */}
      {view === 'card' && tab === 'Personal' && sortedPersonal.length > 0 && (
        <div className={styles.grid}>
          {sortedPersonal.map(sub => (
            <PersonalCard
              key={sub.id}
              sub={sub}
              onEdit={() => openEdit(sub)}
              onToggle={() => toggleActive(sub)}
              onDelete={() => setDeleteConfirm(sub.id)}
            />
          ))}
        </div>
      )}
      {view === 'card' && tab === 'Business' && sortedBiz.length > 0 && (
        <div className={styles.grid}>
          {sortedBiz.map(rec => <BizCard key={rec.id} rec={rec} />)}
        </div>
      )}

      {/* Table view */}
      {view === 'table' && tab === 'Personal' && sortedPersonal.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <SortTh label="Status"    colKey="status"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Name"      colKey="name"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Category"  colKey="category"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Frequency" colKey="frequency" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="/Month"    colKey="monthly"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className={styles.right} />
                <SortTh label="Renewal"   colKey="renewal"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedPersonal.map(sub => {
                const info = getRenewalInfo(nextPersonalRenewal(sub), sub.frequency);
                return (
                  <tr key={sub.id} className={`${styles.tableRow} ${!sub.active ? styles.rowInactive : ''}`}>
                    <td>
                      <span className={`${styles.statusPill} ${sub.active ? styles.statusPillActive : styles.statusPillOff}`}>
                        {sub.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      {sub.url
                        ? <a href={sub.url} target="_blank" rel="noopener noreferrer" className={styles.tableLink}>{sub.name}</a>
                        : sub.name
                      }
                    </td>
                    <td>{personalCatLabel(sub.category)}</td>
                    <td>{freqLabel(sub.frequency)}</td>
                    <td className={styles.right}>
                      {sub.currency !== 'CAD' && <span className={styles.currencyTag}>{sub.currency} </span>}
                      {formatCurrency(toMonthly(sub.amount, sub.frequency))}
                    </td>
                    <td>
                      {info.nextDate
                        ? <span className={info.soon ? styles.renewalSoon : styles.renewalDate}>
                            {fmtRenewalDate(info.nextDate)}{info.soon && ` (${info.daysLeft === 0 ? 'today' : `${info.daysLeft}d`})`}
                          </span>
                        : <span className={styles.renewalUnknown}>—</span>
                      }
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className={styles.actionBtn} onClick={() => toggleActive(sub)}>{sub.active ? 'Pause' : 'Resume'}</button>
                        <button className={styles.actionBtn} onClick={() => openEdit(sub)}>Edit</button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setDeleteConfirm(sub.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {view === 'table' && tab === 'Business' && sortedBiz.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <SortTh label="Status"    colKey="status"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Vendor"    colKey="name"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Category"  colKey="category"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Frequency" colKey="frequency" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="/Month"    colKey="monthly"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className={styles.right} />
                <SortTh label="Renewal"   colKey="renewal"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedBiz.map(rec => {
                const active = isRecurActive(rec);
                const nextDate = nextRecurRenewal(rec.startDate, rec.frequency);
                const info = getRenewalInfo(nextDate, rec.frequency);
                return (
                  <tr key={rec.id} className={`${styles.tableRow} ${!active ? styles.rowInactive : ''}`}>
                    <td>
                      <span className={`${styles.statusPill} ${active ? styles.statusPillActive : styles.statusPillOff}`}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.tablePrimary}>{rec.vendor || rec.description || '—'}</div>
                      {rec.description && rec.vendor && <div className={styles.tableSecondary}>{rec.description}</div>}
                    </td>
                    <td>{bizCatLabel(rec.category)}</td>
                    <td>{freqLabel(rec.frequency)}</td>
                    <td className={styles.right}>{formatCurrency(recurMonthly(rec))}</td>
                    <td>
                      {info.nextDate
                        ? <span className={info.soon ? styles.renewalSoon : styles.renewalDate}>
                            {fmtRenewalDate(info.nextDate)}{info.soon && ` (${info.daysLeft === 0 ? 'today' : `${info.daysLeft}d`})`}
                          </span>
                        : <span className={styles.renewalUnknown}>—</span>
                      }
                    </td>
                    <td>
                      <Link href="/expenses" className={styles.actionLink}>Manage →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Subscription' : 'Add Subscription'}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editId ? 'Save Changes' : 'Add Subscription'}</Button>
          </div>
        }
      >
        <div className={styles.formGrid}>
          <FormField label="Service Name" required>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Netflix, Spotify, Adobe CC"
              autoFocus
            />
          </FormField>
          <FormField label="Website URL">
            <Input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://..."
            />
          </FormField>
          <div className={styles.formRow}>
            <FormField label="Amount" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Currency">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </FormField>
          </div>
          <div className={styles.formRow}>
            <FormField label="Billing Frequency">
              <Select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCIES.map(fr => <option key={fr.value} value={fr.value}>{fr.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Billing Day (of month)">
              <Input
                type="number"
                min="1"
                max="31"
                value={form.billingDay}
                onChange={e => setForm(f => ({ ...f, billingDay: e.target.value }))}
                placeholder="e.g. 15"
              />
            </FormField>
          </div>
          <FormField label="Next Renewal Date" hint={form.frequency === 'monthly' && form.billingDay ? 'Calculated from billing day above — override here if needed' : 'Optional: set for annual or quarterly subs to enable renewal notices'}>
            <Input
              type="date"
              value={form.renewalDate}
              onChange={e => setForm(f => ({ ...f, renewalDate: e.target.value }))}
            />
          </FormField>
          <FormField label="Category">
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {PERSONAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Family plan, shared with partner"
              rows={2}
            />
          </FormField>
          <label className={styles.activeToggle}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
            />
            <span>Active subscription</span>
          </label>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Remove Subscription"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => doDelete(deleteConfirm)}>Remove</Button>
          </div>
        }
      >
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Are you sure you want to remove this subscription? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

// ── Personal subscription card ─────────────────────────────────────────────
function PersonalCard({ sub, onEdit, onToggle, onDelete }) {
  const monthly = toMonthly(sub.amount, sub.frequency);
  const annual  = monthly * 12;
  const info    = getRenewalInfo(nextPersonalRenewal(sub), sub.frequency);
  return (
    <div className={`${styles.card} ${!sub.active ? styles.cardInactive : ''}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardName}>
          {sub.url
            ? <a href={sub.url} target="_blank" rel="noopener noreferrer" className={styles.cardNameLink}>{sub.name}</a>
            : sub.name
          }
        </div>
        <span className={`${styles.statusPill} ${sub.active ? styles.statusPillActive : styles.statusPillOff}`}>
          {sub.active ? 'Active' : 'Paused'}
        </span>
      </div>
      <div className={styles.cardCategory}>{personalCatLabel(sub.category)}</div>
      <div className={styles.cardPricing}>
        <span className={styles.cardAmount}>
          {sub.currency !== 'CAD' ? `${sub.currency} ` : ''}{formatCurrency(parseFloat(sub.amount) || 0)}
        </span>
        <span className={styles.cardFreq}>/ {freqLabel(sub.frequency).toLowerCase()}</span>
      </div>
      {sub.frequency !== 'monthly' && (
        <div className={styles.cardEquiv}>≈ {formatCurrency(monthly)}/mo · {formatCurrency(annual)}/yr</div>
      )}
      {info.nextDate && (
        <div className={info.soon ? styles.renewalSoonCard : styles.cardMeta}>
          {info.soon ? '🔔 ' : ''}
          Renews {fmtRenewalDate(info.nextDate)}{info.soon ? ` — in ${info.daysLeft === 0 ? 'today' : `${info.daysLeft} day${info.daysLeft !== 1 ? 's' : ''}`}` : ''}
        </div>
      )}
      {!info.nextDate && sub.billingDay && sub.frequency !== 'monthly' && (
        <div className={styles.cardMeta}>Bills on day {sub.billingDay}</div>
      )}
      {sub.notes && <div className={styles.cardNotes}>{sub.notes}</div>}
      <div className={styles.cardActions}>
        <button className={styles.actionBtn} onClick={onToggle}>{sub.active ? 'Pause' : 'Resume'}</button>
        <button className={styles.actionBtn} onClick={onEdit}>Edit</button>
        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={onDelete}>Remove</button>
      </div>
    </div>
  );
}

// ── Business (recurring expense) card ─────────────────────────────────────
function BizCard({ rec }) {
  const active   = isRecurActive(rec);
  const monthly  = recurMonthly(rec);
  const annual   = monthly * 12;
  const nextDate = nextRecurRenewal(rec.startDate, rec.frequency);
  const info     = getRenewalInfo(nextDate, rec.frequency);
  return (
    <div className={`${styles.card} ${!active ? styles.cardInactive : ''}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardName}>{rec.vendor || rec.description || 'Recurring Expense'}</div>
        <span className={`${styles.statusPill} ${active ? styles.statusPillActive : styles.statusPillOff}`}>
          {active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className={styles.cardCategory}>{bizCatLabel(rec.category)}</div>
      {rec.description && rec.vendor && (
        <div className={styles.cardDesc}>{rec.description}</div>
      )}
      <div className={styles.cardPricing}>
        <span className={styles.cardAmount}>{formatCurrency(parseFloat(rec.amount) || 0)}</span>
        <span className={styles.cardFreq}>/ {freqLabel(rec.frequency).toLowerCase()}</span>
      </div>
      {rec.frequency !== 'monthly' && (
        <div className={styles.cardEquiv}>≈ {formatCurrency(monthly)}/mo · {formatCurrency(annual)}/yr</div>
      )}
      {info.nextDate && (
        <div className={info.soon ? styles.renewalSoonCard : styles.cardMeta}>
          {info.soon ? '🔔 ' : ''}
          Renews {fmtRenewalDate(info.nextDate)}{info.soon ? ` — in ${info.daysLeft === 0 ? 'today' : `${info.daysLeft} day${info.daysLeft !== 1 ? 's' : ''}`}` : ''}
        </div>
      )}
      {rec.businessUsePercent != null && rec.businessUsePercent < 100 && (
        <div className={styles.cardMeta}>{rec.businessUsePercent}% business use</div>
      )}
      <div className={styles.cardActions}>
        <Link href="/expenses" className={styles.actionLink}>Manage in Expenses →</Link>
      </div>
    </div>
  );
}

function SortTh({ label, colKey, sortKey, sortDir, onSort, className }) {
  const active = sortKey === colKey;
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th
      className={[styles.sortableTh, active ? styles.sortableThActive : '', className].filter(Boolean).join(' ')}
      onClick={() => onSort(colKey)}
      tabIndex={0}
      aria-sort={ariaSort}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(colKey); } }}
    >
      {label}
      <span className={styles.sortIndicator} aria-hidden="true">
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
      </span>
    </th>
  );
}
