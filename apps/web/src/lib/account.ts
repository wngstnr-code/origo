import {
  type PasskeyCredentialMetadata,
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { PRODUCTION_RP_ID, RPC_URLS, backupPhrase, creatorKey, prfFromBackupPhrase, walletKey } from "@origo/sdk";
import { useSyncExternalStore } from "react";
import {
  type Account as ViemAccount,
  type Address,
  type Chain,
  type EIP1193Provider,
  type LocalAccount,
  type Transport,
  type WalletClient,
  createWalletClient,
  custom,
  fallback,
  http,
} from "viem";
import { CHAIN } from "./chain";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

/** Anything that can sign the EIP-712 registration: a Mera session or an injected wallet. */
export type CreatorSigner = { address: Address; signTypedData: LocalAccount["signTypedData"] };

/**
 * The signed-in account (docs/origo/ARCHITECTURE.md section 8).
 * - passkey: the creator key and the wallet key are two different keys from one passkey. Only the credential id
 *   is stored; the keys live in memory inside Mera signing sessions.
 * - browser: fallback for browsers without passkey PRF (GAPS.md G7). One injected wallet address is both the
 *   creator and the payer, and the UI says so.
 */
export type Account = {
  kind: "passkey" | "browser";
  /** Signs registrations; this address goes on the record as the creator. */
  creator: CreatorSigner;
  /** Pays gas. For a passkey, a standard BIP-44 account importable via the backup phrase. */
  wallet: { address: Address };
  /** Sends transactions from `wallet`. */
  walletClient: WalletClient<Transport, Chain, ViemAccount>;
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
  const wallet = toViemAccount(walletSession);
  current = {
    kind: "passkey",
    creator: toViemAccount(creatorSession),
    wallet,
    walletClient: createWalletClient({ account: wallet, chain: CHAIN, transport: fallback(RPC_URLS[CHAIN.id].map((url) => http(url))) }),
  };
  emit();
}

export const hasBrowserWallet = () => typeof window !== "undefined" && !!window.ethereum;

/** Connects MetaMask or another injected wallet and switches it to the Origo chain. */
export async function connectBrowserWallet() {
  const provider = window.ethereum;
  if (!provider) throw new Error("No browser wallet found. Install MetaMask or Rabby, or use a passkey on a phone.");
  const [address] = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
  if (!address) throw new Error("The wallet did not share an address.");
  const walletClient = createWalletClient({ account: address, chain: CHAIN, transport: custom(provider) });
  try {
    await walletClient.switchChain({ id: CHAIN.id });
  } catch {
    await walletClient.addChain({ chain: CHAIN });
  }
  signOut();
  current = {
    kind: "browser",
    creator: {
      address,
      signTypedData: ((args: Parameters<LocalAccount["signTypedData"]>[0]) =>
        walletClient.signTypedData({ ...args, account: address } as never)) as LocalAccount["signTypedData"],
    },
    wallet: { address },
    walletClient,
  };
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
        return "This browser or password manager cannot derive keys from a passkey (WebAuthn PRF). Try Safari 18 or newer, a phone with an up-to-date OS, or use a browser wallet instead.";
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
