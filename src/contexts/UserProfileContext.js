'use client';

import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/client';

// ─── DEFAULT STATE ───────────────────────────────────────────────────────────

const DEFAULT_PERSONAL = {
  nonEligibleDivs:  0,
  eligibleDivs:     0,
  employmentIncome: 0,   // T4 Box 14 — employment income from any source
  otherIncome:      0,   // rental, pension, EI, etc.
  rrspDeduction:    0,
  rrspRoom:         0,
  taxWithheld:      0,   // T4 Box 22 — income tax withheld at source
  cppContributions: 0,   // T4 Box 16 — CPP employee contributions
  eiPremiums:       0,   // T4 Box 18 — EI employee premiums
  spouseNetIncome:  null, // null = no spouse; number = spouse/partner net income
};

export function makeDefaultUserProfile() {
  const year = new Date().getFullYear();
  return {
    personalProfile: {
      maritalStatus: '',
      spouseName: '',
      spouseIncomeType: '',
      spouseEstIncome: 0,
    },
    dependants: [],
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
    activePersonalYear: year,
    personalYears: {
      [year]: { ...DEFAULT_PERSONAL },
    },
  };
}

// ─── REDUCER ────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'RESTORE_USER_PROFILE':
      return { ...makeDefaultUserProfile(), ...action.payload };

    case 'UPDATE_PERSONAL_PROFILE':
      return { ...state, personalProfile: { ...state.personalProfile, ...action.payload } };

    case 'SET_DEPENDANTS':
      return { ...state, dependants: action.payload };

    case 'SET_ACTIVE_PERSONAL_YEAR': {
      const year = action.payload;
      const existing = state.personalYears?.[year];
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
          [year]: { ...(state.personalYears?.[year] || DEFAULT_PERSONAL), ...action.payload },
        },
      };
    }

    case 'UPDATE_OTHER_INCOME_SOURCES':
      return { ...state, otherIncomeSources: { ...state.otherIncomeSources, ...action.payload } };

    default:
      return state;
  }
}

// ─── CONTEXT ────────────────────────────────────────────────────────────────

const UserProfileContext = createContext(null);

export function UserProfileProvider({ children }) {
  const { user } = useAuth();
  const [userProfile, userDispatch] = useReducer(reducer, null, makeDefaultUserProfile);

  const lastLoaded  = useRef(null);
  const syncTimer   = useRef(null);
  const migrated    = useRef(false);
  const profileRef  = useRef(userProfile);
  profileRef.current = userProfile;

  // ── Load user profile from Firestore when user signs in ───────────────
  useEffect(() => {
    if (!user?.uid) return;

    (async () => {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);

      if (snap.exists() && snap.data().personal) {
        const data = snap.data().personal;
        const merged = { ...makeDefaultUserProfile(), ...data };
        lastLoaded.current = merged;
        userDispatch({ type: 'RESTORE_USER_PROFILE', payload: merged });
        migrated.current = snap.data().migrated ?? true;
      } else {
        // New user — create doc with defaults
        const defaults = makeDefaultUserProfile();
        lastLoaded.current = defaults;
        await setDoc(ref, { personal: defaults, migrated: false }, { merge: true });
        migrated.current = false;
      }
    })();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear state on sign-out
  useEffect(() => {
    if (!user) {
      lastLoaded.current = null;
      migrated.current = false;
      userDispatch({ type: 'RESTORE_USER_PROFILE', payload: makeDefaultUserProfile() });
    }
  }, [user]);

  // ── Debounced sync back to Firestore ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    if (userProfile === lastLoaded.current) return;

    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      if (!user?.uid) return;
      updateDoc(doc(db, 'users', user.uid), {
        personal: profileRef.current,
        updatedAt: serverTimestamp(),
      }).catch(err => console.error('UserProfile sync error:', err));
    }, 1500);

    return () => clearTimeout(syncTimer.current);
  }, [userProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── One-time migration: seed from company state on first use ──────────
  // Called by AppContext after loading a company that has personal data
  const migrateFromCompany = useCallback(async (companyPersonalData) => {
    if (migrated.current) return; // already migrated
    if (!user?.uid) return;
    if (!companyPersonalData) return;

    const merged = {
      personalProfile:    companyPersonalData.personalProfile    || makeDefaultUserProfile().personalProfile,
      dependants:         companyPersonalData.dependants?.length > 0 ? companyPersonalData.dependants : (profileRef.current.dependants || []),
      otherIncomeSources: companyPersonalData.otherIncomeSources || makeDefaultUserProfile().otherIncomeSources,
      activePersonalYear: companyPersonalData.activePersonalYear || profileRef.current.activePersonalYear,
      personalYears:      { ...profileRef.current.personalYears, ...(companyPersonalData.personalYears || {}) },
    };

    lastLoaded.current = merged;
    userDispatch({ type: 'RESTORE_USER_PROFILE', payload: merged });

    // Persist to Firestore and mark as migrated
    await setDoc(doc(db, 'users', user.uid), {
      personal:    merged,
      migrated:    true,
      migratedAt:  serverTimestamp(),
    }, { merge: true });

    migrated.current = true;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ────────────────────────────────────────────────────
  const activePersonalYear = userProfile.activePersonalYear;
  const activePY = userProfile.personalYears?.[activePersonalYear] ?? { ...DEFAULT_PERSONAL };

  return (
    <UserProfileContext.Provider value={{
      userProfile,
      userDispatch,
      activePY,
      activePersonalYear,
      migrateFromCompany,
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used inside UserProfileProvider');
  return ctx;
}
