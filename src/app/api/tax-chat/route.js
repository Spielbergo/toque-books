import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { createRateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// More generous limit for chat (smaller, faster calls)
const limiter = createRateLimiter({ windowMs: 5 * 60_000, max: 20 }); // 20 per 5 min per IP

/**
 * POST /api/tax-chat
 * Body: { taxData, messages: [{role, content}], question }
 * Returns: { answer }
 */
export async function POST(request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      await verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Rate limit ────────────────────────────────────────────────────
    const ip = request.headers.get('x-real-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
      ?? 'unknown';
    if (!limiter.check(ip)) {
      return NextResponse.json({ error: 'Too many requests — please wait a few minutes' }, { status: 429 });
    }

    // ── Gemini API key ────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json({ error: 'AI features not configured.' }, { status: 503 });
    }

    const body = await request.json();
    const { taxData, messages = [], question } = body;
    if (!taxData || !question?.trim()) {
      return NextResponse.json({ error: 'Missing taxData or question' }, { status: 400 });
    }

    // ── Build prompt ──────────────────────────────────────────────────
    const historyText = messages.length > 0
      ? messages.map(m => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`).join('\n\n')
      : '';

    const prompt = `You are a knowledgeable Canadian tax advisor specializing in Ontario CCPCs (Canadian-Controlled Private Corporations). You have reviewed the following tax data for a client:

TAX DATA:
${JSON.stringify(taxData, null, 2)}

${historyText ? `PREVIOUS CONVERSATION:\n${historyText}\n\n` : ''}User: ${question}

Respond as a tax advisor in 2-5 sentences. Be specific — reference dollar amounts and percentages from the tax data when relevant. If the question is outside the scope of this tax data or requires a professional opinion you cannot give, say so briefly. Do not use JSON. Plain text only.

Advisor:`;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim();

    return NextResponse.json({ answer });
  } catch (e) {
    console.error('tax-chat route error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
