import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 }); // 30 uploads/min per IP

/**
 * POST /api/parse-pdf
 * Accepts multipart form with one or more `file` entries.
 * Optional `mode` field: 'invoice' (default) | 'bank_statement'
 * Returns { results: [{ filename, text, parsed, transactions? }] }
 * For single-file calls also returns top-level { text, parsed } for backwards compat.
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
      await verifyToken(token);
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
        entry.transactions = parsed.bank === 'RBC'
          ? extractRBCTransactions(text, parsed.openingBalance, parsed.periodStart)
          : extractTransactions(text);
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

/**
 * Search lines[] for a label matching labelPattern and return the $ amount
 * at the END of that line, or at the START of the NEXT line.
 * This handles PDFs where label and value appear on adjacent lines.
 * Returns null if not found.
 */
function extractLabeledAmount(lines, labelPattern) {
  for (let i = 0; i < lines.length; i++) {
    if (!labelPattern.test(lines[i])) continue;
    // Amount at end of same line: "Total payable / ... $40.57"
    const sameLine = lines[i].match(/\$\s*([\d,]+\.\d{2})\s*$/);
    if (sameLine) return parseFloat(sameLine[1].replace(/,/g, ''));
    // Amount on next line: "Total payable / ...\n$40.57"
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].match(/^\s*\$?\s*([\d,]+\.\d{2})\b/);
      if (nextLine) return parseFloat(nextLine[1].replace(/,/g, ''));
    }
  }
  return null;
}

// ─── PLATFORM / MARKETPLACE VENDOR DETECTION ────────────────────────────────
const PLATFORM_PATTERNS = [
  [/amazon\.ca|amazon\.com\.ca|amazon\.com\b/i, 'Amazon.ca'],
  [/\bnewegg\.ca|\bnewegg\.com/i, 'Newegg'],
  [/\bgoogle\s+pay|\bgoogle\s+store|\bgoogle\.com/i, 'Google'],
  [/\bapple\s+store|\bapple\.com/i, 'Apple'],
  [/\bmicrosoft\.com|\bxbox\b/i, 'Microsoft'],
  [/\badobe\.com/i, 'Adobe'],
  [/\bshopify\b/i, 'Shopify'],
];

/**
 * Return a canonical marketplace name if text (or the GST/HST remitter name) betrays
 * that this is a marketplace receipt, otherwise returns null.
 */
function detectPlatformVendor(text, remitterName) {
  const haystack = (remitterName ? remitterName + '\n' : '') + text;
  for (const [pat, name] of PLATFORM_PATTERNS) {
    if (pat.test(haystack)) return name;
  }
  return null;
}

// ─── SMART FIELD EXTRACTION ─────────────────────────────────────────────────

