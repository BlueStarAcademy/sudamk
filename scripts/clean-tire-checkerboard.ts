/**
 * Remove baked Photoshop-style transparency checkerboards from league tire marks.
 * Flood-fills from image borders so interior metallic whites / mint plates are preserved.
 *
 * Run: npx tsx scripts/clean-tire-checkerboard.ts
 *      npx tsx scripts/clean-tire-checkerboard.ts --from-backup
 *      npx tsx scripts/clean-tire-checkerboard.ts --decontam
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images/tire');
const FROM_BACKUP = process.argv.includes('--from-backup');
const FRINGE_ONLY = process.argv.includes('--fringe');
const DECONTAM_ONLY = process.argv.includes('--decontam');

/**
 * Plate key (checker ~236 / ~254):
 * - Hard flood: neutral + L>=185
 * - Soft fringe: adjacent to transparent, neutral + L>=170, short iterations only
 * - Residual white pass: L>=230 only (never flood L~160 interiors through silver rims)
 * - Edge decontamination: un-premultiply against plate white + hard/soft rim cleanup
 */
const FLOOD_MAX_CHROMA = 20;
const FLOOD_MIN_LUMA = 185;
const FRINGE_MAX_CHROMA = 24;
const FRINGE_MIN_LUMA = 170;
const RESIDUAL_WHITE_MIN_LUMA = 230;
const RESIDUAL_WHITE_MAX_CHROMA = 16;

const MATTE_R = 248;
const MATTE_G = 248;
const MATTE_B = 248;

type RGBA = { r: number; g: number; b: number; a: number };

function get(data: Buffer, w: number, x: number, y: number): RGBA {
  const i = (y * w + x) * 4;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! };
}

function setClear(data: Buffer, i: number) {
  data[i] = 0;
  data[i + 1] = 0;
  data[i + 2] = 0;
  data[i + 3] = 0;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function chromaOf(r: number, g: number, b: number): number {
  return Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
}

function isPlateBg(p: RGBA, minLuma: number, maxCh: number): boolean {
  if (p.a < 8) return true;
  if (chromaOf(p.r, p.g, p.b) > maxCh) return false;
  return luma(p.r, p.g, p.b) >= minLuma;
}

function countTransparent(data: Buffer): number {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 16) n++;
  return n;
}

/** Opaque near-white within 2px of transparent (avg>=220, pair chrom<=18). */
export function countNearWhiteFringe(data: Buffer, w: number, h: number): number {
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = get(data, w, x, y);
      if (p.a < 16) continue;
      const avg = (p.r + p.g + p.b) / 3;
      if (avg < 220) continue;
      if (Math.abs(p.r - p.g) > 18 || Math.abs(p.g - p.b) > 18 || Math.abs(p.r - p.b) > 18) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (data[(ny * w + nx) * 4 + 3]! < 16) {
            near = true;
            break;
          }
        }
      }
      if (near) n++;
    }
  }
  return n;
}

export function countOutsideLightNeutral(data: Buffer, w: number, h: number): number {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const R = (Math.min(w, h) / 2) * Math.sqrt(0.7);
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - cx, y - cy) <= R) continue;
      const p = get(data, w, x, y);
      if (p.a < 16) continue;
      if (chromaOf(p.r, p.g, p.b) > 28) continue;
      if (luma(p.r, p.g, p.b) < 160) continue;
      n++;
    }
  }
  return n;
}

function touchesTransparent4(data: Buffer, w: number, h: number, x: number, y: number): boolean {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return true;
    if (data[(ny * w + nx) * 4 + 3]! < 16) return true;
  }
  return false;
}

/**
 * Color decontamination on silhouette edge:
 * 1) Un-premultiply against plate matte white for edge-touching pixels
 * 2) Hard-clear near-neutral bright opaque rim
 * 3) Fade soft near-neutral halo alphas
 * 4) Zero RGB where a<16
 */
