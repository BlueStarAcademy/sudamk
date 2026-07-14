/**
 * Grade slot frames: soft grade-tinted plate + soft rounded metal bevel.
 * Plate keeps each grade's hue at muted strength so icons stay clear.
 * No fire/grain/bloom. Run: npx tsx scripts/generate-grade-slot-frames.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type Rgba = { r: number; g: number; b: number };

const SIZE = 512;

type GradeStyle = {
    /** Soft / muted grade plate fill (readable hue, not near-black) */
    fill: Rgba;
    /** Slightly richer grade tone for edge vignette */
    tint: Rgba;
    rimDark: Rgba;
    rimMid: Rgba;
    rimLight: Rgba;
    accent: Rgba;
    /** outer band thickness in px */
    outer: number;
    /** mid band */
    mid: number;
    /** inner highlight line */
    inner: number;
    /** corner radius as fraction of SIZE */
    radiusFrac: number;
    ornament: 'none' | 'tick' | 'diamond' | 'bracket' | 'star';
};

const grades: Record<string, GradeStyle> = {
    // Soft grade plates: keep clear hue (not near-black), calmer than old mid-sat fills
    normal: {
        fill: { r: 62, g: 66, b: 76 },
        tint: { r: 78, g: 82, b: 92 },
        rimDark: { r: 72, g: 76, b: 86 },
        rimMid: { r: 148, g: 152, b: 162 },
        rimLight: { r: 210, g: 214, b: 222 },
        accent: { r: 170, g: 174, b: 184 },
        outer: 14,
        mid: 7,
        inner: 2.5,
        radiusFrac: 0.06,
        ornament: 'none',
    },
    uncommon: {
        fill: { r: 24, g: 60, b: 40 },
        tint: { r: 32, g: 78, b: 52 },
        rimDark: { r: 24, g: 88, b: 50 },
        rimMid: { r: 52, g: 175, b: 105 },
        rimLight: { r: 150, g: 236, b: 180 },
        accent: { r: 100, g: 210, b: 140 },
        outer: 15,
        mid: 7.5,
        inner: 2.5,
        radiusFrac: 0.065,
        ornament: 'tick',
    },
    rare: {
        fill: { r: 22, g: 50, b: 88 },
        tint: { r: 30, g: 64, b: 110 },
        rimDark: { r: 28, g: 88, b: 150 },
        rimMid: { r: 56, g: 158, b: 230 },
        rimLight: { r: 155, g: 220, b: 255 },
        accent: { r: 100, g: 190, b: 250 },
        outer: 16,
        mid: 8,
        inner: 3,
        radiusFrac: 0.07,
        ornament: 'bracket',
    },
    epic: {
        fill: { r: 58, g: 34, b: 92 },
        tint: { r: 74, g: 44, b: 116 },
        rimDark: { r: 88, g: 48, b: 140 },
        rimMid: { r: 158, g: 110, b: 230 },
        rimLight: { r: 220, g: 190, b: 255 },
        accent: { r: 190, g: 150, b: 250 },
        outer: 17,
        mid: 8.5,
        inner: 3,
        radiusFrac: 0.075,
        ornament: 'diamond',
    },
    legendary: {
        fill: { r: 74, g: 26, b: 38 },
        tint: { r: 94, g: 34, b: 50 },
        rimDark: { r: 118, g: 34, b: 50 },
        rimMid: { r: 200, g: 68, b: 92 },
        rimLight: { r: 250, g: 160, b: 175 },
        accent: { r: 230, g: 100, b: 125 },
        outer: 18,
        mid: 9,
        inner: 3,
        radiusFrac: 0.08,
        ornament: 'diamond',
    },
    mythic: {
        fill: { r: 68, g: 50, b: 16 },
        tint: { r: 86, g: 64, b: 22 },
        rimDark: { r: 128, g: 92, b: 22 },
        rimMid: { r: 210, g: 165, b: 48 },
        rimLight: { r: 255, g: 228, b: 130 },
        accent: { r: 240, g: 200, b: 80 },
        outer: 18,
        mid: 9.5,
        inner: 3.2,
        radiusFrac: 0.085,
        ornament: 'star',
    },
    transcendent: {
        fill: { r: 14, g: 54, b: 66 },
        tint: { r: 20, g: 70, b: 84 },
        rimDark: { r: 22, g: 110, b: 130 },
        rimMid: { r: 48, g: 195, b: 218 },
        rimLight: { r: 165, g: 245, b: 255 },
        accent: { r: 100, g: 230, b: 245 },
        outer: 18,
        mid: 9,
        inner: 3,
        radiusFrac: 0.085,
        ornament: 'star',
    },
};

function clamp(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)));
}

function mix(a: Rgba, b: Rgba, t: number): Rgba {
    const u = Math.max(0, Math.min(1, t));
    return {
        r: clamp(a.r + (b.r - a.r) * u),
        g: clamp(a.g + (b.g - a.g) * u),
        b: clamp(a.b + (b.b - a.b) * u),
    };
}

