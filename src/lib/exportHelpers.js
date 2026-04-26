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
  calculateMileageDeduction,
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
  download(`canbooks-backup-${fyKey}.json`, JSON.stringify(payload, null, 2), 'application/json');
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
  const headers = ['Invoice #', 'Client', 'Client Email', 'Issue Date', 'Due Date', 'Status', 'Currency', 'Subtotal', 'HST', 'Total', 'Exchange Rate (to CAD)', 'Total (CAD)', 'Paid Date', 'Notes'];
  const rows = invoices.map(inv => {
    const cur = inv.currency || 'CAD';
    const rate = inv.exchangeRateToCAD || 1;
    return csvRow([
      inv.invoiceNumber ?? '', inv.client?.name ?? '', inv.client?.email ?? '',
      inv.issueDate ?? '', inv.dueDate ?? '', inv.status ?? '',
      cur,
      (inv.subtotal ?? 0).toFixed(2), (inv.hstAmount ?? 0).toFixed(2),
      (inv.total ?? 0).toFixed(2),
      cur === 'CAD' ? '' : rate.toFixed(6),
      cur === 'CAD' ? '' : ((inv.total ?? 0) * rate).toFixed(2),
      inv.paidDate ?? '', inv.notes ?? '',
    ]);
  });
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
<!-- CRA T2 Corporate Income Tax Return Summary — Generated by CanBooks -->
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
<!-- CRA T1 Personal Income Tax Return Summary — Generated by CanBooks -->
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
<TaxReturn software="CanBooks" year="${year}">
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
    rows.push(csvRow(['Purchase Journal', exp.date ?? '', exp.id?.slice(0, 8) ?? '', 'CanBooks', exp.description ?? exp.category ?? '', (exp.amount ?? 0).toFixed(2), '', '5100', exp.category ?? 'General Expense']));
  }

  for (const inv of invoices.filter(i => i.status === 'paid' || i.status === 'sent')) {
    rows.push(csvRow(['Sales Journal', inv.issueDate ?? '', inv.invoiceNumber ?? '', 'CanBooks', `Invoice ${inv.invoiceNumber ?? ''} — ${inv.client?.name ?? ''}`, '', (inv.subtotal ?? 0).toFixed(2), '4100', 'Revenue']));
    if ((inv.hstAmount ?? 0) > 0) {
      rows.push(csvRow(['Sales Journal', inv.issueDate ?? '', inv.invoiceNumber ?? '', 'CanBooks', 'HST/GST Collected', '', (inv.hstAmount ?? 0).toFixed(2), '2200', 'HST/GST Payable']));
    }
  }

  download(`Sage50-${fyKey}.csv`, [csvRow(headers), ...rows].join('\n'), 'text/csv');
}

// ─── 15. Full Tax Summary CSV ─────────────────────────────────────────────────

export function exportTaxSummaryCSV(state, fyKey, userProfile) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { fy, invoices, expenses: rawExpenses } = data;
  const s = state.settings;
  // Exclude expenses manually pushed from the mileage page — mileage is calculated from logs below
  const expenses = rawExpenses.filter(e => !(e.notes && e.notes.startsWith('Mileage log auto-calculated')));

  const grossRevenue = invoices
    .filter(i => i.status === 'paid' || i.status === 'sent')
    .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);
  const totalDeductible = expenses.reduce((sum, e) =>
    sum + getDeductibleAmount(e.amount, e.category, e.businessUsePercent ?? 100), 0);
  const hoResult = calculateHomeOfficeDeduction(fy.homeOffice ?? {});
  const totalCCA = (fy.ccaClasses ?? []).reduce((s2, c) => s2 + (c.claimedAmount || 0), 0);
  const mileageResult = calculateMileageDeduction(fy.mileageLogs ?? []);
  const totalDeductions = totalDeductible + (hoResult?.deductible ?? 0) + totalCCA + mileageResult.deductible;
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
    csvRow(['CANBOOKS — TAX SUMMARY', '']),
    csvRow(['Company', s.companyName ?? '']),
    csvRow(['Business Number', s.businessNumber ?? '']),
    csvRow(['Fiscal Year', fyKey]),
    csvRow(['Generated', new Date().toISOString()]),
    csvRow(['', '']),
    csvRow(['=== CORPORATE (T2) ===', '']),
    csvRow(['Gross Revenue', grossRevenue.toFixed(2)]),
    csvRow(['Total Deductible Expenses', totalDeductible.toFixed(2)]),
    csvRow(['Home Office Deduction', (hoResult?.deductible ?? 0).toFixed(2)]),
    csvRow(['Mileage Deduction', mileageResult.deductible.toFixed(2)]),
    csvRow(['Mileage Total KM', mileageResult.totalKm.toFixed(0)]),
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