export function decontaminateEdgeMatte(data: Buffer, w: number, h: number): {
  hardRimCleared: number;
  softFaded: number;
  unpremultiplied: number;
} {
  let hardRimCleared = 0;
  let softFaded = 0;
  let unpremultiplied = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3]!;
      if (a <= 0) continue;
      if (!touchesTransparent4(data, w, h, x, y)) continue;

      const aNorm = a / 255;
      if (aNorm > 0.02) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        data[i] = clampByte((r - MATTE_R * (1 - aNorm)) / aNorm);
        data[i + 1] = clampByte((g - MATTE_G * (1 - aNorm)) / aNorm);
        data[i + 2] = clampByte((b - MATTE_B * (1 - aNorm)) / aNorm);
        unpremultiplied++;
      }

      const r2 = data[i]!;
      const g2 = data[i + 1]!;
      const b2 = data[i + 2]!;
      const C = chromaOf(r2, g2, b2);
      const L = luma(r2, g2, b2);
      const a2 = data[i + 3]!;

      // Hard white rim only — leave colored/silver ornaments (higher chroma) alone
      if (C <= 25 && L >= 210 && a2 >= 200) {
        setClear(data, i);
        hardRimCleared++;
        continue;
      }

      // Soft halo fade
      if (C <= 25 && L >= 190 && a2 >= 40 && a2 <= 220) {
        data[i + 3] = clampByte(a2 * 0.35);
        softFaded++;
      }
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 16) setClear(data, i);
  }

  return { hardRimCleared, softFaded, unpremultiplied };
}

function detectChecker(data: Buffer, w: number, h: number): { cell: number; tones: number[] } {
  const hist = new Map<number, number>();
  const vals: number[] = [];
  for (let x = 0; x < Math.min(w, 400); x++) {
    const p = get(data, w, x, 0);
    if (p.a < 200 || chromaOf(p.r, p.g, p.b) > 20) {
      vals.push(-1);
      continue;
    }
    const L = Math.round(luma(p.r, p.g, p.b) / 4) * 4;
    vals.push(L);
    hist.set(L, (hist.get(L) || 0) + 1);
  }
  const runs: number[] = [];
  let run = 1;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] === vals[i - 1] && vals[i]! >= 0) run++;
    else {
      if (vals[i - 1]! >= 0) runs.push(run);
      run = 1;
    }
  }
  if (vals.length && vals[vals.length - 1]! >= 0) runs.push(run);
  const freq = new Map<number, number>();
  for (const r of runs) {
    if (r < 4 || r > 48) continue;
    freq.set(r, (freq.get(r) || 0) + 1);
  }
  const cell = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 20;
  const tones = [...hist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([t]) => t);
  return { cell, tones };
}

function floodClearBg(data: Buffer, w: number, h: number): number {
  const visited = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  const trySeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    if (!isPlateBg(get(data, w, x, y), FLOOD_MIN_LUMA, FLOOD_MAX_CHROMA)) return;
    visited[idx] = 1;
    qx[qt] = x;
    qy[qt] = y;
    qt++;
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  let cleared = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (qh < qt) {
    const x = qx[qh]!;
    const y = qy[qh]!;
    qh++;
    const i = (y * w + x) * 4;
    if (data[i + 3]! >= 8) {
      setClear(data, i);
      cleared++;
    }

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (visited[nidx]) continue;
      const p = get(data, w, nx, ny);
      if (!isPlateBg(p, FLOOD_MIN_LUMA, FLOOD_MAX_CHROMA)) continue;
      visited[nidx] = 1;
      qx[qt] = nx;
      qy[qt] = ny;
      qt++;
    }
  }

  return cleared;
}

function clearSoftFringe(data: Buffer, w: number, h: number): number {
  let cleared = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;

  for (let iter = 0; iter < 2; iter++) {
    const batch: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3]! < 8) continue;
        const p = get(data, w, x, y);
        if (!isPlateBg(p, FRINGE_MIN_LUMA, FRINGE_MAX_CHROMA)) continue;
        let touchesT = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            touchesT = true;
            break;
          }
          if (data[(ny * w + nx) * 4 + 3]! < 16) {
            touchesT = true;
            break;
          }
        }
        if (touchesT) batch.push(i);
      }
    }
    if (!batch.length) break;
    for (const i of batch) {
      setClear(data, i);
      cleared++;
    }
  }
  return cleared;
}

