// Experiment: do "tile" hashes (sub-window hashes registered alongside the full hash) make crops findable,
// and what do they cost in false positives? See docs/origo/GAPS.md G24.
// Run after building the SDK: `node packages/sdk/scripts/tiles-experiment.mjs`.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { phash, phashVariants, hamming } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const photosDir = path.resolve(here, "../fixtures/photos");

async function decode(buf) {
  const { data, info } = await sharp(buf).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

/** Windows as fractions: scale sx, sy and positions at start, middle, end of the free range. */
function windows(scales) {
  const out = [];
  for (const [sx, sy] of scales) {
    const xs = sx === 1 ? [0] : [0, (1 - sx) / 2, 1 - sx];
    const ys = sy === 1 ? [0] : [0, (1 - sy) / 2, 1 - sy];
    for (const fy of ys) for (const fx of xs) out.push({ fx, fy, sx, sy });
  }
  return out;
}

const tileSets = {
  none: [],
  "S1: 0.9 and 0.8 square (18)": windows([[0.9, 0.9], [0.8, 0.8]]),
  "S2: S1 + one-axis 0.9/0.8 (30)": windows([[0.9, 0.9], [0.8, 0.8], [0.9, 1], [1, 0.9], [0.8, 1], [1, 0.8]]),
  "S3: S2 + 0.7 square (39)": windows([[0.9, 0.9], [0.8, 0.8], [0.9, 1], [1, 0.9], [0.8, 1], [1, 0.8], [0.7, 0.7]]),
  "S4: all of 1/0.9/0.8 per axis (48)": windows([
    [0.9, 0.9], [0.8, 0.8], [0.9, 1], [1, 0.9], [0.8, 1], [1, 0.8], [0.9, 0.8], [0.8, 0.9],
  ]),
};

function rectOf(w, img) {
  return {
    x: Math.round(w.fx * img.width),
    y: Math.round(w.fy * img.height),
    width: Math.round(w.sx * img.width),
    height: Math.round(w.sy * img.height),
  };
}

// Deterministic PRNG for random crops.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

async function cropJpeg(buf, img, fx, fy, sx, sy) {
  const r = rectOf({ fx, fy, sx, sy }, img);
  return sharp(buf).extract({ left: r.x, top: r.y, width: r.width, height: r.height }).jpeg({ quality: 80 }).toBuffer();
}

const queries = {
  "crop-center-10": (b, m) => cropJpeg(b, m, 0.05, 0.05, 0.9, 0.9),
  "crop-center-20": (b, m) => cropJpeg(b, m, 0.1, 0.1, 0.8, 0.8),
  "crop-center-30": (b, m) => cropJpeg(b, m, 0.15, 0.15, 0.7, 0.7),
  "crop-one-side-10": (b, m) => cropJpeg(b, m, 0, 0, 0.9, 1),
  "crop-corner-15": (b, m) => cropJpeg(b, m, 0.15, 0.15, 0.85, 0.85),
  "crop-random-75-95": (b, m) => {
    const sx = 0.75 + rand() * 0.2;
    const sy = 0.75 + rand() * 0.2;
    return cropJpeg(b, m, rand() * (1 - sx), rand() * (1 - sy), sx, sy);
  },
  "whatsapp-like (control)": (b) => sharp(b).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer(),
};

const files = (await readdir(photosDir)).filter((f) => f.endsWith(".jpg")).sort();
const photos = [];
for (const f of files) {
  const buf = await readFile(path.join(photosDir, f));
  const img = await decode(buf);
  const tiles = {};
  for (const [name, ws] of Object.entries(tileSets)) {
    tiles[name] = [phash(img), ...ws.map((w) => phash(img, { crop: rectOf(w, img), trim: false }))];
  }
  photos.push({ file: f, buf, img, tiles });
}

const minDist = (variants, hashes) => Math.min(...variants.flatMap((v) => hashes.map((h) => hamming(v, h))));
const pct = (a, n) => `${Math.round((100 * a) / n)}%`;
const results = {};

for (const [qname, qfn] of Object.entries(queries)) {
  seed = 42;
  const qv = [];
  for (const p of photos) qv.push(phashVariants(await decode(await qfn(p.buf, p.img))));
  for (const set of Object.keys(tileSets)) {
    const d = photos.map((p, i) => minDist(qv[i], p.tiles[set]));
    results[`${qname} | ${set}`] = { at7: pct(d.filter((x) => x <= 7).length, d.length), at11: pct(d.filter((x) => x <= 11).length, d.length) };
  }
}

// False positives: originals (all 8 variants) against every OTHER photo's full + tile hashes.
const fp = {};
for (const set of Object.keys(tileSets)) {
  const ds = [];
  for (const q of photos) {
    const qv = phashVariants(q.img);
    for (const r of photos) if (r !== q) ds.push(minDist(qv, r.tiles[set]));
  }
  ds.sort((a, b) => a - b);
  fp[set] = { min: ds[0], at7: pct(ds.filter((x) => x <= 7).length, ds.length), at11: pct(ds.filter((x) => x <= 11).length, ds.length) };
}

console.table(results);
console.table(fp);
await writeFile(path.resolve(here, "tiles-experiment-results.json"), JSON.stringify({ results, falsePositives: fp }, null, 2));
