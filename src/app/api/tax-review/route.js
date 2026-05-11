import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { createRateLimiter } from '@/lib/rateLimit';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 }); // 5 reviews/min per IP

// ── Server-side prompt cache ──────────────────────────────────────────────────
// Avoids repeat Gemini API calls when the same tax data is reviewed multiple
// times (same session, dev hot-reload, etc.). TTL: 30 minutes.
const CACHE_TTL_MS = 30 * 60 * 1000;
const responseCache = new Map(); // hash → { result, expiresAt }

function hashTaxData(taxData) {
  return createHash('sha256').update(JSON.stringify(taxData)).digest('hex').slice(0, 16);
}

function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { responseCache.delete(key); return null; }
  return entry.result;
}

function setCached(key, result) {
  // Evict old entries if cache grows large (safety valve)
  if (responseCache.size >= 200) {
    const now = Date.now();
    for (const [k, v] of responseCache) { if (now > v.expiresAt) responseCache.delete(k); }
  }
  responseCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

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
    // x-real-ip is set by Vercel and cannot be spoofed; fall back to last
    // entry in x-forwarded-for (appended by trusted proxy, not the client)
    const ip = request.headers.get('x-real-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
      ?? 'unknown';
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
    const { taxData, userNotes } = body;
    if (!taxData) {
      return NextResponse.json({ error: 'Missing taxData' }, { status: 400 });
    }
    // Prevent oversized / prompt-injection payloads
    const sanitizedNotes = typeof userNotes === 'string'
      ? userNotes.slice(0, 1000)
      : undefined;

    // ── Cache check ───────────────────────────────────────────────────
    // Skip cache when user has added notes (personalised request)
    const cacheKey = hashTaxData(taxData);
    if (!sanitizedNotes) {
      const cached = getCached(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    const prompt = `You are a Canadian tax advisor reviewing an Ontario CCPC's (Canadian-Controlled Private Corporation) fiscal year in detail.

COMPANY TAX DATA:
${JSON.stringify(taxData, null, 2)}
${sanitizedNotes ? `\nUSER NOTES / QUESTIONS:\n${sanitizedNotes}\n` : ''}
Provide a thorough, detailed tax review. Return ONLY a valid JSON object:
{
  "summary": "2-3 sentence plain-English overview covering their key numbers: revenue, net income, combined tax burden, and one standout observation",
  "items": [
    {
      "category": "good|review|tip",
      "title": "Concise title (5-10 words)",
      "detail": "2-3 sentences with specific dollar amounts and percentages. Be actionable and precise."
    }
  ]
}

Category meanings:
- "good": Something positive or well-handled
- "review": A flag, potential issue, or something to double-check before filing
- "tip": An actionable optimization or planning opportunity

Provide 7-10 items covering as many of these as are relevant:
1. Overall tax efficiency — compare effective corporate rate to SBD benchmark (12.2%)
2. Salary vs. dividend mix — is the split optimal for integration?
3. Expense analysis — are any expense categories unusually high or low relative to revenue? Flag any categories with very low spend that might be under-reported
4. HST reconciliation — does collected HST make sense relative to revenue? Is ITC reasonable?
5. CCA strategy — is there unclaimed CCA that could reduce tax?
6. RRSP optimization — is there unused RRSP room that could reduce personal tax?
7. Shareholder loan — if closing balance > 0, explain the one-year rule
8. Retained earnings strategy — is it growing too fast (triggering RDTOH considerations)?
9. Integration analysis — is the combined corporate + personal tax burden efficient compared to just paying salary?
10. Invoicing completeness — flag any overdue or draft invoices that should be addressed

Always include at least one "good" item. Always end with a "tip" reminding them to consult a CPA.
Reference specific dollar amounts from the data throughout.
Return ONLY the JSON object, no markdown fences or explanation.`;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 });
    }

    if (!sanitizedNotes) setCached(cacheKey, parsed);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error('tax-review route error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
