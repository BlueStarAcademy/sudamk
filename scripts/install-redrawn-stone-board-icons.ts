/**
 * Install AI-redrawn Stone1–7 and Board4–5: chroma-key magenta plate → transparent WebP.
 * Never keys near-black (preserves black go stones).
 *
 * Run: npx tsx scripts/install-redrawn-stone-board-icons.ts
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
    'Board4_redraw.png': 'Board4.webp',
    'Board5_redraw.png': 'Board5.webp',
    'Stone1_redraw.png': 'Stone1.webp',
    'Stone2_redraw.png': 'Stone2.webp',
    'Stone3_redraw.png': 'Stone3.webp',
    'Stone4_redraw.png': 'Stone4.webp',
    'Stone5_redraw.png': 'Stone5.webp',
    'Stone6_redraw.png': 'Stone6.webp',
    'Stone7_redraw.png': 'Stone7.webp',
};

/** Magenta / hot-pink plate only — never near-black */
function isMagentaPlate(r: number, g: number, b: number, a: number): boolean {
    if (a < 10) return true;
    // classic #FF00FF and soft variants from generators
    if (r > 180 && b > 180 && g < 140) return true;
    if (r > 200 && b > 160 && g < 100) return true;
    return false;
}

async function cleanAndWrite(srcPng: string, destWebp: string): Promise<void> {
    const { data, info } = await sharp(srcPng)
        .ensureAlpha()
        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 0, b: 255, alpha: 1 } })
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
        if (!isMagentaPlate(out[i]!, out[i + 1]!, out[i + 2]!, out[i + 3]!)) return;
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

    // Also clear remaining non-edge magenta islands (common under stones)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * ch;
            if (isMagentaPlate(out[i]!, out[i + 1]!, out[i + 2]!, out[i + 3]!)) {
                out[i + 3] = 0;
            }
        }
    }

    const tmp = `${destWebp}.__tmp.webp`;
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .webp({ nearLossless: true, quality: 92, effort: 5 })
        .toFile(tmp);

    const bak = `${destWebp}.bak`;
    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            try {
                await fs.rename(destWebp, bak);
            } catch {
                await fs.unlink(destWebp).catch(() => undefined);
            }
            await fs.rename(tmp, destWebp);
            await fs.unlink(bak).catch(() => undefined);
            console.log('OK', path.basename(destWebp));
            return;
        } catch (e) {
            console.warn('retry', path.basename(destWebp), attempt, (e as Error).message);
            await new Promise((r) => setTimeout(r, 200 + attempt * 120));
        }
    }
    throw new Error(`FAIL ${destWebp}`);
}

async function main(): Promise<void> {
    await fs.mkdir(destDir, { recursive: true });
    for (const [srcName, destName] of Object.entries(map)) {
        const src = path.join(assets, srcName);
        try {
            await fs.access(src);
        } catch {
            console.warn('SKIP missing', srcName);
            continue;
        }
        await cleanAndWrite(src, path.join(destDir, destName));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
