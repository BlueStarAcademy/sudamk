/**
 * public/images/simbols/simbol*.png · simbolp*.png → 동일 경로 .webp (게임 모드 아이콘)
 * Run: npx tsx scripts/convert-simbol-pngs-to-webp.ts
 */
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'public', 'images', 'simbols');

const WEBP_OPTS: sharp.WebpOptions = {
    quality: 90,
    alphaQuality: 100,
    effort: 6,
};

async function main(): Promise<void> {
    const entries = await fs.readdir(ROOT);
    const pngs = entries
        .filter((name) => /^simbol(?:p?\d+)\.png$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (pngs.length === 0) {
        console.log('No simbol PNG files found in', ROOT);
        return;
    }

    for (const name of pngs) {
        const pngPath = path.join(ROOT, name);
        const webpPath = pngPath.replace(/\.png$/i, '.webp');
        await sharp(pngPath).ensureAlpha().webp(WEBP_OPTS).toFile(webpPath);
        const st = await fs.stat(webpPath);
        console.log(`✓ ${name} → ${path.basename(webpPath)} (${Math.round(st.size / 1024)} KB)`);
    }

    console.log(`Done: ${pngs.length} file(s)`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
