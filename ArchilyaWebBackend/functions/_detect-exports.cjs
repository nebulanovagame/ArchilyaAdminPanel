const fs = require('fs');
const lines = fs.readFileSync('C:/NNG/proje61/archilya-web/functions/index.js', 'utf8').split('\n');
const exportRegex = /^exports\.([a-zA-Z_$][a-zA-Z0-9_$]*) = (onCall|onTaskDispatched|onRequest|onSchedule)/;
const exportList = [];
let current = null;
let depth = 0;
let inside = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!inside) {
    const m = line.match(exportRegex);
    if (m) {
      current = { name: m[1], start: i + 1, end: null };
      inside = true;
      depth = 0;
    }
    continue;
  }
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '/' && j + 1 < line.length && line[j+1] === '/') break;
    if (ch === '/' && j + 1 < line.length && line[j+1] === '*') { j += 2; while (j < line.length - 1 && !(line[j] === '*' && line[j+1] === '/')) j++; j++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; j++; while (j < line.length && line[j] !== q) { if (line[j] === '\\') j++; j++; } continue; }
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    if (ch === '}' || ch === ')' || ch === ']') depth--;
  }
  if (depth === 0 && i > current.start - 1) {
    if (/[;}]\s*$/.test(line) || /^\s*\)\s*;?\s*$/.test(line)) {
      current.end = i + 1;
      exportList.push(current);
      inside = false;
      current = null;
    }
  }
}
if (current && !current.end) { current.end = lines.length; exportList.push(current); }

exportList.forEach(e => console.log(e.name + ':' + e.start + '-' + e.end));
console.log('\nTotal exports: ' + exportList.length);
console.log('Total lines: ' + lines.length);

// Save to JSON for later use
fs.writeFileSync('C:/NNG/proje61/archilya-web/functions/src/_export-ranges.json', JSON.stringify(exportList, null, 2));
