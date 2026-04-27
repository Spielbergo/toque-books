import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { createRateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * Extract a dollar amount from text near a label.
 * Returns a float or null.
 */
function extractAmount(text, patterns) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const raw = m[1].replace(/,/g, '').trim();
      const val = parseFloat(raw);
      if (!isNaN(val)) return val;
    }
  }
  return null;
}

/**
 * Extract a 4-digit tax year from text.
 */
function extractYear(text) {
  // Look for "Tax Year YYYY" or "YYYY Tax Year" or just a 4-digit year in 20xx range
  const m = text.match(/tax\s+year[:\s]+(\d{4})/i)
    || text.match(/(\d{4})\s+tax\s+year/i)
    || text.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1]) : null;
}

/**
 * Parse a CRA T4 slip from extracted text.
 */
function parseT4(text) {
  return {
    slipType: 'T4',
    taxYear: extractYear(text),
    t4: {
      // Box 14 — Employment income
      box14: extractAmount(text, [
        /(?:box|case)\s*14[:\s]+\$?([\d,]+\.?\d*)/i,
        /employment\s+income[:\s]+\$?([\d,]+\.?\d*)/i,
        /14\s+employment[^$\d]*\$?([\d,]+\.?\d*)/i,
      ]),
      // Box 22 — Income tax deducted
      box22: extractAmount(text, [
        /(?:box|case)\s*22[:\s]+\$?([\d,]+\.?\d*)/i,
        /income\s+tax\s+deducted[:\s]+\$?([\d,]+\.?\d*)/i,
        /22\s+income\s+tax[^$\d]*\$?([\d,]+\.?\d*)/i,
      ]),
      // Box 16 — CPP contributions
      box16: extractAmount(text, [
        /(?:box|case)\s*16[:\s]+\$?([\d,]+\.?\d*)/i,
        /cpp\s+contributions?[:\s]+\$?([\d,]+\.?\d*)/i,
        /employee['s]*\s+cpp[^$\d]*\$?([\d,]+\.?\d*)/i,
      ]),
      // Box 18 — EI premiums
      box18: extractAmount(text, [
        /(?:box|case)\s*18[:\s]+\$?([\d,]+\.?\d*)/i,
        /ei\s+premiums?[:\s]+\$?([\d,]+\.?\d*)/i,
        /employee['s]*\s+ei[^$\d]*\$?([\d,]+\.?\d*)/i,
      ]),
    },
    t5: null,
    noa: null,
  };
}

/**
 * Parse a CRA T5 slip from extracted text.
 */
function parseT5(text) {
  return {
    slipType: 'T5',
    taxYear: extractYear(text),
    t4: null,
    t5: {
      // Box 10 — Actual amount of eligible dividends
      box10: extractAmount(text, [
        /(?:box|case)\s*10[:\s]+\$?([\d,]+\.?\d*)/i,
        /actual\s+amount\s+of\s+eligible\s+dividends?[:\s]+\$?([\d,]+\.?\d*)/i,
        /eligible\s+dividends?[^$\d]*\$?([\d,]+\.?\d*)/i,
      ]),
      // Box 24 — Actual amount of non-eligible dividends
      box24: extractAmount(text, [
        /(?:box|case)\s*24[:\s]+\$?([\d,]+\.?\d*)/i,
        /actual\s+amount\s+of\s+non[\s-]eligible\s+dividends?[:\s]+\$?([\d,]+\.?\d*)/i,
        /non[\s-]eligible\s+dividends?[^$\d]*\$?([\d,]+\.?\d*)/i,
      ]),
    },
    noa: null,
  };
}

/**
 * Parse a CRA Notice of Assessment from extracted text.
 */
function parseNOA(text) {
  return {
    slipType: 'NOA',
    taxYear: extractYear(text),
    t4: null,
    t5: null,
    noa: {
      rrspRoom: extractAmount(text, [
        /rrsp\s+deduction\s+limit[:\s]+\$?([\d,]+\.?\d*)/i,
        /your\s+rrsp\s+limit[:\s]+\$?([\d,]+\.?\d*)/i,
        /available\s+contribution\s+room[:\s]+\$?([\d,]+\.?\d*)/i,
        /rrsp\/prpp\s+deduction\s+limit[:\s]+\$?([\d,]+\.?\d*)/i,
      ]),
    },
  };
}

/**
 * Detect slip type from text.
 */
function detectSlipType(text) {
  const t = text.toUpperCase();
  if (t.includes('STATEMENT OF REMUNERATION') || t.includes('T4 ') || /\bT4\b/.test(t)) return 'T4';
  if (t.includes('STATEMENT OF INVESTMENT INCOME') || t.includes('T5 ') || /\bT5\b/.test(t)) return 'T5';
  if (t.includes('NOTICE OF ASSESSMENT') || t.includes('NOA') || t.includes('RRSP DEDUCTION LIMIT')) return 'NOA';
  if (t.includes('T4A')) return 'T4A';
  return 'unknown';
}

/**
 * POST /api/ai-parse-pdf
 * Accepts multipart form data with one or more 'file' entries (PDF only).
 * Extracts text locally using pdf-parse and returns structured T4/T5/NOA data.
 * No data is sent to any external service.
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

    const formData = await request.formData();
    const files = formData.getAll('file');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const pdf = require('pdf-parse/lib/pdf-parse.js');
    const results = [];

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        results.push({ filename: file.name, error: 'Only PDF files are supported. Convert images to PDF first.' });
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        results.push({ filename: file.name, error: 'File too large (max 20 MB)' });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const data = await pdf(buffer);
        const text = data.text;

        const slipType = detectSlipType(text);
        let parsed;
        if (slipType === 'T4' || slipType === 'T4A') {
          parsed = parseT4(text);
          parsed.slipType = slipType;
        } else if (slipType === 'T5') {
          parsed = parseT5(text);
        } else if (slipType === 'NOA') {
          parsed = parseNOA(text);
        } else {
          parsed = { slipType: 'unknown', taxYear: extractYear(text), t4: null, t5: null, noa: null };
        }

        results.push({ filename: file.name, parsed });
      } catch (e) {
        console.error('pdf-parse error for', file.name, e?.message);
        results.push({
          filename: file.name,
          error: 'Could not read PDF — ensure this is a text-based CRA T4, T5, or Notice of Assessment (not a scanned image)',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error('parse-pdf route error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

