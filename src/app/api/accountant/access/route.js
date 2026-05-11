// POST /api/accountant/access — Add accountant email
// DELETE /api/accountant/access — Remove accountant email
// Authenticated as the company owner (Bearer token)

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export const runtime = 'nodejs';

function getFirestore() {
  return admin.firestore();
}

// GET /api/accountant/access?companyId=xxx — Owner reads their accountant list
export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyIdToken(token);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();

    if (!doc.exists || doc.data().userId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ emails: doc.data().accountantEmails || [] });
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

    const decoded = await verifyIdToken(token);
    const { companyId, email } = await request.json();

    if (!companyId || !email) {
      return NextResponse.json({ error: 'companyId and email are required' }, { status: 400 });
    }

    // Validate email format (basic)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const db = getFirestore();
    const ref = db.collection('companies').doc(companyId);
    const doc = await ref.get();

    if (!doc.exists || doc.data().userId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ref.update({
      accountantEmails: admin.firestore.FieldValue.arrayUnion(email.toLowerCase().trim()),
      updatedAt: new Date().toISOString(),
    });

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

    const decoded = await verifyIdToken(token);
    const { companyId, email } = await request.json();

    if (!companyId || !email) {
      return NextResponse.json({ error: 'companyId and email are required' }, { status: 400 });
    }

    const db = getFirestore();
    const ref = db.collection('companies').doc(companyId);
    const doc = await ref.get();

    if (!doc.exists || doc.data().userId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ref.update({
      accountantEmails: admin.firestore.FieldValue.arrayRemove(email.toLowerCase().trim()),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[accountant/access DELETE]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
