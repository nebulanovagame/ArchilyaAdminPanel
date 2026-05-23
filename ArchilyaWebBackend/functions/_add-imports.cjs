const fs = require('fs');
const sharedNames = JSON.parse(fs.readFileSync('C:/NNG/proje61/archilya-web/functions/src/_shared-exports.json', 'utf8'));
const domains = ['ai-jobs', 'credits', 'workspaces', 'legacy', 'projects', 'ai-legacy', 'notifications', 'payments', 'r2-admin', 'r2-user', 'contact'];

for (const domain of domains) {
  const file = `C:/NNG/proje61/archilya-web/functions/src/${domain}/index.js`;
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  const lines = content.split('\n');
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('// Archilya Functions')) { startIdx = i + 1; continue; }
    if (line.startsWith('// Auto-extracted')) { startIdx = i + 1; continue; }
    if (line.startsWith('const { onCall')) { startIdx = i + 1; continue; }
    if (line.startsWith('const { onTaskDispatched')) { startIdx = i + 1; continue; }
    if (line.startsWith('const admin =')) { startIdx = i + 1; continue; }
    if (line.startsWith('const db =')) { startIdx = i + 1; continue; }
    if (line === '') { startIdx = i + 1; continue; }
    break;
  }
  
  const usedNames = [];
  const body = lines.slice(startIdx).join('\n');
  for (const name of sharedNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(?<![a-zA-Z0-9_$_.])' + escaped + '(?![a-zA-Z0-9_$])', 'g');
    if (regex.test(body)) {
      usedNames.push(name);
    }
  }
  
  const importLines = [
    `const shared = require('../shared');`,
    `const { ${usedNames.join(', ')} } = shared;`,
    ``,
  ];
  
  const newContent = importLines.join('\n') + lines.slice(startIdx).join('\n');
  fs.writeFileSync(file, newContent);
  console.log(`${domain}: ${usedNames.length} imports`);
}
console.log('Done');
