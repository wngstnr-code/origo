import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { concat, keccak256, numberToHex } from "viem";
import { describe, expect, it } from "vitest";
import {
  TILE_WINDOWS,
  detectBorders,
  hamming,
  phash,
  phashVariants,
  phashWithTiles,
  tileRect,
  tilesHash,
  type RGBAImage,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../fixtures/photos/f08-pasar-bantul.jpg");

async function decode(buf: Buffer): Promise<RGBAImage> {
  const { data, info } = await sharp(buf).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

describe("tile windows", () => {
  it("has 39 windows in the specified order", () => {
    expect(TILE_WINDOWS).toHaveLength(39);
    expect(TILE_WINDOWS[0]).toEqual({ fx: 0, fy: 0, sx: 0.9, sy: 0.9 });
    const center = TILE_WINDOWS[4];
    expect(center?.fx).toBeCloseTo(0.05, 12);
    expect(center?.fy).toBeCloseTo(0.05, 12);
    expect(center?.sx).toBe(0.9);
    expect(TILE_WINDOWS[18]).toEqual({ fx: 0, fy: 0, sx: 0.9, sy: 1 });
    expect(TILE_WINDOWS[38]?.sx).toBe(0.7);
  });

  it("places rects inside the content rect", () => {
    const content = { x: 10, y: 20, width: 1000, height: 500 };
    for (const w of TILE_WINDOWS) {
      const r = tileRect(w, content);
      expect(r.x).toBeGreaterThanOrEqual(10);
      expect(r.y).toBeGreaterThanOrEqual(20);
      expect(r.x + r.width).toBeLessThanOrEqual(1010);
      expect(r.y + r.height).toBeLessThanOrEqual(520);
    }
  });
});

describe("phashWithTiles on a real photo", async () => {
  const buf = await readFile(fixture);
  const img = await decode(buf);
  const tiled = phashWithTiles(img);

  it("full hash equals phash", () => {
    expect(tiled.pHash).toBe(phash(img));
    expect(tiled.content).toEqual(detectBorders(img));
  });

  it("each tile equals phash of that window without trim", () => {
    TILE_WINDOWS.forEach((w, i) => {
      expect(tiled.tiles[i]).toBe(phash(img, { crop: tileRect(w, tiled.content), trim: false }));
    });
  });

  it("finds a 20% center crop through a tile", async () => {
    const left = Math.round(img.width * 0.1);
    const top = Math.round(img.height * 0.1);
    const cropped = await sharp(buf)
      .extract({ left, top, width: img.width - 2 * left, height: img.height - 2 * top })
      .jpeg({ quality: 70 })
      .toBuffer();
    const variants = phashVariants(await decode(cropped));
    const best = Math.min(...variants.flatMap((v) => tiled.tiles.map((t) => hamming(v, t))));
    const fullOnly = Math.min(...variants.map((v) => hamming(v, tiled.pHash)));
    expect(best).toBeLessThanOrEqual(7);
    expect(fullOnly).toBeGreaterThan(best);
  });
});

describe("tilesHash", () => {
  it("is zero for no tiles", () => {
    expect(tilesHash([])).toBe(`0x${"00".repeat(32)}`);
  });

  it("matches Solidity abi.encodePacked(uint64[]): each element as a 32-byte word", () => {
    const tiles = [1n, 0xffffffffffffffffn, 0x0123456789abcdefn];
    const manual = keccak256(concat(tiles.map((t) => numberToHex(t, { size: 32 }))));
    expect(tilesHash(tiles)).toBe(manual);
  });
});
