/**
 * Canadian Tax Calculation Library
 * Ontario CCPC - 2025 tax year
 */

import {
  FEDERAL_BRACKETS_2025,
  ONTARIO_BRACKETS_2025,
  BPA_FEDERAL_2025,
  BPA_ONTARIO_2025,
  ON_SURTAX_1_THRESHOLD,
  ON_SURTAX_2_THRESHOLD,
  CORPORATE_RATES_2025,
  DIVIDEND_RATES_2025,
  PARTIAL_DEDUCTION_CATEGORIES,
  CPP_MAX_EMPLOYEE_CONTRIBUTION_2025,
  EI_MAX_PREMIUM_2025,
  CANADA_EMPLOYMENT_AMOUNT_2025,
} from './constants.js';

// ─── HELPERS ────────────────────────────────────────────────────────────────

function calcBracketedTax(income, brackets) {
  let tax = 0;
  let prev = 0;
  for (const { up_to, rate } of brackets) {
    if (income <= prev) break;
    const taxable = Math.min(income, up_to) - prev;
    tax += taxable * rate;
    prev = up_to;
  }
  return Math.max(0, tax);
}

// ─── CORPORATE TAX ──────────────────────────────────────────────────────────

/**
 * Calculate Ontario CCPC corporate tax.
 * @param {number} grossRevenue        - Total revenue (before expenses)
 * @param {number} totalDeductibleExp  - Total deductible expenses
 * @returns {object} Corporate tax breakdown
 */
export function calculateCorporateTax(grossRevenue, totalDeductibleExp) {
  const rates = CORPORATE_RATES_2025;
  const netIncome = Math.max(0, grossRevenue - totalDeductibleExp);
  
  // SBD applies to lessor of active business income or $500K
  const sbdIncome = Math.min(netIncome, rates.sbd_limit);
  const generalIncome = Math.max(0, netIncome - sbdIncome);

  // Federal tax
  const fedTaxSBD = sbdIncome * rates.fed_sbd_net;
  const fedTaxGeneral = generalIncome * rates.fed_general_net;
  const fedTax = fedTaxSBD + fedTaxGeneral;

  // Ontario tax
  const onTaxSBD = sbdIncome * rates.on_small;
  const onTaxGeneral = generalIncome * rates.on_general;
  const onTax = onTaxSBD + onTaxGeneral;

  const totalTax = fedTax + onTax;
  const effectiveRate = netIncome > 0 ? totalTax / netIncome : 0;
  const afterTaxIncome = netIncome - totalTax;
  const retainedEarnings = afterTaxIncome; // before dividends

  return {
    grossRevenue,
    totalDeductions: totalDeductibleExp,
    netIncome,
    sbdIncome,
    generalIncome,
    fedTaxSBD,
    fedTaxGeneral,
    fedTax,
    onTaxSBD,
    onTaxGeneral,
    onTax,
    totalTax,
    effectiveRate,
    afterTaxIncome,
    retainedEarnings,
  };
}

// ─── EXPENSE DEDUCTIBILITY ──────────────────────────────────────────────────

/**
 * Calculate deductible amount for an expense.
 * Some categories are only partially deductible (e.g., meals = 50%).
 */
export function getDeductibleAmount(amount, category, businessUsePercent = 100) {
  const partialRate = PARTIAL_DEDUCTION_CATEGORIES[category] ?? 1;
  return amount * partialRate * (businessUsePercent / 100);
}

// ─── HOME OFFICE DEDUCTION ──────────────────────────────────────────────────

/**
 * Calculate home office deduction for a corporation.
 * CRA allows: (office sq ft / total home sq ft) × eligible home expenses
 */
export function calculateHomeOfficeDeduction(homeOffice) {
  const {
    totalHomeSqFt = 0,
    officeSqFt = 0,
    monthlyExpenses = {},
    months = 12,
  } = homeOffice;

  if (!totalHomeSqFt || !officeSqFt) return { percent: 0, annualTotal: 0, deductible: 0 };

  const percent = officeSqFt / totalHomeSqFt;

  const {
    rent = 0,
    mortgageInterest = 0,
    utilities = 0,
    heat = 0,
    internet = 0,
    propertyTax = 0,
    maintenance = 0,
    condoFees = 0,
  } = monthlyExpenses;

  const monthlyTotal = rent + mortgageInterest + utilities + heat + internet + propertyTax + maintenance + condoFees;
  const annualTotal = monthlyTotal * months;
  const deductible = annualTotal * percent;

  return {
    percent,
    percentDisplay: (percent * 100).toFixed(1),
    monthlyTotal,
    annualTotal,
    deductible,
    months,
  };
}

// ─── HST SUMMARY ────────────────────────────────────────────────────────────

/**
 * Summarize HST collected vs ITCs vs net remittance.
 */
