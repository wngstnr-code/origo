import type { Rect, RGBAImage } from "./types.js";

/** Convert RGBA to float64 luma (Y = 0.299R + 0.587G + 0.114B). Alpha is ignored. */
export function toLuma(img: RGBAImage): Float64Array {
  const n = img.width * img.height;
  const out = new Float64Array(n);
  const d = img.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    out[i] = 0.299 * (d[p] as number) + 0.587 * (d[p + 1] as number) + 0.114 * (d[p + 2] as number);
  }
  return out;
}

function clampRect(rect: Rect, width: number, height: number): Rect {
  const x0 = Math.min(Math.max(Math.trunc(rect.x), 0), width);
  const y0 = Math.min(Math.max(Math.trunc(rect.y), 0), height);
  const x1 = Math.min(Math.max(Math.trunc(rect.x) + Math.trunc(rect.width), x0), width);
  const y1 = Math.min(Math.max(Math.trunc(rect.y) + Math.trunc(rect.height), y0), height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Crop an RGBA image to an integer rect, clamped to the image bounds. */
export function cropImage(img: RGBAImage, rect: Rect): RGBAImage {
  const r = clampRect(rect, img.width, img.height);
  const data = new Uint8ClampedArray(r.width * r.height * 4);
  for (let y = 0; y < r.height; y++) {
    const start = ((r.y + y) * img.width + r.x) * 4;
    data.set(img.data.subarray(start, start + r.width * 4), y * r.width * 4);
  }
  return { width: r.width, height: r.height, data };
}

/** Crop a luma plane to an integer rect, clamped to the bounds. */
export function cropLuma(
  luma: Float64Array,
  width: number,
  height: number,
  rect: Rect,
): { luma: Float64Array; width: number; height: number } {
  const r = clampRect(rect, width, height);
  if (r.width === width && r.height === height) return { luma, width, height };
  const out = new Float64Array(r.width * r.height);
  for (let y = 0; y < r.height; y++) {
    const start = (r.y + y) * width + r.x;
    out.set(luma.subarray(start, start + r.width), y * r.width);
  }
  return { luma: out, width: r.width, height: r.height };
}
