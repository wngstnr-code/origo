// Builds the landing page demo images from a CC0 fixture: the original, a copy that went through
// WhatsApp-like compression twice, and a 20% center crop. The landing hashes these live in the browser.
// Run from repo root: `node packages/sdk/scripts/make-landing-demo.mjs`.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../fixtures/photos/f06-andri-permana-banjir.jpg");
const out = path.resolve(here, "../../../apps/web/public/demo");
await mkdir(out, { recursive: true });

await copyFile(src, path.join(out, "original.jpg"));

// Same transform as "whatsapp-twice" in robustness.mjs.
const once = await sharp(src).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer();
await sharp(once).resize(800, 800, { fit: "inside" }).jpeg({ quality: 50 }).toFile(path.join(out, "whatsapp-twice.jpg"));

// Same transform as "crop-center-20" in robustness.mjs.
const meta = await sharp(src).metadata();
const dx = Math.round((meta.width * 0.2) / 2);
const dy = Math.round((meta.height * 0.2) / 2);
await sharp(src)
  .extract({ left: dx, top: dy, width: meta.width - 2 * dx, height: meta.height - 2 * dy })
  .jpeg({ quality: 85 })
  .toFile(path.join(out, "crop-20.jpg"));

console.log(`wrote demo images to ${out}`);
