import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/supabase/server';
import { getHelcimTransaction } from '@/lib/helcim';

export const runtime = 'nodejs';

const WEBHOOK_SECRET = process.env.HELCIM_WEBHOOK_SECRET;

export async function GET() {
	return NextResponse.json({ ok: true });
}

export async function HEAD() {
	return new Response(null, { status: 200 });
}

export async function POST(req) {
	const rawBody = await req.text();

	let event;
	try {
		event = JSON.parse(rawBody);
	} catch {
		return NextResponse.json({ ok: true });
	}

	if (event.type !== 'cardTransaction') {
		return NextResponse.json({ ok: true });
	}

	if (WEBHOOK_SECRET) {
		const webhookId = req.headers.get('webhook-id') || '';
		const webhookTimestamp = req.headers.get('webhook-timestamp') || '';
		const webhookSig = req.headers.get('webhook-signature') || '';

		if (!webhookId || !webhookTimestamp || !webhookSig) {
			return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 });
		}

		const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
		const secretBytes = Buffer.from(WEBHOOK_SECRET, 'base64');
		const expectedSig = crypto
			.createHmac('sha256', secretBytes)
			.update(signedContent)
			.digest('base64');

		const sigValues = webhookSig.split(' ').map(s => s.split(',')[1]).filter(Boolean);
		if (!sigValues.includes(expectedSig)) {
			return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
		}

		const ts = parseInt(webhookTimestamp, 10);
		if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
			return NextResponse.json({ error: 'Webhook timestamp out of range' }, { status: 400 });
		}
	}

	try {
		const tx = await getHelcimTransaction(event.id);

		if (tx?.status !== 'APPROVED') {
			return NextResponse.json({ ok: true });
		}

		const customerCode = tx.customerCode;
		if (!customerCode) return NextResponse.json({ ok: true });

		const supabase = getAdminDb();
		const { data: sub } = await supabase
			.from('user_subscriptions')
			.select('id, current_period_end')
			.eq('helcim_customer_code', customerCode)
			.single();

		if (!sub) return NextResponse.json({ ok: true });

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
		console.error('Payments webhook error:', err);
		return NextResponse.json({ ok: true });
	}
}
