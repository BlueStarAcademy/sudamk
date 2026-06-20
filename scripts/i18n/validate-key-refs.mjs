#!/usr/bin/env node
/**
 * Validate t('prefix.key') calls against ko.json namespace structure.
 * Flags cross-namespace dot notation that should use colon (prefix:key).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const ko = JSON.parse(fs.readFileSync(path.join(root, 'shared/i18n/catalog/ko.json'), 'utf8'));

const TOP_NS = Object.keys(ko);

function hasPath(obj, parts) {
    let cur = obj;
    for (const p of parts) {
        if (cur == null || typeof cur !== 'object' || !(p in cur)) return false;
        cur = cur[p];
    }
    return true;
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

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /\bt(?:Common)?\(\s*['"]([a-zA-Z][a-zA-Z0-9_-]*)\.([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const prefix = m[1];
        const rest = m[2];
        if (!TOP_NS.includes(prefix)) continue;

        const line = src.slice(0, m.index).split('\n').length;

        // Find nearest useTranslation before this call (same file, simplistic)
        const before = src.slice(0, m.index);
        const nsMatches = [...before.matchAll(/useTranslation\(\s*(?:\[([^\]]+)\]|'([^']+)'|"([^"]+)")/g)];
        if (nsMatches.length === 0) continue;
        const last = nsMatches[nsMatches.length - 1];
        let namespaces = [];
        if (last[1]) {
            namespaces = [...last[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
        } else {
            namespaces = [last[2] || last[3]];
        }
        const defaultNs = namespaces[0];
        const parts = rest.split('.');

        // Valid: nested under default ns (e.g. pair.lobby.*, lobby.adventure.*)
        if (hasPath(ko[defaultNs], [prefix, ...parts])) continue;

        // Valid: key exists in default ns with full dotted path
        if (hasPath(ko[defaultNs], [prefix, ...parts.slice(0, 1)]) && parts.length === 1) {
            // single segment after prefix - check full path
        }
        if (hasPath(ko[defaultNs], `${prefix}.${rest}`.split('.'))) continue;

        // Valid: exists in any listed namespace as nested prefix path
        let foundInListed = false;
        for (const ns of namespaces) {
            if (hasPath(ko[ns], [prefix, ...parts])) {
                foundInListed = true;
                break;
            }
            if (hasPath(ko[ns], `${prefix}.${rest}`.split('.'))) {
                foundInListed = true;
                break;
            }
        }
        if (foundInListed) continue;

        // Valid: exists at top level of prefix namespace
        if (hasPath(ko[prefix], parts)) {
            issues.push({
                file: path.relative(root, file),
                line,
                key: `${prefix}.${rest}`,
                defaultNs,
                fix: `t('${prefix}:${rest}')`,
            });
            continue;
        }

        // Also check single-segment rest at top of prefix ns
        if (parts.length > 1 && hasPath(ko[prefix], [parts[0]])) {
            // might be partial - still suggest colon for first segment
        }
    }
}

const seen = new Set();
for (const i of issues) {
    const k = `${i.file}:${i.line}:${i.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`${i.file}:${i.line}\t[${i.defaultNs}]\t${i.key}\t→ ${i.fix}`);
}
console.error(`\nTotal: ${seen.size}`);
