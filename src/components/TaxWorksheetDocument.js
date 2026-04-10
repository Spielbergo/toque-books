// TaxWorksheetDocument.js — T1 + T2 Combined Tax Worksheet (React-PDF)
// Dynamic import only — do NOT import at module level in Next.js pages

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const INK   = '#111827';
const MUTED = '#6B7280';
const RULE  = '#E5E7EB';
const GREEN = '#065F46';
const LGREEN= '#ECFDF5';
const RED   = '#991B1B';
const LRED  = '#FEF2F2';
const NAVY  = '#1E3A5F';
const LNAVY = '#EFF6FF';
const GREY_BG = '#F9FAFB';

function c(n, digits = 2) {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pct(n, digits = 2) {
  if (n == null || isNaN(Number(n))) return '—';
  return (Number(n) * 100).toFixed(digits) + '%';
}

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  // ── Doc header
  docHeader: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
  },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: NAVY,
    marginBottom: 2,
  },
  docSubtitle: {
    fontSize: 7.5,
    color: MUTED,
  },
  docMeta: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 24,
  },
  docMetaItem: {
    marginRight: 24,
  },
  docMetaLabel: {
    fontSize: 6.5,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  docMetaValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: INK,
    marginTop: 1,
  },
  // ── Section heading
  sectionHead: {
    backgroundColor: NAVY,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 0,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    fontSize: 6.5,
    color: '#C7D9F0',
  },
  // ── Sub-section
  subhead: {
    backgroundColor: LNAVY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  subheadText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Line rows
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  lineRowAlt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    backgroundColor: GREY_BG,
  },
  lineRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1.5,
    borderTopColor: NAVY,
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    backgroundColor: LNAVY,
    marginTop: 2,
  },
  lineRowOwing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: LRED,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  lineRowRefund: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: LGREEN,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  lineNum: {
    fontSize: 6.5,
    color: MUTED,
    width: 42,
  },
  lineLabel: {
    flex: 1,
    fontSize: 8,
    color: INK,
  },
  lineLabelMuted: {
    flex: 1,
    fontSize: 7.5,
    color: MUTED,
    fontStyle: 'italic',
  },
  lineLabelBold: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: INK,
  },
  lineValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: INK,
    textAlign: 'right',
    width: 70,
  },
  lineValueMuted: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'right',
    width: 70,
  },
  lineValueRed: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: RED,
    textAlign: 'right',
    width: 70,
  },
  lineValueGreen: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: GREEN,
    textAlign: 'right',
    width: 70,
  },
  lineValueTotal: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: NAVY,
    textAlign: 'right',
    width: 70,
  },
  // ── Disclaimer
  disclaimer: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 8,
  },
  disclaimerText: {
    fontSize: 7,
    color: '#92400E',
    lineHeight: 1.5,
  },
  // ── Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 4,
  },
  pageFooterText: {
    fontSize: 6.5,
    color: MUTED,
  },
  // ── Page break
  pageBreak: {
    marginTop: 0,
  },
});

