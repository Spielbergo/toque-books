'use client';

import { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import { today, addDays } from '@/lib/formatters';
import { HST_RATES } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile, makeDefaultUserProfile } from '@/contexts/UserProfileContext';

// ─── DEFAULT STATE ───────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  companyName: '',
  ownerName: '',
  hstNumber: '',
  province: 'ON',
  fiscalEndMonth: 11,   // November
  fiscalEndDay: 30,
  incorporationYear: new Date().getFullYear(),
  defaultPaymentTerms: 30,
  hstRegistered: true,
  // Business profile (used on invoices)
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  logo: null,           // base64 data URL — used on PDF invoices
  badgeLogo: null,      // base64 data URL — used as sidebar/app badge icon
  invoiceFooterNotes: '',
  legalName: '',           // Legal name if different from trading name
  businessNumber: '',      // CRA Business Number (BN9)
  // Personal account matching
  personalAccountKeywords: '',  // comma-separated nicknames/keywords e.g. "spielbergo, personal"
};

const DEFAULT_HOME_OFFICE = {
  totalHomeSqFt: 0,
  officeSqFt: 0,
  months: 12,
  monthlyExpenses: {
    rent: 0,
    mortgageInterest: 0,
    utilities: 0,
    heat: 0,
    internet: 0,
    propertyTax: 0,
    maintenance: 0,
    condoFees: 0,
  },
};

const DEFAULT_PERSONAL = {
  nonEligibleDivs: 0,
  eligibleDivs: 0,
  otherIncome: 0,
  rrspDeduction: 0,
  rrspRoom: 0,
};

const DEFAULT_BALANCE_SHEET = {
  manualCash: null,           // null = auto-fill from latest bank statement; number = override
  otherCurrentAssets: 0,      // prepaid expenses, deposits, etc.
  otherLongTermAssets: 0,     // long-term investments, deposits
  accountsPayable: 0,
  otherCurrentLiabilities: 0, // accrued liabilities, deferred revenue, etc.
  longTermDebt: 0,
  shareCapital: 1,            // usually $1 for most CCPCs
};

function makeInitialState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    activeFiscalYear: getCurrentFiscalYearLabel(),
    fiscalYears: {
      [getCurrentFiscalYearLabel()]: {
        label: getCurrentFiscalYearLabel(),
        startDate: getCurrentFiscalYearStart(),
        endDate: getCurrentFiscalYearEnd(),
        invoices: [],
        expenses: [],
        homeOffice: { ...DEFAULT_HOME_OFFICE },
        dividendsPaid: [],
        bankStatements: [],
        notes: '',
        openingRetainedEarnings: 0,
        shareholderLoan: { openingBalance: 0, transactions: [] },
        ccaClasses: [],
        hstRemittances: [],   // [{ id, period, amtCollected, itc, netRemittance, remittedDate, confirmationNo, notes }]
        mileageLogs: [],      // [{ id, date, startOdo, endOdo, km, purpose, client, notes }]
        balanceSheet: { ...DEFAULT_BALANCE_SHEET },
        payrollRuns: [],      // [{ id, employeeId, periodStart, periodEnd, grossPay, cpp, ei, incomeTax, netPay }]
      },
    },
    clients: [],
    employees: [],             // [{ id, name, sin, address, city, province, postalCode, birthDate, startDate }]
    t4aRecipients: [],         // [{ id, name, sin, address, city, province, postalCode, taxYear, box048, box020, box028, notes }]
    onboardingCompleted: false,
    businessType: 'ccpc', // 'ccpc' | 'sole_prop' | 'partnership' | 'pc' | 'other'
    businessOps: {
      homeOffice: false,
      vehicleBusiness: false,
      vehicleBusinessPct: 0,
      hasEmployees: false,
      numEmployees: 0,
      paysSelf: 'dividends', // 'dividends' | 'salary' | 'mix' | 'none'
      otherShareholders: false,
    },
    recurringExpenses: [], // [{ id, vendor, description, category, businessUsePercent, amount, hst, frequency, startDate, endDate, notes }]
    recurringInvoices: [], // [{ id, clientId, subject, lineItems, notes, frequency, nextDate, hstRate, active }]
    products: [],          // [{ id, name, description, category, defaultRate, unit, notes, createdAt }]
    personalSubs: [],      // [{ id, name, url, amount, currency, frequency, billingDay, category, notes, active }]
    timeEntries: [],       // [{ id, clientId, projectId, description, date, startTime, endTime, durationMinutes, billable, rate, invoiceId, createdAt }]
    projects: [],          // [{ id, name, clientId, status, description, dueDate, tasks: [], createdAt }]
    proposals: [],         // [{ id, number, clientId, title, description, lineItems, subtotal, hstAmount, total, status, validUntil, sentAt, acceptedAt, notes, publicToken, createdAt }]
  };
}

