/**
 * Pack 4 frame PNGs into a horizontal WebP sprite sheet.
 * Expects: public/images/monster/_frames/<stageId>/<base>_f0.png … _f3.png
 * Writes:  public/images/monster/<stageId>/<base>.webp
 *
 * Run: npx tsx scripts/pack-adventure-monster-sheet.ts [stageId]
 *
 * Chroma:
 * - Classify SOURCE corner color BEFORE resize (magenta / dark / light).
 * - Pad with that color, key only that mode — never dark-key after magenta
 *   (that used to eat charcoal monsters whose silhouette looked like a black bg).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/monster');
const CELL = 512;
const COLS = 4;
const ROWS = 1;

const webpOpts = {
    nearLossless: true,
    quality: 92,
    alphaQuality: 100,
    effort: 6,
    smartSubsample: false,
} as const;

const STAGES = [
    'neighborhood_hill',
    'lake_park',
    'aquarium',
    'zoo',
    'amusement_park',
] as const;

type BgMode = 'magenta' | 'dark' | 'light' | 'none';

const MAGENTA_DIST = 110;
/** Tight — loose dark key eats soft AA on white/cream characters. */
const DARK_BG_DIST = 22;
const LIGHT_BG_DIST = 48;

function isNearMagenta(r: number, g: number, b: number): boolean {
    return r > 170 && b > 160 && g < 150 && Math.hypot(r - 255, g - 0, b - 255) <= MAGENTA_DIST + 50;
}

function isNearBlack(r: number, g: number, b: number, limit = DARK_BG_DIST): boolean {
    return Math.hypot(r, g, b) <= limit;
}

function isNearWhiteGray(r: number, g: number, b: number, bg: [number, number, number], limit = LIGHT_BG_DIST): boolean {
    return Math.hypot(r - bg[0], g - bg[1], b - bg[2]) <= limit;
}

function lumin(r: number, g: number, b: number): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sat(r: number, g: number, b: number): number {
    return Math.max(r, g, b) - Math.min(r, g, b);
}

async function classifySourceBg(fp: string): Promise<{ mode: BgMode; avg: [number, number, number] }> {
    const { data, info } = await sharp(fp)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    const sample = (x: number, y: number): [number, number, number] => {
        const i = (Math.min(y, h - 1) * w + Math.min(x, w - 1)) * ch;
        return [data[i]!, data[i + 1]!, data[i + 2]!];
    };
    const points = [
        sample(0, 0),
        sample(w - 1, 0),
        sample(0, h - 1),
        sample(w - 1, h - 1),
        sample((w / 2) | 0, 0),
        sample((w / 2) | 0, h - 1),
        sample(0, (h / 2) | 0),
        sample(w - 1, (h / 2) | 0),
    ];
    const avg: [number, number, number] = [
        Math.round(points.reduce((s, c) => s + c[0], 0) / points.length),
        Math.round(points.reduce((s, c) => s + c[1], 0) / points.length),
        Math.round(points.reduce((s, c) => s + c[2], 0) / points.length),
    ];
    const magentaVotes = points.filter(([r, g, b]) => isNearMagenta(r, g, b)).length;
    const sum = avg[0] + avg[1] + avg[2];
    if (magentaVotes >= 2 || isNearMagenta(...avg)) return { mode: 'magenta', avg };
    if (sum <= 100) return { mode: 'dark', avg };
    if (avg[0] >= 150 && avg[1] >= 150 && avg[2] >= 150) return { mode: 'light', avg };
    return { mode: 'none', avg };
}

function padColor(mode: BgMode): { r: number; g: number; b: number; alpha: number } {
    if (mode === 'magenta') return { r: 255, g: 0, b: 255, alpha: 1 };
    if (mode === 'dark') return { r: 0, g: 0, b: 0, alpha: 1 };
    if (mode === 'light') return { r: 220, g: 220, b: 220, alpha: 1 };
    return { r: 0, g: 0, b: 0, alpha: 0 };
}

function floodClear(
    out: Buffer,
    w: number,
    h: number,
    ch: number,
    accept: (r: number, g: number, b: number, a: number) => boolean,
): void {
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (seen[idx]) return;
        const i = idx * ch;
        const a = out[i + 3]!;
        if (a === 0) {
            seen[idx] = 1;
            stack.push(idx);
            return;
        }
        if (!accept(out[i]!, out[i + 1]!, out[i + 2]!, a)) return;
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
}

