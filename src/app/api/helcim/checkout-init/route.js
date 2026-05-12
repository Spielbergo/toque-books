import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/supabase/server';
import { initHelcimCheckout } from '@/lib/helcim';

export const runtime = 'nodejs';

/**
 * POST /api/helcim/checkout-init
 * Server-side: initialize a HelcimPay.js checkout session (verify / $0).
 * Returns { checkoutToken, secretToken } to the client.
 */
export async function POST(req) {
  // Authenticate the user
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let user;
  try {
    ({ user } = await verifyToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenPreview = process.env.HELCIM_API_TOKEN
      ? `set (${process.env.HELCIM_API_TOKEN.length} chars, starts: ${process.env.HELCIM_API_TOKEN.slice(0, 6)})`
      : 'NOT SET';
    console.log('[checkout-init] HELCIM_API_TOKEN:', tokenPreview);

    const data = await initHelcimCheckout({
      paymentType: 'verify',
      currency: 'CAD',
      amount: 0,
      customerRequest: {
        contactName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'NorthBooks User',
        email: user.email || '',
      },
    });

    return NextResponse.json({
      checkoutToken: data.checkoutToken,
      secretToken: data.secretToken,
    });
  } catch (err) {
    console.error('Helcim checkout-init error:', err);
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
