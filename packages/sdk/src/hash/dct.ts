const N = 32;

const COS = (() => {
  const t = new Float64Array(N * N);
  for (let k = 0; k < N; k++) {
    for (let n = 0; n < N; n++) t[k * N + n] = Math.cos((Math.PI / N) * (n + 0.5) * k);
  }
  return t;
})();

/** Unnormalized 2D DCT-II of a 32 x 32 row-major matrix (rows, then columns). */
export function dct2d32(m: Float64Array): Float64Array {
  if (m.length !== N * N) throw new RangeError("dct2d32 expects 1024 values");
  const tmp = new Float64Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let k = 0; k < N; k++) {
      let acc = 0;
      for (let n = 0; n < N; n++) acc += (m[y * N + n] as number) * (COS[k * N + n] as number);
      tmp[y * N + k] = acc;
    }
  }
  const out = new Float64Array(N * N);
  for (let x = 0; x < N; x++) {
    for (let k = 0; k < N; k++) {
      let acc = 0;
      for (let n = 0; n < N; n++) acc += (tmp[n * N + x] as number) * (COS[k * N + n] as number);
      out[k * N + x] = acc;
    }
  }
  return out;
}

/**
 * Dihedral transform of a 32 x 32 matrix. Variants 0..3: rotate clockwise v times.
 * Variants 4..7: mirror left-right, then rotate clockwise (v - 4) times.
 */
export function dihedral32(m: Float64Array, variant: number): Float64Array {
  if (!Number.isInteger(variant) || variant < 0 || variant > 7) throw new RangeError("variant must be 0..7");
  let cur = m;
  if (variant >= 4) {
    const mir = new Float64Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) mir[y * N + x] = m[y * N + (N - 1 - x)] as number;
    cur = mir;
  }
  for (let r = 0; r < variant % 4; r++) {
    const next = new Float64Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) next[y * N + x] = cur[(N - 1 - x) * N + y] as number;
    cur = next;
  }
  return cur === m ? Float64Array.from(m) : cur;
}
