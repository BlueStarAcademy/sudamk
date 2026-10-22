#!/usr/bin/env node
/**
 * Ratchet guard for ArenaKind policy migration.
 * Fails when ad-hoc arena branching grows beyond the recorded baseline
 * (per file, per pattern). Legacy counts are frozen in
 * scripts/arena-policy-baseline.json; migrating a file should only
 * ever lower its counts -- regenerate with --write-baseline after a
 * verified reduction, never to raise counts.
 *
 * Usage:
 *   node scripts/validate-arena-policy.mjs
 *   node scripts/validate-arena-policy.mjs --write-baseline
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'arena-policy-baseline.json');

const ROOTS = ['shared', 'server', 'utils', 'hooks', 'components', 'contexts'];
const ROOT_FILES = ['Game.tsx', 'App.tsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '__tests__', 'generated']);
const EXEMPT = new Set([
    'shared/utils/liveSessionArenaKind.ts', // the policy itself reads raw fields
]);

const PATTERNS = {
    gameCategoryComparison: /gameCategory\s*(?:===|!==)/g,
    legacyFlagBranch: /\b(?:game|session|existing|incoming|g|cur|prev)\.(?:isAiGame|isSinglePlayer)\b/g,
    directPairGameAccess: /settings\??\.pairGame\b/g,
    idPrefixKindCheck: /startsWith\(\s*['"](?:sp-game-|tower-game-|tower-)/g,
};

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

function collectCounts() {
    const counts = {};
    const files = [];
    for (const r of ROOTS) files.push(...walk(path.join(root, r)));
    for (const f of ROOT_FILES) files.push(...walk(path.join(root, f)));
    for (const file of files) {
        const rel = path.relative(root, file).replace(/\\/g, '/');
        if (EXEMPT.has(rel)) continue;
        if (rel.includes('/__tests__/')) continue;
        const source = fs.readFileSync(file, 'utf8');
        const entry = {};
        for (const [name, re] of Object.entries(PATTERNS)) {
            re.lastIndex = 0;
            const n = [...source.matchAll(re)].length;
            if (n > 0) entry[name] = n;
        }
        if (Object.keys(entry).length > 0) counts[rel] = entry;
    }
    return counts;
}

const current = collectCounts();

if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n');
    console.log(`validate-arena-policy: baseline written (${Object.keys(current).length} files)`);
    process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
    console.error('validate-arena-policy: baseline missing. Run with --write-baseline first.');
    process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

const issues = [];
for (const [file, patterns] of Object.entries(current)) {
    for (const [name, n] of Object.entries(patterns)) {
        const allowed = baseline[file]?.[name] ?? 0;
        if (n > allowed) issues.push(`${file}: ${name} grew ${allowed} -> ${n}`);
    }
}

if (issues.length === 0) {
    console.log('validate-arena-policy: ok (no ad-hoc arena branching growth)');
    process.exit(0);
}
for (const issue of issues) console.error(issue);
console.error(
    `\nvalidate-arena-policy: ${issues.length} issue(s). Route new branching through resolveArenaSessionPolicy instead.`,
);
process.exit(1);
