// POST /api/accountant/access — Add accountant email
// DELETE /api/accountant/access — Remove accountant email
// Authenticated as the company owner (Bearer token)

import { NextResponse } from 'next/server';
import { verifyToken, getAdminDb } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/accountant/access?companyId=xxx — Owner reads their accountant list
export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { user } = await verifyToken(token);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

    const db = getAdminDb();
    const { data: row } = await db
      .from('companies')
      .select('user_id, accountant_emails')
      .eq('id', companyId)
      .single();

    if (!row || row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ emails: row.accountant_emails || [] });
  } catch (err) {
    console.error('[accountant/access GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { user } = await verifyToken(token);
    const { companyId, email } = await request.json();

    if (!companyId || !email) {
      return NextResponse.json({ error: 'companyId and email are required' }, { status: 400 });
    }

    // Validate email format (basic)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const db = getAdminDb();
    const { data: row } = await db
      .from('companies')
      .select('user_id, accountant_emails')
      .eq('id', companyId)
      .single();

    if (!row || row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalized = email.toLowerCase().trim();
    const current = row.accountant_emails || [];
    if (!current.includes(normalized)) {
      await db
        .from('companies')
        .update({ accountant_emails: [...current, normalized], updated_at: new Date().toISOString() })
        .eq('id', companyId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[accountant/access POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { user } = await verifyToken(token);
    const { companyId, email } = await request.json();

    if (!companyId || !email) {
      return NextResponse.json({ error: 'companyId and email are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const { data: row } = await db
      .from('companies')
      .select('user_id, accountant_emails')
      .eq('id', companyId)
      .single();

    if (!row || row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalized = email.toLowerCase().trim();
    const filtered = (row.accountant_emails || []).filter(e => e !== normalized);
    await db
      .from('companies')
      .update({ accountant_emails: filtered, updated_at: new Date().toISOString() })
      .eq('id', companyId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[accountant/access DELETE]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
