/**
 * Batch i18n migration for target components (blacksmith, modals, championship, gameRecord, shell, quick-panel, root modals).
 * Run: node scripts/i18n/_migrate-target-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function writeJson(rel, obj) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function readFile(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function writeFile(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
}

function ensureImport(content, importLine) {
  const line = importLine.trim();
  if (content.includes(line)) return content;
  const idx = content.indexOf('\n');
  return content.slice(0, idx + 1) + importLine + content.slice(idx + 1);
}

function ensureHook(content, marker, hookLine) {
  const hook = hookLine.trim();
  if (content.includes(hook)) return content;
  const idx = content.indexOf(marker);
  if (idx < 0) return content;
  const fnArrow = content.indexOf('=> {', idx);
  if (fnArrow < 0) return content;
  const nl = content.indexOf('\n', fnArrow);
  return content.slice(0, nl + 1) + hookLine + content.slice(nl + 1);
}

function stripGradeStyleNames(content) {
  let s = content.replace(
    /const gradeStyles: Record<ItemGrade, \{ name: string; (color: string; background: string[^}]*)\}> = \{/g,
    'const gradeStyles: Record<ItemGrade, { $1}> = {',
  );
  s = s.replace(/, name: '[^']*'/g, '');
  s = s.replace(/name: '[^']*', /g, '');
  return s;
}

function applyGradeStylesPatch(content, { hookMarker, relImport = '../../shared/i18n/localizedCatalog.js' }) {
  if (!content.includes("name: '일반'") && !content.includes('name: \'일반\'')) return content;
  content = stripGradeStyleNames(content);
  content = ensureImport(content, `import { useLocalizedItemGrade } from '${relImport}';\n`);
  if (hookMarker && !content.includes('useLocalizedItemGrade()')) {
    content = ensureHook(content, hookMarker, '    const localizedGrade = useLocalizedItemGrade();\n');
  }
  content = content.replace(/gradeStyles\[([^\]]+)\]\.name/g, 'localizedGrade($1)');
  content = content.replace(/styles\.name/g, 'localizedGrade(item.grade)');
  return content;
}

function applyPatch(file, config) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    console.warn('Skip missing:', file);
    return { modified: false, skipped: 0 };
  }
  if (config.skip) {
    console.log(`Skipped (no-op): ${file}`);
    return { modified: false, skipped: 0 };
  }

  let content = readFile(file);
  const original = content;
  let skipped = 0;

  for (const imp of config.ensureImport || []) {
    content = ensureImport(content, imp);
  }
  for (const { marker, line } of config.hooks || []) {
    content = ensureHook(content, marker, line);
  }
  if (config.gradeStyles) {
    content = applyGradeStylesPatch(content, config.gradeStyles);
  }

  for (const [from, to] of config.replacements || []) {
    if (!content.includes(from)) {
      console.warn(`SKIP ${file}: ${from.slice(0, 70).replace(/\n/g, ' ')}...`);
      skipped++;
      continue;
    }
    content = content.replace(from, to);
  }

  if (content !== original) {
    writeFile(file, content);
    return { modified: true, skipped };
  }
  return { modified: false, skipped };
}

// --- catalog extensions loaded from ./_migrate-target-batch-catalog.mjs ---
import { extendCatalogs } from './_migrate-target-batch-catalog.mjs';
import { patches } from './_migrate-target-batch-patches.mjs';
import { supplementPatches } from './_migrate-target-batch-patches-supplement.mjs';

const ko = readJson('shared/i18n/catalog/ko.json');
const en = readJson('shared/i18n/catalog/en.json');
extendCatalogs(ko, en);
writeJson('shared/i18n/catalog/ko.json', ko);
writeJson('shared/i18n/catalog/en.json', en);

let filesModified = 0;
let totalSkipped = 0;
for (const patch of [...patches, ...supplementPatches]) {
  const { modified, skipped } = applyPatch(patch.file, patch);
  totalSkipped += skipped;
  if (modified) {
    filesModified++;
    console.log('Patched:', patch.file, skipped ? `(skipped ${skipped})` : '');
  }
}

console.log(`\nCatalog updated. ${filesModified} files patched. ${totalSkipped} replacements skipped.`);

await import('./_migrate-target-batch-direct-remaining.mjs');
await import('./_migrate-target-batch-direct-pass2.mjs');
await import('./_migrate-target-batch-pass3.mjs').then((m) => m.runPass3Migrations());
await import('./_migrate-target-batch-pass4.mjs').then((m) => m.runPass4Migrations());
await import('./_migrate-target-batch-pass5.mjs').then((m) => m.runPass5Migrations());
await import('./_migrate-target-batch-pass6.mjs').then((m) => m.runPass6Migrations());
await import('./_migrate-target-batch-pass6b.mjs').then((m) => m.runPass6bMigrations());
await import('./_migrate-target-batch-pass6c.mjs').then((m) => m.runPass6cMigrations());
