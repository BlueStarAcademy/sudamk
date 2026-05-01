/**
 * chapter 폴더 내 PNG → 표준 파일명 .webp (near-lossless). 원본 PNG는 삭제하지 않습니다.
 * Run: npx tsx scripts/normalize-adventure-monster-webp.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/monster');

const webpOpts = {
    nearLossless: true,
    quality: 92,
    alphaQuality: 100,
    effort: 6,
    smartSubsample: false,
} as const;

async function convertOne(src: string, dest: string): Promise<void> {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await sharp(src).ensureAlpha().webp(webpOpts).toFile(dest);
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

async function main() {
    const jobs: { src: string; dest: string }[] = [];

    for (let i = 1; i <= 9; i++) {
        const n = pad(i);
        jobs.push({
            src: path.join(ROOT, 'amusement_park', `amusement_park_${n}.png`),
            dest: path.join(ROOT, 'amusement_park', `amusement_park_${n}.webp`),
        });
    }
    for (let i = 1; i <= 12; i++) {
        const n = pad(i);
        jobs.push({
            src: path.join(ROOT, 'aquarium', `aquarium_${n}.png`),
            dest: path.join(ROOT, 'aquarium', `aquarium_${n}.webp`),
        });
    }
    for (let i = 1; i <= 11; i++) {
        const n = pad(i);
        jobs.push({
            src: path.join(ROOT, 'lake_park', `lake_park_${n}.png`),
            dest: path.join(ROOT, 'lake_park', `lake_park_${n}.webp`),
        });
    }
    for (let i = 1; i <= 12; i++) {
        const n = pad(i);
        jobs.push({
            src: path.join(ROOT, 'neighborhood_hill', `neighborhood_hill_${n}.png`),
            dest: path.join(ROOT, 'neighborhood_hill', `neighborhood_hill_${n}.webp`),
        });
    }
    for (let i = 1; i <= 11; i++) {
        const n = pad(i);
        jobs.push({
            src: path.join(ROOT, 'zoo', `zoo_${n}.png`),
            dest: path.join(ROOT, 'zoo', `zoo_${n}.webp`),
        });
    }

    for (const { src, dest } of jobs) {
        try {
            await fs.access(src);
        } catch {
            throw new Error(`Missing source: ${path.relative(process.cwd(), src)}`);
        }
    }

    for (const { src, dest } of jobs) {
        await convertOne(src, dest);
        console.log('OK', path.relative(process.cwd(), src), '→', path.relative(process.cwd(), dest));
    }

    console.log('Done,', jobs.length, 'converted; PNG sources kept.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