function getCurrentFiscalYearLabel() {
  // Fiscal year ending Nov 30, 2025 → label "FY2024-25"
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const year = now.getFullYear();
  // If before December, fiscal end is this year
  const endYear = month <= 11 ? year : year + 1;
  return `FY${endYear - 1}-${String(endYear).slice(-2)}`;
}

function getCurrentFiscalYearStart() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const endYear = month <= 11 ? year : year + 1;
  return `${endYear - 1}-12-01`;
}

function getCurrentFiscalYearEnd() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const endYear = month <= 11 ? year : year + 1;
  return `${endYear}-11-30`;
}

function withTimeout(promise, ms, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

async function withTimeoutRetry(taskFactory, {
  label = 'request',
  timeoutMs = 30000,
  retries = 1,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await withTimeout(taskFactory(), timeoutMs, label);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      if (!String(error?.message || '').includes('timed out')) break;
    }
  }
  throw lastError;
}

// ─── REDUCER ────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    // Settings
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    // Fiscal year management
    case 'SET_ACTIVE_FISCAL_YEAR':
      return { ...state, activeFiscalYear: action.payload };
    case 'ADD_FISCAL_YEAR': {
      const { key, label, startDate, endDate } = action.payload;
      // Carry-forward values from the most recent previous FY
      const prevFYKeys = Object.keys(state.fiscalYears || {}).filter(k => k !== 'all').sort();
      const prevFY = prevFYKeys.length > 0 ? state.fiscalYears[prevFYKeys[prevFYKeys.length - 1]] : null;
      // CCA: carry closing UCC as new opening UCC, reset current-year add/disp/claimed
      const carriedCCA = (prevFY?.ccaClasses || []).map(c => ({
        ...c,
        openingUCC: Math.max(0, (c.openingUCC || 0) + (c.additions || 0) - (c.disposals || 0) - (c.claimedAmount || 0)),
        additions: 0,
        disposals: 0,
        claimedAmount: 0,
      }));
      // Shareholder loan: carry closing balance as new opening balance
      const prevSL = prevFY?.shareholderLoan ?? { openingBalance: 0, transactions: [] };
      const prevSLClosing = (prevSL.openingBalance || 0) +
        (prevSL.transactions || []).reduce((sum, t) =>
          t.type === 'withdrawal' ? sum + (t.amount || 0) : sum - (t.amount || 0), 0);
      return {
        ...state,
        fiscalYears: {
          ...state.fiscalYears,
          [key]: {
            label,
            startDate,
            endDate,
            invoices: [],
            expenses: [],
            homeOffice: { ...DEFAULT_HOME_OFFICE },
            dividendsPaid: [],
            bankStatements: [],
            notes: '',
            openingRetainedEarnings: 0,
            shareholderLoan: { openingBalance: prevSLClosing, transactions: [] },
            ccaClasses: carriedCCA,
            hstRemittances: [],
            mileageLogs: [],
            balanceSheet: { ...DEFAULT_BALANCE_SHEET },
            payrollRuns: [],
          },
        },
        activeFiscalYear: key,
      };
    }

    // Personal year management
    // Invoices
    case 'ADD_INVOICE': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      const hstRate = HST_RATES[state.settings.province] ?? 0.13;
      const inv = buildInvoice(action.payload, hstRate, fyData.invoices.length + 1, state.settings);
      return updateFY(state, fy, { invoices: [...fyData.invoices, inv] });
    }
    case 'UPDATE_INVOICE': {
      const fy = findItemFY(state, 'invoices', action.payload.id) || resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      return updateFY(state, fy, {
        invoices: fyData.invoices.map(inv =>
          inv.id === action.payload.id ? { ...inv, ...action.payload } : inv
        ),
      });
    }
    case 'DELETE_INVOICE': {
      const fy = findItemFY(state, 'invoices', action.payload) || resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      return updateFY(state, fy, {
        invoices: fyData.invoices.filter(inv => inv.id !== action.payload),
      });
    }

    // Expenses
    case 'ADD_EXPENSE': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      const exp = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return updateFY(state, fy, { expenses: [...fyData.expenses, exp] });
    }
    case 'UPDATE_EXPENSE': {
      const fy = findItemFY(state, 'expenses', action.payload.id) || resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      return updateFY(state, fy, {
        expenses: fyData.expenses.map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload } : e
        ),
      });
    }
    case 'DELETE_EXPENSE': {
      const fy = findItemFY(state, 'expenses', action.payload) || resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      return updateFY(state, fy, {
        expenses: fyData.expenses.filter(e => e.id !== action.payload),
      });
    }

    // Home office
    case 'UPDATE_HOME_OFFICE': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      return updateFY(state, fy, {
        homeOffice: { ...fyData.homeOffice, ...action.payload },
      });
    }

    // Dividends
    case 'ADD_DIVIDEND': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      const div = { id: uuidv4(), ...action.payload };
      return updateFY(state, fy, { dividendsPaid: [...fyData.dividendsPaid, div] });
    }
    case 'DELETE_DIVIDEND': {
      const fy = findItemFY(state, 'dividendsPaid', action.payload) || resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      return updateFY(state, fy, {
        dividendsPaid: fyData.dividendsPaid.filter(d => d.id !== action.payload),
      });
    }

    // Clients
    case 'ADD_CLIENT': {
      const client = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, clients: [...(state.clients || []), client] };
    }
    case 'UPDATE_CLIENT': {
      return {
        ...state,
        clients: (state.clients || []).map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };
    }
    case 'DELETE_CLIENT': {
      return { ...state, clients: (state.clients || []).filter(c => c.id !== action.payload) };
    }

    // Bank statements
    case 'ADD_BANK_STATEMENT': {
      const allFYKeys = Object.keys(state.fiscalYears || {}).filter(k => k !== 'all').sort();
      const fy = (state.activeFiscalYear !== 'all' && state.fiscalYears[state.activeFiscalYear])
        ? state.activeFiscalYear
        : allFYKeys[allFYKeys.length - 1];
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      const stmt = { id: uuidv4(), ...action.payload, uploadedAt: new Date().toISOString() };
      return updateFY(state, fy, { bankStatements: [...(fyData.bankStatements || []), stmt] });
    }
    case 'DELETE_BANK_STATEMENT': {
      // Search all FYs for the statement to delete
      const targetFY = Object.entries(state.fiscalYears || {}).find(([, fyData]) =>
        (fyData.bankStatements || []).some(s => s.id === action.payload)
      )?.[0];
      if (!targetFY) return state;
      const fyData = state.fiscalYears[targetFY];
      return updateFY(state, targetFY, {
        bankStatements: (fyData.bankStatements || []).filter(s => s.id !== action.payload),
      });
    }
    case 'UPDATE_BANK_STATEMENT': {
      const targetFY = Object.entries(state.fiscalYears || {}).find(([, fyData]) =>
        (fyData.bankStatements || []).some(s => s.id === action.payload.id)
      )?.[0];
      if (!targetFY) return state;
      const fyData = state.fiscalYears[targetFY];
      return updateFY(state, targetFY, {
        bankStatements: (fyData.bankStatements || []).map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      });
    }

    // Full restore (import)
    case 'RESTORE':
      return action.payload;

    // Onboarding completion — patches settings + all top-level profile fields
    case 'COMPLETE_ONBOARDING': {
      const { settings, fiscalYearPatch, ...rest } = action.payload;
      let newState = { ...state, onboardingCompleted: true, ...rest };
      if (settings) {
        newState = { ...newState, settings: { ...newState.settings, ...settings } };
      }
      if (fiscalYearPatch) {
        const fy = newState.activeFiscalYear;
        if (fy && newState.fiscalYears[fy]) {
          newState = updateFY(newState, fy, fiscalYearPatch);
        }
      }
      return newState;
    }

    case 'UPDATE_BUSINESS_OPS':
      return { ...state, businessOps: { ...state.businessOps, ...action.payload } };

    // Recurring expenses
    case 'ADD_RECURRING': {
      const rec = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, recurringExpenses: [...(state.recurringExpenses || []), rec] };
    }
    case 'UPDATE_RECURRING': {
      return {
        ...state,
        recurringExpenses: (state.recurringExpenses || []).map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      };
    }
    case 'DELETE_RECURRING': {
      return {
        ...state,
        recurringExpenses: (state.recurringExpenses || []).filter(r => r.id !== action.payload),
      };
    }

    // Personal subscriptions
    case 'ADD_PERSONAL_SUB': {
      const sub = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, personalSubs: [...(state.personalSubs || []), sub] };
    }
    case 'UPDATE_PERSONAL_SUB': {
      return {
        ...state,
        personalSubs: (state.personalSubs || []).map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };
    }
    case 'DELETE_PERSONAL_SUB': {
      return {
        ...state,
        personalSubs: (state.personalSubs || []).filter(s => s.id !== action.payload),
      };
    }

    // Time entries
    case 'ADD_TIME_ENTRY': {
      const entry = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, timeEntries: [...(state.timeEntries || []), entry] };
    }
    case 'UPDATE_TIME_ENTRY': {
      return {
        ...state,
        timeEntries: (state.timeEntries || []).map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload } : e
        ),
      };
    }
    case 'DELETE_TIME_ENTRY': {
      return { ...state, timeEntries: (state.timeEntries || []).filter(e => e.id !== action.payload) };
    }

    // Projects
    case 'ADD_PROJECT': {
      const project = { id: uuidv4(), ...action.payload, tasks: action.payload.tasks || [], createdAt: new Date().toISOString() };
      return { ...state, projects: [...(state.projects || []), project] };
    }
    case 'UPDATE_PROJECT': {
      return {
        ...state,
        projects: (state.projects || []).map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    }
    case 'DELETE_PROJECT': {
      return { ...state, projects: (state.projects || []).filter(p => p.id !== action.payload) };
    }

    // Proposals
    case 'ADD_PROPOSAL': {
      const proposal = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, proposals: [...(state.proposals || []), proposal] };
    }
    case 'UPDATE_PROPOSAL': {
      return {
        ...state,
        proposals: (state.proposals || []).map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    }
    case 'DELETE_PROPOSAL': {
      return { ...state, proposals: (state.proposals || []).filter(p => p.id !== action.payload) };
    }

    // Recurring invoices
    case 'ADD_RECURRING_INVOICE': {
      const rec = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, recurringInvoices: [...(state.recurringInvoices || []), rec] };
    }
    case 'UPDATE_RECURRING_INVOICE': {
      return {
        ...state,
        recurringInvoices: (state.recurringInvoices || []).map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      };
    }
    case 'DELETE_RECURRING_INVOICE': {
      return {
        ...state,
        recurringInvoices: (state.recurringInvoices || []).filter(r => r.id !== action.payload),
      };
    }

    // HST remittances
    case 'ADD_HST_REMITTANCE': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const rem = { id: uuidv4(), ...action.payload };
      return updateFY(state, fy, { hstRemittances: [...(state.fiscalYears[fy].hstRemittances || []), rem] });
    }
    case 'UPDATE_HST_REMITTANCE': {
      const fy = Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.hstRemittances || []).some(r => r.id === action.payload.id)
      )?.[0] || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, {
        hstRemittances: (state.fiscalYears[fy].hstRemittances || []).map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      });
    }
    case 'DELETE_HST_REMITTANCE': {
      const fy = Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.hstRemittances || []).some(r => r.id === action.payload)
      )?.[0] || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, {
        hstRemittances: (state.fiscalYears[fy].hstRemittances || []).filter(r => r.id !== action.payload),
      });
    }

    // Mileage logs
    case 'ADD_MILEAGE': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const entry = { id: uuidv4(), ...action.payload };
      return updateFY(state, fy, { mileageLogs: [...(state.fiscalYears[fy].mileageLogs || []), entry] });
    }
    case 'UPDATE_MILEAGE': {
      const fy = Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.mileageLogs || []).some(m => m.id === action.payload.id)
      )?.[0] || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, {
        mileageLogs: (state.fiscalYears[fy].mileageLogs || []).map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      });
    }
    case 'DELETE_MILEAGE': {
      const fy = Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.mileageLogs || []).some(m => m.id === action.payload)
      )?.[0] || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, {
        mileageLogs: (state.fiscalYears[fy].mileageLogs || []).filter(m => m.id !== action.payload),
      });
    }

    // Products & Services
    case 'ADD_PRODUCT': {
      const product = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, products: [...(state.products || []), product] };
    }
    case 'UPDATE_PRODUCT': {
      return {
        ...state,
        products: (state.products || []).map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    }
    case 'DELETE_PRODUCT': {
      return {
        ...state,
        products: (state.products || []).filter(p => p.id !== action.payload),
      };
    }

    // Retained earnings carry-forward
    case 'SET_FY_OPENING_RE': {
      const { fyKey, amount } = action.payload;
      if (!state.fiscalYears[fyKey]) return state;
      return updateFY(state, fyKey, { openingRetainedEarnings: amount });
    }

    // Shareholder loan transactions
    case 'ADD_SHAREHOLDER_TX': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const sl = state.fiscalYears[fy].shareholderLoan ?? { openingBalance: 0, transactions: [] };
      return updateFY(state, fy, { shareholderLoan: { ...sl, transactions: [...(sl.transactions || []), { id: uuidv4(), ...action.payload }] } });
    }
    case 'UPDATE_SHAREHOLDER_TX': {
      const fy = (Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.shareholderLoan?.transactions || []).some(t => t.id === action.payload.id))?.[0]) || resolveMutableFY(state);
      if (!fy) return state;
      const sl = state.fiscalYears[fy].shareholderLoan ?? { openingBalance: 0, transactions: [] };
      return updateFY(state, fy, { shareholderLoan: { ...sl, transactions: (sl.transactions || []).map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) } });
    }
    case 'DELETE_SHAREHOLDER_TX': {
      const fy = (Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.shareholderLoan?.transactions || []).some(t => t.id === action.payload))?.[0]) || resolveMutableFY(state);
      if (!fy) return state;
      const sl = state.fiscalYears[fy].shareholderLoan ?? { openingBalance: 0, transactions: [] };
      return updateFY(state, fy, { shareholderLoan: { ...sl, transactions: (sl.transactions || []).filter(t => t.id !== action.payload) } });
    }
    case 'SET_SHAREHOLDER_OPENING': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const sl = state.fiscalYears[fy].shareholderLoan ?? { openingBalance: 0, transactions: [] };
      return updateFY(state, fy, { shareholderLoan: { ...sl, openingBalance: action.payload } });
    }

    // Balance sheet
    case 'UPDATE_BALANCE_SHEET': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const bs = state.fiscalYears[fy].balanceSheet ?? { ...DEFAULT_BALANCE_SHEET };
      return updateFY(state, fy, { balanceSheet: { ...bs, ...action.payload } });
    }

    // Employees (top-level — not per FY)
    case 'ADD_EMPLOYEE': {
      const emp = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, employees: [...(state.employees || []), emp] };
    }
    case 'UPDATE_EMPLOYEE': {
      return {
        ...state,
        employees: (state.employees || []).map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload } : e
        ),
      };
    }
    case 'DELETE_EMPLOYEE': {
      return { ...state, employees: (state.employees || []).filter(e => e.id !== action.payload) };
    }

    // T4A recipients (contractors)
    case 'ADD_T4A_RECIPIENT': {
      const rec = { id: uuidv4(), ...action.payload, createdAt: new Date().toISOString() };
      return { ...state, t4aRecipients: [...(state.t4aRecipients || []), rec] };
    }
    case 'UPDATE_T4A_RECIPIENT': {
      return {
        ...state,
        t4aRecipients: (state.t4aRecipients || []).map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      };
    }
    case 'DELETE_T4A_RECIPIENT': {
      return { ...state, t4aRecipients: (state.t4aRecipients || []).filter(r => r.id !== action.payload) };
    }

    // Payroll runs (per FY)
    case 'ADD_PAYROLL_RUN': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      const run = { id: uuidv4(), ...action.payload };
      return updateFY(state, fy, { payrollRuns: [...(state.fiscalYears[fy].payrollRuns || []), run] });
    }
    case 'UPDATE_PAYROLL_RUN': {
      const fy = Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.payrollRuns || []).some(r => r.id === action.payload.id)
      )?.[0] || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, {
        payrollRuns: (state.fiscalYears[fy].payrollRuns || []).map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      });
    }
    case 'DELETE_PAYROLL_RUN': {
      const fy = Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.payrollRuns || []).some(r => r.id === action.payload)
      )?.[0] || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, {
        payrollRuns: (state.fiscalYears[fy].payrollRuns || []).filter(r => r.id !== action.payload),
      });
    }

    // CCA asset classes
    case 'ADD_CCA_CLASS': {
      const fy = resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, { ccaClasses: [...(state.fiscalYears[fy].ccaClasses || []), { id: uuidv4(), ...action.payload }] });
    }
    case 'UPDATE_CCA_CLASS': {
      const fy = (Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.ccaClasses || []).some(c => c.id === action.payload.id))?.[0]) || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, { ccaClasses: (state.fiscalYears[fy].ccaClasses || []).map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) });
    }
    case 'DELETE_CCA_CLASS': {
      const fy = (Object.entries(state.fiscalYears || {}).find(([, d]) =>
        (d.ccaClasses || []).some(c => c.id === action.payload))?.[0]) || resolveMutableFY(state);
      if (!fy) return state;
      return updateFY(state, fy, { ccaClasses: (state.fiscalYears[fy].ccaClasses || []).filter(c => c.id !== action.payload) });
    }

    default:
      return state;
  }
}

