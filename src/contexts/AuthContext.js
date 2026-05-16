'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [authLoading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;
    // Safety valve: never let auth loading block the app forever.
    const hardTimeout = window.setTimeout(() => {
      if (!resolved) setLoading(false);
    }, 5000);

    const finishInit = () => {
      resolved = true;
      setLoading(false);
      window.clearTimeout(hardTimeout);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        finishInit();
      }
      _syncCookie(session?.user);
    });

    return () => {
      window.clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear middleware presence cookie first so route guard can never trap users.
    _syncCookie(null);
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // If global sign-out fails, still attempt a local sign-out and continue.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore; we still send user to login with local guard cookie cleared.
      }
    }
    window.location.href = '/auth/login';
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function _syncCookie(user) {
  // Presence cookie for middleware — not cryptographically trusted,
  // real access is protected by Supabase RLS.
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  const sameSite = '; SameSite=Lax';
  if (user) {
    document.cookie = `app_session=1; path=/${sameSite}${secure}`;
  } else {
    document.cookie = `app_session=; path=/${sameSite}${secure}; Max-Age=0`;
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
