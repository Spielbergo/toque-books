import { createClient } from '@supabase/supabase-js';

let _client = null;
const BROWSER_SUPABASE_TIMEOUT_MS = 15000;

function createTimeoutFetch(timeoutMs = BROWSER_SUPABASE_TIMEOUT_MS) {
  return async (input, init = {}) => {
    const controller = new AbortController();
    let timedOut = false;

    const onAbort = () => controller.abort();
    if (init.signal) {
      if (init.signal.aborted) controller.abort();
      else init.signal.addEventListener('abort', onAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) {
        throw new Error(`Network timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (init.signal) init.signal.removeEventListener('abort', onAbort);
    }
  };
}

/**
 * Returns a singleton Supabase browser client.
 * Safe to call from any client component — reuses the same instance.
 */
export function getSupabaseClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
    }

    _client = createClient(
      url,
      key,
      {
        global: {
          fetch: createTimeoutFetch(),
        },
      },
    );
  }
  return _client;
}

// Convenience named export so callers can do:
//   import { supabase } from '@/lib/supabase/client';
export const supabase = getSupabaseClient();


