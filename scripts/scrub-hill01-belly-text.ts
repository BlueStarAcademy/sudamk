/**
 * Cover likely belly-text oval on neighborhood_hill_01 frames with sampled wood color.
 * Run: npx tsx scripts/scrub-hill01-belly-text.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve('public/images/monster/_frames/neighborhood_hill');

async function scrub(file: string) {
    const input = path.join(DIR, file);
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    const out = Buffer.from(data);
    // Sample wood tone from upper chest (above typical plaque)
    const sx = Math.floor(w * 0.5);
    const sy = Math.floor(h * 0.48);
    const si = (sy * w + sx) * ch;
    const wr = out[si]!;
    const wg = out[si + 1]!;
    const wb = out[si + 2]!;
    const cx = w * 0.5;
    const cy = h * 0.58;
    const rx = w * 0.16;
    const ry = h * 0.1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const nx = (x - cx) / rx;
            const ny = (y - cy) / ry;
            if (nx * nx + ny * ny > 1) continue;
            const i = (y * w + x) * ch;
            if (out[i + 3]! < 8) continue;
            // Soft blend toward wood sample
            const t = 1 - Math.min(1, Math.sqrt(nx * nx + ny * ny));
            const a = 0.55 + 0.45 * t;
            out[i] = Math.round(out[i]! * (1 - a) + wr * a);
            out[i + 1] = Math.round(out[i + 1]! * (1 - a) + wg * a);
            out[i + 2] = Math.round(out[i + 2]! * (1 - a) + wb * a);
        }
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(input);
    console.log('scrubbed', file);
}

async function main() {
    for (const f of ['neighborhood_hill_01_f2.png', 'neighborhood_hill_01_f3.png']) {
        await scrub(f);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
