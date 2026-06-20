#!/usr/bin/env node
/** Validate t('ns:key.path') colon references exist in ko.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const ko = JSON.parse(fs.readFileSync(path.join(root, 'shared/i18n/catalog/ko.json'), 'utf8'));

function hasPath(obj, parts) {
    let cur = obj;
    for (const p of parts) {
        if (cur == null || typeof cur !== 'object' || !(p in cur)) return false;
        cur = cur[p];
    }
    return typeof cur === 'string' || (typeof cur === 'object' && cur !== null);
}

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (['node_modules', 'dist', 'generated', 'scripts'].includes(e.name)) continue;
            walk(p, out);
        } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
            out.push(p);
        }
    }
    return out;
}

const files = [];
for (const r of ['components', 'hooks', 'Game.tsx', 'App.tsx']) {
    const p = path.join(root, r);
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else files.push(p);
}

const issues = [];
const re = /\bt(?:Common)?\(\s*['"]([a-zA-Z][a-zA-Z0-9_-]*):([^'"]+)['"]/g;

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) {
        const ns = m[1];
        const keyPath = m[2];
        if (!ko[ns]) {
            issues.push({ file: path.relative(root, file), line: src.slice(0, m.index).split('\n').length, key: `${ns}:${keyPath}`, reason: 'unknown namespace' });
            continue;
        }
        if (!hasPath(ko[ns], keyPath.split('.'))) {
            issues.push({ file: path.relative(root, file), line: src.slice(0, m.index).split('\n').length, key: `${ns}:${keyPath}`, reason: 'missing path' });
        }
    }
}

for (const i of issues) {
    console.log(`${i.file}:${i.line}\t${i.key}\t(${i.reason})`);
}
console.error(`\nTotal: ${issues.length}`);
