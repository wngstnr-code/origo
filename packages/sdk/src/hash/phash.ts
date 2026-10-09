import { MAX_POPCOUNT, MIN_POPCOUNT } from "../constants.js";
import { detectBordersLuma } from "./borders.js";
import { dct2d32, dihedral32 } from "./dct.js";
import { cropImage, cropLuma, toLuma } from "./luma.js";
import { areaResize } from "./resize.js";
import type { Rect, RGBAImage } from "./types.js";

export interface PHashOptions {
  /** Trim uniform borders (default true). */
  trim?: boolean;
  /** Manual crop, applied before trim. */
  crop?: Rect;
}

/** Spec steps 6-8: 64 low-frequency DCT coefficients thresholded at their median. */
export function hashFromLuma32(m: Float64Array): bigint {
  const d = dct2d32(m);
  const vals = new Float64Array(64);
  for (let ky = 0; ky < 8; ky++) for (let kx = 0; kx < 8; kx++) vals[ky * 8 + kx] = d[ky * 32 + kx] as number;
  const sorted = Float64Array.from(vals).sort();
  const median = ((sorted[31] as number) + (sorted[32] as number)) / 2;
  let h = 0n;
  for (let i = 0; i < 64; i++) {
    h = (h << 1n) | ((vals[i] as number) > median ? 1n : 0n);
  }
  return h;
}

function resized32(img: RGBAImage, opts: PHashOptions): Float64Array {
  const src = opts.crop ? cropImage(img, opts.crop) : img;
  let luma = toLuma(src);
  let w = src.width;
  let h = src.height;
  if (opts.trim !== false) {
    const c = cropLuma(luma, w, h, detectBordersLuma(luma, w, h));
    luma = c.luma;
    w = c.width;
    h = c.height;
  }
  return areaResize(luma, w, h);
}

/** Perceptual hash: crop? -> trim? -> luma -> 32x32 resize -> DCT -> 64 bits. */
export function phash(img: RGBAImage, opts: PHashOptions = {}): bigint {
  return hashFromLuma32(resized32(img, opts));
}

/** The 8 orientation variants (index = variant). Index 0 equals {@link phash}. */
export function phashVariants(img: RGBAImage, opts: PHashOptions = {}): bigint[] {
  const m = resized32(img, opts);
  const out: bigint[] = [];
  for (let v = 0; v < 8; v++) out.push(hashFromLuma32(dihedral32(m, v)));
  return out;
}

const MASK64 = (1n << 64n) - 1n;

/** Number of set bits in a 64-bit value. */
export function popcount64(h: bigint): number {
  let v = h & MASK64;
  let c = 0;
  while (v) {
    c += Number(v & 1n);
    v >>= 1n;
  }
  return c;
}

/** Hamming distance between two 64-bit hashes. */
export function hamming(a: bigint, b: bigint): number {
  return popcount64((a ^ b) & MASK64);
}

/** True if the hash carries too little information (popcount outside 8..56). */
export function isDegenerate(h: bigint): boolean {
  const p = popcount64(h);
  return p < MIN_POPCOUNT || p > MAX_POPCOUNT;
}

/** Format as `0x` plus exactly 16 lowercase hex digits. */
export function hashToHex(h: bigint): `0x${string}` {
  if (h < 0n || h > MASK64) throw new RangeError("hash out of 64-bit range");
  return `0x${h.toString(16).padStart(16, "0")}`;
}

/** Parse a hex string (with or without 0x) into a 64-bit hash. */
export function hexToHash(hex: string): bigint {
  const s = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{1,16}$/.test(s)) throw new RangeError("invalid 64-bit hex hash");
  return BigInt(`0x${s}`);
}
