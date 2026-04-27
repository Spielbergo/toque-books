// Canadian tax rates and constants
// Updated for 2025 tax year

export const PROVINCES = {
  ON: 'Ontario',
  BC: 'British Columbia',
  AB: 'Alberta',
  QC: 'Quebec',
  MB: 'Manitoba',
  SK: 'Saskatchewan',
  NS: 'Nova Scotia',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  PE: 'Prince Edward Island',
};

export const HST_RATES = {
  ON: 0.13,
  BC: 0.05,  // GST only
  AB: 0.05,  // GST only
  QC: 0.05,  // GST only (QST separate)
  MB: 0.05,  // GST + provincial
  SK: 0.05,  // GST only
  NB: 0.15,
  NS: 0.15,
  NL: 0.15,
  PE: 0.15,
};

// 2025 Federal personal income tax brackets
export const FEDERAL_BRACKETS_2025 = [
  { up_to: 57375,    rate: 0.15   },
  { up_to: 114750,   rate: 0.205  },
  { up_to: 158519,   rate: 0.26   },
  { up_to: 220000,   rate: 0.29   },
  { up_to: Infinity, rate: 0.33   },
];

// 2025 Ontario income tax brackets
export const ONTARIO_BRACKETS_2025 = [
  { up_to: 51446,    rate: 0.0505 },
  { up_to: 102894,   rate: 0.0915 },
  { up_to: 150000,   rate: 0.1116 },
  { up_to: 220000,   rate: 0.1216 },
  { up_to: Infinity, rate: 0.1316 },
];

// 2025 basic personal amounts
export const BPA_FEDERAL_2025 = 16129;
export const BPA_ONTARIO_2025 = 11865;

// Ontario surtax thresholds 2025
export const ON_SURTAX_1_THRESHOLD = 5315;   // 20% surtax on ON tax above this
export const ON_SURTAX_2_THRESHOLD = 6802;   // additional 36% on ON tax above this

// 2025 Corporate tax rates
export const CORPORATE_RATES_2025 = {
  // Federal
  fed_base: 0.38,
  fed_abatement: 0.10,           // Provincial abatement
  fed_sbd: 0.19,                 // Small Business Deduction (total fed with SBD = 9%)
  fed_grr: 0.13,                 // General Rate Reduction (total fed general = 15%)
  fed_sbd_net: 0.09,             // Effective federal rate on SBD income
  fed_general_net: 0.15,         // Effective federal rate on general income
  sbd_limit: 500000,             // Small Business Deduction limit
  // Ontario
  on_small: 0.032,               // Ontario small business rate (3.2%)
  on_general: 0.115,             // Ontario general rate (11.5%)
  // Combined
  combined_small: 0.122,         // 9% + 3.2%
  combined_general: 0.265,       // 15% + 11.5%
};

// Dividend gross-up and DTC rates 2025
export const DIVIDEND_RATES_2025 = {
  non_eligible: {
    gross_up: 0.15,
    fed_dtc_rate: 0.090301,      // % of grossed-up dividend
    on_dtc_rate: 0.032863,       // % of grossed-up dividend
  },
  eligible: {
    gross_up: 0.38,
    fed_dtc_rate: 0.150198,      // % of grossed-up dividend
    on_dtc_rate: 0.10,           // % of grossed-up dividend
  },
};

// RRSP contribution limit 2025
export const RRSP_LIMIT_2025 = 32490;
export const RRSP_RATE = 0.18; // 18% of prior year earned income

export const EXPENSE_CATEGORIES = [
  { value: 'advertising',           label: 'Advertising & Marketing' },
  { value: 'bank_fees',             label: 'Bank Fees & Interest' },
  { value: 'business_meals',        label: 'Business Meals (50% deductible)' },
  { value: 'education',             label: 'Education & Training' },
  { value: 'equipment',             label: 'Equipment & Hardware' },
  { value: 'home_office',           label: 'Home Office' },
  { value: 'insurance',             label: 'Insurance' },
  { value: 'legal_professional',    label: 'Legal & Professional Fees' },
  { value: 'office_supplies',       label: 'Office Supplies' },
  { value: 'software_subscriptions',label: 'Software & Subscriptions' },
  { value: 'telephone_internet',    label: 'Telephone & Internet' },
  { value: 'training',              label: 'Training & Professional Development' },
  { value: 'travel',                label: 'Travel' },
  { value: 'vehicle',               label: 'Vehicle & Transportation' },
  { value: 'wages_salaries',        label: 'Wages & Salaries' },
  { value: 'other',                 label: 'Other' },
];

// Meals & entertainment is 50% deductible in Canada
export const PARTIAL_DEDUCTION_CATEGORIES = {
  business_meals: 0.5,
};

export const INVOICE_STATUSES = [
  { value: 'draft',    label: 'Draft',    color: 'muted'   },
  { value: 'sent',     label: 'Sent',     color: 'info'    },
  { value: 'paid',     label: 'Paid',     color: 'success' },
  { value: 'overdue',  label: 'Overdue',  color: 'danger'  },
  { value: 'void',     label: 'Void',     color: 'muted'   },
];

export const DEFAULT_PAYMENT_TERMS = 30; // days

// Fiscal year helper: Nov 30 end
export function getFiscalYearKey(fiscalEndMonth, fiscalEndDay, calendarYear) {
  // e.g. Nov 30 end: FY covering Dec 1 YYYY to Nov 30 YYYY+1
  const endYear = calendarYear;
  const startYear = calendarYear - 1;
  const start = `${startYear}-${String(fiscalEndMonth + 1).padStart(2, '0')}-${String(fiscalEndDay + 1).padStart(2, '0')}`;
  // Simpler: just return a label
  return `FY${startYear}-${String(endYear).slice(-2)}`;
}

export const CURRENT_TAX_YEAR = 2025;
export const DEFAULT_FISCAL_END_MONTH = 11; // November (1-indexed)
export const DEFAULT_FISCAL_END_DAY = 30;

// 2025 CPP / EI constants
export const CPP_MAX_EMPLOYEE_CONTRIBUTION_2025 = 3867.50; // T4 Box 16 — employee contribution cap
export const EI_MAX_PREMIUM_2025               = 1049.12; // T4 Box 18 — employee premium cap
export const CANADA_EMPLOYMENT_AMOUNT_2025     = 1433;    // Line 31260 claim cap
