import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const THRESH = 28;
const isNearBlack = (r, g, b) => Math.max(r, g, b) <= THRESH;

function floodBackgroundMask(data, w, h) {
    const n = w * h;
    const bg = new Uint8Array(n);
    const q = new Int32Array(n);
    let head = 0;
    let tail = 0;
    const tryPush = (i) => {
        if (bg[i]) return;
        const o = i * 4;
        if (!isNearBlack(data[o], data[o + 1], data[o + 2])) return;
        bg[i] = 1;
        q[tail++] = i;
    };
    for (let x = 0; x < w; x++) {
        tryPush(x);
        tryPush((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
        tryPush(y * w);
        tryPush(y * w + (w - 1));
    }
    while (head < tail) {
        const i = q[head++];
        const x = i % w;
        const y = (i / w) | 0;
        if (x > 0) tryPush(i - 1);
        if (x < w - 1) tryPush(i + 1);
        if (y > 0) tryPush(i - w);
        if (y < h - 1) tryPush(i + w);
    }
    return bg;
}

function applyFeatherAlpha(data, bg, w, h, featherPx = 2) {
    const n = w * h;
    const dist = new Float32Array(n);
    dist.fill(1e9);
    const q = new Int32Array(n);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < n; i++) {
        if (!bg[i]) {
            dist[i] = 0;
            q[tail++] = i;
        }
    }
    if (tail === 0) {
        for (let i = 0; i < n; i++) data[i * 4 + 3] = 0;
        return;
    }
    while (head < tail) {
        const i = q[head++];
        const d = dist[i];
        const x = i % w;
        const y = (i / w) | 0;
        const neigh = [];
        if (x > 0) neigh.push(i - 1);
        if (x < w - 1) neigh.push(i + 1);
        if (y > 0) neigh.push(i - w);
        if (y < h - 1) neigh.push(i + w);
        for (const j of neigh) {
            const nd = d + 1;
            if (nd < dist[j]) {
                dist[j] = nd;
                q[tail++] = j;
            }
        }
    }
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        if (!bg[i]) {
            data[o + 3] = 255;
            continue;
        }
        const d = dist[i];
        if (d >= featherPx + 0.5) data[o + 3] = 0;
        else {
            const t = Math.max(0, Math.min(1, d / (featherPx + 0.01)));
            data[o + 3] = Math.round((1 - t) * 255);
        }
    }
}

const dir = path.resolve('public/images/pets');
const files = ['soulstone1.webp', 'soulstone2.webp', 'soulstone3.webp', 'soulstone4.webp', 'soulstone5.webp'];

for (const f of files) {
    const srcPath = path.join(dir, f);
    const pngPath = path.join(dir, f.replace(/\.webp$/i, '.png'));
    const altWebp = path.join(dir, f.replace(/\.webp$/i, '.tr.webp'));

    const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const rgba = Buffer.from(data);

    // Only flood if still opaque black bg
    let preTrans = 0;
    for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] < 10) preTrans++;
    if (preTrans < w * h * 0.05) {
        const bg = floodBackgroundMask(rgba, w, h);
        applyFeatherAlpha(rgba, bg, w, h, 2);
    }
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        if (rgba[o + 3] === 0) {
            rgba[o] = 0;
            rgba[o + 1] = 0;
            rgba[o + 2] = 0;
        }
    }

    await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
        .png({ compressionLevel: 9, force: true })
        .toFile(pngPath);

    // Write alternate unlocked webp name for later rename when server releases lock
    await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
        .webp({ quality: 85, alphaQuality: 100, effort: 4 })
        .toFile(altWebp);

    const m = await sharp(pngPath).metadata();
    console.log(path.basename(pngPath), 'hasAlpha', m.hasAlpha, '+', path.basename(altWebp));
    if (!m.hasAlpha) throw new Error(`png alpha missing: ${pngPath}`);
}

console.log('OK');
