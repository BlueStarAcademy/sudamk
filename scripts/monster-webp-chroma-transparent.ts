/**
 * 모험 몬스터 webp 모서리 색을 기준으로 배경을 투명 처리(유사색 제거).
 * Run: npx tsx scripts/monster-webp-chroma-transparent.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/monster');
/** RGB 거리 이하이면 배경으로 간주 */
const COLOR_DIST = 38;

async function* walkWebp(dir: string): AsyncGenerator<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) yield* walkWebp(p);
        else if (e.name.toLowerCase().endsWith('.webp')) yield p;
    }
}

function avgCornerRgb(data: Buffer, w: number, h: number, channels: number): [number, number, number] {
    const get = (x: number, y: number) => {
        const i = (Math.min(y, h - 1) * w + Math.min(x, w - 1)) * channels;
        return [data[i]!, data[i + 1]!, data[i + 2]!] as [number, number, number];
    };
    const corners = [get(0, 0), get(w - 1, 0), get(0, h - 1), get(w - 1, h - 1)];
    const r = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
    const g = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
    const b = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);
    return [r, g, b];
}

async function processFile(filePath: string) {
    const input = await fs.readFile(filePath);
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) {
        console.warn('skip (not rgba)', filePath);
        return;
    }
    const bg = avgCornerRgb(data, w, h, ch);
    const out = Buffer.from(data);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * ch;
            const r = out[i]!;
            const g = out[i + 1]!;
            const b = out[i + 2]!;
            const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
            if (d <= COLOR_DIST) {
                out[i + 3] = 0;
            }
        }
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .webp({ quality: 88, effort: 4, alphaQuality: 100 })
        .toFile(filePath + '.tmp');
    await fs.rename(filePath + '.tmp', filePath);
    console.log('OK', path.relative('public', filePath));
}

async function main() {
    let n = 0;
    for await (const f of walkWebp(ROOT)) {
        await processFile(f);
        n += 1;
    }
    console.log('Done,', n, 'files.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
