// Robustness suite for the Origo perceptual hash (docs/origo/ARCHITECTURE.md section 11).
// Run after building the SDK: `pnpm --filter @origo/sdk robustness`.
// Writes docs/origo/ROBUSTNESS.md and packages/sdk/scripts/robustness-results.json.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { phash, phashVariants, hamming, hashToHex } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const photosDir = path.resolve(here, "../fixtures/photos");
const reportPath = path.resolve(here, "../../../docs/origo/ROBUSTNESS.md");
const jsonPath = path.resolve(here, "robustness-results.json");

const MATCH = 7;
const LOW = 11;

async function decode(buf) {
  const { data, info } = await sharp(buf).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

function textSvg(width, height, text, y, size, fill = "white") {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="50%" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="bold" ` +
      `fill="${fill}" stroke="black" stroke-width="${Math.max(2, size / 14)}" text-anchor="middle">${text}</text></svg>`,
  );
}

/** Each transform returns { buf, crop? } where crop is the manual crop a verifier would draw. */
const transforms = {
  "jpeg-q90": async (b) => ({ buf: await sharp(b).jpeg({ quality: 90 }).toBuffer() }),
  "jpeg-q70": async (b) => ({ buf: await sharp(b).jpeg({ quality: 70 }).toBuffer() }),
  "jpeg-q50": async (b) => ({ buf: await sharp(b).jpeg({ quality: 50 }).toBuffer() }),
  "jpeg-q30": async (b) => ({ buf: await sharp(b).jpeg({ quality: 30 }).toBuffer() }),
  "resize-50": async (b, m) => ({ buf: await sharp(b).resize(Math.round(m.width / 2)).jpeg({ quality: 85 }).toBuffer() }),
  "resize-25": async (b, m) => ({ buf: await sharp(b).resize(Math.round(m.width / 4)).jpeg({ quality: 85 }).toBuffer() }),
  "whatsapp-like": async (b) => ({ buf: await sharp(b).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer() }),
  "whatsapp-twice": async (b) => {
    const once = await sharp(b).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer();
    return { buf: await sharp(once).resize(800, 800, { fit: "inside" }).jpeg({ quality: 50 }).toBuffer() };
  },
  "border-black-60": async (b) => ({
    buf: await sharp(b).extend({ top: 60, bottom: 60, left: 60, right: 60, background: "#000" }).jpeg({ quality: 85 }).toBuffer(),
  }),
  "caption-bars": async (b, m) => {
    const top = Math.round(m.height * 0.15);
    const bottom = Math.round(m.height * 0.1);
    const ext = await sharp(b).extend({ top, bottom, left: 0, right: 0, background: "#fff" }).toBuffer();
    const h = m.height + top + bottom;
    const svg = textSvg(m.width, h, "BANJIR HARI INI", Math.round(top * 0.7), Math.round(top * 0.45), "black");
    return { buf: await sharp(ext).composite([{ input: svg }]).jpeg({ quality: 80 }).toBuffer() };
  },
  "text-overlay": async (b, m) => {
    const svg = textSvg(m.width, m.height, "BANJIR HARI INI", Math.round(m.height * 0.18), Math.round(m.height * 0.1));
    return { buf: await sharp(b).composite([{ input: svg }]).jpeg({ quality: 80 }).toBuffer() };
  },
  "chat-screenshot-auto": async (b, m) => chatScreenshot(b, m, false),
  "chat-screenshot-manual-crop": async (b, m) => chatScreenshot(b, m, true),
  "brightness+10": async (b) => ({ buf: await sharp(b).modulate({ brightness: 1.1 }).jpeg({ quality: 85 }).toBuffer() }),
  "brightness-10": async (b) => ({ buf: await sharp(b).modulate({ brightness: 0.9 }).jpeg({ quality: 85 }).toBuffer() }),
  mirror: async (b) => ({ buf: await sharp(b).flop().jpeg({ quality: 85 }).toBuffer() }),
  "rotate-90": async (b) => ({ buf: await sharp(b).rotate(90).jpeg({ quality: 85 }).toBuffer() }),
  "crop-center-5": async (b, m) => ({ buf: await centerCrop(b, m, 0.05) }),
  "crop-center-10": async (b, m) => ({ buf: await centerCrop(b, m, 0.1) }),
  "crop-center-20": async (b, m) => ({ buf: await centerCrop(b, m, 0.2) }),
  "crop-one-side-10": async (b, m) => ({
    buf: await sharp(b).extract({ left: 0, top: 0, width: Math.round(m.width * 0.9), height: m.height }).jpeg({ quality: 85 }).toBuffer(),
  }),
};

async function centerCrop(b, m, frac) {
  const dx = Math.round((m.width * frac) / 2);
  const dy = Math.round((m.height * frac) / 2);
  return sharp(b).extract({ left: dx, top: dy, width: m.width - 2 * dx, height: m.height - 2 * dy }).jpeg({ quality: 85 }).toBuffer();
}

/** A phone-like chat screenshot: dark UI with non-uniform header and input bar, photo in a bubble. */
async function chatScreenshot(b, m, manualCrop) {
  const W = 1170;
  const H = 2532;
  const photoW = 900;
  const photoH = Math.round((m.height / m.width) * photoW);
  const left = 180;
  const topY = Math.round((H - photoH) / 2);
  const photo = await sharp(b).resize(photoW, photoH).toBuffer();
  const ui = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${W}" height="${H}" fill="#0b141a"/>` +
      `<rect width="${W}" height="260" fill="#202c33"/>` +
      `<circle cx="110" cy="170" r="55" fill="#6b7c85"/>` +
      `<text x="200" y="160" font-family="Arial" font-size="48" fill="#e9edef">Grup Warga RT 05</text>` +
      `<text x="200" y="215" font-family="Arial" font-size="34" fill="#8696a0">Andi, Budi, Citra, +42</text>` +
      `<text x="60" y="70" font-family="Arial" font-size="40" fill="#e9edef">10:42</text>` +
      `<rect x="${left - 12}" y="${topY - 12}" width="${photoW + 24}" height="${photoH + 90}" rx="24" fill="#005c4b"/>` +
      `<text x="${left}" y="${topY + photoH + 60}" font-family="Arial" font-size="36" fill="#e9edef">Banjir hari ini, hati-hati!</text>` +
      `<rect y="${H - 200}" width="${W}" height="200" fill="#202c33"/>` +
      `<rect x="40" y="${H - 160}" width="${W - 200}" height="100" rx="50" fill="#2a3942"/>` +
      `</svg>`,
  );
  const buf = await sharp(ui).composite([{ input: photo, left, top: topY }]).jpeg({ quality: 85 }).toBuffer();
  return manualCrop ? { buf, crop: { x: left, y: topY, width: photoW, height: photoH } } : { buf };
}

