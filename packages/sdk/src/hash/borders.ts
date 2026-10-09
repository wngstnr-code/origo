import { cropImage, toLuma } from "./luma.js";
import type { Rect, RGBAImage } from "./types.js";

const TOLERANCE = 8;
const UNIFORM_FRACTION = 0.98;
const MAX_TRIM_FRACTION = 0.2;
const MIN_RESULT = 32;

function median(values: Float64Array): number {
  const s = Float64Array.from(values).sort();
  const n = s.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Same as {@link detectBorders} but on a precomputed luma plane. */
export function detectBordersLuma(luma: Float64Array, width: number, height: number): Rect {
  const full: Rect = { x: 0, y: 0, width, height };
  if (width === 0 || height === 0) return full;

  const rowLine = (y: number): Float64Array => luma.subarray(y * width, (y + 1) * width);
  const colLine = (x: number): Float64Array => {
    const c = new Float64Array(height);
    for (let y = 0; y < height; y++) c[y] = luma[y * width + x] as number;
    return c;
  };

  const isUniform = (line: Float64Array, ref: number): boolean => {
    let ok = 0;
    for (let i = 0; i < line.length; i++) {
      if (Math.abs((line[i] as number) - ref) <= TOLERANCE) ok++;
    }
    return ok >= UNIFORM_FRACTION * line.length;
  };

  const walk = (maxDrop: number, get: (i: number) => Float64Array): number => {
    const ref = median(get(0));
    let dropped = 0;
    while (dropped < maxDrop && isUniform(get(dropped), ref)) dropped++;
    return dropped;
  };

  const maxRows = Math.floor(MAX_TRIM_FRACTION * height);
  const maxCols = Math.floor(MAX_TRIM_FRACTION * width);
  const top = walk(maxRows, (i) => rowLine(i));
  const bottom = walk(maxRows, (i) => rowLine(height - 1 - i));
  const left = walk(maxCols, (i) => colLine(i));
  const right = walk(maxCols, (i) => colLine(width - 1 - i));

  const w = width - left - right;
  const h = height - top - bottom;
  if (w < MIN_RESULT || h < MIN_RESULT) return full;
  return { x: left, y: top, width: w, height: h };
}

/** Spec step 1: detect uniform borders on each side and return the content rect. */
export function detectBorders(img: RGBAImage): Rect {
  return detectBordersLuma(toLuma(img), img.width, img.height);
}

/** Crop away uniform borders (see {@link detectBorders}). */
export function trimBorders(img: RGBAImage): RGBAImage {
  return cropImage(img, detectBorders(img));
}
