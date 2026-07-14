/**
 * Install shop item icons (magenta chroma → transparent WebP).
 * Run: npx tsx scripts/install-shop-item-icons.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ASSETS = path.resolve(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor/projects/c-project-sudam/assets',
);

const MAGENTA_KEY: [number, number, number] = [255, 0, 255];
const MAGENTA_DIST = 110;

const jobs = [
    { src: 'shop_EquipmentBox1.png', destDir: 'public/images/Box', dest: 'EquipmentBox1.webp' },
    { src: 'shop_EquipmentBox2.png', destDir: 'public/images/Box', dest: 'EquipmentBox2.webp' },
    { src: 'shop_EquipmentBox3.png', destDir: 'public/images/Box', dest: 'EquipmentBox3.webp' },
    { src: 'shop_EquipmentBox4.png', destDir: 'public/images/Box', dest: 'EquipmentBox4.webp' },
    { src: 'shop_EquipmentBox5.png', destDir: 'public/images/Box', dest: 'EquipmentBox5.webp' },
    { src: 'shop_EquipmentBox6.png', destDir: 'public/images/Box', dest: 'EquipmentBox6.webp' },
    { src: 'shop_ResourceBox1.png', destDir: 'public/images/Box', dest: 'ResourceBox1.webp' },
    { src: 'shop_ResourceBox2.png', destDir: 'public/images/Box', dest: 'ResourceBox2.webp' },
    { src: 'shop_ResourceBox3.png', destDir: 'public/images/Box', dest: 'ResourceBox3.webp' },
    { src: 'shop_ResourceBox4.png', destDir: 'public/images/Box', dest: 'ResourceBox4.webp' },
    { src: 'shop_ResourceBox5.png', destDir: 'public/images/Box', dest: 'ResourceBox5.webp' },
    { src: 'shop_ResourceBox6.png', destDir: 'public/images/Box', dest: 'ResourceBox6.webp' },
    { src: 'shop_con1.png', destDir: 'public/images/use', dest: 'con1.webp' },
    { src: 'shop_con2.png', destDir: 'public/images/use', dest: 'con2.webp' },
    { src: 'shop_con3.png', destDir: 'public/images/use', dest: 'con3.webp' },
    { src: 'shop_ap_potion_10.png', destDir: 'public/images/use', dest: 'ap_potion_10.webp' },
    { src: 'shop_ap_potion_20.png', destDir: 'public/images/use', dest: 'ap_potion_20.webp' },
    { src: 'shop_ap_potion_30.png', destDir: 'public/images/use', dest: 'ap_potion_30.webp' },
    { src: 'shop_ad_reward.png', destDir: 'public/images/shop', dest: 'ad_reward.webp' },
    { src: 'shop_remove_ads_package.png', destDir: 'public/images/shop', dest: 'remove_ads_package.webp' },
    { src: 'shop_equipment_bonus_epic.png', destDir: 'public/images/shop', dest: 'equipment_bonus_epic.webp' },
    { src: 'shop_equipment_bonus_legendary.png', destDir: 'public/images/shop', dest: 'equipment_bonus_legendary.webp' },
    { src: 'shop_equipment_bonus_mythic.png', destDir: 'public/images/shop', dest: 'equipment_bonus_mythic.webp' },
] as const;

function isNearMagenta(r: number, g: number, b: number): boolean {
    return r > 180 && b > 180 && g < 140 && Math.hypot(r - 255, g - 0, b - 255) <= MAGENTA_DIST + 40;
}

async function chromaMagentaPng(buf: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) return buf;
    const out = Buffer.from(data);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (seen[idx]) return;
        const i = idx * ch;
        const d = Math.hypot(out[i]! - MAGENTA_KEY[0], out[i + 1]! - MAGENTA_KEY[1], out[i + 2]! - MAGENTA_KEY[2]);
        if (d > MAGENTA_DIST) return;
        if (!isNearMagenta(out[i]!, out[i + 1]!, out[i + 2]!)) return;
        seen[idx] = 1;
        stack.push(idx);
    };
    for (let x = 0; x < w; x++) {
        push(x, 0);
        push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
        push(0, y);
        push(w - 1, y);
    }
    while (stack.length) {
        const idx = stack.pop()!;
        const i = idx * ch;
        out[i + 3] = 0;
        const x = idx % w;
        const y = (idx / w) | 0;
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
    }
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const i = idx * ch;
            if (out[i + 3]! === 0) continue;
            const nearClear =
                out[((y - 1) * w + x) * ch + 3]! === 0 ||
                out[((y + 1) * w + x) * ch + 3]! === 0 ||
                out[(y * w + x - 1) * ch + 3]! === 0 ||
                out[(y * w + x + 1) * ch + 3]! === 0;
            if (!nearClear) continue;
            if (isNearMagenta(out[i]!, out[i + 1]!, out[i + 2]!)) out[i + 3] = 0;
        }
    }
    return sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

async function main() {
    for (const j of jobs) {
        const outDir = path.resolve(j.destDir);
        await fs.mkdir(outDir, { recursive: true });
        const src = path.join(ASSETS, j.src);
        const raw = await sharp(src).ensureAlpha().png().toBuffer();
        const keyed = await chromaMagentaPng(raw);
        const dest = path.join(outDir, j.dest);
        await sharp(keyed)
            .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 6 })
            .toFile(dest);
        console.log('OK', path.join(j.destDir, j.dest));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
