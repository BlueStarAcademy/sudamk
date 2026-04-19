/**
 * 모험 몬스터 WebP를 알파·그라데이션 보존에 유리한 near-lossless로 재인코딩합니다.
 * (기존 손실 WebP의 블록/밴딩 완화 — 경로·파일명은 그대로)
 *
 *   npx tsx scripts/reencode-monster-webp-near-lossless.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/monster');

const WEBP_OPTS: sharp.WebpOptions = {
    nearLossless: true,
    quality: 92,
    alphaQuality: 100,
    effort: 6,
    smartSubsample: false,
};

async function* walkWebp(dir: string): AsyncGenerator<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) yield* walkWebp(p);
        else if (e.name.toLowerCase().endsWith('.webp')) yield p;
    }
}

async function reencodeOne(filePath: string): Promise<void> {
    const buf = await sharp(filePath).ensureAlpha().webp(WEBP_OPTS).toBuffer();
    await fs.writeFile(filePath, buf);
}

async function main() {
    let n = 0;
    for await (const f of walkWebp(ROOT)) {
        await reencodeOne(f);
        console.log('OK', path.relative('public', f));
        n += 1;
    }
    console.log('Done,', n, 'files.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
