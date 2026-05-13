/**
 * 소스 내 정적 이미지 경로의 .png → .webp 일괄 치환.
 * - `/images/...png`, 따옴표로 감싼 `images/...png` 만 대상(상대 장비 경로 등).
 * - 변환 파이프라인·로컬 PNG 읽기 스크립트는 제외.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'terminals']);

const SKIP_FILES = new Set([
    'scripts/normalize-adventure-monster-webp.ts',
    'scripts/convert-adventure-monster-pngs.ts',
    'scripts/adventure-monster-webp-to-png.ts',
    'scripts/bulk-image-png-to-webp-refs.mjs',
]);

const EXT = /\.(ts|tsx|css|html|json|txt|js)$/i;

function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(ent.name)) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

function transform(content) {
    let c = content;
    // `/images/...png`
    c = c.replace(/\/images\/[A-Za-z0-9_./-]+\.png\b/g, (m) => m.replace(/\.png\b/, '.webp'));
    // 따옴표로 감싼 `images/...png` (앞에 / 없음 — 상수 풀 등)
    c = c.replace(/(['"])images\/([^'"\\]+)\.png\1/g, '$1images/$2.webp$1');
    return c;
}

function main() {
    const files = walk(ROOT).filter((f) => {
        const rel = path.relative(ROOT, f).replace(/\\/g, '/');
        if (!EXT.test(f)) return false;
        if (SKIP_FILES.has(rel)) return false;
        return true;
    });

    let changed = 0;
    for (const full of files) {
        const raw = fs.readFileSync(full, 'utf8');
        const next = transform(raw);
        if (next !== raw) {
            fs.writeFileSync(full, next, 'utf8');
            changed++;
            console.log('updated', path.relative(ROOT, full));
        }
    }
    console.log('done, files changed:', changed);
}

main();
