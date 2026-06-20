#!/usr/bin/env node
/**
 * Find React components/functions that call t() but never declare t via useTranslation
 * or a module-level i18n helper (i18n.t, shopT, tt, etc.).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (['node_modules', 'dist', 'generated'].includes(e.name)) continue;
            walk(p, out);
        } else if (/\.tsx$/.test(e.name)) {
            out.push(p);
        }
    }
    return out;
}

const MODULE_HELPERS = new Set([
    'i18n',
    'shopT',
    'tt',
    'qs',
    'pt',
    'invT',
    'gs',
    'tourT',
    'towerTx',
]);

function splitTopLevelFunctions(src) {
    const blocks = [];
    const fnRe = /(?:^|\n)((?:export\s+)?(?:const|function)\s+([A-Z][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(?:\([^)]*\)|[^=]+)\s*=>|(?:export\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\()/g;
    const starts = [];
    let m;
    while ((m = fnRe.exec(src)) !== null) {
        const name = m[2] || m[3];
        starts.push({ index: m.index + (m[0].startsWith('\n') ? 1 : 0), name });
    }
    for (let i = 0; i < starts.length; i++) {
        const start = starts[i].index;
        const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
        blocks.push({ name: starts[i].name, body: src.slice(start, end), start });
    }
    return blocks;
}

function hasTDeclaration(body) {
    if (/const\s*\{\s*t\b/.test(body)) return true;
    if (/const\s*\{\s*t\s*:/.test(body)) return true;
    if (/\bt\s*=\s*useTranslation/.test(body)) return true;
    for (const h of MODULE_HELPERS) {
        if (new RegExp(`\\b${h}\\s*\\(`).test(body)) return true;
    }
    return false;
}

function findBareTCalls(body) {
    const hits = [];
    const re = /\bt\s*\(/g;
    let m;
    while ((m = re.exec(body)) !== null) {
        const line = body.slice(0, m.index).split('\n').length;
        const lineText = body.split('\n')[line - 1]?.trim() ?? '';
        if (lineText.includes('buildShortLabels(t') || lineText.includes('(t:') || lineText.includes('t: (key')) continue;
        hits.push({ line, lineText: lineText.slice(0, 100) });
    }
    return hits;
}

const files = walk(path.join(root, 'components'));
const issues = [];

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/\bt\s*\(/.test(src)) continue;

    const moduleHasHelper = [...MODULE_HELPERS].some((h) => new RegExp(`const\\s+${h}\\s*=`).test(src));
    const blocks = splitTopLevelFunctions(src);

    if (blocks.length === 0) {
        if (!/useTranslation/.test(src) && !moduleHasHelper) {
            issues.push({ file: path.relative(root, file), fn: '(module)', line: 0, lineText: 'uses t() without useTranslation' });
        }
        continue;
    }

    for (const block of blocks) {
        if (!/\bt\s*\(/.test(block.body)) continue;
        if (hasTDeclaration(block.body)) continue;
        // inherit from parent closure if outer component has t - check if nested arrow only
        const hits = findBareTCalls(block.body);
        for (const h of hits) {
            const absLine = src.slice(0, block.start).split('\n').length + h.line - 1;
            issues.push({
                file: path.relative(root, file),
                fn: block.name,
                line: absLine,
                lineText: h.lineText,
            });
        }
    }
}

for (const i of issues) {
    console.log(`${i.file}:${i.line}\t${i.fn}\t${i.lineText}`);
}
console.error(`\nTotal: ${issues.length}`);
