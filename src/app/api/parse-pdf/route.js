import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/parse-pdf
 * Accepts multipart form with one or more `file` entries.
 * Optional `mode` field: 'invoice' (default) | 'bank_statement'
 * Returns { results: [{ filename, text, parsed, transactions? }] }
 * For single-file calls also returns top-level { text, parsed } for backwards compat.
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const mode = formData.get('mode') || 'invoice';
    const files = formData.getAll('file');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const results = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        results.push({ filename: file.name, error: 'Unsupported file type' });
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        results.push({ filename: file.name, error: 'File too large (max 20 MB)' });
        continue;
      }

      let text = '';
      if (file.type === 'application/pdf') {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const result = await pdfParse(buffer);
        text = result.text;
      }

      const parsed = mode === 'bank_statement'
        ? parseBankStatementText(text)
        : parseDocumentText(text);

      const entry = { filename: file.name, text, parsed };
      if (mode === 'bank_statement') {
        entry.transactions = extractTransactions(text);
      }
      results.push(entry);
    }

    // Backwards compat: single file returns top-level text/parsed too
    const response = { results };
    if (results.length === 1 && !results[0].error) {
      response.text = results[0].text;
      response.parsed = results[0].parsed;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('PDF parse error:', err);
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}

// ─── SMART FIELD EXTRACTION ─────────────────────────────────────────────────

