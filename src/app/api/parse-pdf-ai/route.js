import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/rateLimit';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Tighter rate limit for AI endpoint (costs money)
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 }); // 10 AI parses/min per IP

// ── Server-side response cache ────────────────────────────────────────────────
// Caches by hash of (mode + text). If a user uploads the same PDF twice the
// second call is free. TTL: 1 hour (hot-reload safe, avoids repeat charges).
const CACHE_TTL_MS = 60 * 60 * 1000;
const responseCache = new Map();

function makeCacheKey(mode, text) {
  return createHash('sha256').update(`${mode}:${text}`).digest('hex').slice(0, 24);
}
function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { responseCache.delete(key); return null; }
  return entry.result;
}
function setCached(key, result) {
  if (responseCache.size >= 500) {
    const now = Date.now();
    for (const [k, v] of responseCache) { if (now > v.expiresAt) responseCache.delete(k); }
  }
  responseCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Max text to send (token cost control) ─────────────────────────────────────
// ~40 000 chars ≈ 10 000 tokens for Gemini Flash. Most statements/invoices are
// well under this. We slice from the start so header + transactions are captured.
const MAX_TEXT_CHARS = 40_000;

// ── System instructions ───────────────────────────────────────────────────────
// Kept as a constant so they're compiled once and reused. Using systemInstruction
// lets the Google backend apply its own caching for repeated identical instructions.

const BANK_SYSTEM = `You are a financial document parser for Canadian bank statements.
Extract ALL transactions and header details from the raw text.

Return ONLY valid JSON matching this EXACT schema (no markdown fences, no commentary):
{
  "bank": "string or null",
  "period": "string or null",
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "openingBalance": number_or_null,
  "closingBalance": number_or_null,
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "string", "amount": number, "type": "debit|credit" }
  ]
}

Rules:
- amount is ALWAYS positive; use type "debit" for withdrawals/charges, "credit" for deposits
- All dates must be ISO format YYYY-MM-DD
- description: clean, trimmed text (max 80 chars) — no trailing numbers that are part of amounts
- Omit summary/balance lines, section headers, and totals — only include real transactions
- Extract EVERY transaction you can find; do not stop early
- If you find a running balance column, ignore it (do not treat it as a transaction)`;

const INVOICE_SYSTEM = `You are an invoice and receipt parser for Canadian businesses.
Extract all billing details from the raw text.

Return ONLY valid JSON matching this EXACT schema (no markdown fences, no commentary):
{
  "date": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "documentNumber": "string or null",
  "vendor": "string or null",
  "client": "string or null",
  "subtotal": number_or_null,
  "hst": number_or_null,
  "total": number_or_null,
  "hstNumber": "string or null",
  "lineItems": [
    { "description": "string", "quantity": number, "rate": number, "amount": number }
  ]
}

Rules:
- All amounts in document currency (usually CAD)
- subtotal is pre-tax; hst is the GST/HST/tax amount; total includes tax
- lineItems is [] if no itemized list found
- documentNumber: invoice #, order #, receipt #, etc.
- vendor: who issued the invoice/receipt
- client: who it was billed to
- hstNumber: Canadian business number (e.g. 123456789 RT0001)
- Return null for any field not found in the text`;

/**
 * POST /api/parse-pdf-ai
 * Body: { text: string, mode: 'bank_statement' | 'invoice', filename?: string }
 * Returns the same shape as /api/parse-pdf (parsed + transactions for bank, parsed for invoice)
 * so callers can slot it in as a drop-in improvement.
 */
export async function POST(request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try { await verifyToken(token); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

    // ── Rate limit ────────────────────────────────────────────────────
    const ip = request.headers.get('x-real-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
      ?? 'unknown';
    if (!limiter.check(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }

    // ── API key ───────────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'AI features require a GEMINI_API_KEY in .env.local.' },
        { status: 503 }
      );
    }

    // ── Validate body ─────────────────────────────────────────────────
    const body = await request.json();
    const { text, mode } = body;
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }
    if (mode !== 'bank_statement' && mode !== 'invoice') {
      return NextResponse.json({ error: 'mode must be bank_statement or invoice' }, { status: 400 });
    }

    // ── Truncate (cost control) ───────────────────────────────────────
    const truncated = text.length > MAX_TEXT_CHARS
      ? text.slice(0, MAX_TEXT_CHARS) + '\n[...text truncated for length]'
      : text;

    // ── Cache check ───────────────────────────────────────────────────
    const cKey = makeCacheKey(mode, truncated);
    const cached = getCached(cKey);
    if (cached) return NextResponse.json({ ...cached, fromCache: true });

    // ── Call Gemini Flash ─────────────────────────────────────────────
    // gemini-2.0-flash: cheapest capable model; responseMimeType forces valid JSON
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: mode === 'bank_statement' ? BANK_SYSTEM : INVOICE_SYSTEM,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const aiResult = await model.generateContent(
      `Parse this ${mode === 'bank_statement' ? 'bank statement' : 'invoice/receipt'}:\n\n${truncated}`
    );

    const raw = aiResult.response.text().trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Strip markdown fences if the model added them despite responseMimeType
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    }

    // ── Normalise bank statement response ─────────────────────────────
    // For bank_statement, return parsed header + transactions at top level
    // (same shape as /api/parse-pdf so page code is identical)
    let responsePayload;
    if (mode === 'bank_statement') {
      const { transactions = [], ...header } = parsed;
      responsePayload = {
        parsed: header,
        transactions: Array.isArray(transactions) ? transactions : [],
      };
    } else {
      responsePayload = { parsed };
    }

    setCached(cKey, responsePayload);
    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error('parse-pdf-ai error:', err);
    return NextResponse.json(
      { error: 'AI parsing failed: ' + (err.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