export function calculateHSTSummary(invoices, expenses) {
  const hstCollected = invoices
    .filter(inv => ['sent', 'paid'].includes(inv.status))
    .reduce((sum, inv) => sum + (inv.hstAmount || 0), 0);

  const itcTotal = expenses
    .filter(exp => exp.hst && exp.hst > 0)
    .reduce((sum, exp) => {
      // ITC is proportional to business use
      const businessPct = (exp.businessUsePercent ?? 100) / 100;
      return sum + exp.hst * businessPct;
    }, 0);

  const netRemittance = hstCollected - itcTotal;

  return {
    hstCollected,
    itcTotal,
    netRemittance,
  };
}

// ─── MILEAGE DEDUCTION ──────────────────────────────────────────────────────

// CRA 2025 automobile allowance rates
const MILEAGE_RATE_1   = 0.72; // first 5,000 km
const MILEAGE_RATE_2   = 0.66; // balance
const MILEAGE_THRESHOLD = 5000;

/**
 * Calculate CRA mileage allowance deduction from a list of mileage log entries.
 * @param {Array} mileageLogs  - Array of { km, date, purpose, ... }
 * @returns {{ totalKm: number, deductible: number }}
 */
export function calculateMileageDeduction(mileageLogs = []) {
  const totalKm = mileageLogs.reduce((s, l) => s + (parseFloat(l.km) || 0), 0);
  const deductible = totalKm <= MILEAGE_THRESHOLD
    ? totalKm * MILEAGE_RATE_1
    : MILEAGE_THRESHOLD * MILEAGE_RATE_1 + (totalKm - MILEAGE_THRESHOLD) * MILEAGE_RATE_2;
  return { totalKm, deductible, rate1: MILEAGE_RATE_1, rate2: MILEAGE_RATE_2, threshold: MILEAGE_THRESHOLD };
}

// ─── PERSONAL TAX ───────────────────────────────────────────────────────────

/**
 * Calculate Ontario personal income tax including dividend tax credits.
 * @param {object} params
 *   nonEligibleDivs    - Non-eligible dividends received (actual amount, T5 Box 10)
 *   eligibleDivs       - Eligible dividends received (actual amount, T5 Box 24)
 *   employmentIncome   - T4 Box 14 employment income (any source, including own Corp salary)
 *   otherIncome        - Other income: rental, pension, EI benefits, etc.
 *   rrspDeduction      - RRSP contributions deducted (line 20800)
 *   taxWithheld        - T4 Box 22 income tax already withheld at source
 *   cppContributions   - T4 Box 16 CPP employee contributions
 *   eiPremiums         - T4 Box 18 EI employee premiums
 *   spouseNetIncome    - Spouse/partner's net income (null = no spouse; 0 = no income)
 */