function clearResidualWhiteConnected(data: Buffer, w: number, h: number): number {
  const visited = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! >= 16) continue;
      visited[y * w + x] = 1;
      qx[qt] = x;
      qy[qt] = y;
      qt++;
    }
  }

  let cleared = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (qh < qt) {
    const x = qx[qh]!;
    const y = qy[qh]!;
    qh++;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (visited[nidx]) continue;
      const p = get(data, w, nx, ny);
      if (p.a < 16) {
        visited[nidx] = 1;
        qx[qt] = nx;
        qy[qt] = ny;
        qt++;
        continue;
      }
      if (isPlateBg(p, RESIDUAL_WHITE_MIN_LUMA, RESIDUAL_WHITE_MAX_CHROMA)) {
        visited[nidx] = 1;
        setClear(data, nidx * 4);
        cleared++;
        qx[qt] = nx;
        qy[qt] = ny;
        qt++;
        continue;
      }
      visited[nidx] = 1;
    }
  }
  return cleared;
}

function zeroTransparentRgb(data: Buffer): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 16) {
      if (data[i] || data[i + 1] || data[i + 2] || data[i + 3]) {
        setClear(data, i);
        n++;
      }
    }
  }
  return n;
}

async function resolveBackupDir(): Promise<string> {
  const preferred = path.join(ROOT, '_tire_bg_backup_20260714');
  try {
    await fs.access(preferred);
    return preferred;
  } catch {
    /* fall through */
  }
  const entries = await fs.readdir(ROOT);
  const existing = entries.filter((n) => n.startsWith('_tire_bg_backup_')).sort().reverse();
  if (existing[0]) return path.join(ROOT, existing[0]!);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return path.join(ROOT, `_tire_bg_backup_${date}`);
}

async function ensureBackup(backupDir: string, relName: string, srcPath: string) {
  await fs.mkdir(backupDir, { recursive: true });
  const dest = path.join(backupDir, relName);
  try {
    await fs.access(dest);
  } catch {
    await fs.copyFile(srcPath, dest);
  }
}

function cornersHaveOpaqueChecker(data: Buffer, w: number, h: number): boolean {
  const corners = [
    get(data, w, 0, 0),
    get(data, w, w - 1, 0),
    get(data, w, 0, h - 1),
    get(data, w, w - 1, h - 1),
  ];
  return corners.filter((p) => p.a >= 200 && isPlateBg(p, FLOOD_MIN_LUMA, FLOOD_MAX_CHROMA)).length >= 2;
}

async function writeOut(filePath: string, out: Buffer, w: number, h: number) {
  const ext = path.extname(filePath).toLowerCase();
  const tmp = filePath + '.tmp';
  if (ext === '.webp') {
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .webp({
        // lossless avoids nearLossless reconstituting RGB under transparent
        lossless: true,
        quality: 100,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: false,
      })
      .toFile(tmp);
  } else if (ext === '.png') {
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png({ compressionLevel: 9, effort: 10, force: true })
      .toFile(tmp);
  } else {
    throw new Error(`unsupported ext ${ext}`);
  }
  await fs.rename(tmp, filePath);
}

async function processDecontam(filePath: string) {
  const name = path.basename(filePath);
  const input = await fs.readFile(filePath);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (info.channels !== 4) {
    console.log(`SKIP ${name} (not-rgba)`);
    return;
  }

  const corners = [
    get(data, w, 0, 0),
    get(data, w, w - 1, 0),
    get(data, w, 0, h - 1),
    get(data, w, w - 1, h - 1),
  ];
  const fringeBefore = countNearWhiteFringe(data, w, h);
  const out = Buffer.from(data);
  const stats = decontaminateEdgeMatte(out, w, h);
  zeroTransparentRgb(out);
  const fringeAfter = countNearWhiteFringe(out, w, h);
  await writeOut(filePath, out, w, h);

  console.log(
    `DECONTAM ${name} corners=${corners.map((c) => `${c.r},${c.g},${c.b},${c.a}`).join('|')} ` +
      `hardRim=${stats.hardRimCleared} softFade=${stats.softFaded} unpremul=${stats.unpremultiplied} ` +
      `fringe ${fringeBefore}->${fringeAfter}`,
  );
}

