import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const files = fs.readFileSync(path.join(import.meta.dirname, '_count-target-batch.mjs'), 'utf8')
  .match(/'components[^']+\.tsx'/g)
  .map((s) => s.slice(1, -1));

const ko = /[\uAC00-\uD7A3]/;
const strKo = /['"`][^'"`]*[\uAC00-\uD7A3]/;

for (const f of files) {
  const full = path.join(root, f);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**') || trimmed.startsWith('/*')) return;
    if (ko.test(line) && strKo.test(line)) hits.push(`${i + 1}: ${line.trim()}`);
  });
  if (hits.length) {
    console.log(`--- ${f} (${hits.length})`);
    hits.forEach((h) => console.log(h));
  }
}