export function calculatePersonalTax({
  nonEligibleDivs  = 0,
  eligibleDivs     = 0,
  employmentIncome = 0,
  otherIncome      = 0,
  rrspDeduction    = 0,
  taxWithheld      = 0,
  cppContributions = 0,
  eiPremiums       = 0,
  spouseNetIncome  = null,
}) {
  const neRates = DIVIDEND_RATES_2025.non_eligible;
  const elRates = DIVIDEND_RATES_2025.eligible;

  // Gross up dividends
  const neGrossedUp = nonEligibleDivs * (1 + neRates.gross_up);
  const elGrossedUp = eligibleDivs * (1 + elRates.gross_up);
  const grossedUpDivTotal = neGrossedUp + elGrossedUp;

  // Total income before deductions
  const totalIncome = employmentIncome + otherIncome + grossedUpDivTotal;

  // Net income (after RRSP)
  const rrspActual = Math.min(rrspDeduction, totalIncome);
  const netIncome = Math.max(0, totalIncome - rrspActual);

  // ── Federal tax ──────────────────────────────────────────────────────────
  const fedGrossIncomeTax = calcBracketedTax(netIncome, FEDERAL_BRACKETS_2025);

  // Basic personal amount credit (15%)
  const fedBPA_credit = BPA_FEDERAL_2025 * 0.15;

  // Dividend tax credits
  const fedNeDTC = neGrossedUp * neRates.fed_dtc_rate;
  const fedElDTC = elGrossedUp * elRates.fed_dtc_rate;
  const fedDTC   = fedNeDTC + fedElDTC;

  // Canada Employment Amount credit (15% of min(employment income, $1,433))
  const fedCEA_credit = Math.min(employmentIncome, CANADA_EMPLOYMENT_AMOUNT_2025) * 0.15;

  // CPP employee contributions credit (15%)
  const cppCapped     = Math.min(cppContributions, CPP_MAX_EMPLOYEE_CONTRIBUTION_2025);
  const fedCPP_credit = cppCapped * 0.15;

  // EI premiums credit (15%)
  const eiCapped     = Math.min(eiPremiums, EI_MAX_PREMIUM_2025);
  const fedEI_credit = eiCapped * 0.15;

  // Spousal / partner amount credit (15% of unused BPA — line 30300)
  const fedSpousal_credit = spouseNetIncome !== null
    ? Math.max(0, BPA_FEDERAL_2025 - spouseNetIncome) * 0.15
    : 0;

  const fedTax = Math.max(
    0,
    fedGrossIncomeTax - fedBPA_credit - fedDTC - fedCEA_credit - fedCPP_credit - fedEI_credit - fedSpousal_credit,
  );

  // ── Ontario tax ──────────────────────────────────────────────────────────
  const onGrossIncomeTax = calcBracketedTax(netIncome, ONTARIO_BRACKETS_2025);

  const onBPA_credit = BPA_ONTARIO_2025 * 0.0505;

  const onNeDTC = neGrossedUp * neRates.on_dtc_rate;
  const onElDTC = elGrossedUp * elRates.on_dtc_rate;
  const onDTC   = onNeDTC + onElDTC;

  const onCEA_credit     = Math.min(employmentIncome, CANADA_EMPLOYMENT_AMOUNT_2025) * 0.0505;
  const onCPP_credit     = cppCapped * 0.0505;
  const onEI_credit      = eiCapped  * 0.0505;
  const onSpousal_credit = spouseNetIncome !== null
    ? Math.max(0, BPA_ONTARIO_2025 - spouseNetIncome) * 0.0505
    : 0;

  let onBasicTax = Math.max(
    0,
    onGrossIncomeTax - onBPA_credit - onDTC - onCEA_credit - onCPP_credit - onEI_credit - onSpousal_credit,
  );

  // Ontario Surtax
  let onSurtax = 0;
  if (onBasicTax > ON_SURTAX_1_THRESHOLD) {
    onSurtax += (onBasicTax - ON_SURTAX_1_THRESHOLD) * 0.20;
  }
  if (onBasicTax > ON_SURTAX_2_THRESHOLD) {
    onSurtax += (onBasicTax - ON_SURTAX_2_THRESHOLD) * 0.36;
  }

  // Ontario Health Premium
  const ohp = calcOntarioHealthPremium(netIncome);

  const onTax = onBasicTax + onSurtax + ohp;

  const totalTax    = fedTax + onTax;
  const effectiveRate = totalIncome > 0 ? totalTax / totalIncome : 0;
  const afterTaxIncome = netIncome - totalTax;

  // Balance owing (positive = owe CRA; negative = refund)
  const balanceOwing = totalTax - taxWithheld;

  return {
    nonEligibleDivs,
    eligibleDivs,
    employmentIncome,
    otherIncome,
    rrspDeduction:   rrspActual,
    taxWithheld,
    cppContributions: cppCapped,
    eiPremiums:       eiCapped,
    spouseNetIncome,
    neGrossedUp,
    elGrossedUp,
    grossedUpDivTotal,
    totalIncome,
    netIncome,
    fedGrossIncomeTax,
    fedBPA_credit,
    fedNeDTC,
    fedElDTC,
    fedDTC,
    fedCEA_credit,
    fedCPP_credit,
    fedEI_credit,
    fedSpousal_credit,
    fedTax,
    onGrossIncomeTax,
    onBPA_credit,
    onNeDTC,
    onElDTC,
    onDTC,
    onCEA_credit,
    onCPP_credit,
    onEI_credit,
    onSpousal_credit,
    onBasicTax,
    onSurtax,
    ohp,
    onTax,
    totalTax,
    effectiveRate,
    afterTaxIncome,
    balanceOwing,
  };
}

function calcOntarioHealthPremium(income) {
  if (income <= 20000) return 0;
  if (income <= 36000) return Math.min(300, (income - 20000) * 0.06);
  if (income <= 48000) return Math.min(450, 300 + (income - 36000) * 0.06);
  if (income <= 72000) return Math.min(600, 450 + (income - 48000) * 0.25);
  if (income <= 200000) return Math.min(750, 600 + (income - 72000) * 0.25);
  return Math.min(900, 750 + (income - 200000) * 0.25);
}

// ─── INTEGRATION ANALYSIS ───────────────────────────────────────────────────

/**
 * Combined corporate + personal tax on $1 of corporate income paid as dividend.
 * Shows total tax vs. earning the same income personally.
 */
export function calculateIntegration(corporateIncome, dividendsPaid, rrspDeduction = 0) {
  const corp = calculateCorporateTax(corporateIncome, 0);
  const personal = calculatePersonalTax({
    nonEligibleDivs: dividendsPaid,
    rrspDeduction,
  });

  const combinedTax = corp.totalTax + personal.totalTax;
  const personalOnlyTax = calculatePersonalTax({ otherIncome: corporateIncome });
  const taxDifference = combinedTax - personalOnlyTax.totalTax;
  const corporateRetained = corp.afterTaxIncome - dividendsPaid;

  return {
    corporateIncome,
    dividendsPaid,
    corporateTax: corp.totalTax,
    personalTax: personal.totalTax,
    combinedTax,
    personalOnlyTax: personalOnlyTax.totalTax,
    taxDifference,
    integrationEfficiency: corporateIncome > 0 ? (1 - combinedTax / corporateIncome) * 100 : 0,
    corporateRetained,
  };
}
