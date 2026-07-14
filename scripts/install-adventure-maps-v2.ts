/**
 * Convert adventure map PNGs from assets to public/images/*.webp
 * Usage: npx tsx scripts/install-adventure-maps-v2.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ASSETS = path.resolve(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor/projects/c-project-sudam/assets',
);
const OUT = path.resolve('public/images');

const jobs = [
    { src: 'forest_map_v2.png', dest: 'forest.webp' },
    { src: 'lakeside_map_v2.png', dest: 'lakesidepark.webp' },
    { src: 'aquarium_map_v2.png', dest: 'aquarium.webp' },
    { src: 'zoo_map_v2.png', dest: 'zoo.webp' },
    { src: 'amusement_map_v2.png', dest: 'amusementpark.webp' },
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
