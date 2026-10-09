// End-to-end smoke test against a deployed OrigoRegistry.
// Registers a fixture photo with crop protection (39 tiles) signed by the deployer key, then searches for a
// WhatsApp-like copy and a 20% center crop.
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
import { HASH_VERSION, RPC_URLS, hashToHex, phashVariants, phashWithTiles, tilesHash } from "../dist/index.js";

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
const { pHash, tiles } = phashWithTiles(img);
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
  tilesHash: tilesHash(tiles),
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
      { name: "tilesHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Registration",
  message,
});

const args = [message, signature, "0x", tiles];
const gas = await pub.estimateContractGas({ address: registry, abi, functionName: "register", args, account });
const t0 = Date.now();
const hash = await wallet.writeContract({ address: registry, abi, functionName: "register", args, gas: (gas * 115n) / 100n });
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`registered ${fixture} with ${tiles.length} tiles pHash=${hashToHex(pHash)} tx=${hash} block=${receipt.blockNumber} gasUsed=${receipt.gasUsed} in ${Date.now() - t0} ms`);

async function search(buf) {
  const variants = phashVariants(await decode(buf));
  const found = new Map();
  for (const v of variants) {
    let cursor = 0n;
    do {
      const [ids, tileIndexes, distances, next] = await pub.readContract({
        address: registry,
        abi,
        functionName: "findMatches",
        args: [v, 11, 2, cursor, 256n],
      });
      ids.forEach((id, i) => {
        const prev = found.get(id);
        if (!prev || distances[i] < prev.distance) found.set(id, { tile: tileIndexes[i], distance: distances[i] });
      });
      cursor = next;
    } while (cursor !== 0n);
  }
  return found;
}

// Searched exactly like the Verify flow: 8 variants, paged, radius 2 (<= 11 bits).
const meta = { width: img.width, height: img.height };
const copy = await sharp(fileBytes).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer();
const dx = Math.round(meta.width * 0.1);
const dy = Math.round(meta.height * 0.1);
const crop = await sharp(fileBytes).extract({ left: dx, top: dy, width: meta.width - 2 * dx, height: meta.height - 2 * dy }).jpeg({ quality: 70 }).toBuffer();
const fmt = (m) => JSON.stringify([...m].map(([id, v]) => ({ id, tile: v.tile, distance: v.distance })));
const copyMatches = await search(copy);
console.log("WhatsApp-like copy:", fmt(copyMatches));
console.log("20% center crop:  ", fmt(await search(crop)));
const id = [...copyMatches.keys()].at(-1);
const rec = await pub.readContract({ address: registry, abi, functionName: "getRecord", args: [id] });
console.log(`record #${id} creator=${rec.creator} matchesSigner=${rec.creator === account.address} commitOk=${rec.fileCommit === fileCommit} tileCount=${rec.tileCount}`);