function stats(values) {
  const v = [...values].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))];
  return {
    min: v[0],
    median: q(0.5),
    p90: q(0.9),
    max: v[v.length - 1],
    within7: v.filter((x) => x <= MATCH).length / v.length,
    within11: v.filter((x) => x <= LOW).length / v.length,
  };
}

const minOver = (variants, target) => Math.min(...variants.map((h) => hamming(h, target)));
const pct = (x) => `${Math.round(x * 100)}%`;

const files = (await readdir(photosDir)).filter((f) => f.endsWith(".jpg")).sort();
const originals = [];
for (const f of files) {
  const buf = await readFile(path.join(photosDir, f));
  const img = await decode(buf);
  originals.push({ file: f, buf, meta: { width: img.width, height: img.height }, hash: phash(img) });
}

const perTransform = {};
for (const [name, fn] of Object.entries(transforms)) {
  const distances = [];
  for (const o of originals) {
    const { buf, crop } = await fn(o.buf, o.meta);
    const img = await decode(buf);
    const variants = phashVariants(img, crop ? { crop } : {});
    distances.push(minOver(variants, o.hash));
  }
  perTransform[name] = { distances, ...stats(distances) };
  process.stdout.write(`${name}: ${JSON.stringify(stats(distances))}\n`);
}

// False positives: every query (all 8 variants) against every other registered original.
const pairs = [];
for (const q of originals) {
  const qv = phashVariants(await decode(q.buf));
  for (const r of originals) {
    if (q === r) continue;
    pairs.push({ query: q.file, registered: r.file, distance: minOver(qv, r.hash) });
  }
}
const pairStats = stats(pairs.map((p) => p.distance));
const closest = [...pairs].sort((a, b) => a.distance - b.distance).slice(0, 6);

await writeFile(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      fixtures: originals.map((o) => ({ file: o.file, hash: hashToHex(o.hash), ...o.meta })),
      perTransform,
      falsePositives: { ...pairStats, closest },
    },
    null,
    2,
  ),
);

const rows = Object.entries(perTransform)
  .map(([n, s]) => `| ${n} | ${s.min} | ${s.median} | ${s.p90} | ${s.max} | ${pct(s.within7)} | ${pct(s.within11)} |`)
  .join("\n");
const closestRows = closest.map((p) => `| \`${p.query}\` | \`${p.registered}\` | ${p.distance} |`).join("\n");

const md = `# Origo: Robustness Report

Generated by \`packages/sdk/scripts/robustness.mjs\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.

- Fixtures: ${originals.length} public-domain photos (\`packages/sdk/fixtures/ATTRIBUTION.md\`).
- Distance = minimum Hamming distance over the 8 orientation variants of the query, against the registered (variant 0) hash of the original. This is exactly what the Verify flow does.
- "Same photo" threshold: ${MATCH} bits (guaranteed by on-chain search at probe radius 1). Low-confidence threshold: ${LOW} bits (radius 2).

## Copies of the same photo

| Transformation | Min | Median | P90 | Max | Found at <= ${MATCH} | Found at <= ${LOW} |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## Different photos (false positives)

${pairs.length} ordered pairs of different photos, each query using all 8 variants.

| Min | Median | P90 | Max | Pairs at <= ${MATCH} | Pairs at <= ${LOW} |
| --- | --- | --- | --- | --- | --- |
| ${pairStats.min} | ${pairStats.median} | ${pairStats.p90} | ${pairStats.max} | ${pct(pairStats.within7)} | ${pct(pairStats.within11)} |

Closest different pairs:

| Query | Registered | Distance |
| --- | --- | --- |
${closestRows}
`;
await writeFile(reportPath, md);
process.stdout.write(`false positives: ${JSON.stringify(pairStats)}\nwrote ${reportPath}\n`);
