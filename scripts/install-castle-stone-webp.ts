/**
 * Convert generated castle-stone PNG (magenta plate) → transparent circular WebP.
 * Run: npx tsx scripts/install-castle-stone-webp.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const srcPng = path.resolve(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor/projects/c-project-SUDAMR/assets/castle-stone-token.png',
);
const destWebp = path.resolve('public/images/castle-stone.webp');

function isMagentaPlate(r: number, g: number, b: number, a: number): boolean {
    if (a < 10) return true;
    if (r > 180 && b > 180 && g < 140) return true;
    if (r > 200 && b > 160 && g < 100) return true;
    const mag = Math.min(r, b);
    return mag - g > 90 && g < 150;
}

async function main(): Promise<void> {
    const { data, info } = await sharp(srcPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) throw new Error(`expected RGBA: ${srcPng}`);

    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i += 4) {
        const r = out[i]!;
        const g = out[i + 1]!;
        const b = out[i + 2]!;
        const a = out[i + 3]!;
        if (isMagentaPlate(r, g, b, a)) {
            out[i + 3] = 0;
            continue;
        }
        const mag = Math.min(r, b);
        const diff = mag - g;
        if (diff > 28 && g < 170) {
            const fade = Math.min(1, (diff - 28) / 85);
            out[i + 3] = Math.round(a * (1 - fade));
        }
    }

    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const a = out[(y * w + x) * 4 + 3]!;
            if (a < 24) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX <= minX || maxY <= minY) throw new Error('no opaque pixels after chroma key');

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const radius = Math.max(maxX - minX, maxY - minY) / 2 + 2;
    const pad = 4;
    const cropSize = Math.ceil(radius * 2 + pad * 2);
    const left = Math.max(0, Math.floor(cx - cropSize / 2));
    const top = Math.max(0, Math.floor(cy - cropSize / 2));
    const cropW = Math.min(cropSize, w - left);
    const cropH = Math.min(cropSize, h - top);

    const cropped = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
        const srcY = top + y;
        for (let x = 0; x < cropW; x++) {
            const srcX = left + x;
            const si = (srcY * w + srcX) * 4;
            const di = (y * cropW + x) * 4;
            const dx = srcX - cx;
            const dy = srcY - cy;
            const dist = Math.hypot(dx, dy);
            const edge = radius - 1.2;
            const feather = 1.8;
            let a = out[si + 3]!;
            if (dist > edge + feather) a = 0;
            else if (dist > edge) a = Math.round(a * (1 - (dist - edge) / feather));
            cropped[di] = out[si]!;
            cropped[di + 1] = out[si + 1]!;
            cropped[di + 2] = out[si + 2]!;
            cropped[di + 3] = a;
        }
    }

    await fs.mkdir(path.dirname(destWebp), { recursive: true });
    await sharp(cropped, { raw: { width: cropW, height: cropH, channels: 4 } })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90, effort: 6, alphaQuality: 100 })
        .toFile(destWebp);

    console.log('OK', destWebp, `${cropW}x${cropH} -> 512x512`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
