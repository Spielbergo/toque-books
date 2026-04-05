/**
 * Export Helpers
 * Utility functions for generating various tax and accounting export formats.
 * Supports: JSON, CSV, OFX/QFX, QBO, IIF (QuickBooks), XML (CRA T2/T1 summary),
 *           GST34, T4/T4A slips, Xero, Wave, Sage, FreshBooks, TurboTax XML.
 */

import { formatDateISO } from '@/lib/formatters';
import {
  calculateCorporateTax,
  calculatePersonalTax,
  calculateHSTSummary,
  calculateHomeOfficeDeduction,
  getDeductibleAmount,
} from '@/lib/taxCalculations';
import { expandRecurringForFY } from '@/lib/recurringUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function csvRow(fields) {
  return fields.map(f => {
    const v = String(f ?? '');
    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',');
}

function download(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Resolve invoices and expenses for the given fiscal year from state.
 */
export function resolveFYData(state, fyKey) {
  const fy = state.fiscalYears?.[fyKey];
  if (!fy) return null;
  const { startDate, endDate } = fy;
  const allFYData = Object.values(state.fiscalYears || {});
  const inRange = date => !date || ((!startDate || date >= startDate) && (!endDate || date <= endDate));
  const invoices = allFYData.flatMap(f => f.invoices || []).filter(inv => inRange(inv.issueDate));
  const baseExpenses = allFYData.flatMap(f => f.expenses || []).filter(exp => inRange(exp.date));
  const recurringForFY = startDate && endDate
    ? expandRecurringForFY(state.recurringExpenses || [], startDate, endDate)
    : [];
  const expenses = [...baseExpenses, ...recurringForFY];
  return { fy, invoices, expenses };
}

// ─── 1. JSON Backup ───────────────────────────────────────────────────────────

export function exportJSON(state, userProfile, fyKey) {
  const payload = {
    exportedAt: new Date().toISOString(),
    fiscalYear: fyKey,
    company: state.settings,
    fiscalYearData: state.fiscalYears?.[fyKey] ?? null,
    clients: state.clients,
    products: state.products,
    businessOps: state.businessOps,
    recurringExpenses: state.recurringExpenses,
    personalProfile: userProfile,
  };
  download(`toque-backup-${fyKey}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

// ─── 2. Expenses CSV (universal) ─────────────────────────────────────────────

export function exportExpensesCSV(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { expenses } = data;
  const headers = ['Date', 'Vendor', 'Category', 'Description', 'Amount', 'HST', 'HST Rate', 'Business Use %', 'Deductible Amount', 'Notes'];
  const rows = expenses.map(e => {
    const deductible = getDeductibleAmount(e.amount, e.category, e.businessUsePercent ?? 100);
    return csvRow([
      e.date ?? '', e.vendor ?? '', e.category ?? '', e.description ?? '',
      (e.amount ?? 0).toFixed(2), (e.hst ?? 0).toFixed(2),
      e.hstRate ?? '', e.businessUsePercent ?? 100,
      deductible.toFixed(2), e.notes ?? '',
    ]);
  });
  const content = [csvRow(headers), ...rows].join('\n');
  download(`expenses-${fyKey}.csv`, content, 'text/csv');
}

// ─── 3. Invoices CSV ─────────────────────────────────────────────────────────

export function exportInvoicesCSV(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { invoices } = data;
  const headers = ['Invoice #', 'Client', 'Client Email', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'HST', 'Total', 'Paid Date', 'Notes'];
  const rows = invoices.map(inv => csvRow([
    inv.invoiceNumber ?? '', inv.client?.name ?? '', inv.client?.email ?? '',
    inv.issueDate ?? '', inv.dueDate ?? '', inv.status ?? '',
    (inv.subtotal ?? 0).toFixed(2), (inv.hstAmount ?? 0).toFixed(2),
    (inv.total ?? 0).toFixed(2), inv.paidDate ?? '', inv.notes ?? '',
  ]));
  const content = [csvRow(headers), ...rows].join('\n');
  download(`invoices-${fyKey}.csv`, content, 'text/csv');
}

// ─── 4. GST/HST Return (GST34) CSV ───────────────────────────────────────────

export function exportGST34CSV(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { invoices, expenses } = data;
  const { hstCollected, itcTotal, netRemittance } = calculateHSTSummary(invoices, expenses);
  const s = state.settings;
  const headers = ['Field', 'Amount (CAD)'];
  const rows = [
    csvRow(['Business Name', s.companyName ?? '']),
    csvRow(['HST/GST Number', s.hstNumber ?? '']),
    csvRow(['Reporting Period', fyKey]),
    csvRow(['Line 103 — GST/HST Collected', hstCollected.toFixed(2)]),
    csvRow(['Line 106 — Input Tax Credits (ITC)', itcTotal.toFixed(2)]),
    csvRow(['Line 109 — Net Tax Remittance', netRemittance.toFixed(2)]),
  ];
  download(`GST34-${fyKey}.csv`, [csvRow(headers), ...rows].join('\n'), 'text/csv');
}

// ─── 5. CRA T2 Summary XML ───────────────────────────────────────────────────

export function exportT2XML(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { fy, invoices, expenses } = data;
  const s = state.settings;

  const grossRevenue = invoices
    .filter(i => i.status === 'paid' || i.status === 'sent')
    .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

  const totalDeductible = expenses.reduce((sum, e) =>
    sum + getDeductibleAmount(e.amount, e.category, e.businessUsePercent ?? 100), 0);
  const hoResult = calculateHomeOfficeDeduction(fy.homeOffice ?? {});
  const totalCCA = (fy.ccaClasses ?? []).reduce((s, c) => s + (c.claimedAmount || 0), 0);
  const totalDeductions = totalDeductible + (hoResult?.deductible ?? 0) + totalCCA;
  const corp = calculateCorporateTax(grossRevenue, totalDeductions);
  const totalDivsPaid = (fy.dividendsPaid ?? []).reduce((s, d) => s + (d.amount || 0), 0);
  const openingRE = fy.openingRetainedEarnings ?? 0;
  const closingRE = openingRE + corp.afterTaxIncome - totalDivsPaid;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- CRA T2 Corporate Income Tax Return Summary — Generated by Toque Books -->
<!-- NOTE: This is a summary for reference only. File the official T2 return
     using CRA certified software or a tax professional. -->
<T2Return>
  <ReturnInfo>
    <TaxYear>${fyKey}</TaxYear>
    <FiscalStartDate>${esc(fy.startDate ?? '')}</FiscalStartDate>
    <FiscalEndDate>${esc(fy.endDate ?? '')}</FiscalEndDate>
    <GeneratedDate>${new Date().toISOString()}</GeneratedDate>
  </ReturnInfo>
  <Corporation>
    <LegalName>${esc(s.legalName || s.companyName || '')}</LegalName>
    <BusinessNumber>${esc(s.businessNumber ?? '')}</BusinessNumber>
    <HSTNumber>${esc(s.hstNumber ?? '')}</HSTNumber>
    <Province>${esc(s.province ?? 'ON')}</Province>
    <IncorporationYear>${esc(s.incorporationYear ?? '')}</IncorporationYear>
    <Address>${esc(s.address ?? '')}</Address>
    <City>${esc(s.city ?? '')}</City>
    <PostalCode>${esc(s.postalCode ?? '')}</PostalCode>
  </Corporation>
  <Schedule100_BalanceSheet>
    <OpeningRetainedEarnings>${openingRE.toFixed(2)}</OpeningRetainedEarnings>
    <ClosingRetainedEarnings>${closingRE.toFixed(2)}</ClosingRetainedEarnings>
  </Schedule100_BalanceSheet>
  <Income>
    <GrossRevenue>${grossRevenue.toFixed(2)}</GrossRevenue>
    <TotalDeductibleExpenses>${totalDeductible.toFixed(2)}</TotalDeductibleExpenses>
    <HomeOfficeDeduction>${(hoResult?.deductible ?? 0).toFixed(2)}</HomeOfficeDeduction>
    <CCADeduction>${totalCCA.toFixed(2)}</CCADeduction>
    <NetIncome>${corp.netIncome.toFixed(2)}</NetIncome>
  </Income>
  <TaxCalculation>
    <SBDIncome>${corp.sbdIncome.toFixed(2)}</SBDIncome>
    <FederalTax>${corp.fedTax.toFixed(2)}</FederalTax>
    <OntarioTax>${corp.onTax.toFixed(2)}</OntarioTax>
    <TotalTax>${corp.totalTax.toFixed(2)}</TotalTax>
    <EffectiveRate>${(corp.effectiveRate * 100).toFixed(2)}</EffectiveRate>
    <AfterTaxIncome>${corp.afterTaxIncome.toFixed(2)}</AfterTaxIncome>
  </TaxCalculation>
  <DividendsPaid>${totalDivsPaid.toFixed(2)}</DividendsPaid>
  <Schedule8_CCA>
${(fy.ccaClasses ?? []).map(c => `    <Class number="${esc(c.classNumber)}">
      <Description>${esc(c.description ?? '')}</Description>
      <Rate>${esc(c.rate ?? 0)}</Rate>
      <OpeningUCC>${(c.openingUCC || 0).toFixed(2)}</OpeningUCC>
      <Additions>${(c.additions || 0).toFixed(2)}</Additions>
      <Disposals>${(c.disposals || 0).toFixed(2)}</Disposals>
      <ClaimedAmount>${(c.claimedAmount || 0).toFixed(2)}</ClaimedAmount>
      <ClosingUCC>${((c.openingUCC || 0) + (c.additions || 0) - (c.disposals || 0) - (c.claimedAmount || 0)).toFixed(2)}</ClosingUCC>
    </Class>`).join('\n')}
  </Schedule8_CCA>
  <ShareholderLoan>
    <OpeningBalance>${(fy.shareholderLoan?.openingBalance ?? 0).toFixed(2)}</OpeningBalance>
    <ClosingBalance>${((() => {
      const sl = fy.shareholderLoan ?? { openingBalance: 0, transactions: [] };
      return (sl.openingBalance || 0) + (sl.transactions || []).reduce(
        (sum, t) => t.type === 'withdrawal' ? sum + (t.amount || 0) : sum - (t.amount || 0), 0);
    })()).toFixed(2)}</ClosingBalance>
    <Transactions>
${(fy.shareholderLoan?.transactions ?? []).map(t => `      <Transaction id="${esc(t.id)}">
        <Date>${esc(t.date)}</Date>
        <Description>${esc(t.description ?? '')}</Description>
        <Type>${esc(t.type)}</Type>
        <Amount>${(t.amount || 0).toFixed(2)}</Amount>
      </Transaction>`).join('\n')}
    </Transactions>
  </ShareholderLoan>
</T2Return>`;

  download(`T2-Summary-${fyKey}.xml`, xml, 'application/xml');
}

// ─── 6. CRA T1 Personal Summary XML ─────────────────────────────────────────

export function exportT1XML(userProfile, fyKey, companyName) {
  const year = parseInt(fyKey.replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const py = userProfile?.personalYears?.[year] ?? {};
  const pp = userProfile?.personalProfile ?? {};
  const personal = calculatePersonalTax({
    nonEligibleDivs:  py.nonEligibleDivs  ?? 0,
    eligibleDivs:     py.eligibleDivs     ?? 0,
    employmentIncome: py.employmentIncome ?? 0,
    otherIncome:      py.otherIncome      ?? 0,
    rrspDeduction:    py.rrspDeduction    ?? 0,
    taxWithheld:      py.taxWithheld      ?? 0,
    cppContributions: py.cppContributions ?? 0,
    eiPremiums:       py.eiPremiums       ?? 0,
    spouseNetIncome:  py.spouseNetIncome  ?? null,
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- CRA T1 Personal Income Tax Return Summary — Generated by Toque Books -->
<!-- NOTE: This is a summary for reference only. File the official T1 return
     using NETFILE certified software or a tax professional. -->
<T1Return>
  <ReturnInfo>
    <TaxYear>${year}</TaxYear>
    <GeneratedDate>${new Date().toISOString()}</GeneratedDate>
  </ReturnInfo>
  <Taxpayer>
    <Name>${esc(pp.firstName ?? userProfile?.firstName ?? '')}</Name>
    <MaritalStatus>${esc(pp.maritalStatus ?? '')}</MaritalStatus>
  </Taxpayer>
  <Income>
    <NonEligibleDividends>${(py.nonEligibleDivs ?? 0).toFixed(2)}</NonEligibleDividends>
    <EligibleDividends>${(py.eligibleDivs ?? 0).toFixed(2)}</EligibleDividends>
    <OtherIncome>${(py.otherIncome ?? 0).toFixed(2)}</OtherIncome>
    <NonEligGrossedUp>${(personal.neGrossedUp ?? 0).toFixed(2)}</NonEligGrossedUp>
    <EligGrossedUp>${(personal.elGrossedUp ?? 0).toFixed(2)}</EligGrossedUp>
    <TotalIncome>${(personal.totalIncome ?? 0).toFixed(2)}</TotalIncome>
    <RRSPDeduction>${(py.rrspDeduction ?? 0).toFixed(2)}</RRSPDeduction>
    <NetIncome>${(personal.netIncome ?? 0).toFixed(2)}</NetIncome>
  </Income>
  <TaxCalculation>
    <FederalTax>${(personal.fedTax ?? 0).toFixed(2)}</FederalTax>
    <FederalDTC>${(personal.fedDTC ?? 0).toFixed(2)}</FederalDTC>
    <OntarioTax>${(personal.onTax ?? 0).toFixed(2)}</OntarioTax>
    <OntarioDTC>${(personal.onDTC ?? 0).toFixed(2)}</OntarioDTC>
    <TotalTax>${(personal.totalTax ?? 0).toFixed(2)}</TotalTax>
    <EffectiveRate>${((personal.effectiveRate ?? 0) * 100).toFixed(2)}</EffectiveRate>
    <AfterTaxIncome>${(personal.afterTaxIncome ?? 0).toFixed(2)}</AfterTaxIncome>
  </TaxCalculation>
</T1Return>`;

  download(`T1-Summary-${year}.xml`, xml, 'application/xml');
}

// ─── 7. QuickBooks IIF (desktop import) ──────────────────────────────────────

export function exportQuickBooksIIF(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { invoices, expenses } = data;

  const lines = [
    '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
    '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
    '!ENDTRNS',
  ];

  for (const inv of invoices.filter(i => i.status === 'paid' || i.status === 'sent')) {
    const date = inv.paidDate || inv.issueDate || '';
    const name = inv.client?.name ?? '';
    lines.push(`TRNS\tINVOICE\t${date}\tAccounts Receivable\t${name}\t${(inv.total ?? 0).toFixed(2)}\tInvoice ${inv.invoiceNumber ?? ''}`);
    lines.push(`SPL\tINVOICE\t${date}\tRevenue\t${name}\t${(-(inv.subtotal ?? 0)).toFixed(2)}\t`);
    if ((inv.hstAmount ?? 0) > 0) {
      lines.push(`SPL\tINVOICE\t${date}\tHST/GST Payable\t${name}\t${(-(inv.hstAmount ?? 0)).toFixed(2)}\t`);
    }
    lines.push('ENDTRNS');
  }

  for (const exp of expenses) {
    const date = exp.date || '';
    const name = exp.vendor ?? '';
    const amt = -(exp.amount ?? 0);
    lines.push(`TRNS\tCHECK\t${date}\tBusiness Chequing\t${name}\t${amt.toFixed(2)}\t${exp.description ?? exp.category ?? ''}`);
    lines.push(`SPL\tCHECK\t${date}\t${exp.category ?? 'Expenses'}\t${name}\t${(exp.amount ?? 0).toFixed(2)}\t`);
    lines.push('ENDTRNS');
  }

  download(`QuickBooks-${fyKey}.iif`, lines.join('\n'), 'text/plain');
}

// ─── 8. QuickBooks Online OFX/QBO ────────────────────────────────────────────

export function exportQBO(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { invoices, expenses } = data;
  const now = new Date();
  const dtNow = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);

  const txLines = [];

  for (const exp of expenses) {
    const dt = (exp.date ?? '').replace(/-/g, '');
    txLines.push(`<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>${dt}000000</DTPOSTED>
<TRNAMT>-${(exp.amount ?? 0).toFixed(2)}</TRNAMT>
<FITID>${esc(exp.id ?? Math.random().toString(36).slice(2))}</FITID>
<NAME>${esc(exp.vendor ?? 'Expense')}</NAME>
<MEMO>${esc(exp.description ?? exp.category ?? '')}</MEMO>
</STMTTRN>`);
  }

  for (const inv of invoices.filter(i => i.status === 'paid')) {
    const dt = (inv.paidDate ?? inv.issueDate ?? '').replace(/-/g, '');
    txLines.push(`<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>${dt}000000</DTPOSTED>
<TRNAMT>${(inv.total ?? 0).toFixed(2)}</TRNAMT>
<FITID>${esc(inv.id ?? Math.random().toString(36).slice(2))}</FITID>
<NAME>${esc(inv.client?.name ?? 'Client')}</NAME>
<MEMO>Invoice ${esc(inv.invoiceNumber ?? '')}</MEMO>
</STMTTRN>`);
  }

  const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<DTSERVER>${dtNow}</DTSERVER>
<LANGUAGE>ENG</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1</TRNUID>
<STMTRS>
<CURDEF>CAD</CURDEF>
<BANKACCTFROM>
<BANKID>000000</BANKID>
<ACCTID>${esc(state.settings.companyName ?? 'BUSINESS')}</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
${txLines.join('\n')}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  download(`QuickBooks-Online-${fyKey}.qbo`, ofx, 'application/x-ofx');
}

// ─── 9. Xero / Wave / FreshBooks / Sage — Bank Transactions CSV ──────────────

export function exportBankTransactionsCSV(state, fyKey, flavor = 'xero') {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { invoices, expenses } = data;

  // Xero format: Date,Amount,Payee,Description,Reference,Cheque Number,Account Code,Tax Type
  // Wave format: Transaction Date,Amount,Description
  // FreshBooks / Sage use a very similar shape; we'll output the richest set and label accordingly.

  const headers = {
    xero:       ['Date', 'Amount', 'Payee', 'Description', 'Reference', 'Account Code'],
    wave:       ['Transaction Date', 'Amount', 'Description'],
    freshbooks: ['Date', 'Amount', 'Vendor', 'Category', 'Notes'],
    sage:       ['Date', 'Debit', 'Credit', 'Description', 'Account'],
    generic:    ['Date', 'Amount', 'Name', 'Memo', 'Category', 'Reference'],
  }[flavor] ?? ['Date', 'Amount', 'Name', 'Memo', 'Category', 'Reference'];

  const rows = [];

  for (const exp of expenses) {
    const amt = (exp.amount ?? 0);
    if (flavor === 'xero') {
      rows.push(csvRow([exp.date ?? '', (-amt).toFixed(2), exp.vendor ?? '', exp.description ?? exp.category ?? '', exp.id ?? '', exp.category ?? '']));
    } else if (flavor === 'wave') {
      rows.push(csvRow([exp.date ?? '', (-amt).toFixed(2), exp.description ?? exp.vendor ?? '']));
    } else if (flavor === 'freshbooks') {
      rows.push(csvRow([exp.date ?? '', amt.toFixed(2), exp.vendor ?? '', exp.category ?? '', exp.notes ?? '']));
    } else if (flavor === 'sage') {
      rows.push(csvRow([exp.date ?? '', amt.toFixed(2), '', exp.description ?? exp.category ?? '', exp.category ?? '']));
    } else {
      rows.push(csvRow([exp.date ?? '', (-amt).toFixed(2), exp.vendor ?? '', exp.description ?? '', exp.category ?? '', exp.id ?? '']));
    }
  }

  for (const inv of invoices.filter(i => i.status === 'paid')) {
    const amt = (inv.total ?? 0);
    const date = inv.paidDate ?? inv.issueDate ?? '';
    const name = inv.client?.name ?? '';
    const memo = `Invoice ${inv.invoiceNumber ?? ''}`;
    if (flavor === 'xero') {
      rows.push(csvRow([date, amt.toFixed(2), name, memo, inv.invoiceNumber ?? '', 'Revenue']));
    } else if (flavor === 'wave') {
      rows.push(csvRow([date, amt.toFixed(2), memo]));
    } else if (flavor === 'freshbooks') {
      rows.push(csvRow([date, amt.toFixed(2), name, 'Revenue', '']));
    } else if (flavor === 'sage') {
      rows.push(csvRow([date, '', amt.toFixed(2), memo, 'Revenue']));
    } else {
      rows.push(csvRow([date, amt.toFixed(2), name, memo, 'Revenue', inv.invoiceNumber ?? '']));
    }
  }

  const filename = `${flavor}-transactions-${fyKey}.csv`;
  download(filename, [csvRow(headers), ...rows].join('\n'), 'text/csv');
}

// ─── 10. TurboTax / Wealthsimple Tax — T-Slips CSV ──────────────────────────

export function exportTSlipsCSV(userProfile, fyKey) {
  const year = parseInt(fyKey.replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const py = userProfile?.personalYears?.[year] ?? {};

  // T5 slip data for dividends
  const headers = ['Slip Type', 'Tax Year', 'Box', 'Description', 'Amount (CAD)'];
  const rows = [
    csvRow(['T5', year, '10', 'Actual Amount of Non-Eligible Dividends', (py.nonEligibleDivs ?? 0).toFixed(2)]),
    csvRow(['T5', year, '11', 'Taxable Amount of Non-Eligible Dividends (×1.15)', ((py.nonEligibleDivs ?? 0) * 1.15).toFixed(2)]),
    csvRow(['T5', year, '12', 'Dividend Tax Credit — Non-Eligible', ((py.nonEligibleDivs ?? 0) * 0.090301).toFixed(2)]),
    csvRow(['T5', year, '24', 'Actual Amount of Eligible Dividends', (py.eligibleDivs ?? 0).toFixed(2)]),
    csvRow(['T5', year, '25', 'Taxable Amount of Eligible Dividends (×1.38)', ((py.eligibleDivs ?? 0) * 1.38).toFixed(2)]),
    csvRow(['T5', year, '26', 'Dividend Tax Credit — Eligible', ((py.eligibleDivs ?? 0) * 0.150198).toFixed(2)]),
  ];

  download(`T5-Slips-${year}.csv`, [csvRow(headers), ...rows].join('\n'), 'text/csv');
}

// ─── 11. TurboTax XML (T1 import) ────────────────────────────────────────────

export function exportTurboTaxXML(userProfile, fyKey) {
  const year = parseInt(fyKey.replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const py = userProfile?.personalYears?.[year] ?? {};
  const pp = userProfile?.personalProfile ?? {};
  const personal = calculatePersonalTax({
    nonEligibleDivs:  py.nonEligibleDivs  ?? 0,
    eligibleDivs:     py.eligibleDivs     ?? 0,
    employmentIncome: py.employmentIncome ?? 0,
    otherIncome:      py.otherIncome      ?? 0,
    rrspDeduction:    py.rrspDeduction    ?? 0,
    taxWithheld:      py.taxWithheld      ?? 0,
    cppContributions: py.cppContributions ?? 0,
    eiPremiums:       py.eiPremiums       ?? 0,
    spouseNetIncome:  py.spouseNetIncome  ?? null,
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- TurboTax / H&R Block Tax — T1 Data Import -->
<!-- Import via File > Import > Import from file in TurboTax -->
<TaxReturn software="ToqueBooks" year="${year}">
  <Taxpayer>
    <SIN></SIN>
    <FirstName>${esc(pp.firstName ?? '')}</FirstName>
    <LastName>${esc(pp.lastName ?? '')}</LastName>
    <MaritalStatus>${esc(pp.maritalStatus ?? '')}</MaritalStatus>
  </Taxpayer>
  <T1General>
    <Line10400_OtherEmployment>${(py.otherIncome ?? 0).toFixed(2)}</Line10400_OtherEmployment>
    <Line12000_TaxableNEDividends>${((py.nonEligibleDivs ?? 0) * 1.15).toFixed(2)}</Line12000_TaxableNEDividends>
    <Line12010_TaxableEligDividends>${((py.eligibleDivs ?? 0) * 1.38).toFixed(2)}</Line12010_TaxableEligDividends>
    <Line15000_TotalIncome>${(personal.totalIncome ?? 0).toFixed(2)}</Line15000_TotalIncome>
    <Line20800_RRSPDeduction>${(py.rrspDeduction ?? 0).toFixed(2)}</Line20800_RRSPDeduction>
    <Line23600_NetIncome>${(personal.netIncome ?? 0).toFixed(2)}</Line23600_NetIncome>
    <Line40400_FedDividendTC>${(personal.fedDTC ?? 0).toFixed(2)}</Line40400_FedDividendTC>
    <Line42000_FedTaxPayable>${(personal.fedTax ?? 0).toFixed(2)}</Line42000_FedTaxPayable>
    <Line42800_ProvTaxPayable>${(personal.onTax ?? 0).toFixed(2)}</Line42800_ProvTaxPayable>
    <Line43500_TotalPayable>${(personal.totalTax ?? 0).toFixed(2)}</Line43500_TotalPayable>
  </T1General>
  <T5Slips>
    <NonEligibleDividends_Box10>${(py.nonEligibleDivs ?? 0).toFixed(2)}</NonEligibleDividends_Box10>
    <EligibleDividends_Box24>${(py.eligibleDivs ?? 0).toFixed(2)}</EligibleDividends_Box24>
  </T5Slips>
</TaxReturn>`;

  download(`TurboTax-T1-${year}.xml`, xml, 'application/xml');
}

// ─── 12. UFile T2 XML ────────────────────────────────────────────────────────

export function exportUFileT2XML(state, fyKey) {
  // UFile T2 uses a similar XML structure to the generic CRA T2 summary.
  // This exports data in a format compatible with UFile T2 / H&R Block Business.
  exportT2XML(state, fyKey); // Re-use T2 XML — same structure, rename file
  // Note: actual UFile import tool requires their .u2 binary; this XML provides
  // the structured data to manually populate their forms.
}

// ─── 13. Wealthsimple Tax CSV ─────────────────────────────────────────────────

export function exportWealthsimpleCSV(userProfile, fyKey) {
  const year = parseInt(fyKey.replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const py = userProfile?.personalYears?.[year] ?? {};

  const headers = ['Field', 'Value'];
  const rows = [
    csvRow(['tax_year', year]),
    csvRow(['non_eligible_dividends_actual', (py.nonEligibleDivs ?? 0).toFixed(2)]),
    csvRow(['eligible_dividends_actual', (py.eligibleDivs ?? 0).toFixed(2)]),
    csvRow(['other_income', (py.otherIncome ?? 0).toFixed(2)]),
    csvRow(['rrsp_deduction', (py.rrspDeduction ?? 0).toFixed(2)]),
    csvRow(['rrsp_room', (py.rrspRoom ?? 0).toFixed(2)]),
  ];

  download(`Wealthsimple-T1-${year}.csv`, [csvRow(headers), ...rows].join('\n'), 'text/csv');
}

// ─── 14. Sage 50 Chart of Accounts + Journal Entries CSV ─────────────────────

export function exportSage50CSV(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { invoices, expenses } = data;

  // Sage 50 journal entry import format
  const headers = ['Journal', 'Date', 'Ref', 'Source', 'Description', 'Debit', 'Credit', 'Account Number', 'Account Name'];
  const rows = [];

  for (const exp of expenses) {
    rows.push(csvRow(['Purchase Journal', exp.date ?? '', exp.id?.slice(0, 8) ?? '', 'ToqueBooks', exp.description ?? exp.category ?? '', (exp.amount ?? 0).toFixed(2), '', '5100', exp.category ?? 'General Expense']));
  }

  for (const inv of invoices.filter(i => i.status === 'paid' || i.status === 'sent')) {
    rows.push(csvRow(['Sales Journal', inv.issueDate ?? '', inv.invoiceNumber ?? '', 'ToqueBooks', `Invoice ${inv.invoiceNumber ?? ''} — ${inv.client?.name ?? ''}`, '', (inv.subtotal ?? 0).toFixed(2), '4100', 'Revenue']));
    if ((inv.hstAmount ?? 0) > 0) {
      rows.push(csvRow(['Sales Journal', inv.issueDate ?? '', inv.invoiceNumber ?? '', 'ToqueBooks', 'HST/GST Collected', '', (inv.hstAmount ?? 0).toFixed(2), '2200', 'HST/GST Payable']));
    }
  }

  download(`Sage50-${fyKey}.csv`, [csvRow(headers), ...rows].join('\n'), 'text/csv');
}

// ─── 15. Full Tax Summary CSV ─────────────────────────────────────────────────

export function exportTaxSummaryCSV(state, fyKey, userProfile) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { fy, invoices, expenses } = data;
  const s = state.settings;

  const grossRevenue = invoices
    .filter(i => i.status === 'paid' || i.status === 'sent')
    .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);
  const totalDeductible = expenses.reduce((sum, e) =>
    sum + getDeductibleAmount(e.amount, e.category, e.businessUsePercent ?? 100), 0);
  const hoResult = calculateHomeOfficeDeduction(fy.homeOffice ?? {});
  const totalCCA = (fy.ccaClasses ?? []).reduce((s2, c) => s2 + (c.claimedAmount || 0), 0);
  const totalDeductions = totalDeductible + (hoResult?.deductible ?? 0) + totalCCA;
  const corp = calculateCorporateTax(grossRevenue, totalDeductions);
  const { hstCollected, itcTotal, netRemittance } = calculateHSTSummary(invoices, expenses);
  const totalDivs = (fy.dividendsPaid ?? []).reduce((s2, d) => s2 + (d.amount || 0), 0);

  const year = parseInt(fyKey.replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const py = userProfile?.personalYears?.[year] ?? {};
  const personal = calculatePersonalTax({
    nonEligibleDivs:  py.nonEligibleDivs  ?? 0,
    eligibleDivs:     py.eligibleDivs     ?? 0,
    employmentIncome: py.employmentIncome ?? 0,
    otherIncome:      py.otherIncome      ?? 0,
    rrspDeduction:    py.rrspDeduction    ?? 0,
    taxWithheld:      py.taxWithheld      ?? 0,
    cppContributions: py.cppContributions ?? 0,
    eiPremiums:       py.eiPremiums       ?? 0,
    spouseNetIncome:  py.spouseNetIncome  ?? null,
  });

  const rows = [
    csvRow(['TOQUE BOOKS — TAX SUMMARY', '']),
    csvRow(['Company', s.companyName ?? '']),
    csvRow(['Business Number', s.businessNumber ?? '']),
    csvRow(['Fiscal Year', fyKey]),
    csvRow(['Generated', new Date().toISOString()]),
    csvRow(['', '']),
    csvRow(['=== CORPORATE (T2) ===', '']),
    csvRow(['Gross Revenue', grossRevenue.toFixed(2)]),
    csvRow(['Total Deductible Expenses', totalDeductible.toFixed(2)]),
    csvRow(['Home Office Deduction', (hoResult?.deductible ?? 0).toFixed(2)]),
    csvRow(['CCA (Schedule 8)', totalCCA.toFixed(2)]),
    csvRow(['Net Income', corp.netIncome.toFixed(2)]),
    csvRow(['Federal Tax', corp.fedTax.toFixed(2)]),
    csvRow(['Ontario Tax', corp.onTax.toFixed(2)]),
    csvRow(['Total Corporate Tax', corp.totalTax.toFixed(2)]),
    csvRow(['After-Tax Income', corp.afterTaxIncome.toFixed(2)]),
    csvRow(['Dividends Paid', totalDivs.toFixed(2)]),
    csvRow(['Opening Retained Earnings', (fy.openingRetainedEarnings ?? 0).toFixed(2)]),
    csvRow(['Closing Retained Earnings', ((fy.openingRetainedEarnings ?? 0) + corp.afterTaxIncome - totalDivs).toFixed(2)]),
    csvRow(['', '']),
    csvRow(['=== HST/GST ===', '']),
    csvRow(['HST Collected', hstCollected.toFixed(2)]),
    csvRow(['Input Tax Credits', itcTotal.toFixed(2)]),
    csvRow(['Net Remittance', netRemittance.toFixed(2)]),
    csvRow(['', '']),
    csvRow(['=== PERSONAL (T1) ===', '']),
    csvRow(['Non-Eligible Dividends', (py.nonEligibleDivs ?? 0).toFixed(2)]),
    csvRow(['Eligible Dividends', (py.eligibleDivs ?? 0).toFixed(2)]),
    csvRow(['Other Income', (py.otherIncome ?? 0).toFixed(2)]),
    csvRow(['RRSP Deduction', (py.rrspDeduction ?? 0).toFixed(2)]),
    csvRow(['Total Personal Income', (personal.totalIncome ?? 0).toFixed(2)]),
    csvRow(['Net Personal Income', (personal.netIncome ?? 0).toFixed(2)]),
    csvRow(['Total Personal Tax', (personal.totalTax ?? 0).toFixed(2)]),
    csvRow(['After-Tax Personal Income', (personal.afterTaxIncome ?? 0).toFixed(2)]),
  ];

  download(`Tax-Summary-${fyKey}.csv`, rows.join('\n'), 'text/csv');
}