function setPx(buf: Buffer, x: number, y: number, c: Rgba, a = 255): void {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    buf[i] = c.r;
    buf[i + 1] = c.g;
    buf[i + 2] = c.b;
    buf[i + 3] = a;
}

function blendPx(buf: Buffer, x: number, y: number, c: Rgba, alpha: number): void {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    if (alpha <= 0) return;
    const a = Math.max(0, Math.min(1, alpha));
    const i = (y * SIZE + x) * 4;
    buf[i] = clamp(buf[i] + (c.r - buf[i]) * a);
    buf[i + 1] = clamp(buf[i + 1] + (c.g - buf[i + 1]) * a);
    buf[i + 2] = clamp(buf[i + 2] + (c.b - buf[i + 2]) * a);
    buf[i + 3] = 255;
}

/** Signed distance to rounded rectangle centered in canvas. Negative = inside. */
function sdRoundRect(px: number, py: number, half: number, radius: number): number {
    const qx = Math.abs(px) - (half - radius);
    const qy = Math.abs(py) - (half - radius);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

/**
 * Soft coverage for a hollow band where distance into the outer shape
 * falls between bandStart and bandEnd (from the outer edge inward).
 */
function bandCoverage(
    distFromOuterEdge: number,
    bandStart: number,
    bandEnd: number,
    soft = 0.85,
): number {
    const enter = smoothstep(bandStart - soft, bandStart + soft, distFromOuterEdge);
    const leave = 1 - smoothstep(bandEnd - soft, bandEnd + soft, distFromOuterEdge);
    return Math.max(0, Math.min(1, enter * leave));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    if (edge0 === edge1) return x < edge0 ? 0 : 1;
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function paintSoftDiamond(buf: Buffer, cx: number, cy: number, half: number, c: Rgba): void {
    const r = Math.ceil(half + 1.5);
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            const d = Math.abs(x) + Math.abs(y) - half;
            const a = 1 - smoothstep(-0.9, 0.9, d);
            if (a > 0.02) blendPx(buf, Math.round(cx + x), Math.round(cy + y), c, a);
        }
    }
}

function paintSoftTick(buf: Buffer, cx: number, cy: number, len: number, thick: number, c: Rgba): void {
    const r = Math.ceil(len + 2);
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            const dx = Math.abs(x);
            const dy = Math.abs(y);
            const onArm = (dx <= thick + 0.6 && dy <= len) || (dy <= thick + 0.6 && dx <= len);
            if (!onArm) continue;
            const edge =
                Math.min(
                    dx <= thick + 0.6 ? thick + 0.6 - dx : Infinity,
                    dy <= thick + 0.6 ? thick + 0.6 - dy : Infinity,
                    len - Math.max(dx <= thick + 0.6 ? dy : 0, dy <= thick + 0.6 ? dx : 0),
                ) + 0.5;
            const a = smoothstep(0, 1.2, edge);
            if (a > 0.02) blendPx(buf, Math.round(cx + x), Math.round(cy + y), c, a * 0.92);
        }
    }
}

function paintSoftBracket(
    buf: Buffer,
    ox: number,
    oy: number,
    len: number,
    thick: number,
    c: Rgba,
): void {
    const xDir = ox < SIZE / 2 ? 1 : -1;
    const yDir = oy < SIZE / 2 ? 1 : -1;
    for (let i = 0; i < len + 2; i++) {
        for (let t = 0; t < thick + 2; t++) {
            const along = 1 - Math.abs(i - (len - 1) / 2) / (len * 0.55 + 0.01);
            const across = 1 - Math.abs(t - (thick - 1) / 2) / (thick * 0.7 + 0.01);
            const a = Math.max(0, Math.min(1, along)) * Math.max(0, Math.min(1, across)) * 0.95;
            if (a < 0.05) continue;
            blendPx(buf, Math.round(ox + i * xDir), Math.round(oy + t * yDir), c, a);
            blendPx(buf, Math.round(ox + t * xDir), Math.round(oy + i * yDir), c, a);
        }
    }
}

function paintSoftStar(buf: Buffer, cx: number, cy: number, r: number, c: Rgba): void {
    const extent = Math.ceil(r + 2);
    for (let y = -extent; y <= extent; y++) {
        for (let x = -extent; x <= extent; x++) {
            const ax = Math.abs(x);
            const ay = Math.abs(y);
            let dArm = Math.min(ax, ay);
            if (ax > r || ay > r) dArm = Infinity;
            const diag = Math.abs(ax - ay);
            let dDiag = diag;
            if (ax + ay > r * 1.15 || ax > r * 0.65) dDiag = Infinity;
            const d = Math.min(dArm - 0.55, dDiag - 0.35);
            const a = 1 - smoothstep(-0.7, 0.9, d);
            if (a > 0.03) {
                const fall = 1 - Math.hypot(x, y) / (r + 0.5);
                const col = mix(c, { r: 255, g: 255, b: 255 }, Math.max(0, fall) * 0.22);
                blendPx(buf, Math.round(cx + x), Math.round(cy + y), col, a * 0.95);
            }
        }
    }
}

