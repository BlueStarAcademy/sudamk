/**
 * Overlay stage road keypoints + sampled nodes onto adventure-map images for visual QA.
 * Run: node scripts/preview-sp-stage-paths.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const W = 3600;
const H = 1600;
const OUT = path.resolve('tmp/sp-path-preview');

/** Keep in sync with shared/constants/singlePlayerStageMapPaths.ts SINGLE_PLAYER_ROAD_KEYPOINTS */
const ROADS = {
    1: [
        [50.0, 94.0], [49.0, 88.0], [47.0, 82.0], [45.5, 76.0], [45.5, 70.0],
        [47.5, 64.0], [50.5, 58.0], [53.5, 52.0], [56.0, 46.0], [57.5, 40.0],
        [58.0, 34.0], [59.5, 28.0], [62.0, 22.5], [65.0, 17.0],
    ],
    2: [
        [50.0, 94.5], [49.0, 89.0], [47.0, 83.5], [45.0, 77.5], [44.5, 71.5],
        [47.5, 65.5], [52.0, 59.5], [55.5, 53.5], [55.0, 47.0], [50.5, 41.0],
        [46.0, 35.0], [45.5, 29.0], [48.5, 23.0], [50.0, 17.5],
    ],
    3: [
        [50.0, 94.5], [47.5, 88.0], [43.0, 81.5], [39.0, 74.5], [40.5, 67.5],
        [47.0, 61.0], [55.0, 55.0], [61.0, 49.0], [60.0, 43.0], [53.0, 38.0],
        [46.0, 33.0], [46.5, 28.0], [49.5, 23.0], [50.0, 18.5],
    ],
    4: [
        [48.7, 93.7], [40.2, 86.8], [55.9, 79.4], [56.9, 72.8], [45.0, 56.2],
        [48.5, 51.6], [51.2, 43.5], [44.5, 41.0], [39.7, 35.4], [45.8, 28.3],
        [51.9, 26.8], [49.0, 19.1], [61.2, 21.5], [66.4, 14.0], [72.6, 14.6],
    ],
    5: [
        [42.9, 92.7], [51.4, 83.0], [45.2, 77.4], [49.5, 74.3], [42.6, 70.0],
        [52.3, 64.6], [59.0, 57.9], [49.1, 50.2], [57.2, 45.0], [46.8, 39.4],
        [63.6, 32.3], [64.1, 28.2], [57.7, 25.2], [64.2, 22.0], [60.1, 17.0],
        [62.6, 9.3],
    ],
};

function clamp(n) {
    return Math.max(4, Math.min(96, n));
}

function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return [
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    ];
}

function sampleAlongRoad(road, count) {
    const pts = road.map(([x, y]) => [clamp(x), clamp(y)]);
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        for (let s = 0; s < 24; s++) dense.push(catmull(p0, p1, p2, p3, s / 24).map(clamp));
    }
    dense.push(pts[pts.length - 1]);
    const lens = [];
    let total = 0;
    for (let i = 0; i < dense.length - 1; i++) {
        const dx = dense[i + 1][0] - dense[i][0];
        const dy = (dense[i + 1][1] - dense[i][1]) * 1.35;
        const len = Math.hypot(dx, dy);
        lens.push(len);
        total += len;
    }
    const out = [];
    for (let i = 0; i < count; i++) {
        const target = (i / (count - 1)) * total;
        let acc = 0;
        for (let s = 0; s < lens.length; s++) {
            if (target <= acc + lens[s] || s === lens.length - 1) {
                const u = lens[s] > 0 ? (target - acc) / lens[s] : 0;
                const a = dense[s];
                const b = dense[s + 1];
                out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
                break;
            }
            acc += lens[s];
        }
    }
    return out;
}

function toXY(xPct, yPct) {
    return [(xPct / 100) * W, (yPct / 100) * H];
}

function buildSvg(road, nodes) {
    const keyPts = road.map(([x, y]) => toXY(x, y));
    const nodePts = nodes.map(([x, y]) => toXY(x, y));
    let path = '';
    for (let i = 0; i < nodePts.length; i++) {
        const [x, y] = nodePts[i];
        path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    const keyCircles = keyPts
        .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="18" fill="rgba(255,0,0,0.85)" stroke="#fff" stroke-width="3"/><text x="${x + 22}" y="${y - 10}" fill="#fff" font-size="28" font-family="sans-serif">${i}</text>`)
        .join('');
    const nodeCircles = nodePts
        .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="28" fill="rgba(251,191,36,0.9)" stroke="#111" stroke-width="4"/><text x="${x}" y="${y + 10}" text-anchor="middle" fill="#111" font-size="26" font-weight="700" font-family="sans-serif">${i + 1}</text>`)
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <path d="${path}" fill="none" stroke="rgba(255,230,0,0.85)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  ${nodeCircles}
  ${keyCircles}
</svg>`;
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    for (const n of [1, 2, 3, 4, 5]) {
        const road = ROADS[n];
        const nodes = sampleAlongRoad(road, 20);
        const svg = Buffer.from(buildSvg(road, nodes));
        const src = path.resolve(`public/images/bg/adventure-map-${n}.webp`);
        const dest = path.join(OUT, `map-${n}-path.png`);
        await sharp(src)
            .composite([{ input: await sharp(svg).png().toBuffer(), blend: 'over' }])
            .png()
            .toFile(dest);
        console.log('wrote', dest);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
