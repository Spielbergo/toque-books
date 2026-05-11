// T4ADocument.js — CRA T4A Statement of Pension, Retirement, Annuity and Other Income (React-PDF)
// Dynamic import only — do NOT import at module level in Next.js pages

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const INK   = '#111827';
const MUTED = '#6B7280';
const RULE  = '#D1D5DB';
const BLUE  = '#1D4ED8';
const LBLUE = '#EFF6FF';

function fmt(n) {
  if (n == null || isNaN(Number(n)) || Number(n) === 0) return '—';
  return '$' + Math.abs(Number(n)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 36,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  slip: {
    borderWidth: 1.5,
    borderColor: BLUE,
    marginBottom: 20,
  },
  header: {
    backgroundColor: BLUE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  headerSub: {
    fontSize: 6.5,
    color: '#BFDBFE',
    marginTop: 1,
  },
  headerYear: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 1,
    textAlign: 'right',
  },
  headerYearLabel: {
    fontSize: 6,
    color: '#BFDBFE',
    marginTop: 1,
    textAlign: 'right',
  },
  partiesRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  partyBox: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: RULE,
  },
  partyBoxLast: { flex: 1, padding: 8 },
  partyLabel: {
    fontSize: 6,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  partyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: INK,
    marginBottom: 1.5,
  },
  partyDetail: { fontSize: 7.5, color: MUTED, marginBottom: 1 },
  boxesArea: { padding: 8 },
  boxRow: { flexDirection: 'row', marginBottom: 4 },
  box: {
    flex: 1,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: '#FAFAFA',
    marginRight: 4,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  boxHighlight: {
    flex: 1,
    borderWidth: 1,
    borderColor: BLUE,
    backgroundColor: LBLUE,
    marginRight: 4,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  boxLast: { marginRight: 0 },
  boxNum:   { fontSize: 6, color: MUTED, marginBottom: 2 },
  boxLabel: { fontSize: 6.5, color: MUTED, marginBottom: 3 },
  boxValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: INK,
  },
  boxValueAccent: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: BLUE,
  },
  copyLabel: {
    backgroundColor: '#EFF6FF',
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  copyLabelText: {
    fontSize: 6.5,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  footerNote: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 6.5, color: MUTED, fontStyle: 'italic' },
});

function Box({ num, label, value, highlight, last }) {
  return (
    <View style={[highlight ? s.boxHighlight : s.box, last && s.boxLast]}>
      <Text style={s.boxNum}>{num}</Text>
      <Text style={s.boxLabel}>{label}</Text>
      <Text style={highlight ? s.boxValueAccent : s.boxValue}>{value}</Text>
    </View>
  );
}

/**
 * T4ADocument — renders one slip per recipient.
 *
 * @param {object} props
 *   settings       - company settings (companyName, address, city, province, postalCode, businessNumber)
 *   recipients     - array of { name, sin, address, city, province, postalCode, box048, box020, box028 }
 *   year           - tax year (number or string)
 */
export default function T4ADocument({ settings, recipients = [], year }) {
  const payer = [
    settings.companyName,
    settings.address,
    `${settings.city || ''} ${settings.province || ''} ${settings.postalCode || ''}`.trim(),
  ].filter(Boolean);

  return (
    <Document
      title={`T4A Slips — ${year}`}
      author={settings.companyName || 'CanBooks'}
      subject="CRA T4A Statement of Pension, Retirement, Annuity and Other Income"
    >
      <Page size="LETTER" style={s.page}>
        {recipients.map((rec, idx) => {
          const sinMasked = rec.sin ? `***-***-${String(rec.sin).slice(-3)}` : '—';
          const recipientLines = [
            rec.name,
            rec.address,
            `${rec.city || ''} ${rec.province || ''} ${rec.postalCode || ''}`.trim(),
          ].filter(Boolean);

          return (
            <View key={idx} style={s.slip} wrap={false}>
              {/* Header */}
              <View style={s.header}>
                <View>
                  <Text style={s.headerTitle}>T4A — STATEMENT OF PENSION, RETIREMENT, ANNUITY AND OTHER INCOME</Text>
                  <Text style={s.headerSub}>Agence du revenu du Canada  /  Canada Revenue Agency</Text>
                </View>
                <View>
                  <Text style={s.headerYear}>{year}</Text>
                  <Text style={s.headerYearLabel}>Tax Year / Année d'imposition</Text>
                </View>
              </View>

              {/* Parties */}
              <View style={s.partiesRow}>
                <View style={s.partyBox}>
                  <Text style={s.partyLabel}>Payer / Payeur</Text>
                  {payer.map((line, i) => (
                    <Text key={i} style={i === 0 ? s.partyName : s.partyDetail}>{line}</Text>
                  ))}
                  {settings.businessNumber && (
                    <Text style={s.partyDetail}>BN: {settings.businessNumber}</Text>
                  )}
                </View>
                <View style={s.partyBoxLast}>
                  <Text style={s.partyLabel}>Recipient / Bénéficiaire</Text>
                  {recipientLines.map((line, i) => (
                    <Text key={i} style={i === 0 ? s.partyName : s.partyDetail}>{line}</Text>
                  ))}
                  <Text style={s.partyDetail}>SIN: {sinMasked}</Text>
                </View>
              </View>

              {/* Box grid */}
              <View style={s.boxesArea}>
                <View style={s.boxRow}>
                  <Box num="016" label="Pension or superannuation" value={fmt(rec.box016)} />
                  <Box num="020" label="Self-employment commissions" value={fmt(rec.box020)} highlight={!!rec.box020} />
                  <Box num="028" label="Other income" value={fmt(rec.box028)} last />
                </View>
                <View style={s.boxRow}>
                  <Box num="048" label="Fees for services" value={fmt(rec.box048)} highlight={!!rec.box048} />
                  <Box num="022" label="Income tax deducted" value={fmt(rec.box022)} />
                  <Box num="105" label="Scholarships / bursaries" value={fmt(rec.box105)} last />
                </View>
              </View>

              {/* Copy label */}
              <View style={s.copyLabel}>
                <Text style={s.copyLabelText}>
                  {idx % 2 === 0 ? 'Copy 1 — Recipient\'s copy' : 'Copy 2 — CRA copy'}
                </Text>
              </View>

              {/* Footer */}
              <View style={s.footerNote}>
                <Text style={s.footerText}>Protected B when completed</Text>
                <Text style={s.footerText}>Generated by CanBooks — for reference only. File official T4A via CRA My Business Account.</Text>
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
