/**
 * Normalize slot icon WebP silhouettes to a consistent fill ratio.
 * Crops opaque bbox, scales longest side to TARGET_FILL of 512, centers on transparent canvas.
 * Skips *bgi frames. Run: npx tsx scripts/normalize-slot-icon-bboxes.ts
 *
 * Writes to `.slot-norm-staging/` first, then copyFile over originals (Windows-friendly).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SIZE = 512;
/** Longest opaque side fills this fraction of the canvas. */
const TARGET_FILL = 0.8;
const ALPHA_MIN = 12;

const ROOTS = [
    'public/images/equipments',
    'public/images/materials',
    'public/images/use',
    'public/images/Box',
    'public/images/shop',
];

const SKIP = /bgi(\d*)\.webp$/i;
const SKIP_NAME = /^(Star\d|EnhanceMarker\d|moru)\.webp$/i;

async function listWebp(dir: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dir);
        return entries
            .filter((n) => n.toLowerCase().endsWith('.webp') && !SKIP.test(n) && !SKIP_NAME.test(n))
            .map((n) => path.join(dir, n));
    } catch {
        return [];
    }
}

function opaqueBBox(
    data: Buffer,
    w: number,
    h: number,
    ch: number,
): { left: number; top: number; width: number; height: number } | null {
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * ch + 3]!;
            if (a < ALPHA_MIN) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX < minX || maxY < minY) return null;
    return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function normalizeToStaging(file: string): Promise<string | null> {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) {
        console.warn('SKIP channels', file);
        return null;
    }
    const box = opaqueBBox(data, w, h, ch);
    if (!box || box.width < 4 || box.height < 4) {
        console.warn('SKIP empty', path.basename(file));
        return null;
    }

    const long = Math.max(box.width, box.height);
    const targetPx = Math.round(SIZE * TARGET_FILL);
    const scale = targetPx / long;
    const nw = Math.max(1, Math.round(box.width * scale));
    const nh = Math.max(1, Math.round(box.height * scale));
    const left = Math.round((SIZE - nw) / 2);
    const top = Math.round((SIZE - nh) / 2);

    const cropped = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
        .extract(box)
        .resize(nw, nh, { fit: 'fill', kernel: 'lanczos3' })
        .ensureAlpha()
        .png()
        .toBuffer();

    const outBuf = await sharp({
        create: {
            width: SIZE,
            height: SIZE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([{ input: cropped, left, top }])
        .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 5 })
        .toBuffer();

    const stagingDir = path.join(path.dirname(file), '.slot-norm-staging');
    await fs.mkdir(stagingDir, { recursive: true });
    const staged = path.join(stagingDir, path.basename(file));
    await fs.writeFile(staged, outBuf);
    console.log('STAGED', path.basename(file), `${box.width}x${box.height} -> ${nw}x${nh}`);
    return staged;
}

async function main() {
    const only = process.argv.slice(2);
    const files: string[] = [];
    for (const root of ROOTS) {
        files.push(...(await listWebp(path.resolve(root))));
    }
    const list = only.length
        ? files.filter((f) => only.some((a) => path.basename(f).includes(a)))
        : files;

    const staged: string[] = [];
    for (const f of list) {
        const s = await normalizeToStaging(f);
        if (s) staged.push(s);
    }

    let ok = 0;
    let fail = 0;
    for (const s of staged) {
        const dest = path.resolve(path.join(path.dirname(s), '..', path.basename(s)));
        try {
            // Prefer unlink+rename if copy is locked; fall back to buffered overwrite.
            const buf = await fs.readFile(s);
            try {
                await fs.unlink(dest);
            } catch {
                /* may not exist or locked */
            }
            await fs.writeFile(dest, buf);
            ok++;
            console.log('OK', path.relative(process.cwd(), dest));
        } catch (e) {
            fail++;
            console.warn('PROMOTE_FAIL', dest, (e as Error).message);
        }
    }

    for (const root of ROOTS) {
        await fs.rm(path.resolve(root, '.slot-norm-staging'), { recursive: true, force: true }).catch(() => undefined);
    }
    console.log(`Done ok=${ok} fail=${fail} of ${list.length}`);
    if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
