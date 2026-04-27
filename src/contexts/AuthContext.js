'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [authLoading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      setLoading(false);
      // Set/clear a session presence cookie so the server-side middleware can
      // redirect unauthenticated requests before serving page HTML.
      // This cookie is NOT cryptographically verified at the edge — actual
      // data access is protected by Firestore rules and API route auth tokens.
      if (firebaseUser) {
        document.cookie = 'app_session=1; path=/; SameSite=Strict; Secure';
      } else {
        document.cookie = 'app_session=; path=/; SameSite=Strict; Secure; Max-Age=0';
      }
    });
    return unsub;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    window.location.href = '/auth/login';
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, auth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
