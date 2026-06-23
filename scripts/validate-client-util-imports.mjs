#!/usr/bin/env node
/**
 * Detect client-side calls to exported helpers with no import (static or dynamic).
 * Targets runtime ReferenceError patterns like `computeGameSessionFingerprint is not defined`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const EXPORT_ROOTS = ['utils', path.join('shared', 'utils'), 'services'];
const CLIENT_ROOTS = ['hooks', 'components', 'contexts', 'App.tsx', 'Game.tsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '__tests__', 'generated']);

const GLOBALS = new Set([
  'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Error',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'RegExp', 'Intl', 'Reflect',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'queueMicrotask', 'structuredClone', 'fetch', 'alert', 'confirm',
  'prompt', 'performance', 'AbortController', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams',
  'Blob', 'File', 'FormData', 'Headers', 'Request', 'Response', 'WebSocket', 'Event', 'CustomEvent',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'HTMLElement', 'Element', 'Node',
  'document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history',
  'screen', 'crypto', 'atob', 'btoa', 'Buffer', 'process',
  'React', 'useState', 'useEffect', 'useLayoutEffect', 'useCallback', 'useMemo', 'useRef',
  'useContext', 'useReducer', 'useId', 'useImperativeHandle', 'useDebugValue', 'useDeferredValue',
  'useTransition', 'useSyncExternalStore', 'useInsertionEffect', 'forwardRef', 'memo', 'lazy',
  'createContext', 'createElement', 'Fragment', 'Suspense', 'StrictMode', 'flushSync',
  'createPortal', 'startTransition', 'i18n', 'tx',
]);

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

function collectExports(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const exports = new Map();

  for (const m of source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
    exports.set(m[1], rel);
  }
  for (const m of source.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm)) {
    exports.set(m[1], rel);
  }
  for (const block of source.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of block[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith('type ')) continue;
      const [, exported] = trimmed.split(/\s+as\s+/);
      const name = (exported ?? trimmed).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) exports.set(name, rel);
    }
  }

  return exports;
}

function parseImports(source) {
  const imported = new Set();
  for (const m of source.matchAll(/import[\s\S]*?\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g)) {
    for (const part of m[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith('type ')) continue;
      const [, alias] = trimmed.split(/\s+as\s+/);
      const name = (alias ?? trimmed).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) imported.add(name);
    }
  }
  for (const m of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*,/g)) {
    imported.add(m[1]);
  }
  for (const m of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*from\s*['"][^'"]+['"]/g)) {
    imported.add(m[1]);
  }
  return imported;
}

function parseDynamicImports(source) {
  const dynamic = new Set();
  for (const m of source.matchAll(/import\s*\(\s*['"][^'"]+['"]\s*\)/g)) {
    // noop — marker only
  }
  for (const m of source.matchAll(/(?:await\s+)?import\s*\(\s*['"][^'"]+['"]\s*\)/g)) {
    // look ahead in same statement for destructuring
  }
  for (const m of source.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:await\s+)?import\s*\(/g)) {
    for (const part of m[1].split(',')) {
      const trimmed = part.trim();
      const [, alias] = trimmed.split(/\s+as\s+/);
      const name = (alias ?? trimmed).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) dynamic.add(name);
    }
  }
  return dynamic;
}

function localDeclarations(source) {
  const locals = new Set();
  for (const m of source.matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)) {
    locals.add(m[1]);
  }
  for (const m of source.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
    locals.add(m[1]);
  }
  return locals;
}

function findCallSites(source) {
  const calls = new Set();
  for (const m of source.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    calls.add(m[1]);
  }
  return calls;
}

const exportedSymbols = new Map();
for (const exportRoot of EXPORT_ROOTS) {
  for (const file of walk(path.join(root, exportRoot))) {
    if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
    for (const [name, mod] of collectExports(file)) {
      if (!exportedSymbols.has(name)) exportedSymbols.set(name, mod);
    }
  }
}

const issues = [];
for (const entry of CLIENT_ROOTS) {
  for (const file of walk(path.join(root, entry))) {
    const source = fs.readFileSync(file, 'utf8');
    const relFile = path.relative(root, file).replace(/\\/g, '/');
    const imported = parseImports(source);
    const dynamic = parseDynamicImports(source);
    const locals = localDeclarations(source);
    const calls = findCallSites(source);

    for (const name of calls) {
      if (GLOBALS.has(name) || locals.has(name) || imported.has(name) || dynamic.has(name)) continue;
      const from = exportedSymbols.get(name);
      if (!from || from === relFile) continue;
      issues.push({ file: relFile, symbol: name, expectedFrom: from.replace(/\.ts$/, '.js') });
    }
  }
}

if (issues.length === 0) {
  console.log('validate-client-util-imports: ok');
  process.exit(0);
}

for (const issue of issues) {
  console.error(`${issue.file}: missing import for ${issue.symbol} (exported from ${issue.expectedFrom})`);
}
console.error(`\nvalidate-client-util-imports: ${issues.length} issue(s)`);
process.exit(1);