function updateFY(state, fy, patch) {
  return {
    ...state,
    fiscalYears: {
      ...state.fiscalYears,
      [fy]: { ...state.fiscalYears[fy], ...patch },
    },
  };
}

// Resolves the FY key to use for mutations. When 'all' is active, falls back to newest real FY.
function resolveMutableFY(state) {
  if (state.activeFiscalYear !== 'all' && state.fiscalYears[state.activeFiscalYear]) {
    return state.activeFiscalYear;
  }
  const keys = Object.keys(state.fiscalYears || {}).filter(k => k !== 'all').sort();
  return keys[keys.length - 1] || null;
}

// Finds which FY contains an item by id in a given array key.
function findItemFY(state, arrayKey, id) {
  return Object.entries(state.fiscalYears || {})
    .find(([, fyData]) => (fyData[arrayKey] || []).some(item => item.id === id))?.[0] || null;
}

function buildInvoice(data, hstRate, invoiceCount, settings) {
  const lineItems = data.lineItems || [{ id: uuidv4(), description: '', quantity: 1, rate: 0, amount: 0 }];
  const subtotal = lineItems.reduce((s, li) => s + (li.amount || li.quantity * li.rate || 0), 0);
  const hstAmount = settings.hstRegistered ? subtotal * hstRate : 0;
  const total = subtotal + hstAmount;
  const issueDate = data.issueDate || today();
  const paymentTerms = data.paymentTerms ?? settings.defaultPaymentTerms;
  return {
    id: data.id || uuidv4(),
    invoiceNumber: data.invoiceNumber || generateInvoiceNumber(invoiceCount),
    client: data.client || { name: '', email: '', address: '' },
    issueDate,
    dueDate: data.dueDate || addDays(issueDate, paymentTerms),
    paymentTerms,
    lineItems,
    subtotal,
    hstRate,
    hstAmount,
    total,
    status: data.status || 'draft',
    paidDate: data.paidDate || '',
    notes: data.notes || '',
    currency: 'CAD',
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

function generateInvoiceNumber(count) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(count).padStart(3, '0')}`;
}

// ─── CONTEXT ────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user, authLoading } = useAuth();

  const [state, dispatch]               = useReducer(reducer, null, makeInitialState);
  const [companies, setCompanies]       = useState([]);
  const [activeCompanyId, setActiveId]  = useState(null);
  const [appLoading, setAppLoading]     = useState(true);

  // Refs for sync logic (avoid stale closures in effects)
  const activeIdRef   = useRef(null);
  const lastLoaded    = useRef(null); // reference-equality check to skip sync on load
  const syncTimer     = useRef(null);

  activeIdRef.current = activeCompanyId;

  // ── User-level personal profile (lives at users/{uid}, not per-company) ──
  const { activePY, activePersonalYear, userProfile, userDispatch, migrateFromCompany } = useUserProfile();

  const wrappedDispatch = useCallback((action) => {
    const userActions = ['UPDATE_PERSONAL_PROFILE', 'SET_DEPENDANTS', 'UPDATE_PERSONAL',
      'SET_ACTIVE_PERSONAL_YEAR', 'UPDATE_OTHER_INCOME_SOURCES',
      'ADD_MEDICAL_EXPENSE', 'DELETE_MEDICAL_EXPENSE', 'ADD_DONATION', 'DELETE_DONATION'];
    if (userActions.includes(action.type)) {
      userDispatch(action);
      return;
    }
    if (action.type === 'COMPLETE_ONBOARDING') {
      const { personalProfile, dependants, otherIncomeSources, ...companyPayload } = action.payload;
      if (personalProfile) userDispatch({ type: 'UPDATE_PERSONAL_PROFILE', payload: personalProfile });
      if (dependants) userDispatch({ type: 'SET_DEPENDANTS', payload: dependants });
      if (otherIncomeSources) userDispatch({ type: 'UPDATE_OTHER_INCOME_SOURCES', payload: otherIncomeSources });
      dispatch({ type: 'COMPLETE_ONBOARDING', payload: companyPayload });
      return;
    }
    if (action.type === 'RESTORE') {
      const { personalProfile, dependants, personalYears, activePersonalYear: aPY,
              otherIncomeSources, ...companyPayload } = action.payload;
      const hasPersonalData = personalProfile || (dependants && dependants.length > 0) || personalYears;
      if (hasPersonalData) {
        const profileMerge = {
          ...makeDefaultUserProfile(),
          ...(personalProfile     && { personalProfile }),
          ...(dependants          && { dependants }),
          ...(personalYears       && { personalYears }),
          ...(aPY                 && { activePersonalYear: aPY }),
          ...(otherIncomeSources  && { otherIncomeSources }),
        };
        userDispatch({ type: 'RESTORE_USER_PROFILE', payload: profileMerge });
      }
      dispatch({ type: 'RESTORE', payload: companyPayload });
      return;
    }
    dispatch(action);
  }, [dispatch, userDispatch]);

  // ── Load company data by ID ────────────────────────────────────────────
  const loadCompanyData = useCallback(async (companyId) => {
    setAppLoading(true);
    try {
      const { data: row, error } = await withTimeoutRetry(
        () => supabase
          .from('companies')
          .select('data')
          .eq('id', companyId)
          .single(),
        { label: 'loadCompanyData', timeoutMs: 12000, retries: 1 },
      );

      if (error) throw error;

      if (row?.data && Object.keys(row.data).length > 0) {
        const rawData = row.data;
        // Extract personal fields for migration (legacy — will be absent on new saves)
        const { personalProfile, dependants, personalYears, activePersonalYear: aPY,
                otherIncomeSources, ...companyOnlyData } = rawData;
        const hasPersonalData = personalProfile || dependants?.length || personalYears;
        if (hasPersonalData) {
          // force=true: bypass migrated guard so a backup-import that embedded personal
          // fields gets correctly promoted to users.personal on every load until cleaned up.
          migrateFromCompany({ personalProfile, dependants, personalYears,
            activePersonalYear: aPY, otherIncomeSources }, true);
          // Clean the personal fields out of the company row so this branch is never
          // triggered again for this company.
          const cleaned = {
            ...companyOnlyData,
            onboardingCompleted: companyOnlyData.onboardingCompleted ?? true,
          };
          supabase.from('companies').update({ data: cleaned }).eq('id', companyId)
            .then(({ error }) => { if (error) console.error('Company data cleanup error:', error); });
        }
        // Back-fill onboardingCompleted for accounts created before this flag existed.
        // undefined (absent) → treat as completed; explicit false → still in onboarding.
        const restoredData = {
          ...companyOnlyData,
          onboardingCompleted: companyOnlyData.onboardingCompleted ?? true,
        };
        lastLoaded.current = restoredData;
        dispatch({ type: 'RESTORE', payload: restoredData });
      } else {
        const init = makeInitialState();
        lastLoaded.current = init;
        dispatch({ type: 'RESTORE', payload: init });
      }

      setActiveId(companyId);
      activeIdRef.current = companyId;
      try { localStorage.setItem('canbooks_active_company', companyId); } catch { /* private browsing */ }
    } catch (err) {
      console.error('loadCompanyData error:', err);
    } finally {
      setAppLoading(false);
    }
  }, [migrateFromCompany]);

  // ── Initial load when user authenticates ──────────────────────────────
  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setActiveId(null);
      activeIdRef.current = null;
      if (!authLoading) setAppLoading(false);
      return;
    }

    (async () => {
      setAppLoading(true);
      try {
        const { data: rows, error } = await withTimeoutRetry(
          () => supabase
            .from('companies')
            .select('id, name, created_at, data')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
          { label: 'loadCompanies', timeoutMs: 12000, retries: 1 },
        );

        if (error) throw error;

        const list = (rows || []).map(r => ({
          id: r.id,
          name: r.name,
          createdAt: r.created_at,
          badgeLogo: r.data?.settings?.badgeLogo || null,
        }));
        setCompanies(list);

        if (list.length === 0) { setAppLoading(false); return; }

        let preferred = null;
        try { preferred = localStorage.getItem('canbooks_active_company'); } catch { /* */ }
        const pick = list.find(c => c.id === preferred) ?? list[0];
        await loadCompanyData(pick.id);
      } catch (err) {
        console.error('Failed to load companies:', err);
        try {
          const fallbackId = localStorage.getItem('canbooks_active_company');
          if (fallbackId) {
            await loadCompanyData(fallbackId);
            return;
          }
        } catch (fallbackErr) {
          console.error('Fallback company load failed:', fallbackErr);
        }
        setAppLoading(false);
      }
    })();
  }, [user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global safety valve: never allow app loading screen to persist indefinitely.
  useEffect(() => {
    if (authLoading || !user?.id || !appLoading) return;
    const timer = setTimeout(() => {
      console.error('App loading watchdog triggered. Forcing loading state to false.');
      setAppLoading(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, [authLoading, user?.id, appLoading]);

  // ── Keep active company's badgeLogo in sync in the companies list ────
  useEffect(() => {
    const id = activeIdRef.current;
    if (!id) return;
    setCompanies(prev => prev.map(c =>
      c.id === id ? { ...c, badgeLogo: state.settings?.badgeLogo || null } : c
    ));
  }, [state.settings?.badgeLogo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced sync back to Supabase ───────────────────────────────────
  useEffect(() => {
    if (!activeIdRef.current) return;
    if (state === lastLoaded.current) return; // unchanged since load — skip

    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const id = activeIdRef.current;
      if (!id) return;
      supabase
        .from('companies')
        .update({ data: state, updated_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => { if (error) console.error('Sync error:', error); });
    }, 1500);

    return () => clearTimeout(syncTimer.current);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Company CRUD ───────────────────────────────────────────────────────
  const createCompany = useCallback(async (name) => {
    if (!user?.id) throw new Error('You must be signed in to create a company.');

    const initialData = makeInitialState();
    if (name) {
      initialData.settings = { ...initialData.settings, companyName: name };
    }

    const newCompanyId = uuidv4();

    let insertError = null;
    try {
      const { error } = await withTimeoutRetry(
        () => supabase
          .from('companies')
          .insert({ id: newCompanyId, user_id: user.id, name, data: initialData }),
        { label: 'createCompany', timeoutMs: 30000, retries: 1 },
      );
      if (error) insertError = error;
    } catch (err) {
      insertError = err;
    }

    if (insertError) {
      // Recovery path: timeout can happen after DB commit; verify by ID before failing.
      const { data: existing, error: verifyError } = await withTimeout(
        supabase
          .from('companies')
          .select('id, name')
          .eq('id', newCompanyId)
          .maybeSingle(),
        10000,
        'createCompany verify',
      ).catch(() => ({ data: null, error: insertError }));

      if (!existing || verifyError) {
        throw insertError;
      }
    }

    const newCompany = { id: newCompanyId, name };
    setCompanies(prev => [...prev, newCompany]);

    try {
      await loadCompanyData(newCompanyId);
    } catch (err) {
      // Don't block company creation UI if post-create data hydration fails.
      console.error('createCompany post-load error:', err);
      setActiveId(newCompanyId);
      activeIdRef.current = newCompanyId;
      try { localStorage.setItem('canbooks_active_company', newCompanyId); } catch { /* private browsing */ }
      setAppLoading(false);
    }

    return newCompany;
  }, [user?.id, loadCompanyData]);

  const selectCompany = useCallback(async (companyId) => {
    if (companyId === activeIdRef.current) return;
    setCompanies(list => list); // trigger no-op to keep state stable
    await loadCompanyData(companyId);
  }, [loadCompanyData]);

  const updateCompanyName = useCallback(async (companyId, name) => {
    await supabase.from('companies').update({ name }).eq('id', companyId);
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, name } : c));
  }, []);

  const deleteCompany = useCallback(async (companyId) => {
    await supabase.from('companies').delete().eq('id', companyId);
    const remaining = companies.filter(c => c.id !== companyId);
    setCompanies(remaining);

    if (activeIdRef.current === companyId) {
      if (remaining.length > 0) {
        await loadCompanyData(remaining[0].id);
      } else {
        setActiveId(null);
        activeIdRef.current = null;
        lastLoaded.current = null;
        const init = makeInitialState();
        dispatch({ type: 'RESTORE', payload: init });
        setAppLoading(false);
      }
    }
  }, [companies, loadCompanyData]);

  // ── Derived values ─────────────────────────────────────────────────────
  const activeFY      = state.fiscalYears?.[state.activeFiscalYear];
  const activeCompany = companies.find(c => c.id === activeCompanyId) ?? null;

  return (
    <AppContext.Provider value={{
      state, dispatch: wrappedDispatch, activeFY,
      activePY, activePersonalYear, userProfile,
      companies, activeCompany, activeCompanyId, appLoading,
      createCompany, selectCompany, updateCompanyName, deleteCompany,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

