// InvoiceDocument.js — @react-pdf/renderer invoice template
// Import this only client-side via dynamic import

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const INK      = '#0f1117';   // near-black for primary text
const MUTED    = '#6B7280';   // secondary / labels
const RULE     = '#D1D5DB';   // light rule lines
const ACCENT   = '#0f1117';   // header rule — charcoal, not blue

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

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 80,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: INK,
    lineHeight: 1.45,
  },

  // ── Header: logo left, company right ────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT,
  },
  logo: {
    width: 140,
    height: 64,
    objectFit: 'contain',
    objectPosition: 'left center',
  },
  companyNameOnly: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    color: INK,
    letterSpacing: 0.5,
  },
  companyBlock: {
    alignItems: 'flex-end',
    maxWidth: 230,
  },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: INK,
    marginBottom: 4,
  },
  companyDetail: {
    color: MUTED,
    fontSize: 8.5,
    marginBottom: 1.5,
    textAlign: 'right',
  },
  hstLine: {
    color: MUTED,
    fontSize: 8.5,
    marginTop: 5,
    textAlign: 'right',
  },

  // ── Invoice title + meta ─────────────────────────────
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 28,
  },
  invoiceTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 28,
    color: INK,
    letterSpacing: 4,
  },
  metaBlock: {
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
    gap: 10,
  },
  metaLabel: {
    color: MUTED,
    fontSize: 8,
    width: 58,
    textAlign: 'right',
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    color: INK,
    fontSize: 8,
    width: 95,
    textAlign: 'right',
  },

  // ── Bill To ──────────────────────────────────────────
  billSection: {
    marginBottom: 24,
  },
  billLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  billName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: INK,
    marginBottom: 3,
  },
  billDetail: {
    color: MUTED,
    fontSize: 8.5,
    marginBottom: 2,
  },

  // ── Table ────────────────────────────────────────────
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  colHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  colCell: {
    fontSize: 9,
    color: INK,
  },
  colDesc: { flex: 1 },
  colQty:  { width: 36, textAlign: 'center' },
  colRate: { width: 76, textAlign: 'right' },
  colAmt:  { width: 76, textAlign: 'right' },

  // ── Totals ───────────────────────────────────────────
  totalsWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  totalLabel: {
    color: MUTED,
    fontSize: 8.5,
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: INK,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 2,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: INK,
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: INK,
  },

  // ── Notes ────────────────────────────────────────────
  notesSection: {
    marginTop: 28,
  },
  notesLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  notesText: {
    color: '#374151',
    lineHeight: 1.6,
  },

  // ── Footer ───────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    right: 52,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 1.6,
  },
});

export default function InvoiceDocument({ invoice, settings }) {
  const inv = invoice || {};
  const cfg = settings || {};
  const lineItems = inv.lineItems || [];

  const taxRate  = inv.hstRate ?? 0.13;
  const taxLabel = inv.taxType === 'gst'     ? `GST (5%)`
                 : inv.taxType === 'gst_qst' ? `GST+QST (14.975%)`
                 : inv.taxType === 'none'    ? null
                 : inv.taxType === 'custom'  ? `Tax (${(taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%)`
                 : cfg.province === 'QC'     ? `QST (9.975%)`
                 : `HST (${Math.round(taxRate * 100)}%)`;

  const companyDetails = [
    cfg.address,
    [cfg.city, cfg.province, cfg.postalCode].filter(Boolean).join(', '),
    cfg.phone,
    cfg.website,
  ].filter(Boolean);

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── Header: Logo/Name left, company details right ── */}
        <View style={s.header}>
          <View>
            {cfg.logo ? (
              <Image src={cfg.logo} style={s.logo} />
            ) : (
              <Text style={s.companyNameOnly}>{cfg.companyName || 'Your Company'}</Text>
            )}
          </View>
          <View style={s.companyBlock}>
            {cfg.logo && cfg.companyName && (
              <Text style={s.companyName}>{cfg.companyName}</Text>
            )}
            {companyDetails.map((line, i) => (
              <Text key={i} style={s.companyDetail}>{line}</Text>
            ))}
            {cfg.hstNumber && (
              <Text style={s.hstLine}>HST No. {cfg.hstNumber}</Text>
            )}
          </View>
        </View>

        {/* ── "INVOICE" title + invoice meta ── */}
        <View style={s.titleRow}>
          <Text style={s.invoiceTitle}>INVOICE</Text>
          <View style={s.metaBlock}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Invoice #</Text>
              <Text style={s.metaValue}>{inv.invoiceNumber || '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{fmtDate(inv.issueDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Due Date</Text>
              <Text style={s.metaValue}>{fmtDate(inv.dueDate)}</Text>
            </View>
          </View>
        </View>

        {/* ── Bill To ── */}
        <View style={s.billSection}>
          <Text style={s.billLabel}>Bill To</Text>
          <Text style={s.billName}>{inv.client?.name || '—'}</Text>
          {inv.client?.address && (
            <Text style={s.billDetail}>{inv.client.address}</Text>
          )}
          {inv.client?.city && (
            <Text style={s.billDetail}>
              {[inv.client.city, inv.client.province, inv.client.postalCode].filter(Boolean).join(', ')}
            </Text>
          )}
          {inv.client?.email && (
            <Text style={s.billDetail}>{inv.client.email}</Text>
          )}
          {inv.client?.phone && (
            <Text style={s.billDetail}>{inv.client.phone}</Text>
          )}
          {inv.client?.hstNumber && (
            <Text style={s.billDetail}>HST No. {inv.client.hstNumber}</Text>
          )}
        </View>

        {/* ── Line items table ── */}
        <View style={s.tableHeaderRow}>
          <Text style={[s.colDesc, s.colHeader]}>Description</Text>
          <Text style={[s.colQty, s.colHeader]}>Qty</Text>
          <Text style={[s.colRate, s.colHeader]}>Rate</Text>
          <Text style={[s.colAmt, s.colHeader]}>Amount</Text>
        </View>
        {lineItems.map((li, idx) => (
          <View key={li.id || idx} style={s.tableRow}>
            <Text style={[s.colDesc, s.colCell]}>{li.description || '—'}</Text>
            <Text style={[s.colQty, s.colCell]}>{li.quantity ?? 1}</Text>
            <Text style={[s.colRate, s.colCell]}>{fmtCurrency(li.rate)}</Text>
            <Text style={[s.colAmt, s.colCell]}>{fmtCurrency(li.amount)}</Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={s.totalsWrapper}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmtCurrency(inv.subtotal)}</Text>
            </View>
            {inv.hstAmount > 0 && taxLabel && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>{taxLabel}</Text>
                <Text style={s.totalValue}>{fmtCurrency(inv.hstAmount)}</Text>
              </View>
            )}
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>TOTAL DUE</Text>
              <Text style={s.grandTotalValue}>{fmtCurrency(inv.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Invoice notes ── */}
        {inv.notes && (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{inv.notes}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        {cfg.invoiceFooterNotes && (
          <View style={s.footer}>
            <Text style={s.footerText}>{cfg.invoiceFooterNotes}</Text>
          </View>
        )}

      </Page>
    </Document>
  );
}

