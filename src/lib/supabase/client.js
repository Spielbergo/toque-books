import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * Returns a singleton Supabase browser client.
 * Safe to call from any client component — reuses the same instance.
 */
export function getSupabaseClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    
    const urlLength = url ? url.length : 0;
    const keyLength = key ? key.length : 0;
    console.log('[supabase:client] initializing with env vars', { 
      hasUrl: !!url, 
      urlLength,
      hasKey: !!key, 
      keyLength,
      environment: typeof process !== 'undefined' ? 'node' : 'browser',
    });

    if (!url || !key) {
      console.error('Supabase client error: env vars missing', { 
        hasUrl: !!url, 
        hasKey: !!key 
      });
      throw new Error('Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
    }

    console.debug('Initializing Supabase client with URL:', url);
    _client = createClient(url, key);
    console.log('[supabase:client] client created successfully');
  }
  return _client;
}

// Convenience named export so callers can do:
//   import { supabase } from '@/lib/supabase/client';
export const supabase = getSupabaseClient();


