/**
 * Strip near-black / near-magenta plate backgrounds from installed slot icons
 * so they sit cleanly on grade frames.
 * Run: npx tsx scripts/clean-slot-icon-plates.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const EQ = path.resolve('public/images/equipments');
const SKIP = /bgi\.webp$/i;

function isPlatePixel(r: number, g: number, b: number, a: number): boolean {
    if (a < 8) return true;
    // near black
    if (r < 28 && g < 28 && b < 28) return true;
    // near magenta chroma leftovers
    if (r > 180 && b > 180 && g < 140) return true;
    // dark gray plate
    if (r < 45 && g < 45 && b < 45 && Math.max(r, g, b) - Math.min(r, g, b) < 12) return true;
    return false;
}

async function cleanFile(file: string): Promise<void> {
    const buf = await fs.readFile(file);
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) return;
    const out = Buffer.from(data);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (seen[idx]) return;
        const i = idx * ch;
        if (!isPlatePixel(out[i]!, out[i + 1]!, out[i + 2]!, out[i + 3]!)) return;
        seen[idx] = 1;
        stack.push(idx);
    };
    for (let x = 0; x < w; x++) {
        push(x, 0);
        push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
        push(0, y);
        push(w - 1, y);
    }
    while (stack.length) {
        const idx = stack.pop()!;
        const i = idx * ch;
        out[i + 3] = 0;
        const x = idx % w;
        const y = (idx / w) | 0;
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
    }
    // fringe: near-black next to transparent
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const i = idx * ch;
            if (out[i + 3]! === 0) continue;
            const nearClear =
                out[((y - 1) * w + x) * ch + 3]! === 0 ||
                out[((y + 1) * w + x) * ch + 3]! === 0 ||
                out[(y * w + x - 1) * ch + 3]! === 0 ||
                out[(y * w + x + 1) * ch + 3]! === 0;
            if (!nearClear) continue;
            if (isPlatePixel(out[i]!, out[i + 1]!, out[i + 2]!, 255)) out[i + 3] = 0;
        }
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 5 })
        .toFile(file);
    console.log('cleaned', path.basename(file));
}

async function main() {
    const entries = await fs.readdir(EQ);
    for (const name of entries) {
        if (!name.endsWith('.webp') || SKIP.test(name)) continue;
        await cleanFile(path.join(EQ, name));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
