const fs = require('fs');

const lines = fs.readFileSync('C:/NNG/proje61/archilya-web/functions/index.js', 'utf8').split('\n');
const exports = [];
const exportRegex = /^exports\.([a-zA-Z_$][a-zA-Z0-9_$]*) = (onCall|onTaskDispatched|onRequest|onSchedule|functions\.|https\.)/;

let currentExport = null;
let braceDepth = 0;
let inExport = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (!inExport) {
    const match = line.match(exportRegex);
    if (match) {
      currentExport = { name: match[1], startLine: i + 1, endLine: null };
      inExport = true;
      braceDepth = 0;
    }
    continue;
  }
  
  // Count braces in this line
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '/' && j + 1 < line.length && line[j + 1] === '/') {
      break; // rest of line is comment
    }
    if (ch === '/' && j + 1 < line.length && line[j + 1] === '*') {
      // skip to end of block comment
      j += 2;
      while (j < line.length - 1 && !(line[j] === '*' && line[j + 1] === '/')) {
        j++;
      }
      j++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      // skip string
      const quote = ch;
      j++;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') braceDepth++;
    if (ch === '}' || ch === ')' || ch === ']') braceDepth--;
  }
  
  // Check if export ended (braceDepth went to 0 and line ends with ; or similar)
  if (braceDepth === 0 && inExport && i > currentExport.startLine - 1) {
    // Make sure we're past the first line and the line has a semicolon or closing brace
    if (/[;}]\s*$/.test(line) || /^\s*\)\s*;?\s*$/.test(line)) {
      currentExport.endLine = i + 1;
      exports.push(currentExport);
      inExport = false;
      currentExport = null;
    }
  }
}

// If last export didn't close properly, close it at end of file
if (currentExport && !currentExport.endLine) {
  currentExport.endLine = lines.length;
  exports.push(currentExport);
}

exports.forEach(e => {
  console.log(`${e.name}:${e.startLine}-${e.endLine}`);
});

// Count lines between exports
let helperLines = 0;
for (let i = 0; i < exports.length; i++) {
  const prevEnd = i === 0 ? 0 : exports[i - 1].endLine;
  const gap = exports[i].startLine - prevEnd - 1;
  if (gap > 0) helperLines += gap;
}
console.log(`\nTotal exports: ${exports.length}`);
console.log(`Total helper lines (between exports): ${helperLines}`);
console.log(`Last line: ${lines.length}`);
