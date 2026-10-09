import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  ImageTooSmallError,
  areaResize,
  cropImage,
  dct2d32,
  detectBorders,
  dihedral32,
  hamming,
  hashFromLuma32,
  hashToHex,
  hexToHash,
  isDegenerate,
  phash,
  phashVariants,
  popcount64,
  toLuma,
  trimBorders,
  type RGBAImage,
} from "../src/index.js";

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(w: number, h: number, f: (x: number, y: number) => [number, number, number]): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

function noiseImage(w: number, h: number, seed: number): RGBAImage {
  const r = prng(seed);
  return make(w, h, () => [r() * 255, r() * 255, r() * 255]);
}

/** Smooth gradients plus a few shapes plus mild noise, asymmetric. */
function natural(w: number, h: number, seed = 7): RGBAImage {
  const r = prng(seed);
  return make(w, h, (x, y) => {
    const u = x / w;
    const v = y / h;
    let l = 60 + 90 * u + 50 * Math.sin(v * 5) * Math.cos(u * 3);
    if ((u - 0.3) ** 2 + (v - 0.35) ** 2 < 0.03) l += 90;
    if (u > 0.55 && u < 0.85 && v > 0.55 && v < 0.8) l -= 70;
    if (Math.abs(v - (0.2 + 0.6 * u)) < 0.02) l += 60;
    l += (r() - 0.5) * 8;
    return [l, l * 0.9 + 10, l * 0.8 + 20];
  });
}

