/**
 * Punch a transparent circular hole in avatar frame PNGs (Round/Ring overlays)
 * and strip near-uniform outer backgrounds so the rim sits cleanly over faces.
 *
 * Usage:
 *   node scripts/process-frame-overlays.mjs <stagingDir> [--inner=0.72] [--out=...]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const stagingDir = process.argv[2];
if (!stagingDir) {
  console.error('Usage: node scripts/process-frame-overlays.mjs <stagingDir> [--inner=0.72]');
  process.exit(1);
}

const innerArg = process.argv.find((a) => a.startsWith('--inner='));
const innerRatio = innerArg ? Number(innerArg.split('=')[1]) : 0.72;
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outDir = outArg ? outArg.slice('--out='.length) : stagingDir;

fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(stagingDir).filter((f) => /\.(png|webp)$/i.test(f));

async function punchHole(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rOuter = Math.min(width, height) * 0.48;
  const rInner = Math.min(width, height) * (innerRatio / 2);
  // Soft edge for hole
  const feather = Math.max(2, Math.min(width, height) * 0.008);

  // Sample corner pixels to detect solid studio background
  const cornerSamples = [
    0,
    (width - 1) * channels,
    (height - 1) * width * channels,
    ((height - 1) * width + (width - 1)) * channels,
  ].map((i) => ({
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
  }));
  const avg = cornerSamples.reduce(
    (a, c) => ({ r: a.r + c.r / 4, g: a.g + c.g / 4, b: a.b + c.b / 4 }),
    { r: 0, g: 0, b: 0 }
  );
  const bgTol = 38;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clear center hole for avatar face
      if (dist < rInner - feather) {
        data[i + 3] = 0;
        continue;
      }
      if (dist < rInner + feather) {
        const t = (dist - (rInner - feather)) / (2 * feather);
        data[i + 3] = Math.round(data[i + 3] * Math.min(1, Math.max(0, t)));
      }

      // Outside the decorative ring: kill studio background
      if (dist > rOuter) {
        const dr = data[i] - avg.r;
        const dg = data[i + 1] - avg.g;
        const db = data[i + 2] - avg.b;
        if (dr * dr + dg * dg + db * db < bgTol * bgTol) {
          data[i + 3] = 0;
        }
      }
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);
}

for (const file of files) {
  const input = path.join(stagingDir, file);
  const output = path.join(outDir, file.replace(/\.(webp)$/i, '.png'));
  await punchHole(input, output);
  console.log('punched', file, '->', path.basename(output));
}

console.log('done', files.length, 'files');
