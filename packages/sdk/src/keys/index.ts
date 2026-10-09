import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToEntropy, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

/**
 * Account keys derived from one passkey PRF output (docs/origo/ARCHITECTURE.md section 8):
 *
 *   PRF (32 bytes) -> BIP-39 mnemonic -> seed -> m/44'/60'/0'/0/0   = wallet key (pays gas, MetaMask-portable)
 *   PRF (32 bytes) -> HKDF-SHA256(salt "origo", info "origo/creator/v1") = creator key (signs registrations)
 *
 * The 24-word mnemonic of the PRF bytes is the backup: it restores both keys.
 */

export const WALLET_PATH = "m/44'/60'/0'/0/0";
export const CREATOR_HKDF_SALT = "origo";
export const CREATOR_HKDF_INFO = "origo/creator/v1";

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

function assertPrf(prf: Uint8Array) {
  if (prf.length !== 32) throw new Error("A passkey PRF output must be exactly 32 bytes");
}

/** The 24-word backup phrase for a PRF output. */
export function backupPhrase(prf: Uint8Array): string {
  assertPrf(prf);
  return entropyToMnemonic(prf, wordlist);
}

/** Recovers the PRF output from a backup phrase. Throws if the phrase is not a valid 24-word BIP-39 phrase. */
export function prfFromBackupPhrase(phrase: string): Uint8Array {
  const normalized = phrase.trim().toLowerCase().split(/\s+/).join(" ");
  if (!validateMnemonic(normalized, wordlist)) throw new Error("That is not a valid backup phrase");
  const prf = mnemonicToEntropy(normalized, wordlist);
  assertPrf(prf);
  return prf;
}

/** Wallet private key: standard BIP-44 Ethereum path from the backup phrase, so it imports into any wallet. */
export function walletKey(prf: Uint8Array): Uint8Array {
  const seed = mnemonicToSeedSync(backupPhrase(prf));
  const key = HDKey.fromMasterSeed(seed).derive(WALLET_PATH).privateKey;
  seed.fill(0);
  if (!key) throw new Error("Wallet key derivation failed");
  return key;
}

/** Creator private key: domain-separated from the wallet so the identity on records never pays gas. */
export function creatorKey(prf: Uint8Array): Uint8Array {
  assertPrf(prf);
  const key = hkdf(sha256, prf, utf8ToBytes(CREATOR_HKDF_SALT), utf8ToBytes(CREATOR_HKDF_INFO), 32);
  const k = BigInt(`0x${[...key].map((b) => b.toString(16).padStart(2, "0")).join("")}`);
  // Probability about 2^-128; failing loudly beats deriving a different key silently.
  if (k === 0n || k >= SECP256K1_N) throw new Error("Creator key is out of range for secp256k1");
  return key;
}
