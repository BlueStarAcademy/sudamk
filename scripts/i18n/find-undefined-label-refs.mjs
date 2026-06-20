#!/usr/bin/env node
/**
 * Find likely undefined identifier references from i18n migration leftovers.
 * Heuristic: `fooBar[` or `{fooBar[` where fooBar is not declared in file.
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
            if (['node_modules', 'dist', 'generated', 'scripts', 'admin'].includes(e.name)) continue;
            walk(p, out);
        } else if (/\.tsx$/.test(e.name)) {
            out.push(p);
        }
    }
    return out;
}

const SUSPICIOUS_SUFFIXES = ['Label', 'Labels', 'Text', 'Title', 'Names', 'Map', 'Ko', '_LABEL'];
const files = walk(path.join(root, 'components'));

const issues = [];

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const declared = new Set([
        ...src.matchAll(/\b(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g),
    ].map((m) => m[1]));
    // imports
    for (const m of src.matchAll(/\bimport\s+(?:\{([^}]+)\}|([A-Za-z_$][\w$]*))/g)) {
        if (m[1]) {
            for (const part of m[1].split(',')) {
                const name = part.trim().split(/\s+as\s+/).pop()?.trim();
                if (name) declared.add(name);
            }
        }
        if (m[2]) declared.add(m[2]);
    }
    // props destructuring at component level - skip for simplicity

    const bracketRe = /\b([A-Za-z_$][\w$]*)\s*\[/g;
    let m;
    while ((m = bracketRe.exec(src)) !== null) {
        const id = m[1];
        if (declared.has(id)) continue;
        if (['t', 'tCommon', 'tGame', 'tNav', 'tt', 'tx', 'qs', 'shopT', 'i18n', 'session', 'props', 'state', 'Array', 'Object', 'Math', 'JSON', 'window', 'document', 'process', 'React', 'useMemo', 'useState', 'useEffect', 'useCallback', 'useRef', 'String', 'Number', 'Boolean', 'Date', 'Map', 'Set', 'Promise', 'Intl', 'CSS'].includes(id)) continue;
        if (id.endsWith('Ref') || id.startsWith('use')) continue;
        const hasSuspiciousSuffix = SUSPICIOUS_SUFFIXES.some((s) => id.endsWith(s));
        const line = src.slice(0, m.index).split('\n').length;
        const lineText = src.split('\n')[line - 1]?.trim() ?? '';
        if (!hasSuspiciousSuffix && !lineText.includes('Label')) continue;
        // skip type indexing like Record keys in types
        if (lineText.includes('Record<') || lineText.includes('Partial<')) continue;
        issues.push({ file: path.relative(root, file), line, id, lineText: lineText.slice(0, 120) });
    }
}

const seen = new Set();
for (const i of issues) {
    const k = `${i.file}:${i.line}:${i.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`${i.file}:${i.line}\t${i.id}\t${i.lineText}`);
}
console.error(`\nTotal: ${seen.size}`);