function parseDocumentText(text) {
  if (!text) return {};

  const result = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // --- Date extraction ---
  // WaveApps format: "Invoice Date:October 7, 2024" and "Payment Due:October 7, 2024"
  // Bilingual format: "Invoice date / Date de facturation: 29 April 2025"
  // Amazon: "Order date / Date de commande: March 3, 2026"
  const issueDateMatch = text.match(/(?:Invoice|Order)\s*date\s*(?:\/[^:\n]+)?:\s*([^\n\r]+)/i);
  if (issueDateMatch) {
    const parsed = parseDateString(issueDateMatch[1].trim());
    if (parsed) result.date = parsed;
  }

  const dueDateMatch = text.match(/Payment\s*Due\s*:([^\n\r]+)/i);
  if (dueDateMatch) {
    const parsed = parseDateString(dueDateMatch[1].trim());
    if (parsed) result.dueDate = parsed;
  }

  // Generic fallback — only if label-based extraction above didn't find anything
  if (!result.date) {
    const datePatterns = [
      /\b(\d{4}[-/]\d{2}[-/]\d{2})\b/,
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i,
      /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i,
      /\b(\d{2}[-/]\d{2}[-/]\d{4})\b/,
    ];
    for (const pat of datePatterns) {
      const m = text.match(pat);
      if (m) {
        const parsed = parseDateString(m[1]);
        if (parsed) { result.date = parsed; break; }
      }
    }
  }

  // --- Invoice number ---
  // WaveApps: "Invoice Number:96" (no space after colon)
  // Bilingual: "Invoice # / # de facture: CA51OI5A5QQI"
  const sameLine = text.match(/invoice\s*(?:#|number|num|no\.?)\s*(?:\/[^:\n]+)?\s*:?\s*(\S{1,30})/i);
  if (sameLine) {
    const c = sameLine[1].trim().replace(/[.,]$/, '');
    if (!/^(date|from|to|due)$/i.test(c)) result.documentNumber = c;
  }

  if (!result.documentNumber) {
    const labelIdx = lines.findIndex(l => /^invoice\s*(?:number|num|no\.?|#)\s*:?\s*$/i.test(l));
    if (labelIdx >= 0 && lines[labelIdx + 1]) {
      const candidate = lines[labelIdx + 1].trim();
      if (/^[A-Z0-9][A-Z0-9_/.-]{0,30}$/i.test(candidate)) result.documentNumber = candidate;
    }
  }

  if (!result.documentNumber) {
    const m = text.match(/(?:invoice\s*#|^#\s*)(\w[\w/-]{0,20})/im);
    if (m) result.documentNumber = m[1].trim();
  }

  // --- Amounts ---
  // Use extractLabeledAmount() so label and value can be on adjacent lines —
  // pdf-parse sometimes puts them on separate lines when extracting box/table layouts.

  // Total: most-specific labels first to avoid matching subtotal labels
  result.total =
    extractLabeledAmount(lines, /total\s+payable/i) ||
    extractLabeledAmount(lines, /order\s+total/i) ||
    extractLabeledAmount(lines, /amount\s+due/i) ||
    extractLabeledAmount(lines, /grand\s+total/i) ||
    extractLabeledAmount(lines, /balance\s+due/i) ||
    extractLabeledAmount(lines, /total\s+due/i) ||
    // Bare "total" line — but NOT "total before/avant/partiel" (those are subtotal synonyms)
    (() => {
      for (let i = 0; i < lines.length; i++) {
        if (!/\btotal\b/i.test(lines[i])) continue;
        if (/(?:before|avant|partiel|excl|sub-?total)/i.test(lines[i])) continue;
        const m = lines[i].match(/\$\s*([\d,]+\.\d{2})\s*$/) ||
                  (lines[i + 1] && lines[i + 1].match(/^\s*\$?\s*([\d,]+\.\d{2})\b/));
        if (m) return parseFloat(m[1].replace(/,/g, ''));
      }
      return null;
    })() ||
    null;

  // Subtotal (pre-tax):
  //   "Total before tax / Montant avant taxes: $35.90"  ← Amazon
  //   "Item subtotal", "before tax", "excl. tax"         ← generic
  //   "Subtotal" / "Sub-total"                           ← WaveApps / others
  //   NOT "Invoice subtotal" (Amazon: = total incl. tax)
  result.subtotal =
    extractLabeledAmount(lines, /total\s+before\s+tax/i) ||
    extractLabeledAmount(lines, /montant\s+avant\s+taxes?/i) ||
    extractLabeledAmount(lines, /item\s+subtotal/i) ||
    extractLabeledAmount(lines, /(?:excl\.?\s*tax|before\s+tax)/i) ||
    (() => {
      for (let i = 0; i < lines.length; i++) {
        if (!/\bsub-?total\b/i.test(lines[i])) continue;
        if (/invoice/i.test(lines[i])) continue; // skip "Invoice subtotal" (= total incl. tax on Amazon)
        const m = lines[i].match(/\$\s*([\d,]+\.\d{2})\s*$/) ||
                  (lines[i + 1] && lines[i + 1].match(/^\s*\$?\s*([\d,]+\.\d{2})\b/));
        if (m) return parseFloat(m[1].replace(/,/g, ''));
      }
      return null;
    })() ||
    null;

  // HST/GST — line-based, most-specific first.
  // Registration number lines (e.g. "85730 5932 RT0001") have no "$X.XX" so are
  // skipped naturally by extractLabeledAmount's dollar-sign requirement.
  const hstLabelPatterns = [
    /estimated\s+gst\/hst/i,
    /federal\s+tax/i,
    /taxe\s+f[eé]d[eé]rale/i,
    /\b(?:gst|hst)\b(?![\s\d]*(?:#|RT|RP))/i,
  ];
  for (const pat of hstLabelPatterns) {
    const v = extractLabeledAmount(lines, pat);
    if (v != null) {
      const plausibleTotal = result.total || result.subtotal || 10000;
      if (v > 0 && v < plausibleTotal * 0.25) { result.hst = v; break; }
    }
  }

  // Shipping (only stored when > $0)
  const shippingAmt = extractLabeledAmount(lines, /shipping(?:\s+(?:charges?|&\s*handling|and\s+handling))?/i);
  if (shippingAmt != null && shippingAmt > 0) result.shipping = shippingAmt;

  // --- Vendor / Seller ---
  // Step 1: check for known marketplace platforms (Amazon, Newegg, Google, Apple, etc.)
  // by looking at the domain or "GST/HST remitted by" field which names the platform operator
  const remittedBy = text.match(/(?:GST|HST|TPS|TVH)\s+remitted\s+by[^:\n]*:\s*([^\n\r]+)/i);
  const platformVendor = detectPlatformVendor(text, remittedBy?.[1]);
  if (platformVendor) {
    result.vendor = platformVendor;
  } else {
    // Step 2: explicit "Sold by" label on same or next line
    const soldByInline = text.match(/Sold\s+by\s*(?:\/[^:\n]+)?:\s*([^\n\r$\d]{2,80})/i);
    if (soldByInline) {
      result.vendor = soldByInline[1].trim().replace(/\s+/g, ' ');
    }
    if (!result.vendor) {
      const sellerMatch = text.match(/(?:Seller|Vendor)\s*:\s*([^\n\r$\d]{2,80})/i);
      if (sellerMatch) result.vendor = sellerMatch[1].trim();
    }
    if (!result.vendor) {
      const soldByIdx = lines.findIndex(l => /^Sold\s+by\s*(?:\/.*)?$/i.test(l));
      if (soldByIdx >= 0 && lines[soldByIdx + 1]) {
        result.vendor = lines[soldByIdx + 1].trim();
      }
    }
  }

  // --- Client (Bill To) ---
  // Look for lines after "Bill To:" or "Billed To:" label
  const billToIdx = lines.findIndex(l => /^(?:bill\s*to|billed\s*to|client|ship\s*to)\s*:?\s*$/i.test(l));
  if (billToIdx >= 0 && lines[billToIdx + 1]) {
    result.client = lines[billToIdx + 1].trim();
  }
  if (!result.client) {
    const clientMatch = text.match(/(?:bill\s+to|billed\s+to)[:\s]+([A-Z][^\n]{2,60})/i);
    if (clientMatch) result.client = clientMatch[1].trim();
  }

  // --- HST registration number ---
  const hstNumMatch = text.match(/(?:HST|GST|BN)[#\s:]+(\d{9}\s?(?:RT|RP)?\s?\d{4})/i);
  if (hstNumMatch) result.hstNumber = hstNumMatch[1].trim().replace(/\s+/g, ' ');

  // --- Line items (table parsing) ---
  // Pass where the Bill To / address block ends so the parser never searches inside it.
  let addressEndIdx = 0;
  if (billToIdx >= 0) {
    // WaveApps-style: "Bill To:" on its own line, followed by address lines
    let k = billToIdx + 1;
    while (k < lines.length && k < billToIdx + 8) {
      if (/^(description|item|service|product|qty|quantity|unit price|amount|rate)\b/i.test(lines[k])) break;
      k++;
    }
    addressEndIdx = k;
  }

  // Amazon-style: "Billing address / Adresse de facturation" begins a 3-column section
  // (Billing | Delivery | Sold by) — advance addressEndIdx past the whole block so the
  // header search starts from the actual item table, not from interleaved address lines.
  const amazonAddrIdx = lines.findIndex(l => /^billing\s*address\b/i.test(l));
  if (amazonAddrIdx >= 0) {
    let k = amazonAddrIdx + 1;
    while (k < lines.length) {
      // Stop at the next major section header that precedes the item table
      if (/^(?:order\s+(?:information|date|#)|invoice\s+details|shipment\s+date)\b/i.test(lines[k])) break;
      k++;
    }
    addressEndIdx = Math.max(addressEndIdx, k);
  }
  result.lineItems = parseLineItems(lines, text, addressEndIdx);

  // Single description fallback (used when no table found)
  if (result.lineItems.length === 0) {
    const descLines = lines.filter(l => isLikelyItemDescription(l));
    result.description = descLines[0] || '';
  }

  // If line items have amounts, use their sum as the authoritative pre-tax subtotal —
  // but only when no label-based subtotal was already found (label is more reliable).
  if (!result.subtotal && Array.isArray(result.lineItems) && result.lineItems.length > 0) {
    const liTotal = result.lineItems.reduce((s, li) => s + (li.amount || 0), 0);
    if (liTotal > 0 && (!result.total || liTotal <= result.total + 0.02)) {
      result.subtotal = +liTotal.toFixed(2);
    }
  }

  return result;
}

/**
 * Parse line items from the table section of an invoice.
 * addressEndIdx: index of first line AFTER the Bill To address block — never search before this.
 *
 * Handles:
 *   A) All columns on one line:  "Web Design  1  $500.00  $500.00"
 *   B) WaveApps multi-line: description on its own line, then qty/rate/amount on following lines
 *   C) Fallback: any line ending with two currency values
 */
function parseLineItems(lines, text, addressEndIdx = 0) {
  // ── Find table header row ────────────────────────────────────────────────
  // WaveApps concatenated: "ItemsQuantityPriceAmount" — all headers fused into one token
  let headerIdx = lines.findIndex((l, i) =>
    i >= addressEndIdx &&
    /^Items?Quantity/i.test(l)
  );

  // Standard single-line header (e.g. "Description  Qty  Unit Price  Amount")
  if (headerIdx < 0) {
    headerIdx = lines.findIndex((l, i) =>
      i >= addressEndIdx &&
      /\b(description|items?|service|product|details)\b/i.test(l) &&
      /\b(qty|quantity|hours?|units?|amount|price|rate|unit)\b/i.test(l)
    );
  }

  // WaveApps multi-line header: "Items" on one line, "Quantity" on next
  if (headerIdx < 0) {
    for (let i = addressEndIdx; i < lines.length - 1; i++) {
      if (/^(description|items?|service|details)$/i.test(lines[i]) &&
          /^(qty|quantity|hours?|units?)$/i.test(lines[i + 1])) {
        // Find the end of the multi-line header block (skip until non-header keyword)
        let j = i + 2;
        while (j < lines.length && /^(unit\s*price|price|rate|amount|total)$/i.test(lines[j])) j++;
        headerIdx = j - 1; // will +1 below
        break;
      }
    }
  }

  // ── Find footer row (Subtotal / Total) ───────────────────────────────────
  const searchFrom = Math.max(headerIdx >= 0 ? headerIdx : addressEndIdx, addressEndIdx);
  const footerIdx = lines.findIndex((l, i) =>
    i > searchFrom &&
    /^(subtotal|sub-total|total\b)/i.test(l)
  );

  const startIdx = headerIdx >= 0 ? headerIdx + 1 : addressEndIdx;
  const endIdx   = footerIdx   >= 0 ? footerIdx   : lines.length;

  const sectionLines = lines.slice(startIdx, endIdx);
  const items = [];

  // ── Strategy A: all columns on one line, space-separated ──────────────────
  // "Web Development  1  $1,500.00  $1,500.00"
  const fullRowRe = /^(.+?)\s{2,}(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$/;

  for (const line of sectionLines) {
    if (/^(subtotal|total|tax|gst|hst|discount|shipping)/i.test(line)) continue;
    const fm = line.match(fullRowRe);
    if (fm) {
      const [, desc, qty, rate, amount] = fm;
      if (isLikelyItemDescription(desc)) {
        items.push({
          description: desc.trim(),
          quantity: parseFloat(qty),
          rate: parseFloat(rate.replace(/,/g, '')),
          amount: parseFloat(amount.replace(/,/g, '')),
        });
      }
    }
  }
  if (items.length > 0) return items;

  // ── Strategy A2: WaveApps concatenated format ─────────────────────────────
  // "Web Development144.25$22.00$3,173.50"  (no spaces between fields AT ALL)
  // "Blog Writing141$16.55$2,333.55"
  // Pattern: text description, then decimal qty, then $price, then $amount
  const concatRe = /^(.+?)(\d+(?:\.\d+)?)\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})$/;

  for (const line of sectionLines) {
    if (/^(subtotal|total|tax|gst|hst|discount|shipping)/i.test(line)) continue;
    const cm = line.match(concatRe);
    if (cm) {
      const [, desc, qty, rate, amount] = cm;
      if (isLikelyItemDescription(desc.trim())) {
        items.push({
          description: desc.trim(),
          quantity: parseFloat(qty),
          rate: parseFloat(rate.replace(/,/g, '')),
          amount: parseFloat(amount.replace(/,/g, '')),
        });
      }
    }
  }
  if (items.length > 0) return items;

  // ── Strategy B: WaveApps multi-line (desc line, then number lines) ────────
  // Each item looks like:
  //   Web Development
  //   116.5          ← decimal qty — must be handled
  //   $22.00
  //   $2,563.00
  const isNumberLine = l => /^\$?[\d,]+\.\d{2}$/.test(l) || /^\d+(?:\.\d+)?$/.test(l);

  let i = 0;
  while (i < sectionLines.length) {
    const line = sectionLines[i];
    if (/^(subtotal|total|tax|gst|hst|discount)/i.test(line)) { i++; continue; }

    if (!isNumberLine(line) && isLikelyItemDescription(line)) {
      const nums = [];
      let j = i + 1;
      while (j < sectionLines.length && nums.length < 4) {
        if (isNumberLine(sectionLines[j])) {
          nums.push(parseFloat(sectionLines[j].replace(/[$,]/g, '')));
          j++;
        } else {
          break;
        }
      }

      if (nums.length >= 2) {
        const amount = nums[nums.length - 1];
        const rate   = nums[nums.length - 2];
        const qty    = nums.length >= 3 ? nums[0] : 1;
        items.push({ description: line.trim(), quantity: qty, rate, amount });
        i = j;
        continue;
      }
    }
    i++;
  }
  if (items.length > 0) return items;

  // ── Strategy C: full-text scan for lines ending with two currency values ──
  const currencyRowRe = /^(.+?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$/gm;
  let m;
  while ((m = currencyRowRe.exec(text)) !== null) {
    const desc = m[1].trim();
    if (isLikelyItemDescription(desc) && !/^(subtotal|total|tax|gst|hst)/i.test(desc)) {
      items.push({
        description: desc,
        quantity: 1,
        rate: parseFloat(m[2].replace(/,/g, '')),
        amount: parseFloat(m[3].replace(/,/g, '')),
      });
    }
  }
  if (items.length > 0) return items;

  // ── Strategy D: Amazon/receipt format – 5+ column rows ───────────────────
  // "description  qty  $unit  $discount  $fed_tax  $prov_tax  $item_subtotal"
  // The last column ($item_subtotal) INCLUDES tax on Amazon; use unitPrice × qty for
  // the pre-tax line amount so that the line-item sum matches "Total before tax".
  const receiptRowRe = /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?[\d,]+\.\d{2}\s+\$?[\d,]+\.\d{2}\s+\$?[\d,]+\.\d{2}\s+\$?([\d,]+\.\d{2})\s*$/;
  for (const line of sectionLines) {
    if (/^(subtotal|total|tax|gst|hst|discount|shipping)/i.test(line)) continue;
    const dm = line.match(receiptRowRe);
    if (dm) {
      const [, desc, qty, unitPrice] = dm;
      if (isLikelyItemDescription(desc.trim())) {
        const q = parseFloat(qty);
        const r = parseFloat(unitPrice.replace(/,/g, ''));
        items.push({
          description: desc.trim(),
          quantity: q,
          rate: r,
          amount: +(q * r).toFixed(2),
        });
      }
    }
  }
  if (items.length > 0) return items;

  // ── Strategy E: multi-line item description ───────────────────────────────
  // Amazon (and some other receipts) put the description on multiple lines and
  // the amounts (qty  $unit  $disc  $tax  $tax  $subtotal) on a SEPARATE line below.
  // Find "amounts-only" rows, then look backward for the description.
  const amtsOnlyRe = /^\s*(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})(?:\s+\$?[\d,]+\.\d{2}){2,}\s*$/;
  for (let si = 0; si < sectionLines.length; si++) {
    const am = sectionLines[si].match(amtsOnlyRe);
    if (!am) continue;
    // Walk backward, skipping non-description lines (ASIN, blank-ish, etc.)
    // Stop at another amounts row or a structural keyword.
    const descCandidates = [];
    for (let j = si - 1; j >= 0; j--) {
      const l = sectionLines[j];
      if (amtsOnlyRe.test(l)) break;                          // another item's amounts row
      if (/^(subtotal|total|tax|gst|hst|discount|shipping|description|qty|quantity|items?\s|paid|sold\s+by|billing|delivery|#\s*tax|invoice\s+details)/i.test(l)) break;
      if (isLikelyItemDescription(l)) descCandidates.unshift(l); // prepend → keeps forward order
    }
    if (descCandidates.length > 0) {
      const q = parseFloat(am[1]);
      const r = parseFloat(am[2].replace(/,/g, ''));
      // Prefer the longest candidate — product descriptions are always longer than names/addresses
      const bestDesc = descCandidates.reduce((best, c) => c.length > best.length ? c : best, descCandidates[0]);
      items.push({
        description: bestDesc, // longest line = most complete product title
        quantity: q,
        rate: r,
        amount: +(q * r).toFixed(2),
      });
    }
  }

  return items;
}

function isLikelyItemDescription(str) {
  if (!str || str.length < 2 || str.length > 150) return false;
  if (!/[a-zA-Z]/.test(str)) return false;

  // Known header/footer/structural words
  if (/^(description|items?|service|product|details|qty|quantity|unit\s*price|rate|price|amount|total|subtotal|tax|gst|hst|tps|tvh|invoice|order|date|due|issue|amount\s*due|bill|from|to|payment|terms|page|thank|notes?|memo|balance|discount|shipping|po\s*#|purchase|powered|sold\s+by|ship|asin|federal|provincial|paid|registration|enregistrement)/i.test(str)) return false;

  // Lines starting with "#" are typically labels like "# Tax Registrations / Pas de # d'enregistrement"
  if (/^#/.test(str)) return false;

  // Looks like an invoice/order reference code: no spaces, all uppercase letters+digits (e.g. CA51OI5A5QQI)
  if (/^[A-Z0-9]{6,}$/.test(str)) return false;

  // Looks like a personal name (2 title-case words, letters only, e.g. "Scott Sutherland")
  if (/^[A-Z][a-z'-]+\s+[A-Z][a-z'-]+$/.test(str) && str.length <= 35) return false;

  // All-uppercase — section headers, person names, street addresses (e.g. "SCOTT SUTHERLAND",
  // "505-150 SUDBURY STREET, BUZZ CODE: 9475"). Real product descriptions always have lowercase.
  if (str === str.toUpperCase() && /[A-Z]{2}/.test(str)) return false;

  // Street address keywords
  if (/\b(street|avenue|ave\.?\b|road|drive|driv\b|blvd\.?|crescent|boulevard|buzz\s+code|postal\s+code)\b/i.test(str)) return false;

  // Month names and date-like patterns (prevent dates parsed as descriptions)
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(str)) return false;
  // "29 April 2025" — digit(s) then a month name
  if (/^\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(str)) return false;
  // ISO date or numeric date "2025-04-29", "03/29/2025"
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(str)) return false;
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str)) return false;

  // Geographic terms (common in address blocks)
  if (/^(canada|united states|usa|u\.s\.a|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|northwest territories|nunavut|yukon|bc|ab|mb|sk|ns|nb|nl|pe|nt|nu|yt)/i.test(str)) return false;

  // Looks like a postal code, phone number, email, or URL
  if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i.test(str)) return false; // Canadian postal code
  if (/^\+?[\d\s().-]{7,}$/.test(str)) return false;          // pure phone number
  if (/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(str)) return false; // inline phone number
  if (/^[\w.+-]+@[\w-]+\.[\w.]{2,}$/.test(str)) return false; // email address
  if (/^(https?:\/\/|www\.)/i.test(str)) return false;        // URL at start
  if (/\bwww\./i.test(str) || /https?:\/\//i.test(str)) return false; // inline URL
  if (/\.(com|ca|net|org|io)\b/i.test(str) && !/\s/.test(str)) return false; // bare domain

  return true;
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

  // Statement period — try "statement period: ... to ..." first
  const periodMatch = text.match(/(?:statement\s+(?:period|date|for)|from)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+(?:to|[-–])\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (periodMatch) {
    result.periodStart = parseDateString(periodMatch[1]);
    result.periodEnd = parseDateString(periodMatch[2]);
  }
  // Fallback: bare "Month D, YYYY to Month D, YYYY" (RBC eStatement header format)
  if (!result.periodStart) {
    const m2 = text.match(/([A-Za-z]+ \d{1,2},?\s*\d{4})\s+to\s+([A-Za-z]+ \d{1,2},?\s*\d{4})/i);
    if (m2) {
      result.periodStart = parseDateString(m2[1]);
      result.periodEnd = parseDateString(m2[2]);
    }
  }
  // Build a human-readable period string for display
  if (result.periodStart) {
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtISO = iso => { const [y,m,d] = iso.split('-'); return `${MON[+m-1]} ${+d}, ${y}`; };
    result.period = result.periodEnd
      ? `${fmtISO(result.periodStart)} – ${fmtISO(result.periodEnd)}`
      : fmtISO(result.periodStart);
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

/**
 * RBC-specific transaction extractor.
 * RBC eStatements PDF text has all columns concatenated with no separators, e.g.:
 *   "01 Nov    Monthly fee6.006,206.13"
 *   "04 Nov    e-Transfer - Autodeposit Yopie.ca"   ← description without amounts
 *   "b87ae1de6ec307ae829cf37310aa63585,000.00"       ← hex ref ID + credit amount
 *   "Online transfer sent - 2224 spielbergo2,000.00" ← same-date debit, no balance
 *   "Online transfer sent - 6406 spielbergo2,000.007,206.13" ← last of group, has balance
 *
 * Strategy:
 *  - Lines starting with "DD Mon" open a new transaction date group.
 *  - Lines starting with 20+ hex chars are e-Transfer reference IDs — their amounts
 *    are appended to the preceding entry.
 *  - All other non-dated lines within the activity section are new same-date transactions.
 *  - When a line has two amounts (txn + running balance), the balance is used to confirm
 *    debit/credit via diff from previous balance.
 *  - When only one amount is present (balance not shown for mid-group transactions),
 *    keyword heuristics determine debit/credit and advance the running balance.
 */
function extractRBCTransactions(text, openingBalance, periodStart) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const MONTH_NUM = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
                      jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };

  let year = new Date().getFullYear();
  if (periodStart) year = parseInt(periodStart.split('-')[0], 10);

  const DATE_LINE_RE = /^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*/i;
  const AMOUNT_RE    = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
  // e-Transfer reference IDs are long lowercase hex strings (≥20 chars)
  const HEX_REF_RE   = /^[0-9a-f]{20,}/i;

  // Lines that are structural noise, not transactions
  const SKIP_RE = /^(date[\s\W]|cheques|deposits|account\s+activity|account\s+number|account\s+fees|business\s+account\s+statement|\d+\s+of\s+\d+|closing\s+balance|opening\s+balance|www\.|please\s+contact|1-800|royal\s+bank)/i;

  // Keyword-based debit/credit for single-amount lines that have no balance to cross-check
  const guessType = desc => {
    const d = desc.toLowerCase();
    if (/autodeposit|e.?transfer.{0,20}(received|deposit|\bin\b)|direct\s+deposit/.test(d)) return 'credit';
    if (/online\s+transfer\s+sent|transfer\s+sent|e.?transfer\s+sent|monthly\s+fee|service\s+fee|nsf|annual\s+fee/.test(d)) return 'debit';
    return 'unknown';
  };

  // ── Pass 1: collect raw entries {date, description, amounts[]} ────────────
  const entries = [];
  let currentDate = null;
  let inActivity  = false;

  for (let line of lines) {
    if (/account activity details/i.test(line)) { inActivity = true; continue; }
    if (!inActivity) continue;
    if (SKIP_RE.test(line))  continue;

    // Strip duplicated date prefix that appears on page-break lines in multi-page PDFs:
    // "02 Dec02 Dec    Online transfer..." → "02 Dec    Online transfer..."
    line = line.replace(/^(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\1/i, '$1');

    const dateMatch = line.match(DATE_LINE_RE);
    if (dateMatch) {
      const [prefix, day, mon] = dateMatch;
      const monthNum = MONTH_NUM[mon.toLowerCase()];
      if (!monthNum) continue;
      currentDate = `${year}-${String(monthNum).padStart(2,'0')}-${day}`;

      const rest     = line.slice(prefix.length).trim();
      const amounts  = [...rest.matchAll(AMOUNT_RE)].map(m => parseFloat(m[1].replace(/,/g, '')));
      const firstAmt = rest.search(AMOUNT_RE);
      const desc     = (firstAmt > 0 ? rest.slice(0, firstAmt) : rest).trim();
      if (desc) entries.push({ date: currentDate, description: desc, amounts });

    } else if (currentDate) {
      if (HEX_REF_RE.test(line)) {
        // RBC e-Transfer reference IDs are 32-char hex hashes (MD5) followed
        // immediately by the transaction amount — e.g. "b87ae1d...63585,000.00".
        // The hash's trailing digits corrupt the amount regex (reads 585,000 not 5,000).
        // Fix: strip exactly 32 hex chars before parsing amounts.
        const stripped = line.length >= 32 ? line.slice(32) : line.replace(/^[0-9a-f]+/i, '');
        const amounts = [...stripped.matchAll(AMOUNT_RE)].map(m => parseFloat(m[1].replace(/,/g, '')));
        if (amounts.length && entries.length > 0) {
          entries[entries.length - 1].amounts.push(...amounts);
        }
      } else {
        // New transaction on the same date as the previous dated line
        const amounts  = [...line.matchAll(AMOUNT_RE)].map(m => parseFloat(m[1].replace(/,/g, '')));
        const firstAmt = line.search(AMOUNT_RE);
        const desc     = (firstAmt > 0 ? line.slice(0, firstAmt) : line).trim();
        if (desc) entries.push({ date: currentDate, description: desc, amounts });
      }
    }
  }

  // ── Pass 2: resolve debit/credit using running balance ───────────────────
  const transactions = [];
  let prevBalance = openingBalance ?? null;

  for (const { date, description, amounts } of entries) {
    if (!description || !amounts.length) continue;

    let txnAmount, type;

    if (amounts.length >= 2) {
      // Convention: last amount = new running balance, second-to-last = transaction amount
      const newBalance = amounts[amounts.length - 1];
      txnAmount = amounts[amounts.length - 2];

      if (prevBalance !== null) {
        const diff = newBalance - prevBalance;
        if      (Math.abs(diff - txnAmount) < 0.02) type = 'credit';
        else if (Math.abs(diff + txnAmount) < 0.02) type = 'debit';
        else type = guessType(description);
      } else {
        type = guessType(description);
      }
      prevBalance = newBalance;

    } else {
      // Only one amount — no balance checkpoint; use keyword heuristics
      txnAmount = amounts[0];
      type      = guessType(description);
      // Advance the running balance so subsequent balance-checks stay accurate
      if      (type === 'credit' && prevBalance !== null) prevBalance += txnAmount;
      else if (type === 'debit'  && prevBalance !== null) prevBalance -= txnAmount;
    }

    transactions.push({
      date,
      description,
      amount: type === 'debit' ? -txnAmount : txnAmount,
      type,
    });
  }

  return transactions;
}
