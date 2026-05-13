import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client — uses the service role key.
 * NEVER import this file from any client component.
 * Used only in Next.js API routes for:
 *   1. Verifying Bearer tokens from the browser
 *   2. Performing privileged DB operations (accountant access)
 */
function getServiceClient() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_SECRET_KEY env var is not set.');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Verifies a Supabase access token from an Authorization: Bearer header.
 * Returns { user } on success, throws on failure.
 */
export async function verifyToken(token) {
  const adminClient = getServiceClient();
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error(error?.message || 'Invalid or expired token');
  }
  return { user: data.user };
}

/**
 * Returns a Supabase service-role client for privileged DB access in API routes.
 */
export function getAdminDb() {
  return getServiceClient();
}