function cleanupFringe(out: Buffer, w: number, h: number, ch: number, mode: BgMode): void {
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * ch;
            if (out[i + 3]! === 0) continue;
            const clearN =
                (out[((y - 1) * w + x) * ch + 3]! === 0 ? 1 : 0) +
                (out[((y + 1) * w + x) * ch + 3]! === 0 ? 1 : 0) +
                (out[(y * w + x - 1) * ch + 3]! === 0 ? 1 : 0) +
                (out[(y * w + x + 1) * ch + 3]! === 0 ? 1 : 0);
            if (clearN === 0) continue;
            const r = out[i]!;
            const g = out[i + 1]!;
            const b = out[i + 2]!;
            if (isNearMagenta(r, g, b)) {
                out[i + 3] = 0;
                continue;
            }
            // Soft magenta tint leftover (only when strongly exposed)
            if (clearN >= 2 && r > 150 && b > 120 && g < 130 && sat(r, g, b) > 40) {
                out[i + 3] = 0;
                continue;
            }
            // Never peel pale body pixels on dark-bg plates (white/cream monsters).
            // Only scrub chalk halo for light-bg sources.
            if (mode === 'light') {
                const L = lumin(r, g, b);
                const S = sat(r, g, b);
                if (clearN >= 2 && L >= 205 && S <= 22) out[i + 3] = 0;
                else if (clearN >= 2 && Math.min(r, g, b) >= 230) out[i + 3] = 0;
            }
            if (mode === 'dark' && clearN >= 2 && isNearBlack(r, g, b, 28) && sat(r, g, b) <= 25) {
                out[i + 3] = 0;
            }
        }
    }
}

async function chromaKeyPng(buf: Buffer, mode: BgMode, lightBg: [number, number, number]): Promise<Buffer> {
    if (mode === 'none') return buf;
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (ch !== 4) return buf;
    const out = Buffer.from(data);

    if (mode === 'magenta') {
        floodClear(out, w, h, ch, (r, g, b, a) => a > 0 && isNearMagenta(r, g, b));
    } else if (mode === 'dark') {
        floodClear(
            out,
            w,
            h,
            ch,
            (r, g, b, a) => a > 0 && isNearBlack(r, g, b, DARK_BG_DIST) && lumin(r, g, b) < 26,
        );
    } else if (mode === 'light') {
        floodClear(out, w, h, ch, (r, g, b, a) => a > 0 && isNearWhiteGray(r, g, b, lightBg, LIGHT_BG_DIST));
    }

    cleanupFringe(out, w, h, ch, mode);
    return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function packOne(stageId: string, base: string): Promise<void> {
    const framesDir = path.join(ROOT, '_frames', stageId);
    const frames: Buffer[] = [];
    for (let i = 0; i < COLS; i++) {
        const fp = path.join(framesDir, `${base}_f${i}.png`);
        const { mode, avg } = await classifySourceBg(fp);
        const resized = await sharp(fp)
            .ensureAlpha()
            .resize(CELL, CELL, { fit: 'contain', background: padColor(mode) })
            .png()
            .toBuffer();
        frames.push(await chromaKeyPng(resized, mode, avg));
    }

    const composites = frames.map((input, i) => ({
        input,
        left: i * CELL,
        top: 0,
    }));

    const dest = path.join(ROOT, stageId, `${base}.webp`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await sharp({
        create: {
            width: CELL * COLS,
            height: CELL * ROWS,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite(composites)
        .webp(webpOpts)
        .toFile(dest);

    await sharp(frames[0]!).webp(webpOpts).toFile(path.join(ROOT, stageId, `${base}_portrait.webp`));
    console.log('packed', dest, '+ portrait');
}

async function listBases(stageId: string): Promise<string[]> {
    const framesDir = path.join(ROOT, '_frames', stageId);
    let names: string[];
    try {
        names = await fs.readdir(framesDir);
    } catch {
        return [];
    }
    const bases = new Set<string>();
    for (const n of names) {
        const m = n.match(/^(.+)_f0\.png$/i);
        if (m?.[1]) bases.add(m[1]);
    }
    return [...bases].sort();
}

async function main() {
    const only = process.argv[2];
    const stages = only ? STAGES.filter((s) => s === only) : [...STAGES];
    if (only && stages.length === 0) {
        console.error('Unknown stageId', only);
        process.exit(1);
    }
    for (const stageId of stages) {
        const bases = await listBases(stageId);
        if (bases.length === 0) {
            console.log('skip (no frames)', stageId);
            continue;
        }
        for (const base of bases) {
            await packOne(stageId, base);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
