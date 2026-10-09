import { keccak256 } from "viem";
import { describe, expect, it } from "vitest";
import {
  CURSOR_DONE,
  bucketKey,
  decodeCursor,
  encodeCursor,
  probeAt,
  probeCount,
  probes,
  segments,
} from "../src/index.js";

describe("segments", () => {
  it("splits most significant first", () => {
    expect(segments(0x1234_5678_9abc_def0n)).toEqual([0x1234, 0x5678, 0x9abc, 0xdef0]);
    expect(segments(0n)).toEqual([0, 0, 0, 0]);
    expect(segments((1n << 64n) - 1n)).toEqual([0xffff, 0xffff, 0xffff, 0xffff]);
  });
});

describe("bucketKey", () => {
  it("equals keccak256 of the packed bytes", () => {
    const cases: [number, number][] = [[0, 0], [1, 0x1234], [3, 0xffff], [2, 0xabcd]];
    for (const [i, v] of cases) {
      const bytes = new Uint8Array([1, i, v >> 8, v & 0xff]);
      expect(bucketKey(i, v)).toBe(keccak256(bytes));
      expect(bucketKey(i, v, 1)).toBe(keccak256(bytes));
    }
    expect(bucketKey(0, 5, 2)).toBe(keccak256(new Uint8Array([2, 0, 0, 5])));
    expect(bucketKey(0, 5)).not.toBe(bucketKey(1, 5));
  });
});

describe("probes", () => {
  it("has the right counts", () => {
    expect(probeCount(0)).toBe(1);
    expect(probeCount(1)).toBe(17);
    expect(probeCount(2)).toBe(137);
    expect(probes(0, 0)).toHaveLength(1);
    expect(probes(0, 1)).toHaveLength(17);
    expect(probes(0, 2)).toHaveLength(137);
  });

  it("has exact leading elements", () => {
    const v = 0xabcd;
    expect(probes(v, 0)).toEqual([v]);
    const p1 = probes(v, 1);
    expect(p1[0]).toBe(v);
    expect(p1.slice(1, 5)).toEqual([v ^ 1, v ^ 2, v ^ 4, v ^ 8]);
    expect(p1[16]).toBe(v ^ 0x8000);
    const p2 = probes(v, 2);
    expect(p2[17]).toBe(v ^ 1 ^ 2);
    expect(p2[18]).toBe(v ^ 1 ^ 4);
    expect(p2[31]).toBe(v ^ 1 ^ 0x8000);
    expect(p2[32]).toBe(v ^ 2 ^ 4);
    expect(p2[136]).toBe(v ^ 0x4000 ^ 0x8000);
  });

  it("radius 1 is a prefix of radius 2 and all probes are distinct", () => {
    for (const v of [0, 1, 0xffff, 0x1234]) {
      const p2 = probes(v, 2);
      expect(p2.slice(0, 17)).toEqual(probes(v, 1));
      expect(new Set(p2).size).toBe(137);
      expect(p2.every((x) => x >= 0 && x <= 0xffff)).toBe(true);
    }
  });

  it("probeAt matches probes and rejects bad indexes", () => {
    const p2 = probes(0x55aa, 2);
    for (let k = 0; k < 137; k++) expect(probeAt(0x55aa, 2, k)).toBe(p2[k]);
    expect(() => probeAt(0, 1, 17)).toThrow(RangeError);
    expect(() => probeAt(0, 2, 137)).toThrow(RangeError);
  });
});

describe("cursor", () => {
  it("round trips", () => {
    const cases = [
      { segment: 0, probeIndex: 0, offset: 0 },
      { segment: 3, probeIndex: 136, offset: 12345 },
      { segment: 2, probeIndex: 17, offset: 0 },
    ];
    for (const s of cases) expect(decodeCursor(encodeCursor(s))).toEqual(s);
  });

  it("uses the documented layout", () => {
    expect(encodeCursor({ segment: 1, probeIndex: 2, offset: 3 })).toBe((1n << 160n) | (2n << 96n) | (3n << 1n) | 1n);
    expect(encodeCursor({ segment: 0, probeIndex: 0, offset: 0 })).toBe(1n);
  });

  it("decodes 0 as start", () => {
    expect(CURSOR_DONE).toBe(0n);
    expect(decodeCursor(0n)).toEqual({ segment: 0, probeIndex: 0, offset: 0 });
  });
});
