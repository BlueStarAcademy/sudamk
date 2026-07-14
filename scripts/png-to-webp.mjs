/**
 * Convert PNG files from a staging folder to WebP at target paths.
 *
 * Usage:
 *   node scripts/png-to-webp.mjs <stagingDir> [targetDir]
 *
 * - stagingDir: folder containing .png files (required)
 * - targetDir:  output folder (defaults to stagingDir; mirrors relative paths)
 *
 * Options:
 *   --quality=N   WebP quality 1-100 (default 90)
 *   --dry-run     List conversions without writing
 *
 * Requires sharp (already a project devDependency).
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = { quality: 90, dryRun: false, positional: [] };
  for (const a of argv) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--quality=')) {
      const q = Number(a.slice('--quality='.length));
      if (!Number.isFinite(q) || q < 1 || q > 100) {
        throw new Error('Invalid --quality: expected 1-100');
      }
      opts.quality = q;
    } else if (a.startsWith('-')) {
      throw new Error('Unknown option: ' + a);
    } else {
      opts.positional.push(a);
    }
  }
  return opts;
}

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default ?? mod;
  } catch {
    try {
      const sharpPath = pathToFileURL(
        path.join(ROOT, 'node_modules', 'sharp', 'lib', 'index.js'),
      ).href;
      const mod = await import(sharpPath);
      return mod.default ?? mod;
    } catch (err) {
      console.error('sharp is not available. Install with:');
      console.error('  npm install --save-dev sharp');
      console.error(String(err && err.message ? err.message : err));
      process.exit(1);
    }
  }
}

async function walkPngs(dir, base, out) {
  if (!base) base = dir;
  if (!out) out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await walkPngs(full, base, out);
    } else if (ent.isFile() && /\.png$/i.test(ent.name)) {
      out.push({ full: full, rel: path.relative(base, full) });
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.positional.length < 1) {
    console.error('Usage: node scripts/png-to-webp.mjs <stagingDir> [targetDir] [--quality=90] [--dry-run]');
    process.exit(1);
  }

  const stagingDir = path.resolve(opts.positional[0]);
  const targetDir = path.resolve(opts.positional[1] || stagingDir);

  try {
    await fs.access(stagingDir);
  } catch {
    console.error('Staging directory not found:', stagingDir);
    process.exit(1);
  }

  const sharp = await loadSharp();
  const pngs = await walkPngs(stagingDir);

  if (pngs.length === 0) {
    console.log('No PNG files found in', stagingDir);
    return;
  }

  console.log('Converting ' + pngs.length + ' PNG(s)');
  console.log('  staging: ' + stagingDir);
  console.log('  target:  ' + targetDir);
  console.log('  quality: ' + opts.quality + (opts.dryRun ? ' (dry-run)' : ''));

  let ok = 0;
  for (const item of pngs) {
    const full = item.full;
    const rel = item.rel;
    const outRel = rel.replace(/\.png$/i, '.webp');
    const outPath = path.join(targetDir, outRel);

    if (opts.dryRun) {
      console.log('  would: ' + rel + ' -> ' + outRel);
      ok++;
      continue;
    }

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await sharp(full)
      .ensureAlpha()
      .webp({ quality: opts.quality, alphaQuality: 100, effort: 6 })
      .toFile(outPath);

    const st = await fs.stat(outPath);
    console.log('  ok: ' + rel + ' -> ' + outRel + ' (' + Math.round(st.size / 1024) + ' KB)');
    ok++;
  }

  console.log('Done: ' + ok + '/' + pngs.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