function parseDocumentText(text) {
  if (!text) return {};

  const result = {};

  // --- Date extraction ---
  const datePatterns = [
    /\b(\d{4}[-/]\d{2}[-/]\d{2})\b/,                                   // 2025-01-15 or 2025/01/15
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i,
    /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i,
    /\b(\d{2}[-/]\d{2}[-/]\d{4})\b/,                                   // 01-15-2025
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) {
      const parsed = parseDateString(m[1]);
      if (parsed) { result.date = parsed; break; }
    }
  }

  // --- Invoice/doc number ---
  // Matches: "Invoice #1234", "Invoice No. INV-042", "Invoice: 0099", "#1234" near invoice keyword, WaveApps "Invoice 2026-001" etc.
  const invPatterns = [
    /(?:invoice|inv)\s*(?:no\.?|number|num\.?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9_/-]{0,30})/i,
    /(?:bill|receipt|order|ref|doc)\s*(?:no\.?|number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9_/-]{0,30})/i,
    /^#\s*(\d+)/m,
  ];
  for (const pat of invPatterns) {
    const m = text.match(pat);
    if (m) {
      const candidate = m[1].trim();
      // Skip if it looks like a date or a very short fragment
      if (candidate.length >= 1 && !/^(date|from|to|due)$/i.test(candidate)) {
        result.documentNumber = candidate;
        break;
      }
    }
  }

  // --- Amounts ---
  // Look for total first (most significant number)
  const totalMatch = text.match(/(?:total|amount\s+due|balance\s+due|grand\s+total|total\s+due)[^\d$]*\$?([\d,]+\.?\d{0,2})/i);
  if (totalMatch) result.total = parseFloat(totalMatch[1].replace(/,/g, ''));

  // Subtotal
  const subtotalMatch = text.match(/(?:subtotal|sub-total|sub\s+total)[^\d$]*\$?([\d,]+\.?\d{0,2})/i);
  if (subtotalMatch) result.subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));

  // HST/GST
  const hstMatch = text.match(/(?:HST|GST|hst|gst|tax)[^\d$]*\$?([\d,]+\.?\d{0,2})/i);
  if (hstMatch) result.hst = parseFloat(hstMatch[1].replace(/,/g, ''));

  // If only total found, try to reverse-calculate subtotal
  if (result.total && !result.subtotal && !result.hst) {
    // Try to find any dollar amounts
    const amounts = [...text.matchAll(/\$\s*([\d,]+\.\d{2})/g)]
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0)
      .sort((a, b) => b - a);

    if (amounts.length > 0 && !result.total) {
      result.total = amounts[0];
    }
  }

  // --- Vendor / Billed To / Client ---
  const vendorMatch = text.match(/(?:from|vendor|company|billed\s+from|bill\s+from|issued\s+by)[:\s]+([A-Z][^\n]{2,60})/i);
  if (vendorMatch) result.vendor = vendorMatch[1].trim();

  const clientMatch = text.match(/(?:to|bill\s+to|billed\s+to|client|customer)[:\s]+([A-Z][^\n]{2,60})/i);
  if (clientMatch) result.client = clientMatch[1].trim();

  // --- HST number ---
  const hstNumMatch = text.match(/(?:HST|GST|BN)[#\s:]+(\d{9}\s?(?:RT|RP)?\s?\d{4})/i);
  if (hstNumMatch) result.hstNumber = hstNumMatch[1].trim().replace(/\s+/g, ' ');

  // --- Line items (basic) ---
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  result.lineCount = lines.length;

  // Description: find likely description lines (non-numeric, > 10 chars)
  const descLines = lines
    .filter(l => l.length > 10 && l.length < 120 && !/^\$/.test(l) && !/(invoice|subtotal|gst|hst|total|date|payment|terms|bill|from|to)/i.test(l))
    .slice(0, 3);
  if (descLines.length > 0) result.description = descLines[0];

  return result;
}

function parseDateString(str) {
  if (!str) return null;
  // Normalize
  const s = str.replace(/\//g, '-');
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try native parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

// ─── BANK STATEMENT PARSING ─────────────────────────────────────────────────

function parseBankStatementText(text) {
  if (!text) return {};
  const result = {};

  // Detect bank name
  const bankPatterns = [
    [/TD\s+(?:Canada\s+Trust|Bank)/i, 'TD Bank'],
    [/Royal\s+Bank|RBC/i, 'RBC'],
    [/Bank\s+of\s+Montreal|BMO/i, 'BMO'],
    [/Scotiabank|Nova\s+Scotia/i, 'Scotiabank'],
    [/CIBC|Canadian\s+Imperial/i, 'CIBC'],
    [/National\s+Bank|Banque\s+Nationale/i, 'National Bank'],
    [/Desjardins/i, 'Desjardins'],
    [/Tangerine/i, 'Tangerine'],
    [/EQ\s+Bank/i, 'EQ Bank'],
    [/PC\s+Financial|President.s\s+Choice/i, "PC Financial"],
  ];
  for (const [pat, name] of bankPatterns) {
    if (pat.test(text)) { result.bank = name; break; }
  }

  // Statement period
  const periodMatch = text.match(/(?:statement\s+(?:period|date|for)|from)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+(?:to|[-–])\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (periodMatch) {
    result.periodStart = parseDateString(periodMatch[1]);
    result.periodEnd = parseDateString(periodMatch[2]);
  }

  // Account number (last 4 digits pattern)
  const acctMatch = text.match(/(?:account|acct)[#\s.:]*(?:\*{3,}|x+)(\d{4})/i);
  if (acctMatch) result.accountLast4 = acctMatch[1];

  // Opening/closing balance
  const openMatch = text.match(/(?:opening|beginning|previous)\s+balance[:\s$]*([0-9,]+\.\d{2})/i);
  if (openMatch) result.openingBalance = parseFloat(openMatch[1].replace(/,/g, ''));
  const closeMatch = text.match(/(?:closing|ending|current)\s+balance[:\s$]*([0-9,]+\.\d{2})/i);
  if (closeMatch) result.closingBalance = parseFloat(closeMatch[1].replace(/,/g, ''));

  return result;
}

/**
 * Extract individual transactions from bank statement text.
 * Handles common Canadian bank PDF formats.
 */
function extractTransactions(text) {
  if (!text) return [];
  const transactions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Pattern 1: "Jan 15  DESCRIPTION  -$1,234.56" or "+$1,234.56"
  const pat1 = /^([A-Z][a-z]{2}\.?\s+\d{1,2})\s{2,}(.{3,60?}?)\s{2,}([+-]?\$[\d,]+\.\d{2})\s*$/;
  // Pattern 2: "01/15/2025  DESCRIPTION  1,234.56  5,678.90"
  const pat2 = /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s{2,}(.{3,60?}?)\s{2,}([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$/;
  // Pattern 3: "Jan 15, 2025 DESCRIPTION 1,234.56 CR" or "(1,234.56)"
  const pat3 = /^([A-Z][a-z]{2}\.?\s+\d{1,2},?\s+\d{4})\s{2,}(.{3,60?}?)\s{2,}(?:\((\d[\d,]*\.\d{2})\)|([\d,]+\.\d{2})\s*(CR|DR)?)/;

  let year = new Date().getFullYear();

  for (const line of lines) {
    let m;

    if ((m = line.match(pat1))) {
      const rawAmt = m[3].replace(/[$,]/g, '');
      const amount = parseFloat(rawAmt);
      if (isNaN(amount)) continue;
      const dateStr = parseDateString(m[1] + ' ' + year);
      transactions.push({
        date: dateStr,
        description: m[2].trim(),
        amount,
        type: amount < 0 ? 'debit' : 'credit',
      });
    } else if ((m = line.match(pat2))) {
      const rawAmt = m[3].replace(/,/g, '');
      const amount = parseFloat(rawAmt);
      if (isNaN(amount)) continue;
      const dateStr = parseDateString(m[1]);
      transactions.push({
        date: dateStr,
        description: m[2].trim(),
        amount,
        type: 'unknown', // No sign info in this pattern
      });
    } else if ((m = line.match(pat3))) {
      let amount;
      if (m[3]) {
        amount = -parseFloat(m[3].replace(/,/g, '')); // parentheses = negative
      } else {
        amount = parseFloat(m[4].replace(/,/g, ''));
        if (m[5] === 'DR') amount = -amount;
      }
      if (isNaN(amount)) continue;
      const dateStr = parseDateString(m[1]);
      transactions.push({
        date: dateStr,
        description: m[2].trim(),
        amount,
        type: amount < 0 ? 'debit' : 'credit',
      });
    }
  }

  return transactions.filter(t => t.date && t.description && !isNaN(t.amount));
}
