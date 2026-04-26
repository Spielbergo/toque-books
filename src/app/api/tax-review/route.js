import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { createRateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 }); // 5 reviews/min per IP

/**
 * POST /api/tax-review
 * Accepts a JSON body with tax summary data.
 * Returns { items: [{ category, title, detail }], summary }
 */
export async function POST(request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Rate limit ────────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!limiter.check(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // ── Gemini API key ────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'AI features not configured. Add your GEMINI_API_KEY to .env.local.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { taxData } = body;
    if (!taxData) {
      return NextResponse.json({ error: 'Missing taxData' }, { status: 400 });
    }

    const prompt = `You are a Canadian tax advisor reviewing a small business owner's tax situation for their Ontario CCPC (Canadian-Controlled Private Corporation).

Here is their tax data summary:
${JSON.stringify(taxData, null, 2)}

Please review this data and provide practical, specific tax tips and flags.

Return ONLY a valid JSON object with this exact structure:
{
  "summary": "A 1-2 sentence plain-English overview of their overall tax situation",
  "items": [
    {
      "category": "good",
      "title": "Short title (5-8 words)",
      "detail": "1-2 sentence explanation with specific numbers or percentages where relevant"
    }
  ]
}

Category meanings:
- "good": Something they are doing well or a positive observation
- "review": Something they should double-check or a potential issue worth examining
- "tip": An actionable optimization or planning opportunity

Guidelines:
- Provide 3-5 items total (mix of good, review, and tip)
- Reference specific dollar amounts from the data when relevant
- Focus on CCPC-specific rules: small business deduction, RDTOH, integration, salary vs dividend
- Mention RRSP if there is room to optimize
- Note if corporate tax seems high relative to revenue
- Flag if effective personal tax rate seems high
- Suggest dividend timing or salary mix if relevant
- Always end with a disclaimer item with category "tip" about consulting a CPA
- Return ONLY the JSON object, no markdown or explanation`;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('tax-review route error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
