// InvoiceDocument.js — @react-pdf/renderer invoice template
// Import this only client-side via dynamic import

import { Document, Page, View, Text, Image, StyleSheet, Link } from '@react-pdf/renderer';

const INK           = '#111827';
const MUTED         = '#6B7280';
const RULE          = '#E5E7EB';
const TABLE_HEAD_BG = '#111827';
const TABLE_HEAD_FG = '#FFFFFF';
const AMT_DUE_BG    = '#F3F4F6';

const CURRENCY_SYMBOLS = {
  CAD: 'CA$', USD: 'US$', EUR: '€', GBP: '£', AUD: 'A$',
  MXN: 'MX$', JPY: '¥', CHF: 'CHF ', CNY: 'CN¥',
};

function fmtAmt(amount, currency) {
  if (amount == null || isNaN(amount)) return (CURRENCY_SYMBOLS[currency] || (currency + ' ')) + '0.00';
  const sym = CURRENCY_SYMBOLS[currency] || (currency + ' ');
  const abs = Math.abs(Number(amount));
  const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (amount < 0 ? '-' : '') + sym + formatted;
}

function fmtPhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw; // return as-is if format is unexpected
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 72,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: INK,
    lineHeight: 1.5,
  },

  // ── Top row: logo left / INVOICE + company right ──────────────────────
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    width: 160,
    height: 72,
    objectFit: 'contain',
    objectPosition: 'left top',
  },
  companyNameOnly: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: INK,
    letterSpacing: 0.5,
  },
  rightHeader: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 40,
    color: INK,
    letterSpacing: 4,
    lineHeight: 1,
    marginBottom: 6,
  },
  companyNameRight: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: INK,
    letterSpacing: 0.5,
  },
  companyDetailRight: {
    fontSize: 8.5,
    color: MUTED,
    textAlign: 'right',
    marginTop: 2,
  },
  companyLinkRight: {
    fontSize: 8.5,
    color: MUTED,
    textAlign: 'right',
    marginTop: 2,
    textDecoration: 'none',
  },

  // ── Horizontal rule ───────────────────────────────────────────────────
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    marginTop: 20,
    marginBottom: 24,
  },

  // ── Info row: Bill To left / Meta box right ───────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  billSection: {
    flex: 1,
    paddingRight: 24,
  },
  billLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  billName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: INK,
    marginBottom: 3,
  },
  billContactName: {
    fontSize: 8.5,
    color: INK,
    marginBottom: 2,
  },
  billDetail: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 2,
  },

  // ── Meta box ──────────────────────────────────────────────────────────
  metaBox: {
    width: 240,
    borderWidth: 1,
    borderColor: RULE,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  metaRowHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: AMT_DUE_BG,
  },
  metaLabel: {
    fontSize: 8.5,
    color: MUTED,
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: INK,
  },
  metaAmtLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: INK,
  },
  metaAmtValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: INK,
  },

  // ── Table ─────────────────────────────────────────────────────────────
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: TABLE_HEAD_BG,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  colHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: TABLE_HEAD_FG,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  colCell: {
    fontSize: 9,
    color: INK,
  },
  colDesc:  { flex: 1 },
  colQty:   { width: 60, textAlign: 'center' },
  colPrice: { width: 76, textAlign: 'right' },
  colAmt:   { width: 76, textAlign: 'right' },

  // ── Totals ────────────────────────────────────────────────────────────
  totalsWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  totalsBox: {
    width: 240,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
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
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: RULE,
    marginVertical: 3,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: INK,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: INK,
  },
  amtDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
    paddingBottom: 3,
  },
  amtDueLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: INK,
  },
  amtDueValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: INK,
  },

  // ── Notes / Terms ─────────────────────────────────────────────────────
  notesSection: {
    marginTop: 32,
  },
  notesLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: INK,
    marginBottom: 5,
  },
  notesText: {
    fontSize: 8.5,
    color: MUTED,
    lineHeight: 1.6,
  },

  // ── Footer ────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 52,
    right: 52,
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
  const currency = inv.currency || 'CAD';
  const isForeign = currency !== 'CAD';
  const rate = inv.exchangeRateToCAD || 1;
  // Shorthand: format in invoice currency
  const fmt = amount => fmtAmt(amount, currency);

  const taxRate  = inv.hstRate ?? 0.13;
  const taxPct   = (taxRate * 100).toFixed(3).replace(/\.?0+$/, '');
  const taxLabel = inv.taxType === 'gst'     ? `GST 5%`
                 : inv.taxType === 'gst_qst' ? `GST+QST 14.975%`
                 : inv.taxType === 'none'    ? null
                 : inv.taxType === 'custom'  ? `Tax ${taxPct}%`
                 : cfg.province === 'QC'     ? `QST 9.975%`
                 : `HST ${taxPct}%`;

  // Format phone for display
  const displayPhone = cfg.phone ? fmtPhone(cfg.phone) : null;
  const telHref = cfg.phone ? `tel:${cfg.phone.replace(/\D/g, '')}` : null;
  const websiteHref = cfg.website
    ? (cfg.website.startsWith('http') ? cfg.website : `https://${cfg.website}`)
    : null;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── TOP ROW: Logo left / "INVOICE" + company right ── */}
        <View style={s.topRow}>
          <View>
            {cfg.logo ? (
              <Image src={cfg.logo} style={s.logo} />
            ) : (
              <Text style={s.companyNameOnly}>{cfg.companyName || 'Your Company'}</Text>
            )}
          </View>
          <View style={s.rightHeader}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            {cfg.companyName && (
              <Text style={s.companyNameRight}>{cfg.companyName.toUpperCase()}</Text>
            )}
            {(cfg.city || cfg.province) && (
              <Text style={s.companyDetailRight}>
                {cfg.city && cfg.province ? `${cfg.city}, ${cfg.province}` : cfg.city || cfg.province}
              </Text>
            )}
            {cfg.email && (
              <Link src={`mailto:${cfg.email}`} style={s.companyLinkRight}>{cfg.email}</Link>
            )}
            {displayPhone && (
              <Link src={telHref} style={s.companyLinkRight}>{displayPhone}</Link>
            )}
            {websiteHref && (
              <Link src={websiteHref} style={s.companyLinkRight}>{cfg.website}</Link>
            )}
            {cfg.hstNumber && (
              <Text style={s.companyDetailRight}>HST #{cfg.hstNumber}</Text>
            )}
          </View>
        </View>

        {/* ── Horizontal rule ── */}
        <View style={s.rule} />

        {/* ── Info row: Bill To left / Meta box right ── */}
        <View style={s.infoRow}>
          <View style={s.billSection}>
            <Text style={s.billLabel}>Bill To</Text>
            <Text style={s.billName}>{inv.client?.name || '—'}</Text>
            {inv.client?.contactName && (
              <Text style={s.billContactName}>{inv.client.contactName}</Text>
            )}
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
          </View>

          <View style={s.metaBox}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Invoice Number:</Text>
              <Text style={s.metaValue}>{inv.invoiceNumber || '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Invoice Date:</Text>
              <Text style={s.metaValue}>{fmtDate(inv.issueDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Payment Due:</Text>
              <Text style={s.metaValue}>{fmtDate(inv.dueDate)}</Text>
            </View>
            <View style={s.metaRowHighlight}>
              <Text style={s.metaAmtLabel}>Amount Due ({currency}):</Text>
              <Text style={s.metaAmtValue}>{fmt(inv.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Line items table ── */}
        <View style={s.tableHeaderRow}>
          <Text style={[s.colDesc,  s.colHeader]}>Items</Text>
          <Text style={[s.colQty,   s.colHeader]}>Quantity</Text>
          <Text style={[s.colPrice, s.colHeader]}>Price</Text>
          <Text style={[s.colAmt,   s.colHeader]}>Amount</Text>
        </View>
        {lineItems.map((li, idx) => (
          <View key={li.id || idx} style={s.tableRow}>
            <Text style={[s.colDesc,  s.colCell]}>{li.description || '—'}</Text>
            <Text style={[s.colQty,   s.colCell]}>{li.quantity ?? 1}</Text>
            <Text style={[s.colPrice, s.colCell]}>{fmt(li.rate)}</Text>
            <Text style={[s.colAmt,   s.colCell]}>{fmt(li.amount)}</Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={s.totalsWrapper}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal:</Text>
              <Text style={s.totalValue}>{fmt(inv.subtotal)}</Text>
            </View>
            {inv.hstAmount > 0 && taxLabel && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>{taxLabel}:</Text>
                <Text style={s.totalValue}>{fmt(inv.hstAmount)}</Text>
              </View>
            )}
            <View style={s.totalsDivider} />
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Total:</Text>
              <Text style={s.grandTotalValue}>{fmt(inv.total)}</Text>
            </View>
            <View style={s.amtDueRow}>
              <Text style={s.amtDueLabel}>Amount Due ({currency}):</Text>
              <Text style={s.amtDueValue}>{fmt(inv.total)}</Text>
            </View>
            {isForeign && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>≈ CAD equivalent:</Text>
                <Text style={s.totalValue}>{fmtAmt(inv.total * rate, 'CAD')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Notes / Terms ── */}
        {inv.notes && (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>Notes / Terms</Text>
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

