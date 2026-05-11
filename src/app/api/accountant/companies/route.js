// GET /api/accountant/companies — Returns companies shared with the authenticated user's email
// Authenticated as the accountant (Bearer token)

import { NextResponse } from 'next/server';
import { verifyToken, getAdminDb } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { user } = await verifyToken(token);
    const email = user.email?.toLowerCase().trim();
    if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

    const db = getAdminDb();
    const { data: rows, error } = await db
      .from('companies')
      .select('id, name, user_id, updated_at, data')
      .contains('accountant_emails', [email]);

    if (error) throw error;

    const companies = (rows || []).map(r => ({
      id: r.id,
      name: r.name,
      ownerUid: r.user_id,
      updatedAt: r.updated_at,
      data: r.data,
    }));

    return NextResponse.json({ companies });
  } catch (err) {
    console.error('[accountant/companies GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
