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

// ─── PERSONAL TAX ───────────────────────────────────────────────────────────

/**
 * Calculate Ontario personal income tax including dividend tax credits.
 * @param {object} params
 *   rrspDeduction      - RRSP contributions deducted
 *   nonEligibleDivs    - Non-eligible dividends received (actual amount)
 *   eligibleDivs       - Eligible dividends received (actual amount)
 *   otherIncome        - Other employment/self-employment income
 */
export function calculatePersonalTax({
  nonEligibleDivs = 0,
  eligibleDivs = 0,
  otherIncome = 0,
  rrspDeduction = 0,
}) {
  const neRates = DIVIDEND_RATES_2025.non_eligible;
  const elRates = DIVIDEND_RATES_2025.eligible;

  // Gross up dividends
  const neGrossedUp = nonEligibleDivs * (1 + neRates.gross_up);
  const elGrossedUp = eligibleDivs * (1 + elRates.gross_up);
  const grossedUpDivTotal = neGrossedUp + elGrossedUp;

  // Total income before deductions
  const totalIncome = otherIncome + grossedUpDivTotal;

  // Net income (after RRSP)
  const rrspActual = Math.min(rrspDeduction, totalIncome);
  const netIncome = Math.max(0, totalIncome - rrspActual);

  // Federal tax
  const fedBPA_credit = BPA_FEDERAL_2025 * 0.15; // 15% credit
  const fedGrossIncomeTax = calcBracketedTax(netIncome, FEDERAL_BRACKETS_2025);

  // Federal dividend tax credits
  const fedNeDTC = neGrossedUp * neRates.fed_dtc_rate;
  const fedElDTC = elGrossedUp * elRates.fed_dtc_rate;
  const fedDTC = fedNeDTC + fedElDTC;

  let fedTax = Math.max(0, fedGrossIncomeTax - fedBPA_credit - fedDTC);

  // Ontario tax
  const onBPA_credit = BPA_ONTARIO_2025 * 0.0505; // 5.05% credit
  const onGrossIncomeTax = calcBracketedTax(netIncome, ONTARIO_BRACKETS_2025);

  // Ontario dividend tax credits
  const onNeDTC = neGrossedUp * neRates.on_dtc_rate;
  const onElDTC = elGrossedUp * elRates.on_dtc_rate;
  const onDTC = onNeDTC + onElDTC;

  let onBasicTax = Math.max(0, onGrossIncomeTax - onBPA_credit - onDTC);

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
  const totalTax = fedTax + onTax;
  const effectiveRate = totalIncome > 0 ? totalTax / totalIncome : 0;
  const afterTaxIncome = netIncome - totalTax;

  return {
    nonEligibleDivs,
    eligibleDivs,
    otherIncome,
    rrspDeduction: rrspActual,
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
    fedTax,
    onGrossIncomeTax,
    onBPA_credit,
    onNeDTC,
    onElDTC,
    onDTC,
    onBasicTax,
    onSurtax,
    ohp,
    onTax,
    totalTax,
    effectiveRate,
    afterTaxIncome,
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
