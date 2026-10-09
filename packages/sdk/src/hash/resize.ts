import { ImageTooSmallError } from "./types.js";

interface Weights {
  start: Int32Array;
  count: Int32Array;
  /** Flattened integer overlaps, in units of 1/outSize source pixel. */
  w: Float64Array;
  offset: Int32Array;
}

/**
 * Exact integer overlaps. Source pixel p covers [p*out, (p+1)*out) and output cell o
 * covers [o*src, (o+1)*src) in a common integer scale, so weights are exact.
 */
function buildWeights(src: number, out: number): Weights {
  const start = new Int32Array(out);
  const count = new Int32Array(out);
  const offset = new Int32Array(out);
  const list: number[] = [];
  for (let o = 0; o < out; o++) {
    const lo = o * src;
    const hi = (o + 1) * src;
    const first = Math.floor(lo / out);
    const last = Math.ceil(hi / out) - 1;
    start[o] = first;
    count[o] = last - first + 1;
    offset[o] = list.length;
    for (let p = first; p <= last; p++) {
      list.push(Math.min((p + 1) * out, hi) - Math.max(p * out, lo));
    }
  }
  return { start, count, w: Float64Array.from(list), offset };
}

/**
 * Exact fractional-coverage box filter (separable). Default output is 32 x 32.
 * Throws {@link ImageTooSmallError} when width or height is below 32.
 */
export function areaResize(
  luma: Float64Array,
  width: number,
  height: number,
  outW = 32,
  outH = 32,
): Float64Array {
  if (width < 32 || height < 32) throw new ImageTooSmallError();
  const wx = buildWeights(width, outW);
  const wy = buildWeights(height, outH);

  const tmp = new Float64Array(height * outW);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let ox = 0; ox < outW; ox++) {
      const s = wx.start[ox] as number;
      const c = wx.count[ox] as number;
      const o = wx.offset[ox] as number;
      let acc = 0;
      for (let k = 0; k < c; k++) acc += (luma[row + s + k] as number) * (wx.w[o + k] as number);
      tmp[y * outW + ox] = acc / width;
    }
  }

  const out = new Float64Array(outW * outH);
  for (let oy = 0; oy < outH; oy++) {
    const s = wy.start[oy] as number;
    const c = wy.count[oy] as number;
    const o = wy.offset[oy] as number;
    for (let ox = 0; ox < outW; ox++) {
      let acc = 0;
      for (let k = 0; k < c; k++) acc += (tmp[(s + k) * outW + ox] as number) * (wy.w[o + k] as number);
      out[oy * outW + ox] = acc / height;
    }
  }
  return out;
}
