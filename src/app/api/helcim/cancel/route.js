import { NextResponse } from 'next/server';
import { verifyToken, getAdminDb } from '@/lib/supabase/server';
import { cancelHelcimSubscription } from '@/lib/helcim';

export const runtime = 'nodejs';

/**
 * POST /api/helcim/cancel
 * Cancels the user's Helcim subscription and marks their record as cancelled.
 * The user retains Pro access until current_period_end.
 */
export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let user;
  try {
    ({ user } = await verifyToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminDb();

  // Get the user's current subscription
  const { data: sub, error: fetchErr } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !sub) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  }

  if (sub.status === 'cancelled') {
    return NextResponse.json({ error: 'Subscription already cancelled' }, { status: 400 });
  }

  try {
    // Cancel in Helcim
    if (sub.helcim_subscription_id) {
      await cancelHelcimSubscription(sub.helcim_subscription_id).catch(err => {
        // Log but don't block — we still want to update our DB
        console.error('Helcim cancel error (non-fatal):', err.message);
      });
    }

    // Mark as cancelled in Supabase — access continues until current_period_end
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