function paintOrnaments(buf: Buffer, style: GradeStyle, rimInnerInset: number): void {
    const inset = rimInnerInset + 11;
    const corners: Array<[number, number]> = [
        [inset, inset],
        [SIZE - 1 - inset, inset],
        [inset, SIZE - 1 - inset],
        [SIZE - 1 - inset, SIZE - 1 - inset],
    ];
    for (const [cx, cy] of corners) {
        switch (style.ornament) {
            case 'none':
                break;
            case 'tick':
                paintSoftTick(buf, cx, cy, 6.5, 1.15, style.accent);
                break;
            case 'bracket':
                paintSoftBracket(buf, cx, cy, 17, 3.2, style.accent);
                break;
            case 'diamond':
                paintSoftDiamond(buf, cx, cy, 6.2, style.accent);
                paintSoftDiamond(buf, cx, cy, 2.2, style.rimLight);
                break;
            case 'star':
                paintSoftStar(buf, cx, cy, 7.5, style.accent);
                break;
        }
    }
}

async function writeGrade(name: string, style: GradeStyle): Promise<void> {
    const buf = Buffer.alloc(SIZE * SIZE * 4);
    const cx = (SIZE - 1) / 2;
    const cy = (SIZE - 1) / 2;
    const outerHalf = SIZE / 2 - 0.5;
    const radius = style.radiusFrac * SIZE;
    const rimTotal = style.outer + style.mid + style.inner;

    // Soft center lift stays in-grade (lighter fill), edge softens toward tint
    const centerLift = {
        r: clamp(style.fill.r + 18),
        g: clamp(style.fill.g + 18),
        b: clamp(style.fill.b + 18),
    };
    const edgeShade = {
        r: Math.max(0, mix(style.fill, style.tint, 0.4).r - 6),
        g: Math.max(0, mix(style.fill, style.tint, 0.4).g - 6),
        b: Math.max(0, mix(style.fill, style.tint, 0.4).b - 6),
    };

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const px = x - cx;
            const py = y - cy;
            const sd = sdRoundRect(px, py, outerHalf, radius);
            if (sd > 1.2) {
                setPx(buf, x, y, { r: 0, g: 0, b: 0 }, 0);
                continue;
            }

            const inward = -sd;
            const outerAA = 1 - smoothstep(-0.9, 0.9, sd);

            // Full soft grade plate (hue retained), mild radial depth
            const radial = Math.hypot(px, py) / (outerHalf * 1.15);
            let plate: Rgba;
            if (radial < 0.5) {
                const t = 1 - radial / 0.5;
                plate = mix(style.fill, centerLift, t * 0.45);
            } else {
                const t = (radial - 0.5) / 0.5;
                plate = mix(style.fill, edgeShade, Math.min(1, t) * 0.4);
            }
            // Light under-rim recess — keep grade visible (avoid near-black wash)
            const underRim = bandCoverage(inward, rimTotal, rimTotal + 8, 2);
            plate = mix(plate, mix(style.fill, edgeShade, 0.7), underRim * 0.18);

            let color = plate;

            const cOuter = bandCoverage(inward, 0, style.outer, 0.9);
            const cMid = bandCoverage(inward, style.outer, style.outer + style.mid, 0.85);
            const cInner = bandCoverage(inward, style.outer + style.mid, rimTotal, 0.7);

            if (cOuter > 0.01) {
                const t = Math.max(0, Math.min(1, inward / Math.max(1, style.outer)));
                const outerCol = mix(style.rimDark, mix(style.rimDark, style.rimMid, 0.35), t * 0.5);
                color = mix(color, outerCol, cOuter);
            }
            if (cMid > 0.01) {
                const t = Math.max(
                    0,
                    Math.min(1, (inward - style.outer) / Math.max(1, style.mid)),
                );
                const midCol = mix(style.rimMid, style.rimLight, t * 0.22);
                color = mix(color, midCol, cMid);
            }
            if (cInner > 0.01) {
                color = mix(color, style.rimLight, cInner);
            }

            const sep = bandCoverage(inward, rimTotal, rimTotal + 1.4, 0.55);
            if (sep > 0.01) {
                color = mix(color, mix(style.rimDark, style.fill, 0.55), sep * 0.85);
            }

            setPx(buf, x, y, color, clamp(outerAA * 255));
        }
    }

    paintOrnaments(buf, style, rimTotal);

    const outDir = path.resolve('public/images/equipments');
    const staging = path.join(outDir, '.bgi-staging');
    await fs.mkdir(staging, { recursive: true });
    const raw = sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } });
    await raw.clone().png().toFile(path.join(staging, `${name}bgi.png`));
    await raw.clone().webp({ lossless: true, effort: 6 }).toFile(path.join(staging, `${name}bgi.webp`));
    console.log('STAGED', `${name}bgi`);
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
