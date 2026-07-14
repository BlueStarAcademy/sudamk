/**
 * Flatten equipment icons onto opaque black so dark art (dark robes, boards, etc.)
 * no longer "punches through" transparent holes onto grade frames.
 *
 * Never flatten Stone* — black baduk stones must keep alpha or they melt into the plate.
 * StoneBox* is also skipped (bowl art already composites cleanly with grade frames).
 * Does NOT touch *bgi frames or UI chrome.
 * Run: npx tsx scripts/flatten-equip-icons-on-black.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const EQ = path.resolve('public/images/equipments');
/** Stone / StoneBox excluded — black-stone artwork needs transparency */
const KEEP = /^(Fan|Board|Top|Bottom)\d+\.webp$/i;

async function flattenOne(file: string): Promise<void> {
    const meta = await sharp(file).metadata();
    const w = meta.width ?? 512;
    const h = meta.height ?? 512;
    const icon = await sharp(file).ensureAlpha().png().toBuffer();
    const outBuf = await sharp({
        create: {
            width: w,
            height: h,
            channels: 3,
            background: { r: 0, g: 0, b: 0 },
        },
    })
        .composite([{ input: icon, blend: 'over' }])
        .webp({ nearLossless: true, quality: 92, effort: 5 })
        .toBuffer();

    const tmp = path.join(path.dirname(file), `${path.basename(file, '.webp')}.__flat.webp`);
    await fs.writeFile(tmp, outBuf);
    // Windows: rename target aside first, then move flattened into place
    const bak = `${file}.bakflat`;
    for (let i = 0; i < 8; i++) {
        try {
            try {
                await fs.rename(file, bak);
            } catch {
                await fs.unlink(file).catch(() => undefined);
            }
            await fs.rename(tmp, file);
            await fs.unlink(bak).catch(() => undefined);
            console.log('OK', path.basename(file));
            return;
        } catch (e) {
            console.warn('retry', path.basename(file), i, (e as Error).message);
            await new Promise((r) => setTimeout(r, 250 + i * 150));
        }
    }
    console.error('FAIL kept', tmp);
}

async function main() {
    const only = process.argv.slice(2).map((s) => s.toLowerCase());
    const entries = await fs.readdir(EQ);
    for (const name of entries) {
        if (!KEEP.test(name)) continue;
        if (only.length && !only.some((a) => name.toLowerCase().includes(a))) continue;
        await flattenOne(path.join(EQ, name));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
