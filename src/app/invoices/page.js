'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDate, today, addDays } from '@/lib/formatters';
import { fyLabelForDate } from '@/lib/fyUtils';
import { HST_RATES, INVOICE_STATUSES } from '@/lib/constants';
import { exportInvoicesCSV } from '@/lib/exportHelpers';
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
    sentAt: null,
    remindersSent: [],
    currency: 'CAD',
    exchangeRateToCAD: 1,
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
  const { user } = useAuth();
  const { toast } = useToast();
  const hstRate = HST_RATES[state.settings.province ?? 'ON'];
  const products = state.products || [];

  // Pool all invoices from every FY bucket, then filter by the active FY's date range.
  // This corrects invoices that were imported while a different FY was active.
  const isAllTime = state.activeFiscalYear === 'all';
  const allInvoices = Object.values(state.fiscalYears || {}).flatMap(fy => fy.invoices || []);
  const { startDate, endDate } = activeFY || {};
  const invoices = isAllTime
    ? allInvoices
    : allInvoices.filter(inv =>
        (!startDate || (inv.issueDate ?? '') >= startDate) &&
        (!endDate   || (inv.issueDate ?? '') <= endDate)
      );

  const clients = state.clients || [];

  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [yearFilter, setYearFilter]  = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const [selected, setSelected]     = useState(new Set());
  const [showModal, setShowModal]   = useState(false);
  const [openDescIdx, setOpenDescIdx] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [editInv, setEditInv]       = useState(null);
  const [form, setForm]             = useState(makeBlankInvoice(hstRate));
  const [importing, setImporting]   = useState(false);
  const [importResults, setImportResults] = useState([]);
  const [importIdx, setImportIdx]   = useState(0);
  const [importSaveMode, setImportSaveMode] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [previewUrl, setPreviewUrl]         = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(null);
  const [showSendModal, setShowSendModal]   = useState(false);
  const [sendInvoice, setSendInvoice]       = useState(null);
  const [sendStep, setSendStep]             = useState('compose'); // 'preview' | 'compose'
  const [sendForm, setSendForm]             = useState({ to: '', subject: '', message: '' });
  const [sendLoading, setSendLoading]       = useState(false);
  const [sendError, setSendError]           = useState('');
  const [sendSuccess, setSendSuccess]       = useState(false);
  const [sendIsReminder, setSendIsReminder] = useState(false);
  const [showAging, setShowAging] = useState(false);
  const [tab, setTab] = useState('invoices'); // 'invoices' | 'recurring'
  const [dismissedRecurPrompt, setDismissedRecurPrompt] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [confirmDupNumber, setConfirmDupNumber] = useState(false);
  const [confirmDeleteRecurId, setConfirmDeleteRecurId] = useState(null);
  const [sortKey, setSortKey] = useState('invoiceNumber');
  const [sortDir, setSortDir] = useState('desc');

  // ── Auto-open edit from ?edit=<id> (e.g. dashboard link) ─────────────────
  const searchParams = useSearchParams();
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || allInvoices.length === 0) return;
    const target = allInvoices.find(inv => inv.id === editId);
    if (target) openEdit(target);
    // Remove the query param so refreshing doesn't re-open
    window.history.replaceState(null, '', window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allInvoices.length]);

  // ── Recurring invoice state ───────────────────────
  const [showRecurModal, setShowRecurModal] = useState(false);
  const [recurEditId, setRecurEditId] = useState(null);
  const [recurForm, setRecurForm] = useState({ clientId: '', subject: '', frequency: 'monthly', nextDate: '', notes: '', active: true });
  const recurringInvoices = state.recurringInvoices || [];

  // ── Recurring due-prompt ─────────────────────────
  function advanceNextDate(dateStr, frequency) {
    if (!dateStr) return dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    switch (frequency) {
      case 'weekly':    d.setDate(d.getDate() + 7); break;
      case 'biweekly':  d.setDate(d.getDate() + 14); break;
      case 'monthly':   d.setMonth(d.getMonth() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'annual':    d.setFullYear(d.getFullYear() + 1); break;
      default:          d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  }

  const promptEnabled = state.settings?.recurringPromptEnabled !== false; // default on
  const dueTemplates = promptEnabled
    ? recurringInvoices.filter(r => r.active !== false && r.nextDate && r.nextDate <= today())
    : [];

  function createFromTemplate(template) {
    const client = (state.clients || []).find(c => c.id === template.clientId);
    const newInvoice = {
      ...makeBlankInvoice(hstRate, nextInvoiceNumber(allInvoices)),
      issueDate: today(),
      dueDate: addDays(today(), state.settings.defaultPaymentTerms ?? 30),
      notes: template.notes || '',
      ...(client ? {
        client: {
          name: client.name || '',
          email: client.email || '',
          address: client.address || '',
          city: client.city || '',
          province: client.province || '',
          postalCode: client.postalCode || '',
          phone: client.phone || '',
          hstNumber: client.hstNumber || '',
        },
      } : {}),
    };
    // Advance nextDate on the template
    dispatch({
      type: 'UPDATE_RECURRING_INVOICE',
      payload: { ...template, nextDate: advanceNextDate(template.nextDate, template.frequency) },
    });
    // Open the invoice form pre-filled
    setEditInv(null);
    setForm(newInvoice);
    setShowModal(true);
    toast({ message: `Creating invoice from "${template.subject || 'recurring template'}"`, detail: 'Template advanced to next cycle.' });
  }

  // ── Aging computation ────────────────────────────
  const agingBuckets = (() => {
    const todayStr = today();
    const unpaid = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status) && inv.dueDate);
    const buckets = { current: [], '1_30': [], '31_60': [], '61_90': [], '90plus': [] };
    for (const inv of unpaid) {
      const days = Math.floor((new Date(todayStr) - new Date(inv.dueDate)) / 86400000);
      if (days < 0)       buckets.current.push(inv);
      else if (days <= 30) buckets['1_30'].push(inv);
      else if (days <= 60) buckets['31_60'].push(inv);
      else if (days <= 90) buckets['61_90'].push(inv);
      else                 buckets['90plus'].push(inv);
    }
    return buckets;
  })();
  const agingTotal = inv => inv.reduce((s, i) => s + (i.total || 0), 0);

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

  const closeModal = () => { setShowModal(false); setEditInv(null); setImportSaveMode(false); };

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
  const doSave = () => {
    if (editInv) {
      dispatch({ type: 'UPDATE_INVOICE', payload: { ...form, id: editInv.id } });
      toast({ message: `Invoice #${form.invoiceNumber} updated` });
    } else {
      dispatch({ type: 'ADD_INVOICE', payload: form });
      const dateFy = fyLabelForDate(form.issueDate, state.fiscalYears);
      if (dateFy && state.activeFiscalYear !== 'all' && dateFy !== state.activeFiscalYear) {
        toast({
          message: `Invoice #${form.invoiceNumber} created`,
          detail: `Issue date is in ${dateFy} — switch fiscal years to see it there.`,
          type: 'info',
        });
      } else {
        toast({ message: `Invoice #${form.invoiceNumber} created`, detail: form.client?.name || undefined });
      }
    }
    if (importSaveMode) {
      const savedIdx = importIdx;
      setImportResults(prev => prev.map((r, i) => i === savedIdx ? { ...r, saved: true } : r));
      const nextUnsaved = importResults.findIndex((r, i) => i > savedIdx && !r.saved && !r.error);
      if (nextUnsaved >= 0) setImportIdx(nextUnsaved);
      setShowModal(false);
      setEditInv(null);
      setImportSaveMode(false);
    } else {
      closeModal();
    }
  };

  const handleSave = e => {
    e.preventDefault();
    if (isDuplicateNumber(form.invoiceNumber)) {
      setConfirmDupNumber(true);
      return;
    }
    doSave();
  };

  // ── Delete ────────────────────────────────────────
  const handleDelete = id => {
    dispatch({ type: 'DELETE_INVOICE', payload: id });
    setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    setConfirmDelete(null);
    toast({ message: 'Invoice deleted', type: 'info' });
  };

  // ── Mark paid ─────────────────────────────────────
  const markPaid = inv => {
    dispatch({ type: 'UPDATE_INVOICE', payload: { ...inv, status: 'paid', paidDate: today() } });
    toast({ message: `Invoice #${inv.invoiceNumber} marked as paid`, detail: `${formatCurrency(inv.total)} received` });
  };

  // ── Preview ───────────────────────────────────────
  const openPreview = async invoice => {
    const key = invoice.id || 'form';
    setPreviewLoading(key);
    try {
      const blob = await generateInvoicePDF(invoice, state.settings);
      const file = new File([blob], invoiceFilename(invoice, state.settings), { type: 'application/pdf' });
      const url = URL.createObjectURL(file);
      setPreviewInvoice(invoice);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (err) {
      toast({ message: 'Preview failed', detail: err.message, type: 'error' });
    } finally {
      setPreviewLoading(null);
    }
  };

  const closePreview = () => {
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPreviewInvoice(null);
  };

  // ── Send invoice / reminder ──────────────────────────────────────
  const openSendModal = (inv, isReminder = false) => {
    setSendInvoice(inv);
    setSendIsReminder(isReminder);
    setSendSuccess(false);
    setSendError('');
    setSendStep('compose');
    const clientEmail = inv.client?.email || '';
    const companyName = state.settings?.companyName || '';
    const subject = isReminder
      ? `Payment Reminder: Invoice #${inv.invoiceNumber} — ${companyName}`
      : `Invoice #${inv.invoiceNumber} from ${companyName}`;
    const dueDate = inv.dueDate
      ? new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const clientFirst = inv.client?.name?.split(' ')[0] || 'there';
    const message = isReminder
      ? `Hi ${clientFirst},\n\nThis is a friendly reminder that Invoice #${inv.invoiceNumber} for ${formatCurrency(inv.total)} was due on ${dueDate} and remains outstanding.\n\nPlease find the invoice attached. If you have already sent payment, please disregard this message.\n\nThank you,\n${companyName}`
      : `Hi ${clientFirst},\n\nPlease find your invoice attached for the amount of ${formatCurrency(inv.total)}, due on ${dueDate}.\n\nThank you for your business!\n\n${companyName}`;
    setSendForm({ to: clientEmail, subject, message });
    setShowSendModal(true);
  };

  const closeSendModal = () => {
    setShowSendModal(false);
    setSendInvoice(null);
    setSendSuccess(false);
    setSendError('');
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const handleSendEmail = async () => {
    if (!sendForm.to || !sendForm.subject) { setSendError('Recipient email and subject are required.'); return; }
    setSendLoading(true);
    setSendError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          invoice: sendInvoice,
          settings: state.settings,
          to: sendForm.to,
          subject: sendForm.subject,
          message: sendForm.message,
          isReminder: sendIsReminder,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to send');
      // Update invoice: mark as sent (if not already paid), record sent/reminder date
      const now = today();
      if (sendIsReminder) {
        const updated = {
          ...sendInvoice,
          remindersSent: [...(sendInvoice.remindersSent || []), now],
        };
        dispatch({ type: 'UPDATE_INVOICE', payload: updated });
      } else {
        const updated = {
          ...sendInvoice,
          status: sendInvoice.status === 'draft' ? 'sent' : sendInvoice.status,
          sentAt: sendInvoice.sentAt || now,
        };
        dispatch({ type: 'UPDATE_INVOICE', payload: updated });
      }
      setSendSuccess(true);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSendLoading(false);
    }
  };

  const openSendPreview = async () => {
    if (!sendInvoice) return;
    setSendStep('preview');
    setPreviewLoading('send');
    try {
      const blob = await generateInvoicePDF(sendInvoice, state.settings);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (err) {
      setSendError('Preview failed: ' + err.message);
    } finally {
      setPreviewLoading(null);
    }
  };

  // ── PDF download ──────────────────────────────────
  const handleDownloadPDF = async inv => {
    setPdfLoading(inv.id);
    try {
      await downloadInvoicePDF(inv, state.settings);
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ message: 'PDF generation failed', detail: err.message, type: 'error' });
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
      toast({ message: 'ZIP generation failed', detail: err.message, type: 'error' });
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
      const token = await user.getIdToken();
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd, headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const results = (data.results || []).map(r => {
        const p = r.parsed || {};
        const parsedItems = Array.isArray(p.lineItems) && p.lineItems.length > 0
          ? p.lineItems.map(li => ({
              id: uuidv4(),
              description: li.description || 'Services rendered',
              quantity: li.quantity ?? 1,
              rate: li.rate ?? 0,
              amount: li.amount ?? 0,
            }))
          : [{
              id: uuidv4(),
              description: p.description || 'Services rendered',
              quantity: 1,
              rate: p.subtotal || (p.total ? +(p.total / (1 + hstRate)).toFixed(2) : 0),
              amount: p.subtotal || (p.total ? +(p.total / (1 + hstRate)).toFixed(2) : 0),
            }];
        return {
          filename: r.filename,
          parsed: p,
          text: r.text,
          formData: {
            ...makeBlankInvoice(hstRate),
            invoiceNumber: p.documentNumber || '',
            issueDate: p.date || today(),
            dueDate: p.dueDate || p.date || today(),
            client: { name: p.client || '', email: '', address: '' },
            subtotal: p.subtotal || (p.total ? +(p.total / (1 + hstRate)).toFixed(2) : 0),
            hstAmount: p.hst || (p.subtotal ? +(p.subtotal * hstRate).toFixed(2) : 0),
            total: p.total || 0,
            lineItems: parsedItems,
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
    if (!result || result.error || result.saved) return;
    setForm(result.formData);
    setEditInv(null);
    setImportSaveMode(true);
    setShowModal(true);
    // Import modal auto-hides via isOpen={showImport && !showModal}
  };

  const handleSkipImport = () => {
    setImportIdx(i => Math.min(importResults.length - 1, i + 1));
  };

  // ── AI Enhance (invoice import) ───────────────────────────
  const enhanceImportWithAI = useCallback(async () => {
    const current = importResults[importIdx];
    if (!current || current.error || !current.text) {
      toast({ message: 'No text to enhance', type: 'error' });
      return;
    }
    setAiEnhancing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/parse-pdf-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: current.text, mode: 'invoice', filename: current.filename }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      const p = data.parsed || {};
      const parsedItems = Array.isArray(p.lineItems) && p.lineItems.length > 0
        ? p.lineItems.map(li => ({
            id: uuidv4(),
            description: li.description || 'Services rendered',
            quantity: li.quantity ?? 1,
            rate: li.rate ?? 0,
            amount: li.amount ?? 0,
          }))
        : current.formData.lineItems; // keep existing if AI found nothing
      const enhanced = {
        ...current,
        aiEnhanced: true,
        parsed: { ...current.parsed, ...p },
        formData: {
          ...current.formData,
          invoiceNumber: p.documentNumber || current.formData.invoiceNumber,
          issueDate: p.date || current.formData.issueDate,
          dueDate: p.dueDate || current.formData.dueDate,
          client: { ...current.formData.client, name: p.client || current.formData.client.name },
          subtotal: p.subtotal ?? current.formData.subtotal,
          hstAmount: p.hst ?? current.formData.hstAmount,
          total: p.total ?? current.formData.total,
          lineItems: parsedItems,
        },
      };
      setImportResults(prev => prev.map((r, i) => i === importIdx ? enhanced : r));
      toast({ message: 'AI enhancement complete', detail: `${parsedItems.length} line item${parsedItems.length !== 1 ? 's' : ''} extracted` });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('GEMINI_API_KEY') || msg.includes('503')) {
        toast({ message: 'AI not configured', detail: 'Add GEMINI_API_KEY to .env.local.', type: 'error' });
      } else {
        toast({ message: 'AI parsing failed', detail: msg, type: 'error' });
      }
    } finally {
      setAiEnhancing(false);
    }
  }, [importResults, importIdx, user, toast, hstRate]);

  // ── Bulk status change ────────────────────────────
  const handleBulkStatus = newStatus => {
    selected.forEach(id => {
      const inv = invoices.find(i => i.id === id);
      if (!inv) return;
      const update = { ...inv, status: newStatus };
      if (newStatus === 'paid' && !inv.paidDate) update.paidDate = today();
      dispatch({ type: 'UPDATE_INVOICE', payload: update });
    });
    setSelected(new Set());
  };

  // ── Filter & search ───────────────────────────────
  const invoiceYears = [...new Set(
    invoices.map(inv => inv.issueDate?.slice(0, 4)).filter(Boolean)
  )].sort((a, b) => b - a);

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || inv.invoiceNumber?.toLowerCase().includes(q)
      || inv.client?.name?.toLowerCase().includes(q)
      || inv.notes?.toLowerCase().includes(q);
    const matchYear  = yearFilter  === 'all' || inv.issueDate?.startsWith(yearFilter);
    const matchMonth = monthFilter === 'all' || inv.issueDate?.slice(5, 7) === monthFilter;
    return matchStatus && matchSearch && matchYear && matchMonth;
  });

  // ── Totals (converted to CAD using exchangeRateToCAD) ─────────────────
  const toCAD = (amount, inv) => (amount || 0) * (inv.exchangeRateToCAD || 1);
  const totals = {
    revenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + toCAD(i.subtotal, i), 0),
    outstanding: invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + toCAD(i.total, i), 0),
    hst: invoices.filter(i => ['sent', 'paid'].includes(i.status)).reduce((s, i) => s + toCAD(i.hstAmount, i), 0),
  };

  const currentImport = importResults[importIdx];
  const importSavedCount = importResults.filter(r => r.saved).length;
  const importTotalValid  = importResults.filter(r => !r.error).length;
  const allImportsDone    = importTotalValid > 0 && importSavedCount >= importTotalValid;

  // ── Sort ─────────────────────────────────────────
  const handleSort = key => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'invoiceNumber' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    switch (sortKey) {
      case 'invoiceNumber':
        aVal = parseInt(a.invoiceNumber, 10);
        bVal = parseInt(b.invoiceNumber, 10);
        if (isNaN(aVal) || isNaN(bVal)) {
          aVal = a.invoiceNumber || '';
          bVal = b.invoiceNumber || '';
        }
        break;
      case 'client':   aVal = a.client?.name?.toLowerCase() || ''; bVal = b.client?.name?.toLowerCase() || ''; break;
      case 'issueDate': aVal = a.issueDate || ''; bVal = b.issueDate || ''; break;
      case 'dueDate':   aVal = a.dueDate   || ''; bVal = b.dueDate   || ''; break;
      case 'total':     aVal = a.total     || 0;  bVal = b.total     || 0;  break;
      case 'status':    aVal = a.status    || ''; bVal = b.status    || ''; break;
      default:          aVal = 0; bVal = 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const pageStart  = (safePage - 1) * PAGE_SIZE;
  const paginated  = sorted.slice(pageStart, pageStart + PAGE_SIZE);

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

      {/* Recurring due-prompt banner */}
      {dueTemplates.length > 0 && !dismissedRecurPrompt && (
        <div className={styles.recurPrompt}>
          <div className={styles.recurPromptHeader}>
            <span className={styles.recurPromptIcon}>🔁</span>
            <strong>{dueTemplates.length} recurring invoice{dueTemplates.length !== 1 ? 's' : ''} due</strong>
            <button className={styles.recurPromptDismiss} onClick={() => setDismissedRecurPrompt(true)} title="Dismiss">✕</button>
          </div>
          <div className={styles.recurPromptList}>
            {dueTemplates.map(r => {
              const client = (state.clients || []).find(c => c.id === r.clientId);
              return (
                <div key={r.id} className={styles.recurPromptItem}>
                  <span className={styles.recurPromptLabel}>
                    <span className={styles.recurPromptSubject}>{r.subject || 'Untitled'}</span>
                    {client && <span className={styles.recurPromptClient}> · {client.name}</span>}
                    <span className={styles.recurPromptDate}> (due {formatDate(r.nextDate)})</span>
                  </span>
                  <Button size="sm" onClick={() => createFromTemplate(r)}>+ Create Invoice</Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={tab === 'invoices' ? styles.tabActive : styles.tab} onClick={() => setTab('invoices')}>Invoices</button>
        <button className={tab === 'recurring' ? styles.tabActive : styles.tab} onClick={() => setTab('recurring')}>Recurring <span className={styles.tabBadge}>{recurringInvoices.length}</span></button>
      </div>

      {tab === 'recurring' && (
        <div className={styles.recurringPanel}>
          <div className={styles.toolbar}>
            <div className={styles.filterRow}>
              <span className={styles.recurringTitle}>Recurring Invoice Templates</span>
              <div className={styles.toolbarActions}>
                <Button size="sm" onClick={() => { setRecurEditId(null); setRecurForm({ clientId: '', subject: '', frequency: 'monthly', nextDate: '', notes: '', active: true }); setShowRecurModal(true); }}>+ New Template</Button>
              </div>
            </div>
          </div>
          {recurringInvoices.length === 0 ? (
            <EmptyState icon="🔁" title="No recurring templates" description="Set up recurring invoice templates to stay on schedule." action={<Button onClick={() => { setRecurEditId(null); setRecurForm({ clientId: '', subject: '', frequency: 'monthly', nextDate: '', notes: '', active: true }); setShowRecurModal(true); }}>+ New Template</Button>} />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Subject</th>
                    <th>Frequency</th>
                    <th>Next Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recurringInvoices.map(r => {
                    const client = (state.clients || []).find(c => c.id === r.clientId);
                    return (
                      <tr key={r.id}>
                        <td>{client?.name || r.clientId || '—'}</td>
                        <td>{r.subject || '—'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{r.frequency}</td>
                        <td>{formatDate(r.nextDate)}</td>
                        <td><span className={r.active ? styles.statusPaid : styles.statusDraft}>{r.active ? 'Active' : 'Paused'}</span></td>
                        <td className={styles.right}>
                          <Button variant="ghost" size="sm" onClick={() => { setRecurEditId(r.id); setRecurForm({ clientId: r.clientId || '', subject: r.subject || '', frequency: r.frequency || 'monthly', nextDate: r.nextDate || '', notes: r.notes || '', active: r.active !== false }); setShowRecurModal(true); }}>Edit</Button>
                          <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDeleteRecurId(r.id)}>Delete</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recurring Invoice Modal */}
      {showRecurModal && (
        <Modal title={recurEditId ? 'Edit Recurring Template' : 'New Recurring Template'} onClose={() => setShowRecurModal(false)}>
          <form onSubmit={e => {
            e.preventDefault();
            if (recurEditId) {
              dispatch({ type: 'UPDATE_RECURRING_INVOICE', payload: { id: recurEditId, ...recurForm } });
            } else {
              dispatch({ type: 'ADD_RECURRING_INVOICE', payload: { id: crypto.randomUUID(), ...recurForm } });
            }
            setShowRecurModal(false);
          }}>
            <div className={styles.formGrid}>
              <label className={styles.formLabel}>Client</label>
              <Select value={recurForm.clientId} onChange={e => setRecurForm(f => ({ ...f, clientId: e.target.value }))} required>
                <option value="">Select client…</option>
                {(state.clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <label className={styles.formLabel}>Subject / Description</label>
              <input className={styles.input} value={recurForm.subject} onChange={e => setRecurForm(f => ({ ...f, subject: e.target.value }))} placeholder="Monthly retainer" required />
              <label className={styles.formLabel}>Frequency</label>
              <Select value={recurForm.frequency} onChange={e => setRecurForm(f => ({ ...f, frequency: e.target.value }))}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </Select>
              <label className={styles.formLabel}>Next Invoice Date</label>
              <input type="date" className={styles.input} value={recurForm.nextDate} onChange={e => setRecurForm(f => ({ ...f, nextDate: e.target.value }))} required />
              <label className={styles.formLabel}>Notes</label>
              <input className={styles.input} value={recurForm.notes} onChange={e => setRecurForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              <label className={styles.formLabel}>Active</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={recurForm.active} onChange={e => setRecurForm(f => ({ ...f, active: e.target.checked }))} />
                Send reminders for this template
              </label>
            </div>
            <div className={styles.formActions}>
              <Button type="button" variant="secondary" onClick={() => setShowRecurModal(false)}>Cancel</Button>
              <Button type="submit">{recurEditId ? 'Save Changes' : 'Create Template'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {tab === 'invoices' && (
      <>

      {/* Aging Report */}
      {showAging && (
        <div className={styles.agingPanel}>
          <div className={styles.agingTitle}>Accounts Receivable Aging</div>
          <div className={styles.agingGrid}>
            {[
              { label: 'Current', key: 'current', color: 'var(--success)' },
              { label: '1–30 days', key: '1_30', color: 'var(--warning, #f59e0b)' },
              { label: '31–60 days', key: '31_60', color: 'var(--warning, #f59e0b)' },
              { label: '61–90 days', key: '61_90', color: 'var(--danger)' },
              { label: '90+ days', key: '90plus', color: 'var(--danger)' },
            ].map(({ label, key, color }) => (
              <div key={key} className={styles.agingBucket}>
                <div className={styles.agingBucketLabel}>{label}</div>
                <div className={styles.agingBucketCount}>{agingBuckets[key].length} invoice{agingBuckets[key].length !== 1 ? 's' : ''}</div>
                <div className={styles.agingBucketTotal} style={{ color }}>{formatCurrency(agingTotal(agingBuckets[key]))}</div>
              </div>
            ))}
          </div>
          {agingBuckets['1_30'].concat(agingBuckets['31_60'], agingBuckets['61_90'], agingBuckets['90plus']).length > 0 && (
            <table className={styles.agingTable}>
              <thead><tr><th>Invoice #</th><th>Client</th><th>Due</th><th>Days Overdue</th><th className={styles.right}>Total</th></tr></thead>
              <tbody>
                {agingBuckets['1_30'].concat(agingBuckets['31_60'], agingBuckets['61_90'], agingBuckets['90plus'])
                  .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1))
                  .map(inv => {
                    const days = Math.floor((new Date(today()) - new Date(inv.dueDate)) / 86400000);
                    return (
                      <tr key={inv.id}>
                        <td>#{inv.invoiceNumber}</td>
                        <td>{inv.client?.name || '—'}</td>
                        <td>{formatDate(inv.dueDate)}</td>
                        <td style={{ color: days > 60 ? 'var(--danger)' : 'var(--warning, #f59e0b)', fontWeight: 600 }}>{days}d</td>
                        <td className={styles.right}>{formatCurrency(inv.total)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Main row: search + filters + action buttons all on one line */}
        <div className={styles.filterRow}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search invoices…"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          <Select value={statusFilter} onChange={e => { setStatus(e.target.value); setCurrentPage(1); }} className={styles.filterSelect}>
            <option value="all">All statuses</option>
            {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter('all'); setCurrentPage(1); }} className={styles.filterSelect}>
            <option value="all">All years</option>
            {invoiceYears.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          {yearFilter !== 'all' && (
            <Select value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setCurrentPage(1); }} className={styles.filterSelect}>
              <option value="all">All months</option>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-CA', { month: 'long' })}</option>
              ))}
            </Select>
          )}
          <div className={styles.toolbarActions}>
            {filtered.length > 0 && (
              <Button
                variant="secondary" size="sm"
                onClick={handleDownloadZIP}
                loading={zipLoading}
                title={selected.size > 0 ? `Download ${selected.size} selected as ZIP` : `Download all ${filtered.length} as ZIP`}
              >
                ⬇ {selected.size > 0 ? `ZIP (${selected.size})` : `ZIP (${filtered.length})`}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => exportInvoicesCSV(state, state.activeFiscalYear !== 'all' ? state.activeFiscalYear : Object.keys(state.fiscalYears).sort().pop())}>
              ⬇ CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAging(v => !v)}>
              {showAging ? '✕ Aging' : '📅 Aging'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setImportResults([]); setImportIdx(0); setShowImport(true); }}>
              📎 Import PDFs
            </Button>
            <Button size="sm" onClick={openCreate}>+ New Invoice</Button>
          </div>
        </div>

        {/* Bulk-select row — only visible when rows are checked */}
        {selected.size > 0 && (
          <div className={styles.bulkActions}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <Select
              className={styles.filterSelect}
              defaultValue=""
              onChange={e => { if (e.target.value) { handleBulkStatus(e.target.value); e.target.value = ''; } }}
            >
              <option value="" disabled>Change status…</option>
              {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        )}
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
                  <SortTh label="Invoice #" colKey="invoiceNumber" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Client"    colKey="client"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Date"      colKey="issueDate"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Due"       colKey="dueDate"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className={styles.right}>Subtotal</th>
                  <th className={styles.right}>HST</th>
                  <SortTh label="Total"  colKey="total"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className={styles.right} />
                  <SortTh label="Status" colKey="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(inv => (
                  <tr key={inv.id} className={`${styles.tableRow} ${selected.has(inv.id) ? styles.rowSelected : ''}`}>
                    <td className={styles.checkCell}>
                      <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
                    </td>
                    <td className={styles.invNum}>{inv.invoiceNumber}</td>
                    <td>{inv.client?.name || '—'}</td>
                    <td>{formatDate(inv.issueDate)}</td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td className={styles.right}>{formatCurrency(inv.subtotal)}</td>
                    <td className={styles.right}>{formatCurrency(inv.hstAmount)}</td>
                    <td className={`${styles.right} ${styles.totalCell}`}>
                      {formatCurrency(inv.total)}
                      {inv.currency && inv.currency !== 'CAD' && (
                        <span className={styles.currencyBadge}>{inv.currency}</span>
                      )}
                    </td>
                    <td><Badge color={STATUS_COLORS[inv.status]}>{inv.status}</Badge></td>
                    <td>
                      <div className={styles.rowActions}>
                        {inv.status !== 'paid' && inv.status !== 'void' && (
                          <Button variant="ghost" size="xs" onClick={() => markPaid(inv)}>✓ Paid</Button>
                        )}
                        <Button variant="ghost" size="xs" onClick={() => openSendModal(inv)} title="Send invoice by email">✉ Send</Button>
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <Button variant="ghost" size="xs" onClick={() => openSendModal(inv, true)} title="Send payment reminder">🔔 Remind</Button>
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
            {paginated.map(inv => (
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
                  <span>{formatDate(inv.issueDate)}</span>
                  <span className={styles.mobileTotal}>{formatCurrency(inv.total)}</span>
                </div>
                <div className={styles.mobileActions}>
                  {inv.status !== 'paid' && inv.status !== 'void' && (
                    <Button variant="secondary" size="xs" onClick={() => markPaid(inv)}>✓ Paid</Button>
                  )}
                  <Button variant="secondary" size="xs" onClick={() => openSendModal(inv)}>✉ Send</Button>
                  {(inv.status === 'sent' || inv.status === 'overdue') && (
                    <Button variant="secondary" size="xs" onClick={() => openSendModal(inv, true)}>🔔 Remind</Button>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setCurrentPage(1)} disabled={safePage === 1}>«</button>
          <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === '…'
                ? <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>…</span>
                : <button key={p} className={`${styles.pageBtn} ${p === safePage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
            )
          }
          <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
          <button className={styles.pageBtn} onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}>»</button>
          <span className={styles.pageInfo}>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sorted.length)} of {sorted.length}</span>
        </div>
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
            {form.status === 'paid' && (
              <FormField label="Paid Date">
                <Input type="date" value={form.paidDate} onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))} />
              </FormField>
            )}
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
                  <div className={styles.liDescWrap}>
                    <input
                      className={styles.liDesc}
                      placeholder="Description"
                      value={li.description}
                      autoComplete="off"
                      onChange={e => {
                        updateLineItem(idx, 'description', e.target.value);
                      }}
                      onFocus={() => setOpenDescIdx(idx)}
                      onBlur={() => setTimeout(() => setOpenDescIdx(null), 150)}
                    />
                    {openDescIdx === idx && products.length > 0 && (() => {
                      const q = li.description.toLowerCase();
                      const suggestions = q
                        ? products.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
                        : products;
                      if (!suggestions.length) return null;
                      return (
                        <div className={styles.liDescDropdown}>
                          {suggestions.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className={styles.liDescOption}
                              onMouseDown={() => {
                                const newRate = (p.defaultRate != null && p.defaultRate !== '')
                                  ? parseFloat(p.defaultRate) || 0
                                  : null;
                                const items = form.lineItems.map((li, i) => {
                                  if (i !== idx) return li;
                                  const updated = { ...li, description: p.name };
                                  if (newRate !== null) {
                                    updated.rate = newRate;
                                    updated.amount = parseFloat(updated.quantity || 0) * newRate;
                                  }
                                  return updated;
                                });
                                recalcTotals(items);
                                setOpenDescIdx(null);
                              }}
                            >
                              <span className={styles.liDescOptionName}>{p.name}</span>
                              {p.description && <span className={styles.liDescOptionSub}>{p.description}</span>}
                            </button>
                          ))}
                        </div>
                      );
                    })()}</div>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', margin: '0 0 0.75rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>Currency</label>
            <Select
              value={form.currency || 'CAD'}
              style={{ width: '6rem' }}
              onChange={async e => {
                const cur = e.target.value;
                setForm(f => ({ ...f, currency: cur, exchangeRateToCAD: cur === 'CAD' ? 1 : f.exchangeRateToCAD }));
                if (cur !== 'CAD') {
                  setRateLoading(true);
                  try {
                    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${cur}&to=CAD`);
                    const data = await res.json();
                    if (data.rates?.CAD) setForm(f => ({ ...f, exchangeRateToCAD: data.rates.CAD }));
                  } catch { /* silent — user can edit manually */ }
                  finally { setRateLoading(false); }
                }
              }}
            >
              {['CAD','USD','EUR','GBP','AUD','MXN','JPY','CHF','CNY'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            {(form.currency && form.currency !== 'CAD') && (
              <>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>1 {form.currency} =</span>
                <Input
                  type="number" min="0" step="any"
                  value={form.exchangeRateToCAD || ''}
                  onChange={e => setForm(f => ({ ...f, exchangeRateToCAD: parseFloat(e.target.value) || 1 }))}
                  placeholder={rateLoading ? 'Fetching…' : 'Rate'}
                  style={{ width: '6rem' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CAD</span>
              </>
            )}
          </div>

          <FormField label="Notes">
            <Textarea placeholder="Optional notes or references…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </FormField>
        </form>
      </Modal>

      {/* ── Multi-PDF Import Modal ── */}
      <Modal isOpen={showImport && !showModal} onClose={() => setShowImport(false)} title="Import Invoices from PDF" size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>
              {allImportsDone ? 'Done ✓' : 'Close'}
            </Button>
            {importResults.length > 1 && (
              <div className={styles.importNav}>
                <Button variant="secondary" size="xs" onClick={() => setImportIdx(i => Math.max(0, i - 1))} disabled={importIdx === 0}>←</Button>
                <span>{importIdx + 1} / {importResults.length}</span>
                <Button variant="secondary" size="xs" onClick={() => setImportIdx(i => Math.min(importResults.length - 1, i + 1))} disabled={importIdx === importResults.length - 1}>→</Button>
              </div>
            )}
            {currentImport && !currentImport.error && !currentImport.saved && (
              <>
                {importResults.length > 1 && (
                  <Button variant="secondary" onClick={handleSkipImport} disabled={importIdx === importResults.length - 1}>Skip</Button>
                )}
                <Button onClick={handleUseImported}>Edit &amp; Save →</Button>
              </>
            )}
            {currentImport?.saved && (
              <span className={styles.importSavedBadge}>✅ Saved</span>
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
                    <p className={styles.importPreviewTitle}>
                      {currentImport?.saved ? '✅ Saved: ' : '📄 Extracted from: '}
                      <strong>{currentImport?.filename}</strong>
                    </p>
                    <div className={styles.importPreviewActions}>
                      {currentImport?.aiEnhanced && <span className={styles.aiBadge}>✦ AI Enhanced</span>}
                      {!currentImport?.saved && (
                        <button
                          className={styles.aiBtn}
                          onClick={enhanceImportWithAI}
                          disabled={aiEnhancing}
                          title="Re-parse this invoice with AI for better field extraction"
                        >
                          {aiEnhancing ? '…' : '✦ Enhance with AI'}
                        </button>
                      )}
                    </div>
                    {importTotalValid > 1 && (
                      <p className={styles.importProgress}>{importSavedCount} of {importTotalValid} saved</p>
                    )}
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
        footer={<>
          <Button variant="secondary" onClick={closePreview}>Close</Button>
          {previewInvoice && (
            <Button onClick={() => downloadInvoicePDF(previewInvoice, state.settings)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'0.35rem'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download PDF
            </Button>
          )}
        </>}
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

      {/* ── Confirm Duplicate Invoice Number ── */}
      <Modal isOpen={confirmDupNumber} onClose={() => setConfirmDupNumber(false)} title="Duplicate Invoice Number" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDupNumber(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmDupNumber(false); doSave(); }}>Save Anyway</Button>
          </>
        }
      >
        <p className={styles.confirmText}>Invoice #{form.invoiceNumber} already exists. Do you want to save a duplicate?</p>
      </Modal>

      {/* ── Confirm Delete Recurring Template ── */}
      <Modal isOpen={!!confirmDeleteRecurId} onClose={() => setConfirmDeleteRecurId(null)} title="Delete Recurring Template?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteRecurId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { dispatch({ type: 'DELETE_RECURRING_INVOICE', payload: confirmDeleteRecurId }); setConfirmDeleteRecurId(null); }}>Delete</Button>
          </>
        }
      >
        <p className={styles.confirmText}>This recurring template will be permanently deleted.</p>
      </Modal>

      {/* ── Send Invoice / Reminder Modal ── */}
      <Modal
        isOpen={showSendModal}
        onClose={closeSendModal}
        title={sendIsReminder ? `Send Reminder — Invoice #${sendInvoice?.invoiceNumber}` : `Send Invoice #${sendInvoice?.invoiceNumber}`}
        size="lg"
        footer={
          sendSuccess ? (
            <Button onClick={closeSendModal}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeSendModal}>Cancel</Button>
              {sendStep === 'preview' ? (
                <>
                  <Button variant="secondary" onClick={() => setSendStep('compose')}>← Back to Compose</Button>
                  <Button onClick={() => downloadInvoicePDF(sendInvoice, state.settings)}>⬇ Download PDF</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={openSendPreview} loading={previewLoading === 'send'}>
                    👁 Preview PDF
                  </Button>
                  <Button variant="secondary" onClick={() => { closeSendModal(); openEdit(sendInvoice); }}>
                    ✏ Edit Invoice
                  </Button>
                  <Button onClick={handleSendEmail} loading={sendLoading}>
                    ✉ {sendIsReminder ? 'Send Reminder' : 'Send Invoice'}
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        {sendSuccess ? (
          <div className={styles.sendSuccess}>
            <span className={styles.sendSuccessIcon}>✅</span>
            <p>{sendIsReminder ? 'Reminder sent successfully!' : 'Invoice sent successfully!'}</p>
            {sendIsReminder && <p className={styles.sendSuccessNote}>Reminder recorded on the invoice.</p>}
          </div>
        ) : sendStep === 'preview' ? (
          <div className={styles.previewBody}>
            {previewUrl && <iframe src={previewUrl} className={styles.previewFrame} title="Invoice Preview" />}
          </div>
        ) : (
          <div className={styles.sendForm}>
            {sendIsReminder && sendInvoice?.remindersSent?.length > 0 && (
              <p className={styles.sendReminderNote}>
                Previous reminders sent: {sendInvoice.remindersSent.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })).join(', ')}
              </p>
            )}
            <FormField label="To (recipient email)" required>
              <Input
                type="email"
                placeholder="client@example.com"
                value={sendForm.to}
                onChange={e => setSendForm(f => ({ ...f, to: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Subject">
              <Input
                value={sendForm.subject}
                onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))}
              />
            </FormField>
            <FormField label="Message">
              <Textarea
                rows={8}
                value={sendForm.message}
                onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
              />
            </FormField>
            {sendError && <p className={styles.sendError}>{sendError}</p>}
            <p className={styles.sendNote}>The invoice PDF will be attached automatically.</p>
          </div>
        )}
      </Modal>
      </>
      )}
    </div>
  );
}

function SortTh({ label, colKey, sortKey, sortDir, onSort, className }) {
  const active = sortKey === colKey;
  return (
    <th
      className={[styles.sortableTh, active ? styles.sortableThActive : '', className].filter(Boolean).join(' ')}
      onClick={() => onSort(colKey)}
    >
      {label}
      <span className={styles.sortIndicator}>
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
      </span>
    </th>
  );
}
