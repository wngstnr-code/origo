import { RPC_URLS } from "@origo/sdk";
import { createPublicClient, fallback, http, parseAbi } from "viem";
import { CHAIN } from "./chain";

export { CHAIN, EXPLORER, REGISTRY } from "./chain";

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
