import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * Returns a singleton Supabase browser client.
 * Safe to call from any client component — reuses the same instance.
 */
export function getSupabaseClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  }
  return _client;
}

// Convenience named export so callers can do:
//   import { supabase } from '@/lib/supabase/client';
export const supabase = getSupabaseClient();


