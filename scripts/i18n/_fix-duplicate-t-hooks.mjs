import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === 'admin') continue;
            walk(p, out);
        } else if (e.name.endsWith('.tsx')) out.push(p);
    }
    return out;
}

const tHookRe = /^\s*const \{ t \} = useTranslation\(/;
const tCommonRe = /^\s*const \{ t: tCommon \} = useTranslation\(/;

let fixed = 0;
for (const file of walk(path.join(root, 'components'))) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let changed = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (tHookRe.test(line)) {
            const prev = out[out.length - 1]?.trim() ?? '';
            const prev2 = out[out.length - 2]?.trim() ?? '';
            if (prev2.match(tHookRe) || (prev.match(tCommonRe) && prev2.match(tHookRe))) {
                changed = true;
                continue;
            }
            // duplicate goProverbs line after duplicate t
            if (lines[i + 1]?.includes('goProverbs') && out[out.length - 1]?.includes('goProverbs')) {
                i++;
                changed = true;
                continue;
            }
        }
        out.push(line);
    }
    if (changed) {
        fs.writeFileSync(file, out.join('\n'), 'utf8');
        fixed++;
        console.log('fixed', path.relative(root, file));
    }
}
console.log(`done: ${fixed} files`);
