/**
 * Normalize specific equipment icons with retry (Windows file locks).
 * Run: npx tsx scripts/normalize-locked-equip-icons.ts Top5 Top6 Top7
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SIZE = 512;
const TARGET_FILL = 0.92;
const ALPHA_MIN = 12;
const dir = path.resolve('public/images/equipments');

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
            if (data[(y * w + x) * ch + 3]! < ALPHA_MIN) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX < minX) return null;
    return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms));
}

async function normalizeOne(name: string) {
    const file = path.join(dir, `${name}.webp`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const box = opaqueBBox(data, info.width, info.height, info.channels);
    if (!box) {
        console.warn('empty', name);
        return;
    }
    const long = Math.max(box.width, box.height);
    const scale = Math.round(SIZE * TARGET_FILL) / long;
    const nw = Math.max(1, Math.round(box.width * scale));
    const nh = Math.max(1, Math.round(box.height * scale));
    const left = Math.round((SIZE - nw) / 2);
    const top = Math.round((SIZE - nh) / 2);
    const cropped = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .extract(box)
        .resize(nw, nh, { fit: 'fill', kernel: 'lanczos3' })
        .ensureAlpha()
        .png()
        .toBuffer();
    const outBuf = await sharp({
        create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        .composite([{ input: cropped, left, top }])
        .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 5 })
        .toBuffer();

    const alt = path.join(dir, `${name}_n92.webp`);
    await fs.writeFile(alt, outBuf);
    for (let i = 0; i < 12; i++) {
        try {
            await fs.copyFile(alt, file);
            await fs.unlink(alt).catch(() => undefined);
            console.log('OK', name, `${box.width}x${box.height} -> ${nw}x${nh}`);
            return;
        } catch (e) {
            console.warn('retry', name, i, (e as Error).message);
            await sleep(400 + i * 200);
        }
    }
    console.error('FAIL kept', alt);
}

async function main() {
    const names = process.argv.slice(2);
    if (!names.length) throw new Error('pass icon names e.g. Top5 Top6 Top7');
    for (const n of names) await normalizeOne(n.replace(/\.webp$/i, ''));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
