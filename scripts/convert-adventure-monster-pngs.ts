/**
 * Converts public/images/monster/*.png → chapter subfolders as .webp
 * Run: npx tsx scripts/convert-adventure-monster-pngs.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/monster');

function chapterDirForBasename(base: string): string {
    if (base.startsWith('lakesideparkmon')) return 'lake_park';
    if (base.startsWith('forestmon')) return 'neighborhood_hill';
    if (base.startsWith('aquariummon')) return 'aquarium';
    if (base.startsWith('amusementmon')) return 'amusement_park';
    if (base.startsWith('zoomon')) return 'zoo';
    throw new Error(`Unknown monster prefix: ${base}`);
}

async function main() {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    const pngs = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png'));
    if (pngs.length === 0) {
        console.log('No PNG files in', ROOT);
        return;
    }
    for (const e of pngs) {
        const base = path.basename(e.name, '.png');
        const dir = chapterDirForBasename(base);
        const outDir = path.join(ROOT, dir);
        await fs.mkdir(outDir, { recursive: true });
        const inPath = path.join(ROOT, e.name);
        const outPath = path.join(outDir, `${base}.webp`);
        await sharp(inPath)
            .ensureAlpha()
            .webp({
                nearLossless: true,
                quality: 92,
                alphaQuality: 100,
                effort: 6,
                smartSubsample: false,
            })
            .toFile(outPath);
        await fs.unlink(inPath);
        console.log('OK', e.name, '→', path.relative('public', outPath));
    }
    console.log('Done,', pngs.length, 'converted.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
