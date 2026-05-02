/**
 * Re-encodes public/sounds/*.mp3 for web: mono, 44.1kHz, ~96kbps CBR.
 * Requires devDependency ffmpeg-static (no system ffmpeg).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ffmpegPath from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const soundsDir = path.join(root, "public", "sounds");

if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    console.error("[reencode-sounds] ffmpeg-static binary not found.");
    process.exit(1);
}

const files = fs.readdirSync(soundsDir).filter((f) => f.toLowerCase().endsWith(".mp3"));
if (files.length === 0) {
    console.error("[reencode-sounds] No mp3 files in", soundsDir);
    process.exit(1);
}

let ok = 0;
for (const name of files) {
    const input = path.join(soundsDir, name);
    const tmp = path.join(soundsDir, `.${name}.tmp.mp3`);
    const args = [
        "-nostdin", "-y", "-i", input,
        "-vn", "-ac", "1", "-ar", "44100",
        "-c:a", "libmp3lame", "-b:a", "96k",
        tmp,
    ];
    const r = spawnSync(ffmpegPath, args, { encoding: "utf8" });
    if (r.status !== 0) {
        console.error(`[reencode-sounds] FAILED ${name}:`, r.stderr || r.stdout);
        try { fs.unlinkSync(tmp); } catch {}
        process.exit(1);
    }
    const inStat = fs.statSync(input);
    const outStat = fs.statSync(tmp);
    fs.renameSync(tmp, input);
    console.log(`[reencode-sounds] ${name}  ${(inStat.size / 1024).toFixed(1)} KB -> ${(outStat.size / 1024).toFixed(1)} KB`);
    ok++;
}
console.log(`[reencode-sounds] Done: ${ok} file(s).`);
