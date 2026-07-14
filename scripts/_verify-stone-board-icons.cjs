const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.join("public", "images", "equipments");
const FILES = [
  "Board4.webp", "Board5.webp",
  "Stone1.webp", "Stone2.webp", "Stone3.webp", "Stone4.webp",
  "Stone5.webp", "Stone6.webp", "Stone7.webp",
];

function sample(data, width, channels, x, y) {
  const i = (y * width + x) * channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

(async () => {
  let allOk = true;
  for (const file of FILES) {
    const fp = path.join(DIR, file);
    const base = file.replace(/\.webp$/, "");
    const isStone = base.startsWith("Stone");
    const issues = [];

    if (!fs.existsSync(fp)) {
      console.log(`FAIL ${file}: file missing`);
      allOk = false;
      continue;
    }

    const meta = await sharp(fp).metadata();
    const hasAlpha = meta.hasAlpha === true;
    if (!hasAlpha) issues.push("no alpha channel");

    const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels < 4) issues.push(`expected 4 channels, got ${channels}`);

    const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
    const cornerAlphas = corners.map(([x, y]) => sample(data, width, channels, x, y).a);
    const cornersTransparent = cornerAlphas.every((a) => a <= 10);
    if (!cornersTransparent) {
      issues.push(`corners not transparent (alpha=${cornerAlphas.join(",")})`);
    }

    const total = width * height;
    let transparent = 0;
    let nearBlack = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = sample(data, width, channels, x, y);
        if (p.a === 0) transparent++;
        if (p.r < 25 && p.g < 25 && p.b < 25 && p.a > 200) nearBlack++;
      }
    }
    const pctTransparent = ((100 * transparent) / total).toFixed(2);
    const pctNearBlack = ((100 * nearBlack) / total).toFixed(2);

    if (isStone && nearBlack === 0) {
      issues.push("opaque near-black % is 0 (expected stone body)");
    }

    const ok = issues.length === 0;
    if (!ok) allOk = false;
    const tag = ok ? "OK" : "FAIL";
    const detail = issues.length ? ` — ${issues.join("; ")}` : "";
    console.log(
      `${tag} ${file}: exists, alpha=${hasAlpha}, corners=${cornersTransparent ? "transparent" : "NOT"}, ` +
        `transparent=${pctTransparent}%, nearBlack=${pctNearBlack}%${detail}`
    );
  }
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  console.error("verify error:", e);
  process.exit(2);
});
