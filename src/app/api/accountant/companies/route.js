// GET /api/accountant/companies — Returns companies shared with the authenticated user's email
// Authenticated as the accountant (Bearer token)

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyIdToken(token);
    const email = decoded.email?.toLowerCase().trim();
    if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

    const db = admin.firestore();
    const snap = await db.collection('companies')
      .where('accountantEmails', 'array-contains', email)
      .get();

    const companies = snap.docs.map(doc => {
      const d = doc.data();
      // Only expose non-sensitive metadata + the full data object for read-only display
      return {
        id: doc.id,
        name: d.name,
        ownerUid: d.userId,
        updatedAt: d.updatedAt,
        data: d.data,
      };
    });

    return NextResponse.json({ companies });
  } catch (err) {
    console.error('[accountant/companies GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
