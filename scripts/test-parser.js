// Quick validation script for the WaveApps parser logic
const pdf = require('../node_modules/pdf-parse/lib/pdf-parse.js');
const fs = require('fs');
const path = require('path');

const pdfPath = process.argv[2] || path.join(process.env.USERPROFILE, 'Downloads/Invoice_96_2024-10-07.pdf');

pdf(fs.readFileSync(pdfPath)).then(d => {
  const text = d.text;
  const rawLines = text.split('\n').map(l => l.trim());
  const lines = rawLines.filter(Boolean);

  // Invoice number
  const invNum = text.match(/Invoice\s*Number\s*:(\S+)/i);
  console.log('invoice#:', invNum ? invNum[1] : 'NOT FOUND');

  // Dates
  const issueDateStr = (text.match(/Invoice\s*Date\s*:([^\n\r]+)/i) || [])[1];
  const dueDateStr   = (text.match(/Payment\s*Due\s*:([^\n\r]+)/i) || [])[1];
  console.log('issueDate raw:', issueDateStr ? issueDateStr.trim() : 'NOT FOUND');
  console.log('dueDate raw:  ', dueDateStr ? dueDateStr.trim() : 'NOT FOUND');

  // Client
  const billToIdx = lines.indexOf('BILL TO');
  console.log('client:', billToIdx >= 0 ? lines[billToIdx + 1] : 'NOT FOUND');

  // Table section
  const headerIdx = lines.findIndex(l => /^Items?Quantity/i.test(l));
  const footerIdx = lines.findIndex((l, i) => i > headerIdx && /^(Subtotal|Sub-total|Total\b)/i.test(l));
  console.log('headerIdx:', headerIdx, '→', lines[headerIdx] || 'n/a');
  console.log('footerIdx:', footerIdx, '→', lines[footerIdx] || 'n/a');

  const sectionLines = lines.slice(headerIdx + 1, footerIdx >= 0 ? footerIdx : undefined);
  console.log('sectionLines count:', sectionLines.length);

  // Concatenated item regex
  const concatRe = /^(.+?)(\d+(?:\.\d+)?)\$(\d[\d,]*\.\d{2})\$(\d[\d,]*\.\d{2})$/;
  const items = [];
  for (const line of sectionLines) {
    const m = line.match(concatRe);
    if (m) {
      const item = { description: m[1].trim(), quantity: parseFloat(m[2]), rate: parseFloat(m[3].replace(/,/g, '')), amount: parseFloat(m[4].replace(/,/g, '')) };
      items.push(item);
      console.log('  ITEM:', JSON.stringify(item));
    } else {
      console.log('  NO MATCH:', JSON.stringify(line));
    }
  }
  console.log('\nTotal items found:', items.length);

  // Amounts
  const total = (text.match(/\bTotal:\s*\$?([\d,]+\.\d{2})/i) || [])[1];
  const subtotal = (text.match(/Subtotal:\s*\$?([\d,]+\.\d{2})/i) || [])[1];
  const hst = (text.match(/HST[^:]*:\s*\$?([\d,]+\.\d{2})/i) || [])[1];
  console.log('\nsubtotal:', subtotal, '  hst:', hst, '  total:', total);
});
