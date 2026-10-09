import { encodePacked, keccak256 } from "viem";
import { HASH_VERSION } from "../constants.js";

/** Split a 64-bit hash into four 16-bit segments, most significant first. */
export function segments(h: bigint): [number, number, number, number] {
  const s = (i: number): number => Number((h >> BigInt(48 - 16 * i)) & 0xffffn);
  return [s(0), s(1), s(2), s(3)];
}

/** Bucket key: keccak256(abi.encodePacked(uint8 version, uint8 index, uint16 value)). */
export function bucketKey(segmentIndex: number, segmentValue: number, version: number = HASH_VERSION): `0x${string}` {
  return keccak256(encodePacked(["uint8", "uint8", "uint16"], [version, segmentIndex, segmentValue]));
}

/** Number of probes for a radius: 1, 17, 137. */
export function probeCount(radius: 0 | 1 | 2): number {
  return radius === 0 ? 1 : radius === 1 ? 17 : 137;
}

/** The probe at a given index of the canonical probe order. */
export function probeAt(value: number, radius: 0 | 1 | 2, index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= probeCount(radius)) {
    throw new RangeError("probe index out of range");
  }
  if (index === 0) return value;
  if (index <= 16) return value ^ (1 << (index - 1));
  let p = index - 17;
  let i = 0;
  while (p >= 15 - i) {
    p -= 15 - i;
    i++;
  }
  const j = i + 1 + p;
  return value ^ (1 << i) ^ (1 << j);
}

/** All probes for a segment value, in canonical order. */
export function probes(value: number, radius: 0 | 1 | 2): number[] {
  const n = probeCount(radius);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(probeAt(value, radius, k));
  return out;
}

export interface CursorState {
  segment: number;
  probeIndex: number;
  offset: number;
}

/** Cursor value meaning "done" (as returned) or "start" (as input). */
export const CURSOR_DONE = 0n;

/** cursor = (segment << 160) | (probeIndex << 96) | (offset << 1) | 1 */
export function encodeCursor(s: CursorState): bigint {
  return (BigInt(s.segment) << 160n) | (BigInt(s.probeIndex) << 96n) | (BigInt(s.offset) << 1n) | 1n;
}

/** Inverse of {@link encodeCursor}. 0n decodes to the start state. */
export function decodeCursor(c: bigint): CursorState {
  if (c === 0n) return { segment: 0, probeIndex: 0, offset: 0 };
  return {
    segment: Number(c >> 160n),
    probeIndex: Number((c >> 96n) & ((1n << 64n) - 1n)),
    offset: Number((c >> 1n) & ((1n << 95n) - 1n)),
  };
}
