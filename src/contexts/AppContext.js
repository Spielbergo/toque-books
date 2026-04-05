'use client';

import { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { loadData } from '@/lib/storage';
import { today, addDays } from '@/lib/formatters';
import { HST_RATES } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/client';

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

function makeInitialState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    activeFiscalYear: getCurrentFiscalYearLabel(),
    activePersonalYear: new Date().getFullYear(),
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
      },
    },
    personalYears: {
      [new Date().getFullYear()]: { ...DEFAULT_PERSONAL },
    },
    clients: [],
    onboardingCompleted: false,
    businessType: 'ccpc', // 'ccpc' | 'sole_prop' | 'partnership' | 'pc' | 'other'
    personalProfile: {
      maritalStatus: '',
      spouseName: '',
      spouseIncomeType: '', // 'employed' | 'self_employed' | 'none'
      spouseEstIncome: 0,
    },
    dependants: [], // [{ id, name, birthYear, relationship, disability }]
    businessOps: {
      homeOffice: false,
      vehicleBusiness: false,
      vehicleBusinessPct: 0,
      hasEmployees: false,
      numEmployees: 0,
      paysSelf: 'dividends', // 'dividends' | 'salary' | 'mix' | 'none'
      otherShareholders: false,
    },
    otherIncomeSources: {
      hasEmployment: false,
      employmentAmount: 0,
      hasRental: false,
      rentalAmount: 0,
      hasForeign: false,
      foreignAmount: 0,
      rrspRoom: 0,
      usesTFSA: false,
    },
    recurringExpenses: [], // [{ id, vendor, description, category, businessUsePercent, amount, hst, frequency, startDate, endDate, notes }]
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
          },
        },
        activeFiscalYear: key,
      };
    }

    // Personal year management
    case 'SET_ACTIVE_PERSONAL_YEAR': {
      const year = action.payload;
      const existing = state.personalYears[year];
      return {
        ...state,
        activePersonalYear: year,
        personalYears: existing
          ? state.personalYears
          : { ...state.personalYears, [year]: { ...DEFAULT_PERSONAL } },
      };
    }
    case 'UPDATE_PERSONAL': {
      const year = state.activePersonalYear;
      return {
        ...state,
        personalYears: {
          ...state.personalYears,
          [year]: { ...(state.personalYears[year] || DEFAULT_PERSONAL), ...action.payload },
        },
      };
    }

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
      const total = [...fyData.dividendsPaid, div].reduce((s, d) => s + (d.amount || 0), 0);
      // Update personal year too
      const py = action.payload.personalYear || state.activePersonalYear;
      const pyData = state.personalYears[py] || { ...DEFAULT_PERSONAL };
      return {
        ...updateFY(state, fy, { dividendsPaid: [...fyData.dividendsPaid, div] }),
        personalYears: {
          ...state.personalYears,
          [py]: { ...pyData, nonEligibleDivs: total },
        },
      };
    }
    case 'DELETE_DIVIDEND': {
      const fy = findItemFY(state, 'dividendsPaid', action.payload) || resolveMutableFY(state);
      if (!fy) return state;
      const fyData = state.fiscalYears[fy];
      const remaining = fyData.dividendsPaid.filter(d => d.id !== action.payload);
      const total = remaining.reduce((s, d) => s + (d.amount || 0), 0);
      const py = state.activePersonalYear;
      const pyData = state.personalYears[py] || { ...DEFAULT_PERSONAL };
      return {
        ...updateFY(state, fy, { dividendsPaid: remaining }),
        personalYears: {
          ...state.personalYears,
          [py]: { ...pyData, nonEligibleDivs: total },
        },
      };
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

    case 'UPDATE_PERSONAL_PROFILE':
      return { ...state, personalProfile: { ...state.personalProfile, ...action.payload } };

    case 'SET_DEPENDANTS':
      return { ...state, dependants: action.payload };

    case 'UPDATE_BUSINESS_OPS':
      return { ...state, businessOps: { ...state.businessOps, ...action.payload } };

    case 'UPDATE_OTHER_INCOME_SOURCES':
      return { ...state, otherIncomeSources: { ...state.otherIncomeSources, ...action.payload } };

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

  // ── Load company data by ID ────────────────────────────────────────────
  const loadCompanyData = useCallback(async (companyId) => {
    setAppLoading(true);
    const snap = await getDoc(doc(db, 'companies', companyId));

    if (snap.exists() && snap.data().data && Object.keys(snap.data().data).length > 0) {
      const data = snap.data().data;
      lastLoaded.current = data;
      dispatch({ type: 'RESTORE', payload: data });
    } else {
      const init = makeInitialState();
      lastLoaded.current = init;
      dispatch({ type: 'RESTORE', payload: init });
    }

    setActiveId(companyId);
    activeIdRef.current = companyId;
    try { localStorage.setItem('toque_active_company', companyId); } catch { /* private browsing */ }
    setAppLoading(false);
  }, []);

  // ── Initial load when user authenticates ──────────────────────────────
  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setActiveId(null);
      activeIdRef.current = null;
      // Only stop the loading spinner once we know auth has fully resolved
      // with no user. If authLoading is still true, Firebase hasn't checked
      // yet — keep showing the loader so the redirect guard in AppShell
      // doesn't fire prematurely.
      if (!authLoading) setAppLoading(false);
      return;
    }

    (async () => {
      setAppLoading(true);
      try {
        const q = query(
          collection(db, 'companies'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map(d => ({ id: d.id, name: d.data().name, createdAt: d.data().createdAt, badgeLogo: d.data().data?.settings?.badgeLogo || null }))
          .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
        setCompanies(list);

        if (list.length === 0) { setAppLoading(false); return; }

        let preferred = null;
        try { preferred = localStorage.getItem('toque_active_company'); } catch { /* */ }
        const pick = list.find(c => c.id === preferred) ?? list[0];
        await loadCompanyData(pick.id);
      } catch (err) {
        console.error('Failed to load companies:', err);
        setAppLoading(false);
      }
    })();
  }, [user?.uid, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep active company's badgeLogo in sync in the companies list ────
  useEffect(() => {
    const id = activeIdRef.current;
    if (!id) return;
    setCompanies(prev => prev.map(c =>
      c.id === id ? { ...c, badgeLogo: state.settings?.badgeLogo || null } : c
    ));
  }, [state.settings?.badgeLogo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced sync back to Firestore ──────────────────────────────────
  useEffect(() => {
    if (!activeIdRef.current) return;
    if (state === lastLoaded.current) return; // unchanged since load — skip

    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const id = activeIdRef.current;
      if (!id) return;
      updateDoc(doc(db, 'companies', id), {
        data: state,
        updatedAt: serverTimestamp(),
      }).catch(err => console.error('Sync error:', err));
    }, 1500);

    return () => clearTimeout(syncTimer.current);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Company CRUD ───────────────────────────────────────────────────────
  const createCompany = useCallback(async (name) => {
    const migrateData = companies.length === 0 ? loadData() : null;
    const initialData = migrateData ?? makeInitialState();
    if (migrateData && name) {
      initialData.settings = { ...initialData.settings, companyName: name };
    }

    const ref = await addDoc(collection(db, 'companies'), {
      userId: user.uid,
      name,
      data: initialData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const newCompany = { id: ref.id, name };
    setCompanies(prev => [...prev, newCompany]);
    await loadCompanyData(ref.id);
    return newCompany;
  }, [companies.length, user?.uid, loadCompanyData]);

  const selectCompany = useCallback(async (companyId) => {
    if (companyId === activeIdRef.current) return;
    setCompanies(list => list); // trigger no-op to keep state stable
    await loadCompanyData(companyId);
  }, [loadCompanyData]);

  const updateCompanyName = useCallback(async (companyId, name) => {
    await updateDoc(doc(db, 'companies', companyId), { name });
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, name } : c));
  }, []);

  const deleteCompany = useCallback(async (companyId) => {
    await deleteDoc(doc(db, 'companies', companyId));
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
  const activePY      = state.personalYears?.[state.activePersonalYear] ?? { ...DEFAULT_PERSONAL };
  const activeCompany = companies.find(c => c.id === activeCompanyId) ?? null;

  return (
    <AppContext.Provider value={{
      state, dispatch, activeFY, activePY,
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

