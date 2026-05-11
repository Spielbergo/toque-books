'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

// ─── Plan limits ──────────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    companies: 1,
    invoicesPerMonth: 10,
  },
  pro: {
    companies: Infinity,
    invoicesPerMonth: Infinity,
  },
};

export const PRO_FEATURES = [
  'Multiple companies',
  'PDF exports (T5, T4, T2 worksheet)',
  'AI receipt parsing',
  'Mileage log',
];

// ─── Context ──────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user, authLoading } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();
    setSubscription(data ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  // Clear on sign-out
  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const isPro =
    !loading &&
    subscription?.plan === 'pro' &&
    subscription?.status === 'active' &&
    subscription?.current_period_end != null &&
    new Date(subscription.current_period_end) > new Date();

  return (
    <SubscriptionContext.Provider value={{ subscription, isPro, loading, refresh: load }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return ctx;
}
