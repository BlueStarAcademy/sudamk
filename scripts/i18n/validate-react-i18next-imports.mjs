#!/usr/bin/env node
/**
 * Fail when a TS/TSX file calls react-i18next hooks/components without importing them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const SCAN_ROOTS = ['components', 'hooks', 'contexts', 'App.tsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'generated']);
const SYMBOLS = ['useTranslation', 'Trans', 'I18nextProvider'];

function walk(entry, out = []) {
  if (!fs.existsSync(entry)) return out;
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    if (/\.(tsx|ts)$/.test(entry)) out.push(entry);
    return out;
  }
  for (const name of fs.readdirSync(entry)) {
    if (SKIP_DIRS.has(name)) continue;
    walk(path.join(entry, name), out);
  }
  return out;
}

function hasValidImport(source, symbol) {
  const reactImport = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*['"]react-i18next['"]`,
  );
  const appImport = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*['"][^'"]*useAppTranslation`,
  );
  return reactImport.test(source) || (symbol === 'useTranslation' && appImport.test(source));
}

function usesSymbol(source, symbol) {
  return new RegExp(`\\b${symbol}\\b`).test(source);
}

const files = SCAN_ROOTS.flatMap((entry) => walk(path.join(root, entry)));
const issues = [];

for (const file of files) {
  if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const symbol of SYMBOLS) {
    if (!usesSymbol(source, symbol)) continue;
    if (!hasValidImport(source, symbol)) {
      issues.push(`${path.relative(root, file).replace(/\\/g, '/')}: missing import for ${symbol}`);
    }
  }
}

if (issues.length > 0) {
  for (const issue of issues) console.error(issue);
  console.error(`\nvalidate-react-i18next-imports: ${issues.length} issue(s)`);
  process.exit(1);
}

console.log('validate-react-i18next-imports: ok');
