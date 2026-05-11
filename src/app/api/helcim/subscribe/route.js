import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyToken, getAdminDb } from '@/lib/supabase/server';
import {
  createHelcimCustomer,
  findHelcimCustomerByEmail,
  createHelcimSubscription,
} from '@/lib/helcim';

export const runtime = 'nodejs';

const PLAN_ID = process.env.HELCIM_PAYMENT_PLAN_ID;

/**
 * POST /api/helcim/subscribe
 * After HelcimPay.js verify completes, the client sends:
 *   { transactionData, checkoutToken, secretToken }
 *
 * We:
 *  1. Validate the response hash
 *  2. Find or create the Helcim customer
 *  3. Create the subscription
 *  4. Save/update user_subscriptions in Supabase
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

  if (!PLAN_ID) {
    return NextResponse.json({ error: 'HELCIM_PAYMENT_PLAN_ID not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { transactionData, secretToken } = body;
  if (!transactionData || !secretToken) {
    return NextResponse.json({ error: 'Missing transactionData or secretToken' }, { status: 400 });
  }

  // ── 1. Validate the HelcimPay.js response hash ────────────────────────────
  const { hash: providedHash, ...txData } = transactionData;
  if (providedHash) {
    const jsonStr = JSON.stringify(txData);
    const expectedHash = crypto
      .createHash('sha256')
      .update(jsonStr + secretToken)
      .digest('hex');
    if (expectedHash !== providedHash) {
      return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 });
    }
  }

  const customerCode = txData.data?.customerCode;
  if (!customerCode) {
    return NextResponse.json({ error: 'No customerCode in transaction response' }, { status: 400 });
  }

  try {
    // ── 2. Create Helcim subscription ─────────────────────────────────────
    let helcimSubscriptionId;
    let helcimCustomerCode = customerCode;

    // If HelcimPay.js didn't create a customer yet, create one now
    if (!helcimCustomerCode) {
      const existing = await findHelcimCustomerByEmail(user.email);
      if (existing) {
        helcimCustomerCode = existing.customerCode;
      } else {
        const newCustomer = await createHelcimCustomer({
          contactName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'NorthBooks User',
          email: user.email,
        });
        helcimCustomerCode = newCustomer.customerCode;
      }
    }

    const sub = await createHelcimSubscription({
      customerCode: helcimCustomerCode,
      paymentPlanId: PLAN_ID,
    });
    helcimSubscriptionId = sub.id;

    // ── 3. Upsert subscription record in Supabase ──────────────────────────
    const supabase = getServiceClient();
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: dbErr } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan: 'pro',
        status: 'active',
        helcim_customer_code: helcimCustomerCode,
        helcim_subscription_id: helcimSubscriptionId,
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });

    if (dbErr) throw new Error(dbErr.message);

    return NextResponse.json({ success: true, plan: 'pro' });
  } catch (err) {
    console.error('Helcim subscribe error:', err);
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
