'use client';

import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, today, addDays } from '@/lib/formatters';
import { HST_RATES, INVOICE_STATUSES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import FileDropzone from '@/components/ui/FileDropzone';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const STATUS_COLORS = { paid: 'success', sent: 'info', overdue: 'danger', draft: 'muted', void: 'muted' };

function makeLineItem() {
  return { id: uuidv4(), description: '', quantity: 1, rate: 0, amount: 0 };
}

function nextInvoiceNumber(invoices) {
  const nums = invoices
    .map(inv => parseInt(inv.invoiceNumber, 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1);
}

function makeBlankInvoice(hstRate, invoiceNumber = '') {
  return {
    invoiceNumber,
    client: { name: '', email: '', address: '', city: '', province: '', postalCode: '', phone: '', hstNumber: '' },
    issueDate: today(),
    dueDate: today(),
    paymentTerms: 0,
    taxType: 'provincial',
    customTaxRate: '',
    lineItems: [makeLineItem()],
    subtotal: 0,
    hstRate,
    hstAmount: 0,
    total: 0,
    status: 'draft',
    paidDate: '',
    notes: '',
  };
}

// ─── PDF helpers (dynamic imports to avoid SSR) ────────────────────────────

async function generateInvoicePDF(invoice, settings) {
  const { pdf } = await import('@react-pdf/renderer');
  const { default: InvoiceDocument } = await import('@/components/InvoiceDocument');
  const { createElement } = await import('react');
  const blob = await pdf(createElement(InvoiceDocument, { invoice, settings })).toBlob();
  return blob;
}

function invoiceFilename(invoice, settings) {
  const co = (settings?.companyName || 'Invoice').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const num = invoice.invoiceNumber || 'invoice';
  const date = invoice.issueDate || '';
  return `${co}_Invoice_${num}_${date}.pdf`;
}

async function downloadInvoicePDF(invoice, settings) {
  const blob = await generateInvoicePDF(invoice, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = invoiceFilename(invoice, settings);
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadInvoicesZIP(invoices, settings, filename) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder('invoices');
  for (const inv of invoices) {
    const blob = await generateInvoicePDF(inv, settings);
    folder.file(invoiceFilename(inv, settings), blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `invoices-${today()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvoicesPage() {
  const { state, activeFY, dispatch } = useApp();
  const hstRate = HST_RATES[state.settings.province ?? 'ON'];
  const invoices = activeFY?.invoices ?? [];
  const clients = state.clients || [];

  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [selected, setSelected]     = useState(new Set());
  const [showModal, setShowModal]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editInv, setEditInv]       = useState(null);
  const [form, setForm]             = useState(makeBlankInvoice(hstRate));
  const [importing, setImporting]   = useState(false);
  const [importResults, setImportResults] = useState([]);
  const [importIdx, setImportIdx]   = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [previewUrl, setPreviewUrl]         = useState(null);
  const [previewLoading, setPreviewLoading] = useState(null);

  const openCreate = () => {
    setEditInv(null);
    setForm(makeBlankInvoice(hstRate, nextInvoiceNumber(invoices)));
    setShowModal(true);
  };

  const openEdit = inv => {
    setEditInv(inv);
    setForm({ ...inv });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditInv(null); };

  // ── Client picker ──────────────────────────────────
  const pickClient = clientId => {
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    setForm(f => ({
      ...f,
      client: {
        name: c.name || '',
        email: c.email || '',
        address: c.address || '',
        city: c.city || '',
        province: c.province || '',
        postalCode: c.postalCode || '',
        phone: c.phone || '',
        hstNumber: c.hstNumber || '',
      },
    }));
  };

  // ── Line item helpers ─────────────────────────────
  const updateLineItem = (idx, field, value) => {
    const items = form.lineItems.map((li, i) => {
      if (i !== idx) return li;
      const updated = { ...li, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        updated.amount = parseFloat(updated.quantity || 0) * parseFloat(updated.rate || 0);
      }
      if (field === 'amount') updated.amount = parseFloat(value || 0);
      return updated;
    });
    recalcTotals(items);
  };

  const addLineItem = () => {
    const items = [...form.lineItems, makeLineItem()];
    setForm(f => ({ ...f, lineItems: items }));
  };

  const removeLineItem = idx => {
    const items = form.lineItems.filter((_, i) => i !== idx);
    recalcTotals(items);
  };

  const recalcTotals = items => {
    const subtotal = items.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0);
    const hstAmount = subtotal * (form.hstRate ?? 0);
    setForm(f => ({ ...f, lineItems: items, subtotal, hstAmount, total: subtotal + hstAmount }));
  };

  const changeTaxType = taxType => {
    let rate;
    if      (taxType === 'provincial') rate = hstRate;
    else if (taxType === 'gst')        rate = 0.05;
    else if (taxType === 'gst_qst')   rate = 0.14975;
    else if (taxType === 'none')       rate = 0;
    else                               rate = (parseFloat(form.customTaxRate) || 0) / 100;
    const subtotal   = form.lineItems.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0);
    const hstAmount  = subtotal * rate;
    setForm(f => ({ ...f, taxType, hstRate: rate, hstAmount, total: subtotal + hstAmount }));
  };

  const changeCustomTaxRate = pct => {
    const rate      = (parseFloat(pct) || 0) / 100;
    const subtotal  = form.lineItems.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0);
    const hstAmount = subtotal * rate;
    setForm(f => ({ ...f, customTaxRate: pct, hstRate: rate, hstAmount, total: subtotal + hstAmount }));
  };

  // ── Duplicate number check ──────────────────────
  const isDuplicateNumber = num => {
    if (!num) return false;
    return invoices.some(inv =>
      inv.invoiceNumber?.trim().toLowerCase() === num.trim().toLowerCase() &&
      inv.id !== editInv?.id
    );
  };

  // ── Save ──────────────────────────────────────────
  const handleSave = e => {
    e.preventDefault();
    if (isDuplicateNumber(form.invoiceNumber)) {
      if (!window.confirm(`Invoice #${form.invoiceNumber} already exists. Save anyway?`)) return;
    }
    if (editInv) {
      dispatch({ type: 'UPDATE_INVOICE', payload: { ...form, id: editInv.id } });
    } else {
      dispatch({ type: 'ADD_INVOICE', payload: form });
    }
    closeModal();
  };

  // ── Delete ────────────────────────────────────────
  const handleDelete = id => {
    dispatch({ type: 'DELETE_INVOICE', payload: id });
    setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    setConfirmDelete(null);
  };

  // ── Mark paid ─────────────────────────────────────
  const markPaid = inv => {
    dispatch({ type: 'UPDATE_INVOICE', payload: { ...inv, status: 'paid', paidDate: today() } });
  };

  // ── Preview ───────────────────────────────────────
  const openPreview = async invoice => {
    const key = invoice.id || 'form';
    setPreviewLoading(key);
    try {
      const blob = await generateInvoicePDF(invoice, state.settings);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (err) {
      alert('Preview failed: ' + err.message);
    } finally {
      setPreviewLoading(null);
    }
  };

  const closePreview = () => {
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  // ── PDF download ──────────────────────────────────
  const handleDownloadPDF = async inv => {
    setPdfLoading(inv.id);
    try {
      await downloadInvoicePDF(inv, state.settings);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('PDF generation failed: ' + err.message);
    } finally {
      setPdfLoading(null);
    }
  };

  // ── ZIP download ──────────────────────────────────
  const handleDownloadZIP = async () => {
    const toDownload = selected.size > 0
      ? filtered.filter(inv => selected.has(inv.id))
      : filtered;
    if (toDownload.length === 0) return;
    setZipLoading(true);
    try {
      await downloadInvoicesZIP(toDownload, state.settings);
    } catch (err) {
      console.error('ZIP generation error:', err);
      alert('ZIP generation failed: ' + err.message);
    } finally {
      setZipLoading(false);
    }
  };

  // ── Selection ─────────────────────────────────────
  const toggleSelect = id => setSelected(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  };

  // ── Multi-PDF Import ──────────────────────────────
  const handleImportFiles = useCallback(async files => {
    setImporting(true);
    setImportResults([]);
    setImportIdx(0);
    const fd = new FormData();
    for (const f of files) fd.append('file', f);
    try {
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const results = (data.results || []).map(r => {
        const p = r.parsed || {};
        return {
          filename: r.filename,
          parsed: p,
          text: r.text,
          formData: {
            ...makeBlankInvoice(hstRate),
            invoiceNumber: p.documentNumber || '',
            issueDate: p.date || today(),
            client: { name: p.client || '', email: '', address: '' },
            subtotal: p.subtotal || (p.total ? +(p.total / (1 + hstRate)).toFixed(2) : 0),
            hstAmount: p.hst || (p.subtotal ? +(p.subtotal * hstRate).toFixed(2) : 0),
            total: p.total || 0,
            lineItems: [{
              id: uuidv4(),
              description: p.description || 'Services rendered',
              quantity: 1,
              rate: p.subtotal || (p.total ? +(p.total / (1 + hstRate)).toFixed(2) : 0),
              amount: p.subtotal || (p.total ? +(p.total / (1 + hstRate)).toFixed(2) : 0),
            }],
            notes: '',
          },
        };
      });
      setImportResults(results);
    } catch (err) {
      setImportResults([{ error: err.message }]);
    } finally {
      setImporting(false);
    }
  }, [hstRate]);

  const handleUseImported = () => {
    const result = importResults[importIdx];
    if (!result || result.error) return;
    setForm(result.formData);
    setEditInv(null);
    setShowImport(false);
    setShowModal(true);
  };

  // ── Filter & search ───────────────────────────────
  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || inv.invoiceNumber?.toLowerCase().includes(q)
      || inv.client?.name?.toLowerCase().includes(q)
      || inv.notes?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Totals ────────────────────────────────────────
  const totals = {
    revenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.subtotal, 0),
    outstanding: invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + i.total, 0),
    hst: invoices.filter(i => ['sent', 'paid'].includes(i.status)).reduce((s, i) => s + i.hstAmount, 0),
  };

  const currentImport = importResults[importIdx];

  return (
    <div className={styles.page}>
      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Revenue (paid)</span>
          <span className={styles.summaryValue}>{formatCurrency(totals.revenue)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Outstanding</span>
          <span className={styles.summaryValue}>{formatCurrency(totals.outstanding)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>HST Collected</span>
          <span className={styles.summaryValue}>{formatCurrency(totals.hst)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Invoices</span>
          <span className={styles.summaryValue}>{invoices.length}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search invoices…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onChange={e => setStatus(e.target.value)} className={styles.filterSelect}>
          <option value="all">All statuses</option>
          {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <div className={styles.toolbarActions}>
          {filtered.length > 0 && (
            <Button
              variant="secondary" size="sm"
              onClick={handleDownloadZIP}
              loading={zipLoading}
              title={selected.size > 0 ? `Download ${selected.size} selected as ZIP` : `Download all ${filtered.length} as ZIP`}
            >
              ⬇ {selected.size > 0 ? `ZIP (${selected.size})` : 'ZIP All'}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => { setImportResults([]); setImportIdx(0); setShowImport(true); }}>
            📎 Import PDFs
          </Button>
          <Button size="sm" onClick={openCreate}>+ New Invoice</Button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📄"
          title="No invoices found"
          description={invoices.length === 0 ? "Create your first invoice or import from PDF." : "Try adjusting your search or filter."}
          action={<Button onClick={openCreate}>+ New Invoice</Button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCell}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
                  </th>
                  <th>Invoice #</th><th>Client</th><th>Date</th><th>Due</th>
                  <th className={styles.right}>Subtotal</th><th className={styles.right}>HST</th>
                  <th className={styles.right}>Total</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className={`${styles.tableRow} ${selected.has(inv.id) ? styles.rowSelected : ''}`}>
                    <td className={styles.checkCell}>
                      <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
                    </td>
                    <td className={styles.invNum}>{inv.invoiceNumber}</td>
                    <td>{inv.client?.name || '—'}</td>
                    <td>{formatDate(inv.issueDate, { style: 'short' })}</td>
                    <td>{formatDate(inv.dueDate, { style: 'short' })}</td>
                    <td className={styles.right}>{formatCurrency(inv.subtotal)}</td>
                    <td className={styles.right}>{formatCurrency(inv.hstAmount)}</td>
                    <td className={`${styles.right} ${styles.totalCell}`}>{formatCurrency(inv.total)}</td>
                    <td><Badge color={STATUS_COLORS[inv.status]}>{inv.status}</Badge></td>
                    <td>
                      <div className={styles.rowActions}>
                        {inv.status !== 'paid' && inv.status !== 'void' && (
                          <Button variant="ghost" size="xs" onClick={() => markPaid(inv)}>✓ Paid</Button>
                        )}
                        <Button
                          variant="ghost" size="xs"
                          onClick={() => openPreview(inv)}
                          loading={previewLoading === inv.id}
                          title="Preview PDF"
                        >
                          👁 Preview
                        </Button>
                        <Button
                          variant="ghost" size="xs"
                          onClick={() => handleDownloadPDF(inv)}
                          loading={pdfLoading === inv.id}
                          title="Download PDF"
                        >
                          ⬇ PDF
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => openEdit(inv)}>Edit</Button>
                        <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(inv.id)}>🗑</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className={styles.mobileList}>
            {filtered.map(inv => (
              <div key={inv.id} className={`${styles.mobileCard} ${selected.has(inv.id) ? styles.rowSelected : ''}`}>
                <div className={styles.mobileTop}>
                  <label className={styles.mobileCheck}>
                    <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
                    <span className={styles.invNum}>{inv.invoiceNumber}</span>
                  </label>
                  <Badge color={STATUS_COLORS[inv.status]}>{inv.status}</Badge>
                </div>
                <div className={styles.mobileClient}>{inv.client?.name || 'Unknown client'}</div>
                <div className={styles.mobileMeta}>
                  <span>{formatDate(inv.issueDate, { style: 'short' })}</span>
                  <span className={styles.mobileTotal}>{formatCurrency(inv.total)}</span>
                </div>
                <div className={styles.mobileActions}>
                  {inv.status !== 'paid' && inv.status !== 'void' && (
                    <Button variant="secondary" size="xs" onClick={() => markPaid(inv)}>✓ Paid</Button>
                  )}
                  <Button variant="secondary" size="xs" onClick={() => openPreview(inv)} loading={previewLoading === inv.id}>
                    👁 Preview
                  </Button>
                  <Button variant="secondary" size="xs" onClick={() => handleDownloadPDF(inv)} loading={pdfLoading === inv.id}>
                    ⬇ PDF
                  </Button>
                  <Button variant="secondary" size="xs" onClick={() => openEdit(inv)}>Edit</Button>
                  <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(inv.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Invoice Form Modal ── */}
      <Modal isOpen={showModal} onClose={closeModal} size="xl" title={editInv ? `Edit ${editInv.invoiceNumber}` : 'New Invoice'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="secondary" onClick={() => openPreview(form)} loading={previewLoading === 'form'}>👁 Preview</Button>
            <Button type="submit" form="invoice-form">Save Invoice</Button>
          </>
        }
      >
        <form id="invoice-form" onSubmit={handleSave}>
          <div className={styles.formGrid}>
            <FormField
              label="Invoice Number"
              required
              hint={isDuplicateNumber(form.invoiceNumber) ? '⚠ This number already exists — you can still save with a different number.' : undefined}
            >
              <Input
                placeholder="INV-2026-001"
                value={form.invoiceNumber}
                onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                required
                style={isDuplicateNumber(form.invoiceNumber) ? { borderColor: 'var(--color-warning, #f59e0b)' } : undefined}
              />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Issue Date" required>
              <Input type="date" value={form.issueDate} onChange={e => {
                const d = e.target.value;
                setForm(f => ({ ...f, issueDate: d, ...(!editInv && { dueDate: d }) }));
              }} required />
            </FormField>
            <FormField label="Due Date">
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </FormField>
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Client</h4>
            {clients.length > 0 && (
              <FormField label="Select saved client" hint="Choosing a saved client fills the fields below." className={styles.clientPickerField}>
                <Select
                  value=""
                  onChange={e => { if (e.target.value) pickClient(e.target.value); }}
                >
                  <option value="">— pick a saved client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </FormField>
            )}
            <div className={styles.formGrid}>
              <FormField label="Client Name" required className={styles.colSpan2}>
                <Input placeholder="Client Inc." value={form.client?.name || ''} onChange={e => setForm(f => ({ ...f, client: { ...f.client, name: e.target.value } }))} required />
              </FormField>
              <FormField label="Client Email">
                <Input type="email" placeholder="client@example.com" value={form.client?.email || ''} onChange={e => setForm(f => ({ ...f, client: { ...f.client, email: e.target.value } }))} />
              </FormField>
              <FormField label="Client Address">
                <Input placeholder="123 Main St, Toronto ON" value={form.client?.address || ''} onChange={e => setForm(f => ({ ...f, client: { ...f.client, address: e.target.value } }))} />
              </FormField>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.lineItemsHeader}>
              <h4 className={styles.formSectionTitle}>Line Items</h4>
              <Button type="button" variant="secondary" size="xs" onClick={addLineItem}>+ Add line</Button>
            </div>
            <div className={styles.lineItems}>
              {form.lineItems.map((li, idx) => (
                <div key={li.id} className={styles.lineItem}>
                  <Input
                    className={styles.liDesc}
                    placeholder="Description"
                    value={li.description}
                    onChange={e => updateLineItem(idx, 'description', e.target.value)}
                  />
                  <Input
                    className={styles.liQty}
                    type="number" min="0" step="0.01" placeholder="Qty"
                    value={li.quantity}
                    onChange={e => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    className={styles.liRate}
                    type="number" min="0" step="0.01" placeholder="Rate" prefix="$"
                    value={li.rate}
                    onChange={e => updateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                  />
                  <span className={styles.liAmount}>{formatCurrency(li.amount)}</span>
                  {form.lineItems.length > 1 && (
                    <button type="button" className={styles.liRemove} onClick={() => removeLineItem(idx)} aria-label="Remove line">×</button>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.invoiceTotals}>
              <div className={styles.invoiceTotalRow}>
                <span>Subtotal</span><span>{formatCurrency(form.subtotal)}</span>
              </div>
              <div className={styles.invoiceTotalRow}>
                <Select
                  className={styles.taxTypeSelect}
                  value={form.taxType || 'provincial'}
                  onChange={e => changeTaxType(e.target.value)}
                >
                  <option value="provincial">Provincial HST/GST ({(hstRate * 100).toFixed(0)}%)</option>
                  <option value="gst">GST Only (5%)</option>
                  <option value="gst_qst">GST + QST (14.975%)</option>
                  <option value="none">No Tax (0%)</option>
                  <option value="custom">Custom Rate…</option>
                </Select>
                <span>{(form.taxType || 'provincial') === 'none' ? '—' : formatCurrency(form.hstAmount)}</span>
              </div>
              {(form.taxType === 'custom') && (
                <div className={styles.invoiceTotalRow}>
                  <label className={styles.customRateLabel}>Rate (%)</label>
                  <Input
                    type="number" min="0" max="100" step="0.001"
                    className={styles.customRateInput}
                    placeholder="e.g. 8.5"
                    value={form.customTaxRate ?? ''}
                    onChange={e => changeCustomTaxRate(e.target.value)}
                  />
                </div>
              )}
              <div className={`${styles.invoiceTotalRow} ${styles.invoiceGrandTotal}`}>
                <span>Total</span><span>{formatCurrency(form.total)}</span>
              </div>
            </div>
          </div>

          {form.status === 'paid' && (
            <FormField label="Paid Date">
              <Input type="date" value={form.paidDate} onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))} />
            </FormField>
          )}

          <FormField label="Notes">
            <Textarea placeholder="Optional notes or references…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </FormField>
        </form>
      </Modal>

      {/* ── Multi-PDF Import Modal ── */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Invoices from PDF" size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>Cancel</Button>
            {importResults.length > 1 && (
              <div className={styles.importNav}>
                <Button variant="secondary" size="xs" onClick={() => setImportIdx(i => Math.max(0, i - 1))} disabled={importIdx === 0}>←</Button>
                <span>{importIdx + 1} / {importResults.length}</span>
                <Button variant="secondary" size="xs" onClick={() => setImportIdx(i => Math.min(importResults.length - 1, i + 1))} disabled={importIdx === importResults.length - 1}>→</Button>
              </div>
            )}
            {currentImport && !currentImport.error && (
              <Button onClick={handleUseImported}>Use this data →</Button>
            )}
          </>
        }
      >
        <div className={styles.importBody}>
          {importResults.length === 0 && (
            <FileDropzone
              onFiles={handleImportFiles}
              label={importing ? 'Parsing files…' : 'Drop one or more invoice PDFs here'}
              hint="Supports PDF, PNG, JPG. Fields are pre-filled from extracted text."
              accept=".pdf,.png,.jpg,.jpeg"
            />
          )}
          {importing && <p className={styles.importStatus}>⏳ Extracting text from {importResults.length > 0 ? 'files' : 'PDF'}…</p>}

          {importResults.length > 0 && (
            <>
              {currentImport?.error ? (
                <p className={styles.importError}>❌ {currentImport.filename}: {currentImport.error}</p>
              ) : (
                <div className={styles.importPreview}>
                  <div className={styles.importPreviewHeader}>
                    <p className={styles.importPreviewTitle}>✅ Extracted from: <strong>{currentImport?.filename}</strong></p>
                  </div>
                  {Object.entries(currentImport?.parsed || {}).filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k} className={styles.importRow}>
                      <span className={styles.importKey}>{k}:</span>
                      <span className={styles.importVal}>{String(v)}</span>
                    </div>
                  ))}
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

      {/* ── PDF Preview Modal ── */}
      <Modal isOpen={!!previewUrl} onClose={closePreview} title="Invoice Preview" size="xl"
        footer={<Button variant="secondary" onClick={closePreview}>Close</Button>}
      >
        <div className={styles.previewBody}>
          {previewUrl && <iframe src={previewUrl} className={styles.previewFrame} title="Invoice Preview" />}
        </div>
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Invoice?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Delete</Button>
          </>
        }
      >
        <p className={styles.confirmText}>This invoice will be permanently removed. This cannot be undone.</p>
      </Modal>
    </div>
  );
}


