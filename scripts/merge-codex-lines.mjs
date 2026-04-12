import fs from 'node:fs';

const path = 'constants/adventureMonstersCodex.ts';
let s = fs.readFileSync(path, 'utf8');
s = s.replace(/codexLines: readonly string\[];/, 'codexDescription: string;');

function esc(ts) {
    return ts.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

s = s.replace(/codexLines: \['(.*?)', '(.*?)'\],/gs, (_, a, b) => {
    const merged = `${a} ${b}`;
    return `codexDescription: '${esc(merged)}'`;
});

fs.writeFileSync(path, s);
const n = (s.match(/codexDescription:/g) || []).length;
console.log('codexDescription count:', n);
