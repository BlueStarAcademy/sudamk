import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const targets = fs
  .readFileSync(path.join(root, 'scripts/i18n/_count-target-batch.mjs'), 'utf8')
  .match(/'components[^']+'/g)
  .map((s) => s.slice(1, -1));

function collect(p) {
  const full = path.join(root, p);
  if (fs.existsSync(full) && full.endsWith('.tsx')) return [p];
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { recursive: true })
    .filter((f) => String(f).endsWith('.tsx'))
    .map((f) => path.join(p, String(f)).replace(/\\/g, '/'));
}

const files = [...new Set(targets.flatMap(collect))].filter((f) => !f.includes('admin'));
const ko = /[\uAC00-\uD7A3]/;
const strKo = /['"`][^'"`]*[\uAC00-\uD7A3]/;

let withHook = 0;
let uiLines = 0;
let uiFiles = 0;

console.log('Files without useTranslation:');
for (const f of files) {
  const c = fs.readFileSync(path.join(root, f), 'utf8');
  if (c.includes('useTranslation') || c.includes('useLocalizedItemGrade')) withHook++;

  let ui = 0;
  c.split('\n').forEach((line) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/**')) return;
    if (ko.test(line) && strKo.test(line)) ui++;
  });
  if (ui > 0) {
    uiFiles++;
    uiLines += ui;
  }

  if (!c.includes('useTranslation') && !c.includes('useLocalizedItemGrade')) {
    console.log(`  ${f} (ui=${ui})`);
  }
}

console.log(`\nTarget files: ${files.length}`);
console.log(`With i18n hooks: ${withHook}`);
console.log(`Remaining UI Korean: ${uiLines} lines in ${uiFiles} files`);
