/**
 * Install slot item icons & grade frames.
 * Frames (*bgi): opaque resize → WebP (no chroma).
 * Icons: magenta chroma → transparent WebP.
 * Run: npx tsx scripts/install-slot-item-icons.ts
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

type Job = { src: string; destDir: string; dest: string; mode: 'frame' | 'icon' };

const equipNames = [
    ...[1, 2, 3, 4, 5, 6, 7].flatMap((n) => [
        `Fan${n}`,
        `Board${n}`,
        `Top${n}`,
        `Bottom${n}`,
        `StoneBox${n}`,
        `Stone${n}`,
    ]),
    'EmptyFanSlot',
    'EmptyBoardSlot',
    'EmptyTopSlot',
    'EmptyBottomSlot',
    'EmptyStoneBoxSlot',
    'EmptyStoneSlot',
];

const jobs: Job[] = [
    { src: 'slot_normalbgi.png', destDir: 'public/images/equipments', dest: 'normalbgi.webp', mode: 'frame' },
    { src: 'slot_uncommonbgi.png', destDir: 'public/images/equipments', dest: 'uncommonbgi.webp', mode: 'frame' },
    { src: 'slot_rarebgi.png', destDir: 'public/images/equipments', dest: 'rarebgi.webp', mode: 'frame' },
    { src: 'slot_epicbgi.png', destDir: 'public/images/equipments', dest: 'epicbgi.webp', mode: 'frame' },
    { src: 'slot_legendarybgi.png', destDir: 'public/images/equipments', dest: 'legendarybgi.webp', mode: 'frame' },
    { src: 'slot_mythicbgi.png', destDir: 'public/images/equipments', dest: 'mythicbgi.webp', mode: 'frame' },
    { src: 'slot_transcendentbgi.png', destDir: 'public/images/equipments', dest: 'transcendentbgi.webp', mode: 'frame' },
    ...equipNames.map((name) => ({
        src: `slot_${name}.png`,
        destDir: 'public/images/equipments',
        dest: `${name}.webp`,
        mode: 'icon' as const,
    })),
    { src: 'slot_equipment_bonus_epic.png', destDir: 'public/images/shop', dest: 'equipment_bonus_epic.webp', mode: 'icon' },
    { src: 'slot_equipment_bonus_legendary.png', destDir: 'public/images/shop', dest: 'equipment_bonus_legendary.webp', mode: 'icon' },
    { src: 'slot_equipment_bonus_mythic.png', destDir: 'public/images/shop', dest: 'equipment_bonus_mythic.webp', mode: 'icon' },
    { src: 'slot_materials1.png', destDir: 'public/images/materials', dest: 'materials1.webp', mode: 'icon' },
    { src: 'slot_materials2.png', destDir: 'public/images/materials', dest: 'materials2.webp', mode: 'icon' },
    { src: 'slot_materials3.png', destDir: 'public/images/materials', dest: 'materials3.webp', mode: 'icon' },
    { src: 'slot_materials4.png', destDir: 'public/images/materials', dest: 'materials4.webp', mode: 'icon' },
    { src: 'slot_materials5.png', destDir: 'public/images/materials', dest: 'materials5.webp', mode: 'icon' },
    { src: 'slot_refine.png', destDir: 'public/images/use', dest: 'refine.webp', mode: 'icon' },
    { src: 'slot_allowtrade.png', destDir: 'public/images/use', dest: 'allowtrade.webp', mode: 'icon' },
    { src: 'slot_belong.png', destDir: 'public/images/use', dest: 'belong.webp', mode: 'icon' },
    { src: 'slot_change1.png', destDir: 'public/images/use', dest: 'change1.webp', mode: 'icon' },
    { src: 'slot_change2.png', destDir: 'public/images/use', dest: 'change2.webp', mode: 'icon' },
    { src: 'slot_change3.png', destDir: 'public/images/use', dest: 'change3.webp', mode: 'icon' },
    { src: 'slot_GoldBox1.png', destDir: 'public/images/Box', dest: 'GoldBox1.webp', mode: 'icon' },
    { src: 'slot_GoldBox2.png', destDir: 'public/images/Box', dest: 'GoldBox2.webp', mode: 'icon' },
    { src: 'slot_GoldBox3.png', destDir: 'public/images/Box', dest: 'GoldBox3.webp', mode: 'icon' },
    { src: 'slot_GoldBox4.png', destDir: 'public/images/Box', dest: 'GoldBox4.webp', mode: 'icon' },
    { src: 'slot_DiaBox1.png', destDir: 'public/images/Box', dest: 'DiaBox1.webp', mode: 'icon' },
    { src: 'slot_DiaBox2.png', destDir: 'public/images/Box', dest: 'DiaBox2.webp', mode: 'icon' },
    { src: 'slot_DiaBox3.png', destDir: 'public/images/Box', dest: 'DiaBox3.webp', mode: 'icon' },
    { src: 'slot_DiaBox4.png', destDir: 'public/images/Box', dest: 'DiaBox4.webp', mode: 'icon' },
    { src: 'slot_addturn.png', destDir: 'public/images/button', dest: 'addturn.webp', mode: 'icon' },
    { src: 'slot_missile.png', destDir: 'public/images/button', dest: 'missile.webp', mode: 'icon' },
    { src: 'slot_hidden.png', destDir: 'public/images/button', dest: 'hidden.webp', mode: 'icon' },
    { src: 'slot_scan.png', destDir: 'public/images/button', dest: 'scan.webp', mode: 'icon' },
    { src: 'slot_reflesh.png', destDir: 'public/images/button', dest: 'reflesh.webp', mode: 'icon' },
];

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

async function processJob(j: Job): Promise<void> {
    const outDir = path.resolve(j.destDir);
    await fs.mkdir(outDir, { recursive: true });
    const src = path.join(ASSETS, j.src);
    try {
        await fs.access(src);
    } catch {
        console.warn('SKIP missing', j.src);
        return;
    }
    const dest = path.join(outDir, j.dest);
    if (j.mode === 'frame') {
        await sharp(src)
            .resize(512, 512, { fit: 'cover' })
            .webp({ quality: 90, effort: 6 })
            .toFile(dest);
    } else {
        const raw = await sharp(src).ensureAlpha().png().toBuffer();
        const keyed = await chromaMagentaPng(raw);
        await sharp(keyed)
            .webp({ nearLossless: true, quality: 92, alphaQuality: 100, effort: 6 })
            .toFile(dest);
    }
    console.log('OK', path.join(j.destDir, j.dest));
}

async function main() {
    const only = process.argv.slice(2);
    const list = only.length ? jobs.filter((j) => only.some((a) => j.dest.includes(a) || j.src.includes(a))) : jobs;
    for (const j of list) {
        await processJob(j);
    }
    // Unify silhouette fill after icon install (optional; safe to re-run):
    // npx tsx scripts/normalize-slot-icon-bboxes.ts
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
