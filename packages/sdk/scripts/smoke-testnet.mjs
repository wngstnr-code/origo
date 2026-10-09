// End-to-end smoke test against a deployed OrigoRegistry.
// Registers a fixture photo signed by the deployer key, then searches for a WhatsApp-like copy.
// Usage (from repo root, after `pnpm --filter @origo/sdk build` and `forge build`):
//   set -a; . ./.env; set +a; node packages/sdk/scripts/smoke-testnet.mjs <registry address> [fixture file]
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createPublicClient, createWalletClient, encodeAbiParameters, fallback, http, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { HASH_VERSION, RPC_URLS, hashToHex, phash, phashVariants } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = process.argv[2];
const fixture = process.argv[3] ?? "f01-afd-conditions-after-the-sumatra-floods.jpg";
if (!registry || !process.env.DEPLOYER_PRIVATE_KEY) throw new Error("usage: DEPLOYER_PRIVATE_KEY=... node smoke-testnet.mjs <registry>");

const artifact = JSON.parse(await readFile(path.resolve(here, "../../../contracts/out/OrigoRegistry.sol/OrigoRegistry.json"), "utf8"));
const abi = artifact.abi;
const transport = fallback(RPC_URLS[monadTestnet.id].map((u) => http(u)));
const pub = createPublicClient({ chain: monadTestnet, transport });
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const wallet = createWalletClient({ chain: monadTestnet, transport, account });

async function decode(buf) {
  const { data, info } = await sharp(buf).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

const fileBytes = await readFile(path.resolve(here, "../fixtures/photos", fixture));
const img = await decode(fileBytes);
const pHash = phash(img);
const digest = `0x${createHash("sha256").update(fileBytes).digest("hex")}`;
const fileCommit = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [digest, account.address]));

const message = {
  pHash,
  fileCommit,
  width: img.width,
  height: img.height,
  source: 0,
  hashVersion: HASH_VERSION,
  thumbnailHash: `0x${"00".repeat(32)}`,
  nonce: BigInt(`0x${randomBytes(32).toString("hex")}`),
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
};
const signature = await account.signTypedData({
  domain: { name: "Origo", version: "1", chainId: monadTestnet.id, verifyingContract: registry },
  types: {
    Registration: [
      { name: "pHash", type: "uint64" },
      { name: "fileCommit", type: "bytes32" },
      { name: "width", type: "uint16" },
      { name: "height", type: "uint16" },
      { name: "source", type: "uint8" },
      { name: "hashVersion", type: "uint8" },
      { name: "thumbnailHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Registration",
  message,
});

const args = [message, signature, "0x"];
const gas = await pub.estimateContractGas({ address: registry, abi, functionName: "register", args, account });
const t0 = Date.now();
const hash = await wallet.writeContract({ address: registry, abi, functionName: "register", args, gas: (gas * 115n) / 100n });
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`registered ${fixture} pHash=${hashToHex(pHash)} tx=${hash} block=${receipt.blockNumber} gasUsed=${receipt.gasUsed} in ${Date.now() - t0} ms`);

// A WhatsApp-like copy, searched exactly like the Verify flow (8 variants, paged).
const copy = await sharp(fileBytes).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer();
const variants = phashVariants(await decode(copy));
const found = new Map();
for (const v of variants) {
  let cursor = 0n;
  do {
    const [ids, distances, next] = await pub.readContract({
      address: registry,
      abi,
      functionName: "findMatches",
      args: [v, 7, 1, cursor, 256n],
    });
    ids.forEach((id, i) => found.set(id, Math.min(found.get(id) ?? 99, distances[i])));
    cursor = next;
  } while (cursor !== 0n);
}
console.log("matches for the WhatsApp-like copy:", Object.fromEntries(found));
const rec = await pub.readContract({ address: registry, abi, functionName: "getRecord", args: [[...found.keys()][0] ?? 1] });
console.log(`record creator=${rec.creator} matchesSigner=${rec.creator === account.address} commitOk=${rec.fileCommit === fileCommit}`);
