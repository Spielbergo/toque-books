import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { verifyToken } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/rateLimit';

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 }); // 10 emails/min per IP

export async function POST(request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await verifyToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Rate limit ────────────────────────────────────────────────────
    // x-real-ip is set by Vercel and cannot be spoofed; fall back to last
    // entry in x-forwarded-for (appended by trusted proxy, not the client)
    const ip = request.headers.get('x-real-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
      ?? 'unknown';
    if (!limiter.check(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { invoice, settings, to, subject, message, isReminder } = body;

    if (!to || !subject || !invoice) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, invoice' }, { status: 400 });
    }

    // Validate recipient email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set in .env.local');
    }

    // Generate PDF attachment server-side using @react-pdf/renderer
    const pdfBuffer = await generatePDFBuffer(invoice, settings);

    const fromName  = settings?.companyName || 'Invoice';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'invoices@resend.dev';
    const replyTo   = settings?.email || undefined;
    const filename  = buildFilename(invoice, settings);

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      reply_to: replyTo,
      to,
      subject,
      text: message || '',
      html: buildHtmlBody(message, invoice, settings, isReminder),
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('send-invoice error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generatePDFBuffer(invoice, settings) {
  const { pdf }                        = await import('@react-pdf/renderer');
  const { default: InvoiceDocument }   = await import('@/components/InvoiceDocument');
  const { createElement }              = await import('react');

  const blob       = await pdf(createElement(InvoiceDocument, { invoice, settings })).toBlob();
  const arrayBuf   = await blob.arrayBuffer();
  return Buffer.from(arrayBuf);
}

function buildFilename(invoice, settings) {
  const co  = (settings?.companyName || 'Invoice')
    .replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const num  = invoice.invoiceNumber || 'invoice';
  const date = invoice.issueDate     || '';
  return `${co}_Invoice_${num}_${date}.pdf`;
}

function fmtCurrency(amount) {
  if (amount == null || isNaN(amount)) return '$0.00';
  const abs = Math.abs(Number(amount));
  const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (amount < 0 ? '-$' : '$') + formatted;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function buildHtmlBody(message, invoice, settings, isReminder) {
  const company   = escapeHtml(settings?.companyName || 'Us');
  const invNum    = escapeHtml(invoice.invoiceNumber || '');
  const dueDate   = escapeHtml(fmtDate(invoice.dueDate));
  const total     = fmtCurrency(invoice.total); // generated, safe
  const msgHtml   = escapeHtml(message || '').replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .header  { background: #111827; color: #fff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 2px; }
    .header p  { margin: 6px 0 0; font-size: 13px; opacity: 0.7; }
    .body    { padding: 28px 32px; }
    .body p  { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #374151; }
    .summary { background: #f3f4f6; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .summary-row:last-child { margin-bottom: 0; font-weight: 700; font-size: 14px; }
    .footer  { padding: 16px 32px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${isReminder ? 'PAYMENT REMINDER' : 'INVOICE'}</h1>
      <p>From ${company}</p>
    </div>
    <div class="body">
      ${msgHtml ? `<p>${msgHtml}</p>` : ''}
      <div class="summary">
        ${invNum ? `<div class="summary-row"><span>Invoice #</span><span>${invNum}</span></div>` : ''}
        ${dueDate ? `<div class="summary-row"><span>Due Date</span><span>${dueDate}</span></div>` : ''}
        <div class="summary-row"><span>Amount Due</span><span>${total}</span></div>
      </div>
      <p style="font-size:13px;color:#6b7280;">Your invoice is attached as a PDF.</p>
    </div>
    <div class="footer">
      ${settings?.invoiceFooterNotes ? escapeHtml(settings.invoiceFooterNotes) : `Questions? Contact ${escapeHtml(settings?.email || '') || company}.`}
    </div>
  </div>
</body>
</html>`;
}
