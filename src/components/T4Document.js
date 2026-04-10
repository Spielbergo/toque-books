// T4Document.js — CRA T4 Statement of Remuneration Paid (React-PDF)
// Dynamic import only — do NOT import at module level in Next.js pages

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const INK   = '#111827';
const MUTED = '#6B7280';
const RULE  = '#D1D5DB';
const RED   = '#7C0A02';
const LRED  = '#FEF2F2';

function fmt(n) {
  if (n == null || isNaN(Number(n)) || Number(n) === 0) return '—';
  return '$' + Math.abs(Number(n)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtNum(n) {
  if (n == null || isNaN(Number(n)) || Number(n) === 0) return '—';
  return Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    borderColor: RED,
    marginBottom: 20,
  },
  // ── Header
  header: {
    backgroundColor: RED,
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
    color: '#FCA5A5',
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
    color: '#FCA5A5',
    marginTop: 1,
    textAlign: 'right',
  },
  // ── Parties
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
  // ── Box grid
  boxesArea: {
    padding: 8,
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
    borderColor: RED,
    backgroundColor: LRED,
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
    color: RED,
  },
  // ── Footer
  copyLabel: {
    backgroundColor: '#FFF5F5',
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
  footerText: {
    fontSize: 6.5,
    color: MUTED,
    fontStyle: 'italic',
  },
  footerBN: {
    fontSize: 6.5,
    color: MUTED,
  },
  // ── Code + province row
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaItem: {
    marginRight: 20,
  },
  metaLabel: {
    fontSize: 6,
    color: MUTED,
    marginBottom: 1,
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: INK,
  },
});

function T4Slip({ settings, employeeName, year, py, copyLabel }) {
  const employerName = settings?.legalName || settings?.companyName || 'Corporation';
  const employerBN   = settings?.businessNumber || '';
  const employerProv = settings?.province || 'ON';
  const employerAddr = [settings?.address, settings?.city, settings?.province, settings?.postalCode]
    .filter(Boolean).join(', ');

  const box14 = Number(py?.employmentIncome  || 0);
  const box16 = Number(py?.cppContributions  || 0);
  const box18 = Number(py?.eiPremiums        || 0);
  const box22 = Number(py?.taxWithheld       || 0);
  const box24 = box14;   // EI insurable earnings (simplification: same as box 14)
  const box26 = box14;   // CPP pensionable earnings

  return (
    <View style={s.slip}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>T4 — STATEMENT OF REMUNERATION PAID</Text>
          <Text style={s.headerSub}>ÉTAT DE LA RÉMUNÉRATION PAYÉE</Text>
        </View>
        <View>
          <Text style={s.headerYear}>{year}</Text>
          <Text style={s.headerYearLabel}>TAX YEAR / ANNÉE D'IMPOSITION</Text>
        </View>
      </View>

      {/* Employer / Employee */}
      <View style={s.partiesRow}>
        <View style={s.partyBox}>
          <Text style={s.partyLabel}>Employer (Employeur)</Text>
          <Text style={s.partyName}>{employerName}</Text>
          {employerBN   ? <Text style={s.partyDetail}>BN / NE: {employerBN}</Text> : null}
          {employerAddr ? <Text style={s.partyDetail}>{employerAddr}</Text> : null}
        </View>
        <View style={s.partyBoxLast}>
          <Text style={s.partyLabel}>Employee (Employé)</Text>
          <Text style={s.partyName}>{employeeName || '—'}</Text>
          <Text style={s.partyDetail}>Province of employment: {employerProv}</Text>
        </View>
      </View>

      {/* Meta: province + code */}
      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Text style={s.metaLabel}>10 – Province of employment</Text>
          <Text style={s.metaValue}>{employerProv}</Text>
        </View>
        <View style={s.metaItem}>
          <Text style={s.metaLabel}>29 – Employment code</Text>
          <Text style={s.metaValue}>—</Text>
        </View>
        <View style={s.metaItem}>
          <Text style={s.metaLabel}>12 – Social insurance number</Text>
          <Text style={s.metaValue}>*** *** ***</Text>
        </View>
      </View>

      {/* Boxes */}
      <View style={s.boxesArea}>
        {/* Row 1: 14, 22 */}
        <View style={s.boxRow}>
          <View style={s.boxHighlight}>
            <Text style={s.boxNum}>Box 14 / Case 14</Text>
            <Text style={s.boxLabel}>Employment income{'\n'}Revenus d'emploi</Text>
            <Text style={s.boxValueAccent}>{fmtNum(box14)}</Text>
          </View>
          <View style={[s.boxHighlight, s.boxLast]}>
            <Text style={s.boxNum}>Box 22 / Case 22</Text>
            <Text style={s.boxLabel}>Income tax deducted{'\n'}Impôt sur le revenu retenu</Text>
            <Text style={s.boxValueAccent}>{fmt(box22)}</Text>
          </View>
        </View>
        {/* Row 2: 16, 26 */}
        <View style={s.boxRow}>
          <View style={s.box}>
            <Text style={s.boxNum}>Box 16 / Case 16</Text>
            <Text style={s.boxLabel}>Employee's CPP contributions{'\n'}Cotisations de l'employé au RPC</Text>
            <Text style={s.boxValue}>{fmt(box16)}</Text>
          </View>
          <View style={[s.box, s.boxLast]}>
            <Text style={s.boxNum}>Box 26 / Case 26</Text>
            <Text style={s.boxLabel}>CPP/QPP pensionable earnings{'\n'}Gains ouvrant droit à pension</Text>
            <Text style={s.boxValue}>{fmtNum(box26)}</Text>
          </View>
        </View>
        {/* Row 3: 18, 24 */}
        <View style={s.boxRow}>
          <View style={s.box}>
            <Text style={s.boxNum}>Box 18 / Case 18</Text>
            <Text style={s.boxLabel}>Employee's EI premiums{'\n'}Cotisations de l'employé à l'AE</Text>
            <Text style={s.boxValue}>{fmt(box18)}</Text>
          </View>
          <View style={[s.box, s.boxLast]}>
            <Text style={s.boxNum}>Box 24 / Case 24</Text>
            <Text style={s.boxLabel}>EI insurable earnings{'\n'}Gains assurables d'AE</Text>
            <Text style={s.boxValue}>{fmtNum(box24)}</Text>
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
        {employerBN ? <Text style={s.footerBN}>BN {employerBN}</Text> : null}
      </View>
    </View>
  );
}

export default function T4Document({ settings, employeeName, year, py }) {
  return (
    <Document title={`T4 ${year} — ${employeeName || 'Employee'}`} author="CheddarTax">
      <Page size="LETTER" style={s.page}>
        <T4Slip
          settings={settings}
          employeeName={employeeName}
          year={year}
          py={py}
          copyLabel="Employee's copy / Copie de l'employé"
        />
        <T4Slip
          settings={settings}
          employeeName={employeeName}
          year={year}
          py={py}
          copyLabel="Employer's copy / Copie de l'employeur"
        />
      </Page>
    </Document>
  );
}
