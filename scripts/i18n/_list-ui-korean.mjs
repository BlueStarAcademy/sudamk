import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const files = process.argv.slice(2);
const ko = /[\uAC00-\uD7A3]/;
const strKo = /['"`][^'"`]*[\uAC00-\uD7A3]/;

for (const f of files) {
  const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
  console.log(`=== ${f} ===`);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/**') || t.startsWith('/*')) return;
    if (ko.test(line) && strKo.test(line)) console.log(`${i + 1}: ${t.slice(0, 140)}`);
  });
}
