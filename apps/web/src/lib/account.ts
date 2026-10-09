import {
  type PasskeyCredentialMetadata,
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { PRODUCTION_RP_ID, backupPhrase, creatorKey, prfFromBackupPhrase, walletKey } from "@origo/sdk";
import { useSyncExternalStore } from "react";
import type { LocalAccount } from "viem";

/**
 * Passkey account (docs/origo/ARCHITECTURE.md section 8). Only the credential id and transports are stored;
 * the PRF output and both private keys live in memory only, inside Mera signing sessions.
 */
export type Account = {
  /** Signs registrations; this address goes on the record as the creator. */
  creator: LocalAccount;
  /** Pays gas. Standard BIP-44 account, importable into any wallet via the backup phrase. */
  wallet: LocalAccount;
};

const STORAGE_KEY = "origo.credential";

let current: Account | null = null;
let ends: Array<() => void> = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Passkeys are bound to the hostname. The production one never changes (G6). */
export const rpId = () => location.hostname;
export const isTestHost = () => location.hostname !== PRODUCTION_RP_ID;

function savedCredential(): PasskeyCredentialMetadata | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PasskeyCredentialMetadata) : undefined;
  } catch {
    return undefined;
  }
}

function saveCredential(c: PasskeyCredentialMetadata) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ credentialId: c.credentialId, transports: c.transports }));
  } catch {
    // Storage blocked: signing in later still works, the browser just shows every passkey for this site.
  }
}

export const hasSavedPasskey = () => savedCredential() !== undefined;

function open(prf: Uint8Array) {
  const creatorBytes = creatorKey(prf);
  const walletBytes = walletKey(prf);
  const creatorSession = createSecp256k1SigningSession({ privateKey: creatorBytes });
  const walletSession = createSecp256k1SigningSession({ privateKey: walletBytes });
  // The sessions keep their own copies; wipe ours and the PRF output.
  creatorBytes.fill(0);
  walletBytes.fill(0);
  prf.fill(0);
  signOut();
  ends = [() => creatorSession.end(), () => walletSession.end()];
  current = { creator: toViemAccount(creatorSession), wallet: toViemAccount(walletSession) };
  emit();
}

/** Creates a new passkey for this site and opens its account. One or two system prompts. */
export async function createAccount() {
  const result = await createPasskeyWithPrfOutput({
    rp: { id: rpId(), name: "Origo" },
    user: { name: "Origo photo account", displayName: "Origo photo account" },
  });
  saveCredential(result);
  open(result.prfOutput);
}

/** Opens the account of an existing passkey. One system prompt. */
export async function signIn() {
  const result = await getPasskeyPrfOutput({ rpId: rpId(), credential: savedCredential() });
  saveCredential({ credentialId: result.credentialId, transports: savedCredential()?.transports });
  open(result.prfOutput);
}

/** Opens the account from its 24-word backup phrase, for a lost or new device. No passkey needed. */
export function signInWithBackupPhrase(phrase: string) {
  open(prfFromBackupPhrase(phrase));
}

/** Asks the passkey again and returns the backup phrase. The PRF output is wiped right after. */
export async function revealBackupPhrase(): Promise<string> {
  const result = await getPasskeyPrfOutput({ rpId: rpId(), credential: savedCredential() });
  try {
    return backupPhrase(result.prfOutput);
  } finally {
    result.prfOutput.fill(0);
  }
}

/** Zeroes both signing keys. */
export function signOut() {
  ends.forEach((end) => end());
  ends = [];
  if (current) {
    current = null;
    emit();
  }
}

if (typeof window !== "undefined") window.addEventListener("pagehide", signOut);

export function useAccount(): Account | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** Plain-language message for a failed passkey step. */
export function passkeyErrorMessage(err: unknown): string {
  if (isMeraError(err)) {
    switch (err.code) {
      case "PRF_UNAVAILABLE":
        return "This browser or password manager cannot derive keys from a passkey (WebAuthn PRF). Try Chrome, Safari 18 or newer, or a phone with an up-to-date OS.";
      case "PASSKEY_OPERATION_FAILED":
        return "The passkey prompt was closed or failed. Try again.";
      case "CRYPTO_UNAVAILABLE":
        return "This browser lacks the Web Crypto features Origo needs.";
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : String(err);
}