// ─── PDF helpers ──────────────────────────────────────────────────────────────

async function createPdfBlob(DocumentComponent, props) {
  const { pdf } = await import('@react-pdf/renderer');
  const { createElement } = await import('react');
  return pdf(createElement(DocumentComponent, props)).toBlob();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── T5 Slip PDF ─────────────────────────────────────────────────────────────

export async function exportT5PDF(state, fyKey, userProfile) {
  const { default: T5Document } = await import('@/components/T5Document');
  const s = state.settings;
  const year = parseInt((fyKey ?? '').replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const py = userProfile?.personalYears?.[year] ?? {};
  const profile = userProfile?.personalProfile ?? {};
  const recipientName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    || s?.ownerName || 'Shareholder';

  const blob = await createPdfBlob(T5Document, {
    settings: s,
    recipientName,
    recipientSIN: null,
    year: String(year),
    py,
  });
  downloadBlob(blob, `T5-${year}-${(recipientName).replace(/\s+/g, '_')}.pdf`);
}

// ─── T4 Slip PDF ─────────────────────────────────────────────────────────────

export async function exportT4PDF(state, fyKey, userProfile) {
  const { default: T4Document } = await import('@/components/T4Document');
  const s = state.settings;
  const year = parseInt((fyKey ?? '').replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const py = userProfile?.personalYears?.[year] ?? {};
  const profile = userProfile?.personalProfile ?? {};
  const employeeName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    || s?.ownerName || 'Employee';

  if (!py.employmentIncome || Number(py.employmentIncome) === 0) {
    alert('No employment income recorded for this year. Enter T4 Box 14 on the Personal Tax page first.');
    return;
  }

  const blob = await createPdfBlob(T4Document, {
    settings: s,
    employeeName,
    year: String(year),
    py,
  });
  downloadBlob(blob, `T4-${year}-${(employeeName).replace(/\s+/g, '_')}.pdf`);
}

// ─── T1/T2 Tax Worksheet PDF ─────────────────────────────────────────────────

export async function exportTaxWorksheetPDF(state, fyKey, userProfile) {
  const { default: TaxWorksheetDocument } = await import('@/components/TaxWorksheetDocument');
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
  const totalCCA = (fy.ccaClasses ?? []).reduce((acc, c) => acc + (c.claimedAmount || 0), 0);
  const totalDeductions = totalDeductible + (hoResult?.deductible ?? 0) + totalCCA;
  const corp = calculateCorporateTax(grossRevenue, totalDeductions);
  const hst = calculateHSTSummary(invoices, expenses);

  const year = parseInt((fyKey ?? '').replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
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

  const blob = await createPdfBlob(TaxWorksheetDocument, {
    settings: s,
    fyKey: String(year),
    corp,
    hst,
    personal,
    py,
  });
  downloadBlob(blob, `Tax-Worksheet-${year}-${(s?.companyName ?? 'corp').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

// ─── GIFI Financial Statements ───────────────────────────────────────────────
// CRA RC4088 — General Index of Financial Information
// Produces a tab-delimited CODE\tAMOUNT file for import into UFile T2,
// TaxPrep, Cantax, ProFile and other CRA-certified T2 software.

// Expense category → Schedule 125 GIFI operating expense code
const EXPENSE_CATEGORY_GIFI = {
  advertising:            8521,  // Advertising
  bank_fees:              8715,  // Bank charges
  business_meals:         8523,  // Meals and entertainment
  education:              9200,  // Travel expenses (incl. seminars/training)
  equipment:              8810,  // Office expenses (directly-expensed equipment)
  home_office:            8911,  // Real estate rental (home office portion)
  insurance:              8690,  // Insurance
  legal_professional:     8860,  // Professional fees
  office_supplies:        8811,  // Office stationery and supplies
  software_subscriptions: 9150,  // Computer-related expenses
  telephone_internet:     9225,  // Telephone and telecommunications
  travel:                 9200,  // Travel expenses
  vehicle:                9281,  // Vehicle expenses
  wages_salaries:         9060,  // Salaries and wages
  other:                  9270,  // Other expenses
};

export function exportGIFI(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return;
  const { fy, invoices, expenses } = data;
  const s = state.settings;

  // ── Schedule 125 — Income Statement ──────────────────────────────────────

  // Revenue: paid and sent invoices
  const grossRevenue = invoices
    .filter(i => i.status === 'paid' || i.status === 'sent')
    .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

  // Accumulate deductible expense amounts by GIFI code
  const gifiExpenses = {};
  for (const e of expenses) {
    const code = EXPENSE_CATEGORY_GIFI[e.category] ?? 9270;
    const deductible = getDeductibleAmount(e.amount, e.category, e.businessUsePercent ?? 100);
    if (deductible > 0) {
      gifiExpenses[code] = (gifiExpenses[code] ?? 0) + deductible;
    }
  }

  // Home office deduction → 8911 (Real estate rental blend)
  const hoResult = calculateHomeOfficeDeduction(fy.homeOffice ?? {});
  const homeOfficeDeduction = hoResult?.deductible ?? 0;
  if (homeOfficeDeduction > 0) {
    gifiExpenses[8911] = (gifiExpenses[8911] ?? 0) + homeOfficeDeduction;
  }

  // CCA → 8670 (Amortization of tangible assets)
  const totalCCA = (fy.ccaClasses ?? []).reduce((sum, c) => sum + (c.claimedAmount || 0), 0);
  if (totalCCA > 0) {
    gifiExpenses[8670] = (gifiExpenses[8670] ?? 0) + totalCCA;
  }

  const totalDeductions = Object.values(gifiExpenses).reduce((sum, v) => sum + v, 0);

  // Net income = revenue minus expenses (pre-tax; UFile calculates corporate tax on Schedule 1)
  const netIncome = grossRevenue - totalDeductions;

  // ── Schedule 100 — Balance Sheet ─────────────────────────────────────────

  const openingRE    = fy.openingRetainedEarnings ?? 0;
  const totalDivsPaid = (fy.dividendsPaid ?? []).reduce((sum, d) => sum + (d.amount || 0), 0);
  const reClosing    = openingRE + netIncome - totalDivsPaid;
  const commonShares = s.commonSharesIssued ?? 1;
  const totalEquity  = commonShares + reClosing;

  // Shareholder loan closing balance
  const sl = fy.shareholderLoan ?? { openingBalance: 0, transactions: [] };
  const slClosing = (sl.openingBalance || 0) + (sl.transactions || []).reduce(
    (sum, t) => t.type === 'withdrawal' ? sum + (t.amount || 0) : sum - (t.amount || 0), 0
  );
  const slLiability = Math.max(0, slClosing);   // owed TO shareholder → current liability
  const slAsset     = Math.max(0, -slClosing);  // owed BY shareholder → current asset

  // Capital assets – closing UCC
  const equipUCC = (fy.ccaClasses ?? []).reduce((sum, c) =>
    sum + Math.max(0, (c.openingUCC || 0) + (c.additions || 0) - (c.disposals || 0) - (c.claimedAmount || 0)), 0);

  // Outstanding AR (sent but not yet paid)
  const arOutstanding = invoices
    .filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

  // Total assets must be ≥ 0. If equity is in deficit and there's no
  // recorded shareholder loan to cover it, add an implicit one.
  // (The owner must have funded the losses somehow — this reflects reality.)
  const knownNonCashAssets = arOutstanding + equipUCC + slAsset;
  const computedTotal = slLiability + totalEquity; // may be negative
  const totalAssets = Math.max(knownNonCashAssets, computedTotal);
  const implicitSlLoan = Math.max(0, totalAssets - computedTotal);
  const effectiveSlLiability = slLiability + implicitSlLoan;
  const totalLiabilities = effectiveSlLiability;
  const cashAmount = Math.max(0, totalAssets - knownNonCashAssets);

  // ── Build output ──────────────────────────────────────────────────────────

  const r = n => Math.round(n);   // CRA requires whole dollars; no cents
  const lines = [];

  const add = (code, amount, force = false) => {
    const rounded = r(amount);
    if (force || rounded !== 0) lines.push(`${code}|${Math.abs(rounded)}`);
  };

  // — Schedule 100: Assets (must come before Schedule 125) —
  if (cashAmount > 0)      add(1001, cashAmount);      // Cash
  if (arOutstanding > 0)   add(1060, arOutstanding);   // Accounts receivable
  if (slAsset > 0)         add(1301, slAsset);          // Due from shareholder
  add(1599, totalAssets - equipUCC, true);              // Total current assets (REQUIRED)
  if (equipUCC > 0)        add(2008, equipUCC);         // Total tangible capital assets
  add(2599, totalAssets, true);                         // Total assets (REQUIRED)

  // — Schedule 100: Liabilities —
  if (slLiability > 0)     add(2781, slLiability);     // Due to individual shareholder
  add(3499, totalLiabilities, true);                   // Total liabilities (REQUIRED)

  // — Schedule 100: Equity total only (sub-items omitted — sign-dependent cross-checks break with abs()) —
  add(3620, totalEquity, true);                        // Total shareholder equity (REQUIRED)

  // — Schedule 125: Revenue —
  add(8000, grossRevenue);         // Trade sales of goods and services
  add(8299, grossRevenue, true);   // Total revenue (REQUIRED)

  // — Schedule 125: Operating Expenses (sorted by code) —
  for (const code of Object.keys(gifiExpenses).map(Number).sort((a, b) => a - b)) {
    add(code, gifiExpenses[code]);
  }
  add(9368, totalDeductions, true); // Total expenses (REQUIRED)
  add(9999, netIncome, true);       // Net income/loss (REQUIRED)

  // ── Header line ─────────────────────────────────────────────────────────────
  const bn = (s?.businessNumber ?? '').replace(/\D/g, '').slice(0, 9);
  const corpName = (s?.companyName ?? '').replace(/"/g, '');
  const address  = (s?.address ?? '').replace(/"/g, '');
  const city     = (s?.city ?? '').replace(/"/g, '');
  const prov     = s?.province ?? 'ON';
  const postal   = (s?.postalCode ?? '').replace(/"/g, '');

  // Fiscal year-end → YYYYMMDD (no time component)
  const fiscalEnd = fy.endDate
    ? fy.endDate.replace(/-/g, '').slice(0, 8)
    : `${fyKey}1130`;

  // Export date → YYYYMMDD
  const now = new Date();
  const p2  = n => String(n).padStart(2, '0');
  const exportDate = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}`;

  const header = `"GIFI01","${bn}","ASCII","-","L","${corpName}","","${address}","${city}","${prov}","${postal.replace(/\s/g, '')}","","${fiscalEnd}","${exportDate}"`;

  const companySlug = (s?.companyName ?? 'corp').replace(/[^a-zA-Z0-9]/g, '_');
  // Use ASCII encoding explicitly — no UTF-8 BOM
  const content = [header, ...lines].join('\r\n');
  const bytes = new Uint8Array(content.split('').map(c => c.charCodeAt(0) & 0xFF));
  const blob = new Blob([bytes], { type: 'text/plain;charset=us-ascii' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GIFI-${fyKey}-${companySlug}.gfi`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── FutureTax T2 CSV Exports ─────────────────────────────────────────────────
// FutureTax imports S100 and S125 via Tools → Import CSV/GFI File separately.
// Format: Row 1 header "Code,Amount", Row 2+ data rows with whole-dollar amounts.

function _computeGIFIData(state, fyKey) {
  const data = resolveFYData(state, fyKey);
  if (!data) return null;
  const { fy, invoices, expenses } = data;
  const s = state.settings;

  // S125 — revenue
  const grossRevenue = invoices
    .filter(i => i.status === 'paid' || i.status === 'sent')
    .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

  // S125 — expenses by GIFI code
  const gifiExpenses = {};
  for (const e of expenses) {
    const code = EXPENSE_CATEGORY_GIFI[e.category] ?? 9270;
    const deductible = getDeductibleAmount(e.amount, e.category, e.businessUsePercent ?? 100);
    if (deductible > 0) gifiExpenses[code] = (gifiExpenses[code] ?? 0) + deductible;
  }
  const hoResult = calculateHomeOfficeDeduction(fy.homeOffice ?? {});
  const homeOfficeDeduction = hoResult?.deductible ?? 0;
  if (homeOfficeDeduction > 0) gifiExpenses[8911] = (gifiExpenses[8911] ?? 0) + homeOfficeDeduction;
  const totalCCA = (fy.ccaClasses ?? []).reduce((sum, c) => sum + (c.claimedAmount || 0), 0);
  if (totalCCA > 0) gifiExpenses[8670] = (gifiExpenses[8670] ?? 0) + totalCCA;

  const totalDeductions = Object.values(gifiExpenses).reduce((sum, v) => sum + v, 0);
  const netIncome = grossRevenue - totalDeductions;

  // S100 — balance sheet
  const openingRE     = fy.openingRetainedEarnings ?? 0;
  const totalDivsPaid = (fy.dividendsPaid ?? []).reduce((sum, d) => sum + (d.amount || 0), 0);
  const reClosing     = openingRE + netIncome - totalDivsPaid;
  const commonShares  = s.commonSharesIssued ?? 1;
  const totalEquity   = commonShares + reClosing;
  const sl = fy.shareholderLoan ?? { openingBalance: 0, transactions: [] };
  const slClosing     = (sl.openingBalance || 0) + (sl.transactions || []).reduce(
    (sum, t) => t.type === 'withdrawal' ? sum + (t.amount || 0) : sum - (t.amount || 0), 0,
  );
  const slLiability   = Math.max(0, slClosing);
  const slAsset       = Math.max(0, -slClosing);
  const equipUCC      = (fy.ccaClasses ?? []).reduce((sum, c) =>
    sum + Math.max(0, (c.openingUCC || 0) + (c.additions || 0) - (c.disposals || 0) - (c.claimedAmount || 0)), 0);
  const arOutstanding = invoices
    .filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

  // Total assets = liabilities + equity. When equity is a deep deficit and no
  // shareholder loan is recorded, this can go negative — which FutureTax rejects.
  // If that happens, add an implicit "Due to shareholder" loan to keep assets ≥ 0.
  const knownNonCashAssets    = arOutstanding + equipUCC + slAsset;
  const rawTotal              = slLiability + totalEquity;
  const totalAssets           = Math.max(knownNonCashAssets, rawTotal);
  const implicitSlLoan        = Math.max(0, totalAssets - rawTotal);
  const effectiveSlLiability  = slLiability + implicitSlLoan;
  const totalLiabilities      = effectiveSlLiability;
  const cashAmount            = Math.max(0, totalAssets - knownNonCashAssets);

  const r = n => Math.round(n);
  const s100 = [], s125 = [];
  const addLine = (arr, code, amount, force = false) => {
    const rounded = r(amount);
    if (force || rounded !== 0) arr.push([code, Math.abs(rounded)]);
  };

  // S100 — pre-compute balanced integer totals so 2599 = 3499 + 3620 exactly.
  const r3499 = r(totalLiabilities);
  const r3620 = r(totalEquity); // may be negative (deficit); preserve sign
  const r2599 = r3499 + r3620; // guaranteed to balance, no independent rounding

  // Assets (ascending code order, before liabilities section)
  if (cashAmount > 0)    s100.push([1001, r(cashAmount)]);
  if (arOutstanding > 0) s100.push([1060, r(arOutstanding)]);
  if (slAsset > 0)       s100.push([1301, r(slAsset)]);
  s100.push([1599, r(Math.max(0, totalAssets - equipUCC))]); // total current assets
  if (equipUCC > 0)      s100.push([2008, r(equipUCC)]);
  s100.push([2599, r2599]); // Total assets — REQUIRED

  // Liabilities
  if (effectiveSlLiability > 0) s100.push([2781, r(effectiveSlLiability)]);
  s100.push([3499, r3499]); // Total liabilities — REQUIRED

  // Equity
  s100.push([3620, r3620]); // Total shareholder equity — REQUIRED (validity check code)

  // S125 lines
  addLine(s125, 8000, grossRevenue);
  addLine(s125, 8299, grossRevenue, true);
  for (const code of Object.keys(gifiExpenses).map(Number).sort((a, b) => a - b)) {
    addLine(s125, code, gifiExpenses[code]);
  }
  addLine(s125, 9368, totalDeductions, true);
  addLine(s125, 9999, netIncome, true);

  return { s100, s125, s, fy };
}

export function exportFutureTaxS100CSV(state, fyKey) {
  const result = _computeGIFIData(state, fyKey);
  if (!result) return;
  const { s100, s } = result;
  const rows = ['Code,Amount', ...s100.map(([code, amt]) => `${code},${amt}`)];
  const slug = (s?.companyName ?? 'corp').replace(/[^a-zA-Z0-9]/g, '_');
  download(`FutureTax-S100-${fyKey}-${slug}.csv`, rows.join('\r\n'), 'text/csv');
}

export function exportFutureTaxS125CSV(state, fyKey) {
  const result = _computeGIFIData(state, fyKey);
  if (!result) return;
  const { s125, s } = result;
  const rows = ['Code,Amount', ...s125.map(([code, amt]) => `${code},${amt}`)];
  const slug = (s?.companyName ?? 'corp').replace(/[^a-zA-Z0-9]/g, '_');
  download(`FutureTax-S125-${fyKey}-${slug}.csv`, rows.join('\r\n'), 'text/csv');
}

export function exportFutureTaxCorpInfo(state, fyKey) {
  const s = state.settings;
  const fy = state.fiscalYears?.[fyKey];
  if (!s || !fy) return;
  const lines = [
    '=== FutureTax T2 — Corporation Identification ===',
    'Copy the values below into FutureTax Page 1 (Identification section).',
    '',
    `Business Number (BN):          ${s.businessNumber ?? ''}`,
    `Corporation Name:              ${s.companyName ?? ''}`,
    `Legal Name (if different):     ${s.legalName ?? ''}`,
    `Province / Territory:          ${s.province ?? 'ON'}`,
    `Address:                       ${s.address ?? ''}`,
    `City:                          ${s.city ?? ''}`,
    `Postal Code:                   ${s.postalCode ?? ''}`,
    `Phone:                         ${s.phone ?? ''}`,
    `Email:                         ${s.email ?? ''}`,
    '',
    `Fiscal Year Start:             ${fy.startDate ?? ''}`,
    `Fiscal Year End:               ${fy.endDate ?? ''}`,
    `HST Number:                    ${s.hstNumber ?? ''}`,
    `Incorporation Year:            ${s.incorporationYear ?? ''}`,
    '',
    'Fields to fill in FutureTax:',
    '  001  Business number (BN)',
    '  002  Corporation name',
    '  010–018  Head office address',
    '  060  Fiscal year-end date',
  ];
  const slug = (s?.companyName ?? 'corp').replace(/[^a-zA-Z0-9]/g, '_');
  download(`FutureTax-CorpInfo-${fyKey}-${slug}.txt`, lines.join('\r\n'), 'text/plain');
}

// ─── FutureTax S141 — GIFI Additional Information ────────────────────────────
// Schedule 141 asks who prepared the financials and what type of engagement.
// Defaults assume an owner-manager self-filing with no outside accountant.
// Users should verify Part 4 questions before filing.
export function exportFutureTaxS141CSV(state, fyKey) {
  const s = state.settings;
  if (!s) return;

  // S141 codes: value 1 = Yes/Selected, 2 = No
  // Part 1 — Person primarily involved with financial information
  // Owner = can be identified (111=1), no accounting designation (095=2), is connected (097=1)
  const rows = [
    [111, 1],  // Can you identify the person? Yes
    [95,  2],  // Professional accounting designation? No
    [97,  1],  // Connected to the corporation? Yes (owner)
    // Part 2 — Type of involvement: 302 = Conducted a compilation engagement
    [302, 1],
    // Part 4 — Other information (safe "No" defaults for a simple owner-managed corp)
    [101, 2],  // Notes to financial statements prepared? No
    [104, 2],  // Subsequent events? No
    [105, 2],  // Assets re-evaluated? No
    [106, 2],  // Contingent liabilities? No
    [107, 2],  // Commitments? No
    [108, 2],  // Investments in JV/partnerships? No
    [200, 2],  // Impairment/fair value changes? No
    [250, 2],  // Derecognize financial instruments? No
    [255, 2],  // Apply hedge accounting? No
    [260, 2],  // Discontinue hedge accounting? No
    [265, 2],  // Opening balance adjustment? No
    // Part 5 — Who prepared the T2 return: 310 = Owner/self (prepared it themselves)
    [310, 1],
  ];

  const csvRows = ['Code,Amount', ...rows.map(([code, amt]) => `${code},${amt}`)];
  const slug = (s?.companyName ?? 'corp').replace(/[^a-zA-Z0-9]/g, '_');
  download(`FutureTax-S141-${fyKey}-${slug}.csv`, csvRows.join('\r\n'), 'text/csv');
}

// ─── FutureTax T1 — Personal Income Summary ──────────────────────────────────
// Generates a plain-text cheat sheet of key T1 line numbers for quick manual
// entry into FutureTax Personal or any other T1 tax software.
export function exportFutureTaxT1Info(userProfile, fyKey) {
  const year = parseInt((fyKey ?? '').replace(/[^0-9]/g, '').slice(0, 4), 10) || new Date().getFullYear();
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

  const fmt = v => (Math.round((v ?? 0) * 100) / 100).toFixed(2);
  const lines = [
    `CanBooks — FutureTax T1 Personal Income Summary`,
    `Tax Year: ${year}`,
    `Generated: ${new Date().toLocaleString('en-CA')}`,
    ``,
    `─────────────────────────────────────────────────────────`,
    `INCOME`,
    `─────────────────────────────────────────────────────────`,
    `Line 10100  Employment Income (T4 Box 14)           $${fmt(py.employmentIncome)}`,
    `Line 12000  Taxable non-eligible dividends          $${fmt(personal.neGrossedUp)}`,
    `            (actual $${fmt(py.nonEligibleDivs ?? 0)} × 1.15 gross-up)`,
    `Line 12010  Taxable eligible dividends              $${fmt(personal.elGrossedUp)}`,
    `            (actual $${fmt(py.eligibleDivs ?? 0)} × 1.38 gross-up)`,
    `Line 13000  Other income                            $${fmt(py.otherIncome)}`,
    ``,
    `            Total Income (Line 15000)               $${fmt(personal.totalIncome)}`,
    ``,
    `─────────────────────────────────────────────────────────`,
    `DEDUCTIONS`,
    `─────────────────────────────────────────────────────────`,
    `Line 20800  RRSP Deduction                          $${fmt(py.rrspDeduction)}`,
    ``,
    `            Net Income (Line 23600)                 $${fmt(personal.netIncome)}`,
    ``,
    `─────────────────────────────────────────────────────────`,
    `T4 SLIP BOXES (for manual entry)`,
    `─────────────────────────────────────────────────────────`,
    `Box 22  Income Tax Withheld                         $${fmt(py.taxWithheld)}`,
    `Box 16  CPP Employee Contributions                  $${fmt(py.cppContributions)}`,
    `Box 18  EI Employee Premiums                        $${fmt(py.eiPremiums)}`,
    ``,
    `─────────────────────────────────────────────────────────`,
    `TAX SUMMARY`,
    `─────────────────────────────────────────────────────────`,
    `            Federal Tax                             $${fmt(personal.fedTax)}`,
    `            Ontario Tax                             $${fmt(personal.onTax)}`,
    `Line 43500  Total Tax Payable                       $${fmt(personal.totalTax)}`,
    ``,
    personal.balanceOwing >= 0
      ? `Line 48500  Balance Owing                           $${fmt(personal.balanceOwing)}`
      : `Line 48400  Refund                                  $${fmt(Math.abs(personal.balanceOwing))}`,
    ``,
    `─────────────────────────────────────────────────────────`,
    `NOTE: These are estimates only. Verify all amounts against`,
    `your official CRA T4/T5 slips before filing.`,
  ];

  download(`FutureTax-T1Info-${year}.txt`, lines.join('\n'), 'text/plain');
}
