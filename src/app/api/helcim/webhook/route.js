import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/supabase/server';
import { getHelcimTransaction } from '@/lib/helcim';

export const runtime = 'nodejs';

const WEBHOOK_SECRET = process.env.HELCIM_WEBHOOK_SECRET;

/**
 * POST /api/helcim/webhook
 *
 * Receives Helcim webhook events. Currently handles:
 *  - cardTransaction: when a recurring subscription payment is approved,
 *    update current_period_end for the subscriber.
 *
 * Helcim webhook payload: { id: "transactionId", type: "cardTransaction" }
 *
 * Configure in Helcim dashboard → All Tools → Integrations → Webhooks
 * Set URL to: https://yourdomain.com/api/helcim/webhook
 */
export async function POST(req) {
  const rawBody = await req.text();

  // ── Verify HMAC signature ──────────────────────────────────────────────────
  if (WEBHOOK_SECRET) {
    const webhookId        = req.headers.get('webhook-id') || '';
    const webhookTimestamp = req.headers.get('webhook-timestamp') || '';
    const webhookSig       = req.headers.get('webhook-signature') || '';

    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const secretBytes = Buffer.from(WEBHOOK_SECRET, 'base64');
    const expectedSig = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // webhook-signature can contain multiple "v1,<sig>" entries
    const sigValues = webhookSig.split(' ').map(s => s.split(',')[1]).filter(Boolean);
    if (!sigValues.includes(expectedSig)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Reject replays older than 5 minutes
    const ts = parseInt(webhookTimestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      return NextResponse.json({ error: 'Webhook timestamp out of range' }, { status: 400 });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.type !== 'cardTransaction') {
    // Not a type we handle — acknowledge and move on
    return NextResponse.json({ ok: true });
  }

  try {
    // Fetch the full transaction to get customerCode and status
    const tx = await getHelcimTransaction(event.id);

    if (tx?.status !== 'APPROVED') {
      return NextResponse.json({ ok: true });
    }

    const customerCode = tx.customerCode;
    if (!customerCode) return NextResponse.json({ ok: true });

    // Find the user by helcim_customer_code and extend their period
    const supabase = getAdminDb();
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('id, current_period_end')
      .eq('helcim_customer_code', customerCode)
      .single();

    if (!sub) return NextResponse.json({ ok: true });

    // Extend current_period_end by 1 month from the latest end (or now if lapsed)
    const base = sub.current_period_end && new Date(sub.current_period_end) > new Date()
      ? new Date(sub.current_period_end)
      : new Date();
    base.setMonth(base.getMonth() + 1);

    await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        current_period_end: base.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Helcim webhook error:', err);
    // Still return 200 so Helcim doesn't retry indefinitely for non-fatal errors
    return NextResponse.json({ ok: true });
  }
}
