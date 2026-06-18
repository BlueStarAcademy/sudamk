import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const ko = /[\uAC00-\uD7A3]/;
const strKo = /['"`][^'"`]*[\uAC00-\uD7A3]/;

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === 'admin') continue;
            walk(p, out);
        } else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
    }
    return out;
}

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['components', 'hooks', 'Game.tsx'];
const files = [];
for (const d of dirs) {
    const full = path.join(root, d);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
}

let totalUi = 0;
const rows = [];
for (const f of files) {
    if (f.includes(`${path.sep}admin${path.sep}`)) continue;
    const rel = path.relative(root, f).replace(/\\/g, '/');
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let ui = 0;
    lines.forEach((line) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/**') || t.startsWith('/*')) return;
        if (ko.test(line) && strKo.test(line)) ui++;
    });
    if (ui > 0) {
        rows.push([ui, rel]);
        totalUi += ui;
    }
}
rows.sort((a, b) => b[0] - a[0]);
console.log(`Total UI Korean lines: ${totalUi} in ${rows.length} files\n`);
rows.slice(0, 50).forEach(([u, f]) => console.log(`${u}\t${f}`));
