/**
 * Install adventure map treasure chests (magenta chroma → transparent WebP).
 * Run: npx tsx scripts/install-adventure-treasure-chests.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ASSETS = path.resolve(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor/projects/c-project-sudam/assets',
);
const OUT = path.resolve('public/images/adventure/treasure');

const MAGENTA_KEY: [number, number, number] = [255, 0, 255];
const MAGENTA_DIST = 110;

const jobs = [
    { src: 'treasure_neighborhood_hill.png', dest: 'neighborhood_hill.webp' },
    { src: 'treasure_lake_park.png', dest: 'lake_park.webp' },
    { src: 'treasure_aquarium.png', dest: 'aquarium.webp' },
    { src: 'treasure_zoo.png', dest: 'zoo.webp' },
    { src: 'treasure_amusement_park.png', dest: 'amusement_park.webp' },
] as const;

function isNearMagenta(r: number, g: number, b: number): boolean {
    return r > 180 && b > 180 && g < 140 && Math.hypot(r - 255, g - 0, b - 255) <= MAGENTA_DIST + 40;
}

async function chromaMagentaPng(buf: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) return buf;
    const out = Buffer.from(data);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (seen[idx]) return;
        const i = idx * ch;
        const d = Math.hypot(out[i]! - MAGENTA_KEY[0], out[i + 1]! - MAGENTA_KEY[1], out[i + 2]! - MAGENTA_KEY[2]);
        if (d > MAGENTA_DIST) return;
        if (!isNearMagenta(out[i]!, out[i + 1]!, out[i + 2]!)) return;
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
    // fringe cleanup
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
            if (isNearMagenta(out[i]!, out[i + 1]!, out[i + 2]!)) out[i + 3] = 0;
        }
    }
    return sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

async function main() {
    await fs.mkdir(OUT, { recursive: true });
    for (const j of jobs) {
        const src = path.join(ASSETS, j.src);
        const raw = await sharp(src).ensureAlpha().png().toBuffer();
        const keyed = await chromaMagentaPng(raw);
        const dest = path.join(OUT, j.dest);
        await sharp(keyed)
            .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 6 })
            .toFile(dest);
        console.log('OK', j.dest);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
