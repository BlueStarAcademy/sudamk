/**
 * Remove near-black backgrounds from monster webp sheets (corner-sampled chroma).
 * Run: npx tsx scripts/chroma-adventure-monster-sheets.ts [stageId]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/monster');
const COLOR_DIST = 42;

async function processFile(filePath: string) {
    const input = await fs.readFile(filePath);
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) return;
    const sample = (x: number, y: number) => {
        const i = (Math.min(y, h - 1) * w + Math.min(x, w - 1)) * ch;
        return [data[i]!, data[i + 1]!, data[i + 2]!] as [number, number, number];
    };
    const corners = [sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1)];
    const bg: [number, number, number] = [
        Math.round(corners.reduce((s, c) => s + c[0], 0) / 4),
        Math.round(corners.reduce((s, c) => s + c[1], 0) / 4),
        Math.round(corners.reduce((s, c) => s + c[2], 0) / 4),
    ];
    if (bg[0] + bg[1] + bg[2] > 90) {
        console.log('skip (not dark bg)', path.relative(ROOT, filePath), bg);
        return;
    }
    const out = Buffer.from(data);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * ch;
            const d = Math.hypot(out[i]! - bg[0], out[i + 1]! - bg[1], out[i + 2]! - bg[2]);
            if (d <= COLOR_DIST) out[i + 3] = 0;
        }
    }
    const tmp = filePath + '.tmp';
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 6, smartSubsample: false })
        .toFile(tmp);
    await fs.rename(tmp, filePath);
    console.log('OK', path.relative(ROOT, filePath));
}

async function main() {
    const only = process.argv[2];
    const stages = only
        ? [only]
        : ['neighborhood_hill', 'lake_park', 'aquarium', 'zoo', 'amusement_park'];
    for (const stage of stages) {
        const dir = path.join(ROOT, stage);
        let names: string[];
        try {
            names = await fs.readdir(dir);
        } catch {
            continue;
        }
        for (const n of names) {
            if (!n.toLowerCase().endsWith('.webp')) continue;
            await processFile(path.join(dir, n));
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
