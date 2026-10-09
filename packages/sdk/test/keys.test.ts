import { hkdfSync } from "node:crypto";
import { bytesToHex } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { backupPhrase, creatorKey, prfFromBackupPhrase, walletKey } from "../src/index.js";

// Fixed PRF outputs, standing in for what a passkey returns.
const PRF_A = Uint8Array.from({ length: 32 }, (_, i) => i);
const PRF_B = Uint8Array.from({ length: 32 }, (_, i) => 255 - i * 3);

describe("keys", () => {
  it("backup phrase is 24 words and round-trips to the same PRF", () => {
    for (const prf of [PRF_A, PRF_B]) {
      const phrase = backupPhrase(prf);
      expect(phrase.split(" ")).toHaveLength(24);
      expect(prfFromBackupPhrase(phrase)).toEqual(prf);
      expect(prfFromBackupPhrase(`  ${phrase.toUpperCase().replaceAll(" ", "   ")} `)).toEqual(prf);
    }
  });

  it("wallet key matches the standard BIP-44 account of the backup phrase (viem, independent code)", () => {
    for (const prf of [PRF_A, PRF_B]) {
      const fromViem = mnemonicToAccount(backupPhrase(prf)).address;
      expect(privateKeyToAccount(bytesToHex(walletKey(prf))).address).toBe(fromViem);
    }
  });

  it("creator key is HKDF-SHA256 with the documented salt and info (Node crypto, independent code)", () => {
    const expected = new Uint8Array(hkdfSync("sha256", PRF_A, "origo", "origo/creator/v1", 32));
    expect(creatorKey(PRF_A)).toEqual(expected);
  });

  it("wallet and creator are different accounts, and both are deterministic", () => {
    const wallet = privateKeyToAccount(bytesToHex(walletKey(PRF_A))).address;
    const creator = privateKeyToAccount(bytesToHex(creatorKey(PRF_A))).address;
    expect(wallet).not.toBe(creator);
    expect(privateKeyToAccount(bytesToHex(creatorKey(PRF_A))).address).toBe(creator);
    expect(privateKeyToAccount(bytesToHex(creatorKey(PRF_B))).address).not.toBe(creator);
  });

  it("rejects bad input", () => {
    expect(() => backupPhrase(new Uint8Array(16))).toThrow();
    expect(() => creatorKey(new Uint8Array(31))).toThrow();
    expect(() => prfFromBackupPhrase("not a real phrase at all")).toThrow();
  });
});
