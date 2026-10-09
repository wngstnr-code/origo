import { EXPLORERS, REGISTRY_ADDRESS, RPC_URLS, monadTestnet } from "@origo/sdk";
import { createPublicClient, fallback, http, parseAbi } from "viem";

/** The landing reads the frozen testnet deployment until mainnet is live. */
export const CHAIN = monadTestnet;
export const REGISTRY = REGISTRY_ADDRESS[CHAIN.id]!;
export const EXPLORER = EXPLORERS[CHAIN.id];

export const registryAbi = parseAbi([
  "struct Record { address creator; uint40 registeredAt; uint8 source; uint16 width; uint16 height; uint8 hashVersion; bool hasThumbnail; address submitter; uint64 pHash; bytes32 fileCommit; uint64 registeredBlock; uint8 tileCount; }",
  "function recordCount() view returns (uint256)",
  "function getRecord(uint32 id) view returns (Record)",
]);

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: fallback(RPC_URLS[CHAIN.id].map((url) => http(url))),
});

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
