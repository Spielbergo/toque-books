'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDate, today } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesToHMS(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const s = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function secondsToHMS(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function makeBlankEntry(clients, projects) {
  return {
    clientId: '',
    projectId: '',
    description: '',
    date: today(),
    startTime: '',
    endTime: '',
    durationMinutes: '',
    billable: true,
    rate: '',
  };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TimeTrackingPage() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();

  const clients  = state.clients  || [];
  const projects = state.projects || [];
  const entries  = (state.timeEntries || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt?.localeCompare(a.createdAt));

  // ── Timer state ─────────────────────────────────────────────────────────
  const [running,   setRunning]   = useState(false);
  const [elapsed,   setElapsed]   = useState(0); // seconds
  const [timerDesc, setTimerDesc] = useState('');
  const [timerClient, setTimerClient] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerBillable, setTimerBillable] = useState(true);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  const startTimer = () => {
    startRef.current = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    setRunning(true);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
  };

  const saveTimer = () => {
    if (elapsed < 60) { toast({ message: 'Timer must run for at least 1 minute', type: 'error' }); return; }
    const mins = Math.round(elapsed / 60);
    dispatch({
      type: 'ADD_TIME_ENTRY',
      payload: {
        clientId: timerClient,
        projectId: timerProject,
        description: timerDesc,
        date: today(),
        durationMinutes: mins,
        billable: timerBillable,
        rate: '',
        startTime: '',
        endTime: '',
      },
    });
    toast({ message: `${formatDuration(mins)} saved` });
    setElapsed(0);
    setTimerDesc('');
    setTimerClient('');
    setTimerProject('');
    setRunning(false);
    clearInterval(intervalRef.current);
  };

  // ── Manual entry modal ────────────────────────────────────────────────────
  const [showModal,  setShowModal]  = useState(false);
  const [editEntry,  setEditEntry]  = useState(null);
  const [form,       setForm]       = useState(makeBlankEntry());
  const [confirmDel, setConfirmDel] = useState(null);

  const set = useCallback(k => v => setForm(f => ({ ...f, [k]: v })), []);

  // Auto-calculate duration when start/end times change
  useEffect(() => {
    if (form.startTime && form.endTime) {
      const [sh, sm] = form.startTime.split(':').map(Number);
      const [eh, em] = form.endTime.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) setForm(f => ({ ...f, durationMinutes: String(diff) }));
    }
  }, [form.startTime, form.endTime]);

  const openCreate = () => { setEditEntry(null); setForm(makeBlankEntry()); setShowModal(true); };
  const openEdit   = e  => { setEditEntry(e);    setForm({ ...e });         setShowModal(true); };

  const handleSave = e => {
    e.preventDefault();
    const payload = {
      ...form,
      durationMinutes: parseInt(form.durationMinutes, 10) || 0,
      rate: parseFloat(form.rate) || 0,
    };
    if (editEntry) {
      dispatch({ type: 'UPDATE_TIME_ENTRY', payload: { ...payload, id: editEntry.id } });
      toast({ message: 'Entry updated' });
    } else {
      dispatch({ type: 'ADD_TIME_ENTRY', payload });
      toast({ message: 'Time entry added' });
    }
    setShowModal(false);
  };

  const handleDelete = id => {
    dispatch({ type: 'DELETE_TIME_ENTRY', payload: id });
    setConfirmDel(null);
    toast({ message: 'Entry deleted', type: 'info' });
  };

  // ── Export to invoice ─────────────────────────────────────────────────────
  const exportToInvoice = entry => {
    const client = clients.find(c => c.id === entry.clientId);
    const rate   = entry.rate || 0;
    const hours  = (entry.durationMinutes || 0) / 60;
    const amount = rate * hours;
    toast({ message: `Copy these details to a new invoice for ${client?.name || 'client'}:\n"${entry.description}" — ${formatDuration(entry.durationMinutes)} @ $${rate}/hr = $${amount.toFixed(2)}`, type: 'info' });
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalMins     = entries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
  const billableMins  = entries.filter(e => e.billable).reduce((s, e) => s + (e.durationMinutes || 0), 0);
  const billableValue = entries
    .filter(e => e.billable && e.rate)
    .reduce((s, e) => s + (e.durationMinutes / 60) * e.rate, 0);

  const clientOptions = [{ value: '', label: 'No client' }, ...clients.map(c => ({ value: c.id, label: c.name }))];
  const projectOptions = [
    { value: '', label: 'No project' },
    ...projects.filter(p => !form.clientId || p.clientId === form.clientId || !p.clientId).map(p => ({ value: p.id, label: p.name })),
  ];
  const timerProjectOptions = [
    { value: '', label: 'No project' },
    ...projects.filter(p => !timerClient || p.clientId === timerClient || !p.clientId).map(p => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Time Tracking</h1>
          <p className={styles.sub}>Track billable hours and export to invoices.</p>
        </div>
        <Button onClick={openCreate}>+ Add Entry</Button>
      </div>

      {/* ── Live Timer ── */}
      <div className={styles.timerCard}>
        <div className={styles.timerDisplay}>{secondsToHMS(elapsed)}</div>
        <input
          className={styles.timerDesc}
          placeholder="What are you working on?"
          value={timerDesc}
          onChange={e => setTimerDesc(e.target.value)}
        />
        <div className={styles.timerControls}>
          <select className={styles.timerSelect} value={timerClient} onChange={e => setTimerClient(e.target.value)}>
            {clientOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={styles.timerSelect} value={timerProject} onChange={e => setTimerProject(e.target.value)}>
            {timerProjectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className={styles.timerBillable}>
            <input type="checkbox" checked={timerBillable} onChange={e => setTimerBillable(e.target.checked)} />
            Billable
          </label>
          {!running ? (
            <Button variant="primary" onClick={startTimer}>Start</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={stopTimer}>Pause</Button>
              <Button variant="success" onClick={saveTimer}>Save</Button>
            </>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {entries.length > 0 && (
        <div className={styles.stats}>
          <div className={styles.stat}><span className={styles.statLabel}>Total Hours</span><span className={styles.statValue}>{formatDuration(totalMins)}</span></div>
          <div className={styles.stat}><span className={styles.statLabel}>Billable Hours</span><span className={styles.statValue}>{formatDuration(billableMins)}</span></div>
          <div className={styles.stat}><span className={styles.statLabel}>Billable Value</span><span className={styles.statValue}>${billableValue.toFixed(2)}</span></div>
          <div className={styles.stat}><span className={styles.statLabel}>Entries</span><span className={styles.statValue}>{entries.length}</span></div>
        </div>
      )}

      {/* ── Entries list ── */}
      {entries.length === 0 ? (
        <EmptyState
          title="No time entries yet"
          description="Start the timer above or add a manual entry."
          action={{ label: '+ Add Entry', onClick: openCreate }}
        />
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Date</span>
            <span>Description</span>
            <span>Client / Project</span>
            <span>Duration</span>
            <span>Billable</span>
            <span></span>
          </div>
          {entries.map(entry => {
            const client  = clients.find(c => c.id === entry.clientId);
            const project = projects.find(p => p.id === entry.projectId);
            return (
              <div key={entry.id} className={styles.tableRow}>
                <span className={styles.cellDate}>{formatDate(entry.date)}</span>
                <span className={styles.cellDesc}>{entry.description || <em className={styles.muted}>No description</em>}</span>
                <span className={styles.cellClient}>
                  {client ? <strong>{client.name}</strong> : <span className={styles.muted}>—</span>}
                  {project && <span className={styles.projectTag}>{project.name}</span>}
                </span>
                <span className={styles.cellDuration}>{formatDuration(entry.durationMinutes)}</span>
                <span className={styles.cellBillable}>
                  {entry.billable
                    ? <span className={styles.badgeBillable}>Billable{entry.rate ? ` @ $${entry.rate}/hr` : ''}</span>
                    : <span className={styles.badgeNonBillable}>Non-billable</span>}
                </span>
                <span className={styles.cellActions}>
                  {entry.billable && <button className={styles.actionBtn} onClick={() => exportToInvoice(entry)} title="Export to invoice">📄</button>}
                  <button className={styles.actionBtn} onClick={() => openEdit(entry)} title="Edit">✏️</button>
                  <button className={styles.actionBtn} onClick={() => setConfirmDel(entry.id)} title="Delete">🗑</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editEntry ? 'Edit Time Entry' : 'Add Time Entry'} size="md">
        <form onSubmit={handleSave}>
          <FormField label="Description">
            <Input value={form.description} onChange={set('description')} placeholder="What did you work on?" />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Date">
              <Input type="date" value={form.date} onChange={set('date')} required />
            </FormField>
            <FormField label="Client">
              <Select value={form.clientId} onChange={set('clientId')} options={clientOptions} />
            </FormField>
          </div>
          <FormField label="Project">
            <Select value={form.projectId} onChange={set('projectId')} options={projectOptions} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <FormField label="Start Time">
              <Input type="time" value={form.startTime} onChange={set('startTime')} />
            </FormField>
            <FormField label="End Time">
              <Input type="time" value={form.endTime} onChange={set('endTime')} />
            </FormField>
            <FormField label="Duration (minutes)">
              <Input type="number" min="1" value={form.durationMinutes} onChange={set('durationMinutes')} placeholder="60" required />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Hourly Rate ($)">
              <Input type="number" min="0" step="0.01" value={form.rate} onChange={set('rate')} placeholder="0.00" />
            </FormField>
            <FormField label="Billable">
              <label className={styles.checkRow}>
                <input type="checkbox" checked={form.billable} onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))} />
                This entry is billable
              </label>
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">{editEntry ? 'Save Changes' : 'Add Entry'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete Entry?" size="sm">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>This time entry will be permanently deleted.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDel)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
