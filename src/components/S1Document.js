// S1Document.js — CRA T2 Schedule 1, Net Income (Loss) for Income Tax Purposes
// Dynamic import only — do NOT import at module level in Next.js pages

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const INK   = '#111827';
const MUTED = '#6B7280';
const RULE  = '#E5E7EB';
const NAVY  = '#1E3A5F';
const LNAVY = '#EFF6FF';
const GREY  = '#F9FAFB';
const LRED  = '#FEF2F2';
const RED_B = '#991B1B';
const AMBER = '#78350F';
const LAMBER= '#FFFBEB';

function c(n) {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v === 0) return '—';
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  // ── Document header
  docHeader: {
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  docLeft: {},
  docRight: { alignItems: 'flex-end' },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: NAVY,
  },
  docSubtitle: {
    fontSize: 7.5,
    color: MUTED,
    marginTop: 2,
  },
  docCo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: INK,
    textAlign: 'right',
  },
  docMeta: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'right',
    marginTop: 1,
  },
  // ── Section header
  sectionHead: {
    backgroundColor: NAVY,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  sectionBadge: {
    fontSize: 6.5,
    color: '#C7D9F0',
  },
  // ── Sub-section header
  subHead: {
    backgroundColor: LNAVY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  subHeadText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Line rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  rowAlt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    backgroundColor: GREY,
  },
  rowTotal: {
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
  rowManual: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    backgroundColor: LAMBER,
  },
  rowResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: LNAVY,
    borderTopWidth: 2,
    borderTopColor: NAVY,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    marginTop: 4,
  },
  lineNum: {
    fontSize: 6.5,
    color: MUTED,
    width: 36,
    flexShrink: 0,
  },
  lineLabel: {
    flex: 1,
    fontSize: 8,
    color: INK,
  },
  lineLabelBold: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: INK,
  },
  lineLabelMuted: {
    flex: 1,
    fontSize: 7.5,
    color: MUTED,
    fontStyle: 'italic',
  },
  lineValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: INK,
    textAlign: 'right',
    width: 72,
  },
  lineValueMuted: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'right',
    width: 72,
    fontStyle: 'italic',
  },
  lineValueNavy: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: NAVY,
    textAlign: 'right',
    width: 72,
  },
  lineValueAmber: {
    fontSize: 7.5,
    color: AMBER,
    textAlign: 'right',
    width: 72,
    fontStyle: 'italic',
  },
  // ── Expense detail table
  expTable: {
    marginTop: 0,
    borderLeftWidth: 1,
    borderLeftColor: RULE,
    borderRightWidth: 1,
    borderRightColor: RULE,
  },
  expRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  expRowAlt: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    backgroundColor: GREY,
  },
  expCat: { flex: 1, fontSize: 7.5, color: INK },
  expAmt: { width: 60, textAlign: 'right', fontSize: 7.5, color: INK },
  expAdj: { width: 60, textAlign: 'right', fontSize: 7.5, color: MUTED },
  expDed: { width: 60, textAlign: 'right', fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: INK },
  expHead: { flex: 1, fontSize: 6.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  expHeadAmt: { width: 60, textAlign: 'right', fontSize: 6.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  // ── Notice box
  noticeBox: {
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: LAMBER,
    borderRadius: 3,
    padding: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  noticeTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: AMBER,
    marginBottom: 3,
  },
  noticeText: {
    fontSize: 7,
    color: AMBER,
    lineHeight: 1.5,
  },
  // ── Disclaimer
  disclaimer: {
    borderTopWidth: 1,
    borderTopColor: RULE,
    marginTop: 16,
    paddingTop: 8,
  },
  disclaimerText: {
    fontSize: 6.5,
    color: MUTED,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  // ── Footer
  pageNum: {
    position: 'absolute',
    bottom: 20,
    right: 44,
    fontSize: 6.5,
    color: MUTED,
  },
});

// ── Row components ─────────────────────────────────────────────────────────
function DataRow({ num, label, value, alt, bold, muted, manual }) {
  const rowStyle = manual ? s.rowManual : alt ? s.rowAlt : s.row;
  const labelStyle = bold ? s.lineLabelBold : muted ? s.lineLabelMuted : s.lineLabel;
  const valueStyle = manual ? s.lineValueAmber : muted ? s.lineValueMuted : s.lineValue;
  return (
    <View style={rowStyle}>
      <Text style={s.lineNum}>{num || ''}</Text>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

function TotalRow({ num, label, value }) {
  return (
    <View style={s.rowTotal}>
      <Text style={s.lineNum}>{num || ''}</Text>
      <Text style={s.lineLabelBold}>{label}</Text>
      <Text style={s.lineValue}>{value}</Text>
    </View>
  );
}

function ResultRow({ num, label, value }) {
  return (
    <View style={s.rowResult}>
      <Text style={s.lineNum}>{num || ''}</Text>
      <Text style={s.lineLabelBold}>{label}</Text>
      <Text style={s.lineValueNavy}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  S1Document component
//  Props:
//    settings       — state.settings (companyName, bn, province, etc.)
//    fyLabel        — "FY2024-25" or similar
//    fyPeriod       — "Dec 1, 2024 – Nov 30, 2025"
//    netIncomeBooks — revenue minus ALL expenses (full book amounts)
//    addBacks       — { meals, personalUse, homeOfficePersonal, amortization, other }
//    deductions     — { cca, reserves, other }
//    expenses       — array of expense objects (for the detail table)
//    ccaClasses     — array of CCA class objects
//    corp           — calculateCorporateTax() result
// ─────────────────────────────────────────────────────────────────────────────
export default function S1Document({ settings, fyLabel, fyPeriod, netIncomeBooks, addBacks, deductions, expenses, ccaClasses, corp }) {
  const s1 = settings || {};
  const co = s1.companyName || 'Corporation';
  const bn = s1.businessNumber || '';

  const {
    meals          = 0,
    personalUse    = 0,
    homeOfficePersonal = 0,
    amortization   = 0,   // manual
    other: addOther = 0,  // manual
  } = addBacks || {};

  const {
    cca         = 0,
    reserves    = 0,  // manual
    other: dedOther = 0, // manual
  } = deductions || {};

  const totalAddBacks  = meals + personalUse + homeOfficePersonal + amortization + addOther;
  const totalDedns     = cca + reserves + dedOther;
  const netIncomeTax   = (netIncomeBooks || 0) + totalAddBacks - totalDedns;

  // ── Expense detail — group by category
  const expByCategory = {};
  const catLabels = {
    advertising: 'Advertising & Marketing',
    bank_fees: 'Bank Fees & Interest',
    business_meals: 'Business Meals (50% ded.)',
    education: 'Education & Training',
    equipment: 'Equipment & Hardware',
    home_office: 'Home Office',
    insurance: 'Insurance',
    legal_professional: 'Legal & Professional Fees',
    office_supplies: 'Office Supplies',
    software_subscriptions: 'Software & Subscriptions',
    telephone_internet: 'Telephone & Internet',
    training: 'Training & Development',
    travel: 'Travel',
    vehicle: 'Vehicle & Transportation',
    wages_salaries: 'Wages & Salaries',
    other: 'Other',
  };
  (expenses || []).forEach(exp => {
    const cat = exp.category || 'other';
    if (!expByCategory[cat]) expByCategory[cat] = { amount: 0, deductible: 0 };
    expByCategory[cat].amount    += exp.amount || 0;
    expByCategory[cat].deductible += exp._deductible || 0;
  });
  const expRows = Object.entries(expByCategory).sort((a, b) => b[1].amount - a[1].amount);

  const hasManualFields = amortization === 0 || reserves === 0;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── Document header */}
        <View style={s.docHeader} fixed>
          <View style={s.docLeft}>
            <Text style={s.docTitle}>T2 Schedule 1 — Net Income for Tax Purposes</Text>
            <Text style={s.docSubtitle}>CRA T2SCH1 · Reconciliation of Accounting Income to Taxable Income</Text>
          </View>
          <View style={s.docRight}>
            <Text style={s.docCo}>{co}</Text>
            {bn ? <Text style={s.docMeta}>BN: {bn}</Text> : null}
            <Text style={s.docMeta}>{fyLabel || ''}{fyPeriod ? '  ·  ' + fyPeriod : ''}</Text>
          </View>
        </View>

        {/* ── Section 1: Net income per books */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>NET INCOME (LOSS) PER FINANCIAL STATEMENTS</Text>
        </View>
        <DataRow num="001" label="Net income (loss) per financial statements (accounting)" value={c(netIncomeBooks)} bold />

        {/* ── Section 2: Add-backs */}
        <View style={[s.sectionHead, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>ADD: AMOUNTS DEDUCTED FOR ACCOUNTING, NOT FOR TAX</Text>
          <Text style={s.sectionBadge}>Lines 101–199</Text>
        </View>

        <View style={s.subHead}>
          <Text style={s.subHeadText}>Calculated from your records</Text>
        </View>
        <DataRow num="102" label="Meals & entertainment — disallowed 50% portion" value={c(meals)} alt />
        <DataRow num="103" label="Personal use portion of mixed-use expenses" value={c(personalUse)} />
        <DataRow num="104" label="Home office — personal-use portion (Schedule T2200)" value={c(homeOfficePersonal)} alt />

        <View style={s.subHead}>
          <Text style={s.subHeadText}>Enter manually (requires asset register / accountant)</Text>
        </View>
        <DataRow num="101" label="Amortization / depreciation per financial statements" value={amortization ? c(amortization) : 'Enter manually'} manual />
        <DataRow num="106" label="Other add-backs (fines, charitable donations, etc.)" value={addOther ? c(addOther) : 'Enter manually'} manual alt />

        <TotalRow num="199" label="Total additions (Lines 101–106)" value={c(totalAddBacks)} />

        {/* ── Section 3: Deductions */}
        <View style={[s.sectionHead, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>DEDUCT: AMOUNTS INCLUDED IN INCOME, NOT FOR TAX</Text>
          <Text style={s.sectionBadge}>Lines 201–299</Text>
        </View>

        <View style={s.subHead}>
          <Text style={s.subHeadText}>Calculated from your CCA schedule</Text>
        </View>
        <DataRow num="201" label={`Capital Cost Allowance — CCA (${ccaClasses?.length || 0} class${(ccaClasses?.length || 0) !== 1 ? 'es' : ''})`} value={c(cca)} alt />

        <View style={s.subHead}>
          <Text style={s.subHeadText}>Enter manually</Text>
        </View>
        <DataRow num="213" label="Tax reserves (carry-forward claims, prior-year reserves)" value={reserves ? c(reserves) : 'Enter manually'} manual />
        <DataRow num="299" label="Other deductions (dividends from Can. corps, etc.)" value={dedOther ? c(dedOther) : 'Enter manually'} manual alt />

        <TotalRow num="299" label="Total deductions (Lines 201–299)" value={c(totalDedns)} />

        {/* ── Result: Net income for tax */}
        <ResultRow num="300" label="Net income (loss) for income tax purposes" value={c(netIncomeTax)} />

        {/* ── Agreement check */}
        {Math.abs(netIncomeTax - (corp?.netIncome || 0)) < 1 ? null : (
          <View style={s.noticeBox}>
            <Text style={s.noticeTitle}>⚠  Reconciliation note</Text>
            <Text style={s.noticeText}>
              Line 300 ({c(netIncomeTax)}) differs from the app's calculated taxable income ({c(corp?.netIncome || 0)}) by {c(Math.abs(netIncomeTax - (corp?.netIncome || 0)))}.
              This is expected if manual fields (amortization, reserves) have not been entered, or if CCA claims differ.
              Your accountant will reconcile these on the final T2 filing.
            </Text>
          </View>
        )}

        {/* ── CCA Schedule */}
        {ccaClasses && ccaClasses.length > 0 && (
          <>
            <View style={[s.sectionHead, { marginTop: 12 }]}>
              <Text style={s.sectionTitle}>CCA SCHEDULE (T2 SCHEDULE 8 SUMMARY)</Text>
            </View>
            <View style={s.expTable}>
              <View style={[s.expRow, { backgroundColor: LNAVY }]}>
                <Text style={[s.expHead, { flex: 0.4 }]}>Class</Text>
                <Text style={[s.expHead, { flex: 1.2 }]}>Description</Text>
                <Text style={s.expHeadAmt}>Opening UCC</Text>
                <Text style={s.expHeadAmt}>Additions</Text>
                <Text style={s.expHeadAmt}>Claimed CCA</Text>
                <Text style={s.expHeadAmt}>Closing UCC</Text>
              </View>
              {ccaClasses.map((cls, i) => {
                const open  = parseFloat(cls.openingUCC)   || 0;
                const add   = parseFloat(cls.additions)    || 0;
                const disp  = parseFloat(cls.disposals)    || 0;
                const claim = parseFloat(cls.claimedAmount)|| 0;
                const close = open + add - disp - claim;
                return (
                  <View key={i} style={i % 2 === 0 ? s.expRow : s.expRowAlt}>
                    <Text style={[s.expCat, { flex: 0.4 }]}>{cls.classNumber || '—'}</Text>
                    <Text style={[s.expCat, { flex: 1.2 }]}>{cls.description || '—'}</Text>
                    <Text style={s.expAdj}>{c(open)}</Text>
                    <Text style={s.expAdj}>{c(add)}</Text>
                    <Text style={s.expAmt}>{c(claim)}</Text>
                    <Text style={s.expDed}>{c(close)}</Text>
                  </View>
                );
              })}
              <View style={[s.expRow, { backgroundColor: LNAVY }]}>
                <Text style={[s.expHead, { flex: 0.4 }]}></Text>
                <Text style={[s.expHead, { flex: 1.2, fontFamily: 'Helvetica-Bold', color: NAVY }]}>Total CCA Claimed</Text>
                <Text style={s.expHeadAmt}></Text>
                <Text style={s.expHeadAmt}></Text>
                <Text style={[s.expHeadAmt, { fontFamily: 'Helvetica-Bold', color: NAVY }]}>{c(cca)}</Text>
                <Text style={s.expHeadAmt}></Text>
              </View>
            </View>
          </>
        )}

        {/* ── Expense detail table */}
        {expRows.length > 0 && (
          <>
            <View style={[s.sectionHead, { marginTop: 12 }]}>
              <Text style={s.sectionTitle}>EXPENSE DETAIL — ACCOUNTING VS. TAX DEDUCTIBILITY</Text>
            </View>
            <View style={s.expTable}>
              <View style={[s.expRow, { backgroundColor: LNAVY }]}>
                <Text style={s.expHead}>Category</Text>
                <Text style={s.expHeadAmt}>Book Amount</Text>
                <Text style={s.expHeadAmt}>Add-back</Text>
                <Text style={s.expHeadAmt}>Tax Deductible</Text>
              </View>
              {expRows.map(([cat, vals], i) => {
                const addback = vals.amount - vals.deductible;
                return (
                  <View key={cat} style={i % 2 === 0 ? s.expRow : s.expRowAlt}>
                    <Text style={s.expCat}>{catLabels[cat] || cat}</Text>
                    <Text style={s.expAmt}>{c(vals.amount)}</Text>
                    <Text style={[s.expAdj, { color: addback > 0.005 ? AMBER : MUTED }]}>{addback > 0.005 ? c(addback) : '—'}</Text>
                    <Text style={s.expDed}>{c(vals.deductible)}</Text>
                  </View>
                );
              })}
              <View style={[s.expRow, { backgroundColor: LNAVY }]}>
                <Text style={[s.expHead, { fontFamily: 'Helvetica-Bold', color: NAVY }]}>Total</Text>
                <Text style={[s.expHeadAmt, { fontFamily: 'Helvetica-Bold', color: NAVY }]}>
                  {c(expRows.reduce((sum, [, v]) => sum + v.amount, 0))}
                </Text>
                <Text style={[s.expHeadAmt, { color: AMBER }]}>
                  {c(expRows.reduce((sum, [, v]) => sum + (v.amount - v.deductible), 0))}
                </Text>
                <Text style={[s.expHeadAmt, { fontFamily: 'Helvetica-Bold', color: NAVY }]}>
                  {c(expRows.reduce((sum, [, v]) => sum + v.deductible, 0))}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── Manual fields notice */}
        {hasManualFields && (
          <View style={s.noticeBox}>
            <Text style={s.noticeTitle}>📝  Fields requiring manual completion</Text>
            <Text style={s.noticeText}>
              Lines marked "Enter manually" (amortization, tax reserves, and other add-backs/deductions) cannot be
              calculated automatically because they require information not currently tracked in the app
              (e.g. depreciation schedules, prior-year reserve elections). A qualified accountant or T2 software
              (UFile, Taxprep, ProFile) will complete these lines before filing.
            </Text>
          </View>
        )}

        {/* ── Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            This document is a working draft prepared from data in CanBooks. It is intended to assist your
            accountant in preparing the official CRA T2 Schedule 1 and is NOT a substitute for the filed return.
            Amounts marked "Enter manually" must be completed before filing. Always have a qualified CPA review
            and sign off on your T2 corporate return.
          </Text>
        </View>

        <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