async function processFile(filePath: string, backupDir: string) {
  const name = path.basename(filePath);
  let readPath = filePath;
  if (FROM_BACKUP) {
    const bak = path.join(backupDir, name);
    try {
      await fs.access(bak);
      readPath = bak;
    } catch {
      /* use live */
    }
  }

  const input = await fs.readFile(readPath);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (info.channels !== 4) {
    return { name, skipped: true as const, reason: 'not-rgba' };
  }

  const isTire = /^tire\d+\.(webp|png)$/i.test(name);
  const hasChecker = cornersHaveOpaqueChecker(data, w, h);
  const residualBefore = countOutsideLightNeutral(data, w, h);

  if (!isTire && !hasChecker) {
    console.log(`SKIP ${name} (already-transparent-corners)`);
    return { name, skipped: true as const, reason: 'already-transparent-corners' };
  }
  if (FRINGE_ONLY && !isTire) {
    console.log(`SKIP ${name} (fringe-skip-non-tire)`);
    return { name, skipped: true as const, reason: 'fringe-skip-non-tire' };
  }

  await ensureBackup(backupDir, name, FROM_BACKUP ? readPath : filePath);

  const out = Buffer.from(data);
  const checker = detectChecker(out, w, h);
  let cleared = 0;
  if (!FRINGE_ONLY && (hasChecker || FROM_BACKUP)) {
    cleared += floodClearBg(out, w, h);
  }
  if (!DECONTAM_ONLY) {
    cleared += clearSoftFringe(out, w, h);
    cleared += clearResidualWhiteConnected(out, w, h);
    cleared += clearSoftFringe(out, w, h);
  }
  const de = decontaminateEdgeMatte(out, w, h);
  zeroTransparentRgb(out);

  const residualAfter = countOutsideLightNeutral(out, w, h);
  const afterPct = (countTransparent(out) / (w * h)) * 100;
  await writeOut(filePath, out, w, h);

  console.log(
    `OK   ${name} cell~${checker.cell} tones=${checker.tones.join('/')} ` +
      `cleared~${cleared} hardRim=${de.hardRimCleared} outsideLight ${residualBefore}->${residualAfter} a%=${afterPct.toFixed(2)}`,
  );
  return { name, skipped: false as const, residualBefore, residualAfter, cleared };
}

async function listTargets(): Promise<string[]> {
  const entries = await fs.readdir(ROOT);
  const files = entries.filter((n) => {
    if (DECONTAM_ONLY || FROM_BACKUP || FRINGE_ONLY) return /^tire\d+\.(webp|png)$/i.test(n);
    if (/^tire\d+\.(webp|png)$/i.test(n)) return true;
    if (/^(Ring|Round)\d+\.(webp|png)$/i.test(n)) return true;
    return false;
  });
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return files.map((n) => path.join(ROOT, n));
}

async function main() {
  const backupDir = await resolveBackupDir();
  const mode = DECONTAM_ONLY
    ? 'decontam-only'
    : FROM_BACKUP
      ? 'from-backup'
      : FRINGE_ONLY
        ? 'fringe-only'
        : 'full';
  console.log('Mode:', mode);
  console.log('Backup dir:', backupDir);

  const targets = await listTargets();

  if (DECONTAM_ONLY) {
    for (const f of targets) await processDecontam(f);
    console.log('\nDone decontam.', targets.length, 'files');
    return;
  }

  console.log(
    `Params: flood L>=${FLOOD_MIN_LUMA} C<=${FLOOD_MAX_CHROMA}; fringe L>=${FRINGE_MIN_LUMA}; residualWhite L>=${RESIDUAL_WHITE_MIN_LUMA}`,
  );
  let processed = 0;
  let skipped = 0;
  for (const f of targets) {
    const r = await processFile(f, backupDir);
    if (r.skipped) skipped++;
    else processed++;
  }
  console.log('\nDone. processed=', processed, 'skipped=', skipped);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
