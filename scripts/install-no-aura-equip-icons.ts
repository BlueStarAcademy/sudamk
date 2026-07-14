/**
 * Install AI-regenerated no-aura equipment icons (PNG → cleaned WebP).
 * Run: npx tsx scripts/install-no-aura-equip-icons.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const assets = path.resolve(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor/projects/c-project-sudam/assets',
);
const destDir = path.resolve('public/images/equipments');

const map: Record<string, string> = {
    'Fan5_no_aura_v4.png': 'Fan5.webp',
    'Board5_no_aura.png': 'Board5.webp',
    'Top5_no_aura_v2.png': 'Top5.webp',
    'Bottom5_no_aura.png': 'Bottom5.webp',
    'StoneBox5_no_aura.png': 'StoneBox5.webp',
    'Stone5_no_aura.png': 'Stone5.webp',
    'Fan7_no_aura.png': 'Fan7.webp',
    'Board7_no_aura.png': 'Board7.webp',
    'Top7_no_aura.png': 'Top7.webp',
    'Bottom7_no_aura.png': 'Bottom7.webp',
    'StoneBox7_no_aura_v3.png': 'StoneBox7.webp',
    'Stone7_no_aura.png': 'Stone7.webp',
    'Stone2_fixed.png': 'Stone2.webp',
};

function isPlate(r: number, g: number, b: number, a: number): boolean {
    if (a < 8) return true;
    // Magenta only — never key near-black (destroys go-stones / dark gear)
    if (r > 190 && b > 190 && g < 120) return true;
    return false;
}

async function cleanAndWrite(srcPng: string, destWebp: string): Promise<void> {
    const { data, info } = await sharp(srcPng)
        .ensureAlpha()
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) throw new Error(`expected RGBA: ${srcPng}`);
    const out = Buffer.from(data);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (seen[idx]) return;
        const i = idx * ch;
        if (!isPlate(out[i]!, out[i + 1]!, out[i + 2]!, out[i + 3]!)) return;
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
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const i = idx * ch;
            if (out[i + 3]! === 0) continue;
            const near =
                out[((y - 1) * w + x) * ch + 3]! === 0 ||
                out[((y + 1) * w + x) * ch + 3]! === 0 ||
                out[(y * w + x - 1) * ch + 3]! === 0 ||
                out[(y * w + x + 1) * ch + 3]! === 0;
            if (!near) continue;
            const r = out[i]!;
            const g = out[i + 1]!;
            const b = out[i + 2]!;
            if (isPlate(r, g, b, 255)) out[i + 3] = 0;
            // soft isolated pink bloom only (not red gems / tassels)
            else if (r > 140 && b > 100 && g < 90 && r - g > 50 && b - g > 20) out[i + 3] = 0;
        }
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 5 })
        .toFile(destWebp);
    console.log('OK', path.basename(destWebp));
}

async function main() {
    for (const [src, dest] of Object.entries(map)) {
        const srcPath = path.join(assets, src);
        try {
            await fs.access(srcPath);
        } catch {
            console.warn('SKIP missing', src);
            continue;
        }
        await cleanAndWrite(srcPath, path.join(destDir, dest));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
