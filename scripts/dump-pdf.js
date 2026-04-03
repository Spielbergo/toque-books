const fs = require('fs');
const pdf = require('../node_modules/pdf-parse/lib/pdf-parse.js');

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/dump-pdf.js <path.pdf>'); process.exit(1); }

pdf(fs.readFileSync(file)).then(d => {
  const lines = d.text.split('\n');
  lines.forEach((l, i) => console.log(`${String(i).padStart(3, '0')}: ${JSON.stringify(l)}`));
}).catch(e => console.error(e));
