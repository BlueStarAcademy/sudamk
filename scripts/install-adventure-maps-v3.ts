/**
 * Install adventure map v3 (realism+fantasy hybrid) into public/images.
 * Run: npx tsx scripts/install-adventure-maps-v3.ts
 */
import path from 'node:path';
import sharp from 'sharp';

const ASSETS = path.resolve(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor/projects/c-project-sudam/assets',
);
const OUT = path.resolve('public/images');

const jobs = [
    { src: 'map_v3_forest.png', dest: 'forest.webp' },
    { src: 'map_v3_lakeside.png', dest: 'lakesidepark.webp' },
    { src: 'map_v3_aquarium.png', dest: 'aquarium.webp' },
    { src: 'map_v3_zoo.png', dest: 'zoo.webp' },
    { src: 'map_v3_amusement.png', dest: 'amusementpark.webp' },
] as const;

async function main() {
    for (const j of jobs) {
        const src = path.join(ASSETS, j.src);
        const dest = path.join(OUT, j.dest);
        await sharp(src)
            .resize(1920, 1080, { fit: 'cover' })
            .webp({ quality: 90, effort: 6 })
            .toFile(dest);
        console.log('OK', j.dest);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
