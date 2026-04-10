// T5Document.js — CRA T5 Statement of Investment Income (React-PDF)
// Dynamic import only — do NOT import at module level in Next.js pages

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const INK   = '#111827';
const MUTED = '#6B7280';
const RULE  = '#D1D5DB';
const BLUE  = '#1E3A5F';
const LBLUE = '#E8F0F8';

function fmt(n, digits = 2) {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v === 0) return '—';
  return '$' + Math.abs(v).toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtNum(n, digits = 2) {
  if (n == null || isNaN(Number(n)) || Number(n) === 0) return '—';
  return Number(n).toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    padding: 0,
  },
  // ── Header band
  header: {
    backgroundColor: BLUE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  headerLeft: {},
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  headerSub: {
    fontSize: 6.5,
    color: '#C7D9F0',
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerYear: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 1,
  },
  headerCopy: {
    fontSize: 6,
    color: '#C7D9F0',
    marginTop: 1,
  },
  // ── Parties row
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
  partyBoxLast: {
    flex: 1,
    padding: 8,
  },
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
  partyDetail: {
    fontSize: 7.5,
    color: MUTED,
    marginBottom: 1,
  },
  // ── Boxes grid
  boxesArea: {
    padding: 8,
  },
  boxesTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    color: BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  boxRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
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
  boxLast: {
    marginRight: 0,
  },
  boxNum: {
    fontSize: 6,
    color: MUTED,
    marginBottom: 2,
  },
  boxLabel: {
    fontSize: 6.5,
    color: MUTED,
    marginBottom: 3,
  },
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
  // ── Footer note
  footerNote: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6.5,
    color: MUTED,
    fontStyle: 'italic',
  },
  footerBN: {
    fontSize: 6.5,
    color: MUTED,
  },
  // ── Divider between copies
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    borderStyle: 'dashed',
    marginVertical: 0,
  },
  copyLabel: {
    backgroundColor: '#F3F4F6',
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
});

function T5Slip({ settings, recipientName, recipientSIN, year, py, copyLabel }) {
  const payerName = settings?.legalName || settings?.companyName || 'Corporation';
  const payerBN   = settings?.businessNumber || '';
  const payerAddr = [settings?.address, settings?.city, settings?.province, settings?.postalCode]
    .filter(Boolean).join(', ');

  const neActual  = Number(py?.nonEligibleDivs  || 0);
  const elActual  = Number(py?.eligibleDivs     || 0);
  const neTaxable = neActual * 1.15;
  const elTaxable = elActual * 1.38;
  const neDTC     = neActual * 0.090301;
  const elDTC     = elActual * 0.150198;

  return (
    <View style={s.slip}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>T5 — STATEMENT OF INVESTMENT INCOME</Text>
          <Text style={s.headerSub}>ÉTAT DES REVENUS DE PLACEMENT</Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.headerYear}>{year}</Text>
          <Text style={s.headerCopy}>TAX YEAR / ANNÉE D'IMPOSITION</Text>
        </View>
      </View>

      {/* Parties */}
      <View style={s.partiesRow}>
        <View style={s.partyBox}>
          <Text style={s.partyLabel}>Payer (Payeur)</Text>
          <Text style={s.partyName}>{payerName}</Text>
          {payerBN  ? <Text style={s.partyDetail}>BN: {payerBN}</Text> : null}
          {payerAddr ? <Text style={s.partyDetail}>{payerAddr}</Text> : null}
        </View>
        <View style={s.partyBoxLast}>
          <Text style={s.partyLabel}>Recipient (Bénéficiaire)</Text>
          <Text style={s.partyName}>{recipientName || '—'}</Text>
          {recipientSIN ? <Text style={s.partyDetail}>SIN: {recipientSIN}</Text> : null}
        </View>
      </View>

      {/* Boxes — Row 1: Non-Eligible Dividends */}
      <View style={s.boxesArea}>
        <Text style={s.boxesTitle}>Non-Eligible Dividends / Dividendes non déterminés</Text>
        <View style={s.boxRow}>
          <View style={[s.boxHighlight]}>
            <Text style={s.boxNum}>Box 10 / Case 10</Text>
            <Text style={s.boxLabel}>Actual amount of dividends{'\n'}Montant réel des dividendes</Text>
            <Text style={s.boxValueAccent}>{fmt(neActual)}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.boxNum}>Box 11 / Case 11</Text>
            <Text style={s.boxLabel}>Taxable amount of dividends{'\n'}Montant imposable des dividendes</Text>
            <Text style={s.boxValue}>{fmtNum(neTaxable)}</Text>
          </View>
          <View style={[s.box, s.boxLast]}>
            <Text style={s.boxNum}>Box 12 / Case 12</Text>
            <Text style={s.boxLabel}>Dividend tax credit{'\n'}Crédit d'impôt pour dividendes</Text>
            <Text style={s.boxValue}>{fmt(neDTC)}</Text>
          </View>
        </View>

        {/* Boxes — Row 2: Eligible Dividends */}
        <Text style={[s.boxesTitle, { marginTop: 6 }]}>Eligible Dividends / Dividendes déterminés</Text>
        <View style={s.boxRow}>
          <View style={[s.boxHighlight]}>
            <Text style={s.boxNum}>Box 24 / Case 24</Text>
            <Text style={s.boxLabel}>Actual amount of eligible dividends{'\n'}Montant réel des dividendes déterminés</Text>
            <Text style={s.boxValueAccent}>{fmt(elActual)}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.boxNum}>Box 25 / Case 25</Text>
            <Text style={s.boxLabel}>Taxable amount of eligible dividends{'\n'}Montant imposable des dividendes déterminés</Text>
            <Text style={s.boxValue}>{fmtNum(elTaxable)}</Text>
          </View>
          <View style={[s.box, s.boxLast]}>
            <Text style={s.boxNum}>Box 26 / Case 26</Text>
            <Text style={s.boxLabel}>Eligible dividend tax credit{'\n'}Crédit d'impôt pour dividendes déterminés</Text>
            <Text style={s.boxValue}>{fmt(elDTC)}</Text>
          </View>
        </View>
      </View>

      {/* Copy label + footer */}
      <View style={s.copyLabel}>
        <Text style={s.copyLabelText}>{copyLabel}</Text>
      </View>
      <View style={s.footerNote}>
        <Text style={s.footerText}>
          Generated by CheddarTax · This slip is for reference. File your T1 using official CRA forms.
        </Text>
        {payerBN ? <Text style={s.footerBN}>BN {payerBN}</Text> : null}
      </View>
    </View>
  );
}

export default function T5Document({ settings, recipientName, recipientSIN, year, py }) {
  return (
    <Document title={`T5 ${year} — ${recipientName || 'Recipient'}`} author="CheddarTax">
      <Page size="LETTER" style={s.page}>
        <T5Slip
          settings={settings}
          recipientName={recipientName}
          recipientSIN={recipientSIN}
          year={year}
          py={py}
          copyLabel="Recipient's copy / Copie du bénéficiaire"
        />
        <T5Slip
          settings={settings}
          recipientName={recipientName}
          recipientSIN={recipientSIN}
          year={year}
          py={py}
          copyLabel="Issuer's copy / Copie de l'émetteur"
        />
      </Page>
    </Document>
  );
}
