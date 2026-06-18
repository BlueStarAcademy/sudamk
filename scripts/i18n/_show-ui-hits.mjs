import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const files = process.argv.slice(2);
const strKo = /['"`][^'"`]*[\uAC00-\uD7A3]/;

for (const f of files) {
    const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
    const hits = [];
    lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/**') || t.startsWith('/*')) return;
        if (strKo.test(line)) hits.push(`${i + 1}: ${t.slice(0, 120)}`);
    });
    if (hits.length) {
        console.log(`--- ${f}`);
        hits.forEach((h) => console.log(h));
    }
}
