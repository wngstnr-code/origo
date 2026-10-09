import { encodePacked, keccak256 } from "viem";
import { detectBordersLuma } from "./borders.js";
import { cropLuma, toLuma } from "./luma.js";
import { hashFromLuma32 } from "./phash.js";
import { areaResize } from "./resize.js";
import type { Rect, RGBAImage } from "./types.js";

/** One crop-protection window as fractions of the trimmed content rect. */
export interface TileWindow {
  fx: number;
  fy: number;
  sx: number;
  sy: number;
}

/** Scale pairs in the fixed order defined in docs/origo/ARCHITECTURE.md section 5. */
const TILE_SCALES: ReadonlyArray<readonly [number, number]> = [
  [0.9, 0.9],
  [0.8, 0.8],
  [0.9, 1],
  [1, 0.9],
  [0.8, 1],
  [1, 0.8],
  [0.7, 0.7],
];

function offsets(s: number): number[] {
  return s === 1 ? [0] : [0, (1 - s) / 2, 1 - s];
}

/** The 39 tile windows. Tile index (1-based, as stored on-chain) = position in this list + 1. */
export const TILE_WINDOWS: ReadonlyArray<TileWindow> = TILE_SCALES.flatMap(([sx, sy]) =>
  offsets(sy).flatMap((fy) => offsets(sx).map((fx) => ({ fx, fy, sx, sy }))),
);

/** Pixel rect of a window inside a content rect. */
export function tileRect(w: TileWindow, content: Rect): Rect {
  return {
    x: content.x + Math.round(w.fx * content.width),
    y: content.y + Math.round(w.fy * content.height),
    width: Math.round(w.sx * content.width),
    height: Math.round(w.sy * content.height),
  };
}

/** Full hash plus the 39 crop-protection tile hashes, computed from one luma pass. */
export interface TiledHash {
  pHash: bigint;
  tiles: bigint[];
  content: Rect;
}

/**
 * Hashes for a registration with crop protection. `pHash` equals `phash(img)` and each tile equals
 * `phash(img, { crop: tileRect(window, content), trim: false })`.
 */
export function phashWithTiles(img: RGBAImage): TiledHash {
  const luma = toLuma(img);
  const content = detectBordersLuma(luma, img.width, img.height);
  const hashRect = (r: Rect): bigint => {
    const c = cropLuma(luma, img.width, img.height, r);
    return hashFromLuma32(areaResize(c.luma, c.width, c.height));
  };
  return { pHash: hashRect(content), tiles: TILE_WINDOWS.map((w) => hashRect(tileRect(w, content))), content };
}

/** `keccak256(abi.encodePacked(uint64[] tiles))` as the contract computes it (each element as a 32-byte word). */
export function tilesHash(tiles: readonly bigint[]): `0x${string}` {
  if (tiles.length === 0) return `0x${"00".repeat(32)}`;
  return keccak256(encodePacked(["uint64[]"], [tiles]));
}
