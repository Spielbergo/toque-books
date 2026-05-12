import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/supabase/server';

/**
 * POST /api/proposals/accept
 * Body: { token: string, acceptorName: string }
 *
 * Records the acceptance in Supabase (proposal_acceptances table).
 * This is intentionally public — no auth required.
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { token, acceptorName } = body || {};
  if (!token || typeof token !== 'string' || token.length < 10) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
  if (!acceptorName || typeof acceptorName !== 'string' || !acceptorName.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const supabase = getAdminDb();
    const { error } = await supabase
      .from('proposal_acceptances')
      .upsert({
        token,
        acceptor_name: acceptorName.trim().slice(0, 200),
        accepted_at: new Date().toISOString(),
      }, { onConflict: 'token' });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    // If table doesn't exist yet, return success anyway — acceptance is client-side tracked
    console.warn('[proposals/accept] DB write failed:', err.message);
    return NextResponse.json({ ok: true });
  }
}