function Row({ num, label, value, alt, total, emphasize, muted }) {
  const rowStyle = total ? s.lineRowTotal : alt ? s.lineRowAlt : s.lineRow;
  const labelStyle = total || emphasize ? s.lineLabelBold : muted ? s.lineLabelMuted : s.lineLabel;
  const valueStyle = total ? s.lineValueTotal : s.lineValue;
  return (
    <View style={rowStyle}>
      <Text style={s.lineNum}>{num || ''}</Text>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

function SectionHead({ title, badge }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {badge ? <Text style={s.sectionBadge}>{badge}</Text> : null}
    </View>
  );
}

function Subhead({ title }) {
  return (
    <View style={s.subhead}>
      <Text style={s.subheadText}>{title}</Text>
    </View>
  );
}

export default function TaxWorksheetDocument({ settings, fyKey, corp, hst, personal, py }) {
  const year = fyKey || String(new Date().getFullYear());
  const companyName = settings?.legalName || settings?.companyName || 'Corporation';
  const ownerName = settings?.ownerName ||
    [settings?.firstName, settings?.lastName].filter(Boolean).join(' ') || 'Owner';
  const bn = settings?.businessNumber || '';
  const hasCorpData = corp != null;
  const hasPersonalData = personal != null;

  const balanceOwing = personal?.balanceOwing ?? 0;
  const isOwing = balanceOwing > 0;

  return (
    <Document title={`Tax Worksheet ${year} — ${companyName}`} author="CheddarTax">

      {/* ── Page 1: Corporate T2 ─────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        {/* Doc header */}
        <View style={s.docHeader}>
          <Text style={s.docTitle}>Combined Tax Worksheet — {year}</Text>
          <Text style={s.docSubtitle}>
            For accountant reference only · Ontario CCPC · 2025 tax year
          </Text>
          <View style={s.docMeta}>
            <View style={s.docMetaItem}>
              <Text style={s.docMetaLabel}>Corporation</Text>
              <Text style={s.docMetaValue}>{companyName}</Text>
            </View>
            {bn ? (
              <View style={s.docMetaItem}>
                <Text style={s.docMetaLabel}>Business Number</Text>
                <Text style={s.docMetaValue}>{bn}</Text>
              </View>
            ) : null}
            <View style={s.docMetaItem}>
              <Text style={s.docMetaLabel}>Shareholder / Owner</Text>
              <Text style={s.docMetaValue}>{ownerName}</Text>
            </View>
            <View style={s.docMetaItem}>
              <Text style={s.docMetaLabel}>Fiscal Year</Text>
              <Text style={s.docMetaValue}>{year}</Text>
            </View>
          </View>
        </View>

        {/* ── T2 Corporate Section ──────────────────────────────────── */}
        <SectionHead title="CORPORATE TAX SUMMARY   (T2 / Schedule 1 / Schedule 125)" badge="Corporation" />

        {hasCorpData ? (
          <View>
            <Subhead title="Income (Schedule 125 — Statement of Business Activities)" />
            <Row num="100" label="Gross Revenue" value={c(corp.grossRevenue)} />
            <Row num="104" label="Total Deductible Expenses" value={c(corp.totalDeductions)} alt />
            <Row num="105" label="Net Income Before Tax" value={c(corp.netIncome)} total />

            <Subhead title="Income Allocation (Schedule 1 / SBD)" />
            <Row num="400" label="Active Business Income (SBD — up to $500,000)" value={c(corp.sbdIncome)} />
            <Row num="420" label="General Rate Income" value={c(corp.generalIncome)} alt />

            <Subhead title="Federal Tax" />
            <Row num="700" label="Federal Tax @ SBD Rate (9%)" value={c(corp.fedTaxSBD)} />
            <Row num="710" label="Federal Tax @ General Rate (15%)" value={c(corp.fedTaxGeneral)} alt />
            <Row num="720" label="Total Federal Tax" value={c(corp.fedTax)} total />

            <Subhead title="Ontario Tax" />
            <Row num="800" label="Ontario Tax @ Small Business Rate (3.2%)" value={c(corp.onTaxSBD)} />
            <Row num="810" label="Ontario Tax @ General Rate (11.5%)" value={c(corp.onTaxGeneral)} alt />
            <Row num="820" label="Total Ontario Tax" value={c(corp.onTax)} total />

            <View style={[s.lineRowTotal, { marginTop: 6 }]}>
              <Text style={s.lineNum}>999</Text>
              <Text style={s.lineLabelBold}>TOTAL CORPORATE TAX PAYABLE</Text>
              <Text style={s.lineValueTotal}>{c(corp.totalTax)}</Text>
            </View>
            <Row num="" label="Effective Tax Rate" value={pct(corp.effectiveRate)} muted />
            <Row num="" label="After-Tax Corporate Income" value={c(corp.afterTaxIncome)} emphasize alt />
          </View>
        ) : (
          <Row num="" label="No corporate data available for this fiscal year." value="" muted />
        )}

        {/* ── HST Section ───────────────────────────────────────────── */}
        {hst ? (
          <View>
            <SectionHead title="HST / GST SUMMARY   (GST34)" badge="Remittance" />
            <Row num="" label="HST Collected on Invoices" value={c(hst.hstCollected)} />
            <Row num="" label="Input Tax Credits (ITCs) on Expenses" value={c(hst.itcTotal)} alt />
            <Row num="" label="Net HST Remittance" value={c(hst.netRemittance)} total />
          </View>
        ) : null}

        {/* Page footer */}
        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>CheddarTax · {companyName} · {year}</Text>
          <Text style={s.pageFooterText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ── Page 2: T1 Personal Section ──────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <SectionHead title={`PERSONAL T1 SUMMARY   (Tax Year ${year})`} badge="Individual" />

        {hasPersonalData ? (
          <View>
            <Subhead title="Total Income" />
            {personal.employmentIncome > 0 ? (
              <Row num="10100" label="Employment Income (T4 Box 14)" value={c(personal.employmentIncome)} />
            ) : null}
            {personal.otherIncome > 0 ? (
              <Row num="10400" label="Other Income" value={c(personal.otherIncome)} alt />
            ) : null}
            {personal.nonEligibleDivs > 0 ? (
              <Row num="12000" label="Taxable Dividends (Non-Eligible, grossed-up)" value={c(personal.neGrossedUp)} />
            ) : null}
            {personal.eligibleDivs > 0 ? (
              <Row num="12010" label="Taxable Eligible Dividends (grossed-up)" value={c(personal.elGrossedUp)} alt />
            ) : null}
            <Row num="15000" label="Total Income" value={c(personal.totalIncome)} total />

            <Subhead title="Deductions" />
            {personal.rrspDeduction > 0 ? (
              <Row num="20800" label="RRSP Deduction" value={c(personal.rrspDeduction)} />
            ) : null}
            <Row num="23600" label="Net Income" value={c(personal.netIncome)} total />

            <Subhead title="Federal Tax Calculation" />
            <Row num="" label="Federal Tax on Net Income (before credits)" value={c(personal.fedGrossIncomeTax)} />
            <Row num="30000" label="Basic Personal Amount Credit" value={c(-personal.fedBPA_credit)} alt muted />
            {personal.fedSpousal_credit > 0 ? (
              <Row num="30300" label="Spousal / Partner Amount Credit" value={c(-personal.fedSpousal_credit)} muted />
            ) : null}
            {personal.fedCPP_credit > 0 ? (
              <Row num="30800" label="CPP Contributions Credit" value={c(-personal.fedCPP_credit)} alt muted />
            ) : null}
            {personal.fedEI_credit > 0 ? (
              <Row num="31200" label="EI Premiums Credit" value={c(-personal.fedEI_credit)} muted />
            ) : null}
            {personal.fedCEA_credit > 0 ? (
              <Row num="31260" label="Canada Employment Amount Credit" value={c(-personal.fedCEA_credit)} alt muted />
            ) : null}
            {personal.fedDTC > 0 ? (
              <Row num="40500" label="Federal Dividend Tax Credit" value={c(-personal.fedDTC)} muted />
            ) : null}
            <Row num="40600" label="Federal Net Tax" value={c(personal.fedTax)} total />

            <Subhead title="Ontario Tax Calculation" />
            <Row num="" label="Ontario Tax on Net Income (before credits)" value={c(personal.onGrossIncomeTax)} />
            <Row num="" label="Ontario Basic Personal Amount Credit" value={c(-personal.onBPA_credit)} alt muted />
            {personal.onSpousal_credit > 0 ? (
              <Row num="" label="Ontario Spousal Amount Credit" value={c(-personal.onSpousal_credit)} muted />
            ) : null}
            {personal.onCPP_credit > 0 ? (
              <Row num="" label="Ontario CPP Credit" value={c(-personal.onCPP_credit)} alt muted />
            ) : null}
            {personal.onEI_credit > 0 ? (
              <Row num="" label="Ontario EI Credit" value={c(-personal.onEI_credit)} muted />
            ) : null}
            {personal.onDTC > 0 ? (
              <Row num="" label="Ontario Dividend Tax Credit" value={c(-personal.onDTC)} alt muted />
            ) : null}
            {personal.onSurtax > 0 ? (
              <Row num="" label="Ontario Surtax" value={c(personal.onSurtax)} />
            ) : null}
            {personal.ohp > 0 ? (
              <Row num="" label="Ontario Health Premium" value={c(personal.ohp)} alt />
            ) : null}
            <Row num="42800" label="Ontario Net Tax" value={c(personal.onTax)} total />

            {/* Total tax + balance owing */}
            <View style={[s.lineRowTotal, { marginTop: 6 }]}>
              <Text style={s.lineNum}>43500</Text>
              <Text style={s.lineLabelBold}>TOTAL PERSONAL TAX PAYABLE</Text>
              <Text style={s.lineValueTotal}>{c(personal.totalTax)}</Text>
            </View>

            {personal.taxWithheld > 0 ? (
              <Row num="43700" label="Income Tax Withheld at Source (T4 Box 22)" value={c(-personal.taxWithheld)} alt muted />
            ) : null}

            {/* Balance owing / refund */}
            <View style={isOwing ? s.lineRowOwing : s.lineRowRefund}>
              <Text style={s.lineNum}>48500</Text>
              <Text style={s.lineLabelBold}>
                {isOwing ? 'BALANCE OWING TO CRA' : 'ESTIMATED REFUND'}
              </Text>
              <Text style={isOwing ? s.lineValueRed : s.lineValueGreen}>
                {isOwing ? c(balanceOwing) : c(Math.abs(balanceOwing))}
              </Text>
            </View>

            {/* Dividend details reference */}
            <Subhead title="Dividend Details (from T5 slip)" />
            {personal.nonEligibleDivs > 0 ? (
              <View>
                <Row num="T5-10" label="Non-Eligible Dividends — Actual (Box 10)" value={c(personal.nonEligibleDivs)} />
                <Row num="T5-11" label="Non-Eligible Dividends — Taxable (Box 11, ×1.15)" value={c(personal.neGrossedUp)} alt />
                <Row num="T5-12" label="Non-Eligible Dividend Tax Credit (Box 12)" value={c(personal.fedNeDTC)} />
              </View>
            ) : null}
            {personal.eligibleDivs > 0 ? (
              <View>
                <Row num="T5-24" label="Eligible Dividends — Actual (Box 24)" value={c(personal.eligibleDivs)} alt />
                <Row num="T5-25" label="Eligible Dividends — Taxable (Box 25, ×1.38)" value={c(personal.elGrossedUp)} />
                <Row num="T5-26" label="Eligible Dividend Tax Credit (Box 26)" value={c(personal.fedElDTC)} alt />
              </View>
            ) : null}
          </View>
        ) : (
          <Row num="" label="No personal tax data available for this fiscal year." value="" muted />
        )}

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            DISCLAIMER: This worksheet is generated by CheddarTax for reference purposes only and does not constitute
            an official CRA filing. Tax calculations are estimates based on 2025 rates for Ontario residents.
            Always file your T1 and T2 returns using official CRA-approved software or with the assistance of
            a qualified tax professional. Verify all figures before filing.
          </Text>
        </View>

        {/* Page footer */}
        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>CheddarTax · {companyName} · {year} · For accountant reference only</Text>
          <Text style={s.pageFooterText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
