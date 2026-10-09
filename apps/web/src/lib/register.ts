import {
  HASH_VERSION,
  THUMBNAIL_MAX_BYTES,
  THUMBNAIL_MAX_EDGE,
  type RGBAImage,
  isDegenerate,
  phashWithTiles,
  tilesHash,
} from "@origo/sdk";
import {
  type Account,
  BaseError,
  type Chain,
  ContractFunctionRevertedError,
  type Hex,
  type Transport,
  type WalletClient,
  bytesToHex,
  decodeAbiParameters,
  encodeAbiParameters,
  hexToBytes,
  keccak256,
  parseEventLogs,
} from "viem";
import type { CreatorSigner } from "./account";
import { CHAIN } from "./chain";
import { REGISTRY, publicClient, registryAbi } from "./registry";

const ZERO = `0x${"00".repeat(32)}` as const;
/** Monad charges the declared gas limit, so the margin is kept small (ARCHITECTURE.md section 4). */
const GAS_MARGIN_PERCENT = 115n;

export type Fingerprint = { pHash: bigint; tiles: bigint[]; digest: Hex };

/** Everything that depends only on the file: run once per photo. */
export async function fingerprint(file: Blob, img: RGBAImage): Promise<Fingerprint> {
  if (img.width > 65535 || img.height > 65535) throw new Error("Photos wider or taller than 65,535 pixels are not supported.");
  const { pHash, tiles } = phashWithTiles(img);
  if (isDegenerate(pHash)) throw new Error("This image is almost one flat color, so its fingerprint is not reliable enough to register.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return { pHash, tiles, digest: bytesToHex(digest) };
}

/** A small preview stored on chain in the event log, at most 96 px and 4 KB. */
export async function makeThumbnail(file: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.8, 0.65, 0.5, 0.35, 0.2]) {
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    if (blob.size <= THUMBNAIL_MAX_BYTES) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error("Could not make a preview small enough. Register without a public preview.");
}

export type Registration = {
  pHash: bigint;
  fileCommit: Hex;
  width: number;
  height: number;
  source: number;
  hashVersion: number;
  thumbnailHash: Hex;
  tilesHash: Hex;
  nonce: bigint;
  deadline: bigint;
};

/** The exact arguments of `register`: signed message, creator signature, thumbnail bytes, tiles. */
export type Signed = readonly [Registration, Hex, Hex, readonly bigint[]];

export type Draft = {
  args: Signed;
  gas: bigint;
  /** What the payer is charged: the gas limit times the current gas price. */
  cost: bigint;
};

export const TYPED_DATA = {
  domain: { name: "Origo", version: "1", chainId: CHAIN.id, verifyingContract: REGISTRY },
  types: {
    Registration: [
      { name: "pHash", type: "uint64" },
      { name: "fileCommit", type: "bytes32" },
      { name: "width", type: "uint16" },
      { name: "height", type: "uint16" },
      { name: "source", type: "uint8" },
      { name: "hashVersion", type: "uint8" },
      { name: "thumbnailHash", type: "bytes32" },
      { name: "tilesHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Registration",
} as const;

/** Paying yourself: one hour. A relay link waits for someone else: seven days (ARCHITECTURE.md section 9). */
export const OWN_DEADLINE_SECONDS = 3600;
export const RELAY_DEADLINE_SECONDS = 7 * 24 * 3600;

/** Signs a registration with the creator key. No prompt: the passkey session is already open. */
export async function sign(opts: {
  fp: Fingerprint;
  width: number;
  height: number;
  source: 0 | 1;
  thumbnail: Uint8Array | null;
  cropProtection: boolean;
  creator: CreatorSigner;
  validForSeconds: number;
}): Promise<Signed> {
  const tiles = opts.cropProtection ? opts.fp.tiles : [];
  const message: Registration = {
    pHash: opts.fp.pHash,
    fileCommit: keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [opts.fp.digest, opts.creator.address])),
    width: opts.width,
    height: opts.height,
    source: opts.source,
    hashVersion: HASH_VERSION,
    thumbnailHash: opts.thumbnail ? keccak256(opts.thumbnail) : ZERO,
    tilesHash: tiles.length ? tilesHash(tiles) : ZERO,
    nonce: BigInt(bytesToHex(crypto.getRandomValues(new Uint8Array(32)))),
    deadline: BigInt(Math.floor(Date.now() / 1000) + opts.validForSeconds),
  };
  const signature = await opts.creator.signTypedData({ ...TYPED_DATA, message });
  return [message, signature, opts.thumbnail ? bytesToHex(opts.thumbnail) : "0x", tiles] as const;
}

/** Prices a signed registration for a payer. Reverts (already registered, expired, ...) surface here. */
export async function price(args: Signed, payer: `0x${string}`): Promise<Draft> {
  const [estimate, gasPrice] = await Promise.all([
    publicClient.estimateContractGas({ address: REGISTRY, abi: registryAbi, functionName: "register", args, account: payer }),
    publicClient.getGasPrice(),
  ]);
  const gas = (estimate * GAS_MARGIN_PERCENT) / 100n;
  return { args, gas, cost: gas * gasPrice };
}

// ---------- relay links ----------

const SIGNED_ABI = [
  {
    type: "tuple",
    components: TYPED_DATA.types.Registration.map((f) => ({ name: f.name, type: f.type })),
  },
  { type: "bytes" },
  { type: "bytes" },
  { type: "uint64[]" },
] as const;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromBase64Url = (s: string) => {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/** A link anyone can open to pay for this registration. The data rides in the fragment, which never reaches a server. */
export function relayLink(args: Signed): string {
  const bytes = hexToBytes(encodeAbiParameters(SIGNED_ABI, args as never));
  return `${location.origin}/app/relay#${toBase64Url(bytes)}`;
}

export function parseRelayFragment(fragment: string): Signed {
  // Any decoding failure means the link was cut or edited on the way.
  const raw = fragment.replace(/^#/, "");
  if (!raw) throw new Error("This relay link is empty.");
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(raw);
  } catch {
    throw new Error("This relay link is damaged. Ask for a new one.");
  }
  try {
    const [r, signature, thumbnail, tiles] = decodeAbiParameters(SIGNED_ABI, bytesToHex(bytes));
    return [r as Registration, signature, thumbnail, tiles] as const;
  } catch {
    throw new Error("This relay link is damaged. Ask for a new one.");
  }
}

export type Registered = { id: number; hash: Hex; block: bigint; ms: number };

/** Sends a priced registration from any wallet client: the passkey wallet or an injected browser wallet. */
export async function send(draft: Draft, client: WalletClient<Transport, Chain, Account>): Promise<Registered> {
  const t0 = performance.now();
  const hash = await client.writeContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "register",
    args: draft.args,
    gas: draft.gas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was included but reverted.");
  const [event] = parseEventLogs({ abi: registryAbi, eventName: "Registered", logs: receipt.logs });
  return { id: Number(event.args.id), hash, block: receipt.blockNumber, ms: performance.now() - t0 };
}

const REVERT_MESSAGES: Record<string, string> = {
  CommitAlreadyRegistered: "This creator already registered this exact file.",
  DegenerateHash: "This image is too uniform to register.",
  Expired: "The signed registration expired. Prepare it again.",
  ThumbnailTooLarge: "The preview is too large.",
};

/** Turns RPC and contract errors into one readable sentence. */
export function registerErrorMessage(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "";
      return REVERT_MESSAGES[name] ?? `The registry rejected it (${name || "unknown reason"}).`;
    }
    if (/insufficient funds|balance/i.test(err.message)) return "The wallet does not have enough MON to pay for gas.";
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}
