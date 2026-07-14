/**
 * Generate clean grade slot backgrounds (no AI grain/banding).
 * Flat soft fill + thin border. Run: npx tsx scripts/generate-grade-slot-frames.ts
 */
import path from 'node:path';
import sharp from 'sharp';

type Rgba = { r: number; g: number; b: number; a?: number };

const SIZE = 512;
/** ~2.5px at 64px slot size so baked rim remains visible without CSS overlay. */
const BORDER = 20;

const grades: Record<string, { fill: Rgba; border: Rgba; centerBoost?: number }> = {
    normal: { fill: { r: 72, g: 74, b: 80 }, border: { r: 150, g: 154, b: 162 }, centerBoost: 18 },
    uncommon: { fill: { r: 34, g: 90, b: 52 }, border: { r: 90, g: 190, b: 110 }, centerBoost: 22 },
    rare: { fill: { r: 30, g: 70, b: 130 }, border: { r: 90, g: 160, b: 230 }, centerBoost: 24 },
    epic: { fill: { r: 88, g: 40, b: 140 }, border: { r: 180, g: 110, b: 230 }, centerBoost: 26 },
    legendary: { fill: { r: 120, g: 28, b: 40 }, border: { r: 230, g: 80, b: 95 }, centerBoost: 28 },
    mythic: { fill: { r: 160, g: 120, b: 30 }, border: { r: 240, g: 200, b: 70 }, centerBoost: 30 },
    transcendent: { fill: { r: 40, g: 110, b: 130 }, border: { r: 140, g: 230, b: 240 }, centerBoost: 32 },
};

function clamp(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)));
}

async function writeGrade(name: string, cfg: (typeof grades)[string]): Promise<void> {
    const { fill, border, centerBoost = 20 } = cfg;
    const buf = Buffer.alloc(SIZE * SIZE * 4);
    const cx = (SIZE - 1) / 2;
    const cy = (SIZE - 1) / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const i = (y * SIZE + x) * 4;
            const onBorder = x < BORDER || y < BORDER || x >= SIZE - BORDER || y >= SIZE - BORDER;
            if (onBorder) {
                buf[i] = border.r;
                buf[i + 1] = border.g;
                buf[i + 2] = border.b;
                buf[i + 3] = 255;
                continue;
            }
            // Flat fill — radial handled by CSS scrim to avoid webp banding/moiré
            buf[i] = fill.r;
            buf[i + 1] = fill.g;
            buf[i + 2] = fill.b;
            buf[i + 3] = 255;
        }
    }
    const dest = path.resolve('public/images/equipments', `${name}bgi.webp`);
    // Lossless keeps flat fills + rims crisp at small slot sizes (lossy nearLossless was ~74B mush).
    await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
        .webp({ lossless: true, effort: 6 })
        .toFile(dest);
    console.log('OK', dest);
}

async function main() {
    for (const [name, cfg] of Object.entries(grades)) {
        await writeGrade(name, cfg);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