async function viaSharp(img: RGBAImage, f: (s: ReturnType<typeof sharp>) => ReturnType<typeof sharp>): Promise<RGBAImage> {
  const base = sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } });
  const { data, info } = await f(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

function rotateCW(img: RGBAImage): RGBAImage {
  return make(img.height, img.width, (x, y) => {
    const i = ((img.height - 1 - x) * img.width + y) * 4;
    return [img.data[i] as number, img.data[i + 1] as number, img.data[i + 2] as number];
  });
}

function mirror(img: RGBAImage): RGBAImage {
  return make(img.width, img.height, (x, y) => {
    const i = (y * img.width + (img.width - 1 - x)) * 4;
    return [img.data[i] as number, img.data[i + 1] as number, img.data[i + 2] as number];
  });
}

describe("luma and crop", () => {
  it("computes luma for known pixels and ignores alpha", () => {
    const img: RGBAImage = {
      width: 3,
      height: 1,
      data: new Uint8Array([255, 0, 0, 0, 0, 255, 0, 10, 0, 0, 255, 255]),
    };
    const l = toLuma(img);
    expect(l[0]).toBeCloseTo(0.299 * 255, 12);
    expect(l[1]).toBeCloseTo(0.587 * 255, 12);
    expect(l[2]).toBeCloseTo(0.114 * 255, 12);
  });

  it("crops and clamps", () => {
    const img = make(10, 8, (x, y) => [x * 10, y * 10, 0]);
    const c = cropImage(img, { x: 2, y: 3, width: 4, height: 2 });
    expect(c.width).toBe(4);
    expect(c.height).toBe(2);
    expect(c.data[0]).toBe(20);
    expect(c.data[1]).toBe(30);
    const big = cropImage(img, { x: -5, y: -5, width: 100, height: 100 });
    expect(big.width).toBe(10);
    expect(big.height).toBe(8);
    const out = cropImage(img, { x: 8, y: 6, width: 10, height: 10 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(cropImage(img, { x: 50, y: 50, width: 3, height: 3 }).width).toBe(0);
  });
});

describe("detectBorders", () => {
  const framed = (w: number, h: number, frac: number): RGBAImage => {
    const bx = Math.round(w * frac);
    const by = Math.round(h * frac);
    const r = prng(3);
    return make(w, h, (x, y) => {
      if (x < bx || y < by || x >= w - bx || y >= h - by) return [0, 0, 0];
      const v = 80 + r() * 150;
      return [v, v, v];
    });
  };

  it("trims a 10% frame to the inner rect", () => {
    expect(detectBorders(framed(200, 100, 0.1))).toEqual({ x: 20, y: 10, width: 160, height: 80 });
  });

  it("limits trimming to 20% per side for a 30% frame", () => {
    expect(detectBorders(framed(200, 100, 0.3))).toEqual({ x: 40, y: 20, width: 120, height: 60 });
  });

  it("returns the full rect without a border", () => {
    expect(detectBorders(noiseImage(120, 90, 5))).toEqual({ x: 0, y: 0, width: 120, height: 90 });
  });

  it("falls back to the full rect when the result is under 32 px", () => {
    const img = framed(40, 40, 0.3);
    expect(detectBorders(img)).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it("trimBorders crops to the rect", () => {
    const t = trimBorders(framed(200, 100, 0.1));
    expect(t.width).toBe(160);
    expect(t.height).toBe(80);
  });
});

describe("areaResize", () => {
  it("keeps a constant image constant", () => {
    const out = areaResize(new Float64Array(100 * 77).fill(123.5), 100, 77);
    for (const v of out) expect(v).toBeCloseTo(123.5, 9);
  });

  it("equals block means for integer ratios", () => {
    const r = prng(1);
    const w = 96;
    const h = 64;
    const src = Float64Array.from({ length: w * h }, () => r() * 255);
    const out = areaResize(src, w, h);
    for (let oy = 0; oy < 32; oy++) {
      for (let ox = 0; ox < 32; ox++) {
        let s = 0;
        for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) s += src[(oy * 2 + y) * w + ox * 3 + x] as number;
        expect(out[oy * 32 + ox]).toBeCloseTo(s / 6, 9);
      }
    }
  });

  it("preserves the global mean for non-integer ratios", () => {
    const r = prng(2);
    const src = Float64Array.from({ length: 100 * 77 }, () => r() * 255);
    const mean = src.reduce((a, b) => a + b, 0) / src.length;
    const out = areaResize(src, 100, 77);
    const om = out.reduce((a, b) => a + b, 0) / out.length;
    expect(Math.abs(om - mean)).toBeLessThan(1e-9);
  });

  it("throws below 32 px", () => {
    expect(() => areaResize(new Float64Array(31 * 40), 31, 40)).toThrow(ImageTooSmallError);
    expect(() => areaResize(new Float64Array(40 * 31), 40, 31)).toThrow(ImageTooSmallError);
  });
});

describe("dct2d32 and dihedral32", () => {
  it("constant input only has DC", () => {
    const out = dct2d32(new Float64Array(1024).fill(10));
    expect(out[0]).toBeCloseTo(10 * 1024, 6);
    for (let i = 1; i < 1024; i++) expect(Math.abs(out[i] as number)).toBeLessThan(1e-9);
  });

  it("matches a naive O(n^4) reference", () => {
    const r = prng(9);
    const m = Float64Array.from({ length: 1024 }, () => r() * 255);
    const out = dct2d32(m);
    for (let ky = 0; ky < 32; ky += 3) {
      for (let kx = 0; kx < 32; kx += 3) {
        let s = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            s += (m[y * 32 + x] as number) * Math.cos((Math.PI / 32) * (y + 0.5) * ky) * Math.cos((Math.PI / 32) * (x + 0.5) * kx);
          }
        }
        expect(Math.abs(s - (out[ky * 32 + kx] as number))).toBeLessThan(1e-6);
      }
    }
  });

  it("dihedral group properties", () => {
    const r = prng(4);
    const m = Float64Array.from({ length: 1024 }, () => r());
    expect(dihedral32(m, 0)).toEqual(m);
    expect(dihedral32(dihedral32(m, 4), 4)).toEqual(m);
    let c: Float64Array = m;
    for (let i = 0; i < 4; i++) c = dihedral32(c, 1);
    expect(c).toEqual(m);
    expect(dihedral32(m, 2)).toEqual(dihedral32(dihedral32(m, 1), 1));
    expect(dihedral32(m, 5)).toEqual(dihedral32(dihedral32(m, 4), 1));
    // clockwise: new top-left is old bottom-left
    expect(dihedral32(m, 1)[0]).toBe(m[31 * 32]);
    // mirror: new top-left is old top-right
    expect(dihedral32(m, 4)[0]).toBe(m[31]);
    expect(() => dihedral32(m, 8)).toThrow(RangeError);
  });
});

describe("hashFromLuma32", () => {
  it("sets the MSB when DC is the largest coefficient", () => {
    const m = new Float64Array(1024).fill(200);
    const h = hashFromLuma32(m);
    expect(h >> 63n).toBe(1n);
    // all other coefficients are ~0, equal to the median region, so only the MSB is set
    expect(popcount64(h) >= 1).toBe(true);
  });

  it("puts D[0][1] at bit 62", () => {
    // horizontal cosine of frequency 1 has a large positive D[0][1] and DC offset 0
    const m = new Float64Array(1024);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) m[y * 32 + x] = Math.cos((Math.PI / 32) * (x + 0.5));
    const h = hashFromLuma32(m);
    expect((h >> 62n) & 1n).toBe(1n);
    expect(h >> 63n).toBe(0n);
  });
});

describe("phash", () => {
  const img = natural(160, 120);

  it("is deterministic", () => {
    expect(phash(img)).toBe(phash(img));
    expect(phash(img)).toBeLessThan(1n << 64n);
  });

  it("phashVariants[0] equals phash, with 8 entries", () => {
    const v = phashVariants(img);
    expect(v).toHaveLength(8);
    expect(v[0]).toBe(phash(img));
  });

  it("respects the trim and crop options", () => {
    const inner = natural(160, 160);
    const framed = make(200, 200, (x, y) => {
      if (x < 20 || y < 20 || x >= 180 || y >= 180) return [0, 0, 0];
      const i = ((y - 20) * 160 + (x - 20)) * 4;
      return [inner.data[i] as number, inner.data[i + 1] as number, inner.data[i + 2] as number];
    });
    expect(phash(framed)).toBe(phash(inner));
    expect(phash(framed, { trim: false })).not.toBe(phash(inner));
    expect(phash(framed, { trim: false, crop: { x: 20, y: 20, width: 160, height: 160 } })).toBe(phash(inner));
  });

  it("mirroring changes the hash but variants contain the original", () => {
    const sq = natural(128, 128, 11);
    const base = phash(sq);
    const m = mirror(sq);
    expect(phash(m)).not.toBe(base);
    expect(phashVariants(m).map((h) => hamming(h, base))).toContain(0);
  });

  it("rotating 90 degrees keeps the original among the variants", () => {
    const sq = natural(128, 128, 12);
    const base = phash(sq);
    const rot = rotateCW(sq);
    expect(phash(rot)).not.toBe(base);
    expect(phashVariants(rot).map((h) => hamming(h, base))).toContain(0);
  });

  it("different images are far apart", () => {
    const a = phash(natural(160, 120, 1));
    const b = phash(noiseImage(160, 120, 2));
    const c = phash(make(160, 120, (x, y) => ((x >> 3) + (y >> 3)) % 2 === 0 ? [250, 250, 250] : [10, 10, 10]));
    expect(hamming(a, b)).toBeGreaterThan(7);
    expect(hamming(a, c)).toBeGreaterThan(7);
    expect(hamming(b, c)).toBeGreaterThan(7);
  });

  it("is robust to resize and JPEG q50", async () => {
    const big = natural(800, 600, 21);
    const base = phash(big);
    const half = await viaSharp(big, (s) => s.resize(400, 300, { kernel: "lanczos3" }));
    const jpgBuf = await sharp(Buffer.from(big.data), { raw: { width: 800, height: 600, channels: 4 } })
      .removeAlpha()
      .jpeg({ quality: 50 })
      .toBuffer();
    const dec = await sharp(jpgBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const jpgImg: RGBAImage = { width: dec.info.width, height: dec.info.height, data: new Uint8Array(dec.data) };
    const dResize = hamming(base, phash(half));
    const dJpeg = hamming(base, phash(jpgImg));
    console.log(`robustness: resize50=${dResize} jpegq50=${dJpeg}`);
    expect(dResize).toBeLessThanOrEqual(7);
    expect(dJpeg).toBeLessThanOrEqual(7);
  });

  it("is fast on 4000x3000", () => {
    const w = 4000;
    const h = 3000;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = (x * 255) / w;
        data[i + 1] = (y * 255) / h;
        data[i + 2] = ((x ^ y) & 255);
        data[i + 3] = 255;
      }
    }
    const t0 = performance.now();
    phash({ width: w, height: h, data });
    const ms = performance.now() - t0;
    console.log(`phash 4000x3000: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1000);
  });
});

describe("hash helpers", () => {
  it("popcount64 and hamming", () => {
    expect(popcount64(0n)).toBe(0);
    expect(popcount64((1n << 64n) - 1n)).toBe(64);
    expect(hamming(0n, (1n << 64n) - 1n)).toBe(64);
    expect(hamming(5n, 5n)).toBe(0);
    expect(hamming(0b1010n, 0b0110n)).toBe(2);
  });

  it("isDegenerate edges", () => {
    expect(isDegenerate(0n)).toBe(true);
    expect(isDegenerate((1n << 64n) - 1n)).toBe(true);
    expect(isDegenerate((1n << 7n) - 1n)).toBe(true);
    expect(isDegenerate((1n << 8n) - 1n)).toBe(false);
    expect(isDegenerate((1n << 56n) - 1n)).toBe(false);
    expect(isDegenerate((1n << 57n) - 1n)).toBe(true);
  });

  it("hex round trip and padding", () => {
    expect(hashToHex(0n)).toBe("0x0000000000000000");
    expect(hashToHex(255n)).toBe("0x00000000000000ff");
    expect(hashToHex((1n << 64n) - 1n)).toBe("0xffffffffffffffff");
    const h = 0x0123456789abcdefn;
    expect(hexToHash(hashToHex(h))).toBe(h);
    expect(() => hexToHash("0x1ffffffffffffffff")).toThrow();
    expect(() => hexToHash("0xzz")).toThrow();
    expect(() => hashToHex(1n << 64n)).toThrow();
    expect(() => hashToHex(-1n)).toThrow();
  });
});
