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

    // Fallback probe: if INITIAL_SESSION is missed, unblock via a timed session read.
    Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('getSession timeout')), 2500)),
    ])
      .then((result) => {
        const session = result?.data?.session;
        if (session?.user) {
          setUser(session.user);
          _syncCookie(session.user);
        }
      })
      .catch(() => {
        // Ignore fallback errors; auth listener and hard timeout still resolve loading.
      })
      .finally(() => {
        finishInit();
      });

    return () => {
      window.clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
  if (user) {
    document.cookie = `app_session=1; path=/; SameSite=Strict${secure}`;
  } else {
    document.cookie = `app_session=; path=/; SameSite=Strict${secure}; Max-Age=0`;
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
