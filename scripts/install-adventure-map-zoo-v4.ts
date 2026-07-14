/**
 * Install regenerated zoo map into public/images/zoo.webp
 * Run: npx tsx scripts/install-adventure-map-zoo-v4.ts
 */
import path from 'node:path';
import sharp from 'sharp';

const ASSETS = path.resolve(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor/projects/c-project-sudam/assets',
);
const OUT = path.resolve('public/images');

async function main() {
    const src = path.join(ASSETS, 'map_v4_zoo.png');
    const dest = path.join(OUT, 'zoo.webp');
    await sharp(src).resize(1920, 1080, { fit: 'cover' }).webp({ quality: 90, effort: 6 }).toFile(dest);
    console.log('OK', dest);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
