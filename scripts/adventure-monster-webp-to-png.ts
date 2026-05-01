/**
 * 모험 챕터 몬스터 .webp 옆에 동일 파일명 .png 생성(복원·동기화용). WebP는 그대로 둡니다.
 * Run: npx tsx scripts/adventure-monster-webp-to-png.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/monster');
const CHAPTER_DIRS = ['amusement_park', 'aquarium', 'lake_park', 'neighborhood_hill', 'zoo'] as const;

async function main() {
    let n = 0;
    for (const dir of CHAPTER_DIRS) {
        const d = path.join(ROOT, dir);
        let names: string[];
        try {
            names = await fs.readdir(d);
        } catch {
            continue;
        }
        for (const name of names) {
            if (!name.toLowerCase().endsWith('.webp')) continue;
            const webpPath = path.join(d, name);
            const pngPath = path.join(d, `${path.basename(name, '.webp')}.png`);
            await sharp(webpPath).ensureAlpha().png({ compressionLevel: 9 }).toFile(pngPath);
            console.log('OK', path.relative(process.cwd(), pngPath));
            n += 1;
        }
    }
    console.log('Done,', n, 'PNG files written.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
