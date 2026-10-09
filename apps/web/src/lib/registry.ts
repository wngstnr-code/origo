import { RPC_URLS } from "@origo/sdk";
import { createPublicClient, fallback, http, parseAbi } from "viem";
import { CHAIN } from "./chain";

export { CHAIN, EXPLORER, REGISTRY } from "./chain";

export const registryAbi = parseAbi([
  "struct Record { address creator; uint40 registeredAt; uint8 source; uint16 width; uint16 height; uint8 hashVersion; bool hasThumbnail; address submitter; uint64 pHash; bytes32 fileCommit; uint64 registeredBlock; uint8 tileCount; }",
  "function recordCount() view returns (uint256)",
  "function getRecord(uint32 id) view returns (Record)",
  "function getRecords(uint32[] ids) view returns (Record[])",
  "function findEarliest(uint64 h, uint8 maxDistance, uint8 probeRadius, uint256 perBucket) view returns (uint32[] ids, uint8[] tileIndexes, uint8[] distances, bool complete)",
  "function findMatches(uint64 h, uint8 maxDistance, uint8 probeRadius, uint256 cursor, uint256 maxCandidates) view returns (uint32[] ids, uint8[] tileIndexes, uint8[] distances, uint256 nextCursor)",
  "function labelsOf(address creator) view returns (address[] by, string[] labels)",
  "event Registered(uint32 indexed id, address indexed creator, uint64 pHash, bytes32 fileCommit, uint8 source, uint8 tileCount, bytes thumbnail)",
  "struct Registration { uint64 pHash; bytes32 fileCommit; uint16 width; uint16 height; uint8 source; uint8 hashVersion; bytes32 thumbnailHash; bytes32 tilesHash; uint256 nonce; uint256 deadline; }",
  "function register(Registration r, bytes creatorSig, bytes thumbnail, uint64[] tiles) returns (uint32 id)",
  "function recordsOf(address creator, uint256 offset, uint256 limit) view returns (uint32[])",
  "function creatorRecordCount(address creator) view returns (uint256)",
  "error InvalidSignature()",
  "error Expired()",
  "error NonceUsed()",
  "error WrongHashVersion()",
  "error DegenerateHash()",
  "error InvalidDimensions()",
  "error InvalidSource()",
  "error EmptyCommit()",
  "error CommitAlreadyRegistered()",
  "error ThumbnailTooLarge()",
  "error ThumbnailHashMismatch()",
  "error TooManyTiles()",
  "error TilesHashMismatch()",
  "error TooManyRecords()",
]);

export type RegistryRecord = {
  creator: `0x${string}`;
  registeredAt: number;
  source: number;
  width: number;
  height: number;
  hashVersion: number;
  hasThumbnail: boolean;
  submitter: `0x${string}`;
  pHash: bigint;
  fileCommit: `0x${string}`;
  registeredBlock: bigint;
  tileCount: number;
};

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: fallback(RPC_URLS[CHAIN.id].map((url) => http(url, { batch: true }))),
});

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
