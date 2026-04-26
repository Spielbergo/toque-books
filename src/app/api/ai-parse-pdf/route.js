import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { createRateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 }); // 10 AI calls/min per IP

const EXTRACTION_PROMPT = `You are a Canadian tax slip parser. Analyze this CRA tax document image or PDF and extract all available data.

Return ONLY a valid JSON object with this exact structure (use null for any field not found or not present in this document):
{
  "slipType": "T4" or "T5" or "NOA" or "T4A" or "unknown",
  "taxYear": number or null,
  "t4": {
    "box14": number or null,
    "box22": number or null,
    "box16": number or null,
    "box18": number or null
  },
  "t5": {
    "box10": number or null,
    "box24": number or null
  },
  "noa": {
    "rrspRoom": number or null
  }
}

Field meanings:
- T4 Box 14: Employment income
- T4 Box 22: Income tax deducted
- T4 Box 16: Employee CPP contributions
- T4 Box 18: Employee EI premiums
- T5 Box 10: Actual amount of eligible dividends
- T5 Box 24: Actual amount of non-eligible dividends
- NOA rrspRoom: RRSP deduction limit for next year (from Notice of Assessment)

Rules:
- Extract monetary values as plain numbers without dollar signs, commas, or spaces (e.g. 12345.67)
- Set fields to null if not present in the document
- If this is a T4, set t5 and noa to null
- If this is a T5, set t4 and noa to null
- If this is a NOA, set t4 and t5 to null
- Return ONLY the JSON object, no explanation or markdown`;

/**
 * POST /api/ai-parse-pdf
 * Accepts multipart form data with one or more 'file' entries (PDF or image).
 * Sends each file to Gemini 1.5 Flash and returns structured T4/T5/NOA data.
 * Returns { results: [{ filename, parsed? | error? }] }
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

    const formData = await request.formData();
    const files = formData.getAll('file');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const results = [];

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        results.push({ filename: file.name, error: 'Unsupported file type. Use PDF, PNG, or JPEG.' });
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        results.push({ filename: file.name, error: 'File too large (max 20 MB)' });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString('base64');
        const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type;

        const result = await model.generateContent([
          { inlineData: { data: base64, mimeType } },
          EXTRACTION_PROMPT,
        ]);

        const raw = result.response.text().trim();
        // Strip markdown code fences if Gemini wraps in ```json ... ```
        const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(jsonText);

        results.push({ filename: file.name, parsed });
      } catch (e) {
        console.error('Gemini parse error for', file.name, e?.message);
        results.push({
          filename: file.name,
          error: 'Could not extract data — ensure this is a CRA T4, T5, or Notice of Assessment',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error('ai-parse-pdf route error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
