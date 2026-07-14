import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const THRESH = 28;

function isNearBlack(r, g, b) {
    return Math.max(r, g, b) <= THRESH;
}

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
        if (d >= featherPx + 0.5) {
            data[o + 3] = 0;
        } else {
            const t = Math.max(0, Math.min(1, d / (featherPx + 0.01)));
            data[o + 3] = Math.round((1 - t) * 255);
        }
    }
}

async function processFile(filePath) {
    const base = filePath.replace(/\.(webp|png)$/i, '');
    const pngPath = `${base}.png`;
    const webpPath = `${base}.webp`;

    // Prefer Cursor asset masters if present (still black-bg originals from generation)
    const slug = path.basename(base);
    const assetMaster = path.join(
        'C:/Users/OwnerPC/.cursor/projects/c-project-SUDAMR/assets',
        `${slug}.png`,
    );
    let source = filePath;
    if (fs.existsSync(assetMaster)) source = assetMaster;
    else if (fs.existsSync(pngPath)) source = pngPath;
    else source = webpPath;

    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const rgba = Buffer.from(data);

    let preTrans = 0;
    for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] < 10) preTrans++;

    if (preTrans < w * h * 0.05) {
        const bg = floodBackgroundMask(rgba, w, h);
        applyFeatherAlpha(rgba, bg, w, h, 2);
    }

    let zeroA = 0;
    let fullA = 0;
    for (let i = 0; i < w * h; i++) {
        const al = rgba[i * 4 + 3];
        if (al === 0) zeroA++;
        if (al === 255) fullA++;
    }

    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        if (rgba[o + 3] === 0) {
            rgba[o] = 0;
            rgba[o + 1] = 0;
            rgba[o + 2] = 0;
        }
    }

    // Resize to 256 if masters are larger (assets are often 1024+)
    const pipeline = sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    const outBuf = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const outRgba = Buffer.from(outBuf.data);
    const ow = outBuf.info.width;
    const oh = outBuf.info.height;

    await sharp(outRgba, { raw: { width: ow, height: oh, channels: 4 } })
        .png({ compressionLevel: 9, force: true })
        .toFile(pngPath);

    await sharp(outRgba, { raw: { width: ow, height: oh, channels: 4 } })
        .webp({ quality: 85, alphaQuality: 100, effort: 4 })
        .toFile(webpPath);

    const metaP = await sharp(pngPath).metadata();
    const metaW = await sharp(webpPath).metadata();
    console.log(
        path.basename(base),
        'src',
        path.basename(source),
        'a0',
        zeroA,
        'a255',
        fullA,
        '-> png',
        metaP.hasAlpha,
        'webp',
        metaW.hasAlpha,
        'corner',
        outRgba[3],
    );
    if (!metaP.hasAlpha || !metaW.hasAlpha) {
        throw new Error(`alpha lost for ${base}`);
    }
}

const files = [];
const guildDir = 'c:/project/SUDAMR/public/images/guild/ui';
for (const name of fs.readdirSync(guildDir)) {
    if (name.startsWith('_')) continue;
    if (name.endsWith('.webp')) files.push(path.join(guildDir, name));
}
const qmSlugs = [
    'quest',
    'trade',
    'enhance',
    'store',
    'bag',
    'gibo',
    'pet',
    'ranking',
    'news',
    'encyclopedia',
];
for (const s of qmSlugs) {
    files.push(path.join('c:/project/SUDAMR/public/images/quickmenu', `${s}.webp`));
}

const seen = new Set();
for (const f of files) {
    const key = f.replace(/\.webp$/i, '');
    if (seen.has(key)) continue;
    seen.add(key);
    await processFile(f);
}
console.log('done', seen.size);
