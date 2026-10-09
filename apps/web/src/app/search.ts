import { MATCH_DISTANCE } from "@origo/sdk";
import { REGISTRY, type RegistryRecord, publicClient, registryAbi } from "../lib/registry";

/** Low-confidence pass ("likely the same photo, edited"), ARCHITECTURE.md section 9. */
export const LOOSE_DISTANCE = 11;
const PER_BUCKET = 8n;
const PAGE = 256n;
const CONTESTED_SECONDS = 60;

export type Label = { by: `0x${string}`; label: string };

export type Match = {
  id: number;
  /** 0 is the whole photo, k is crop tile k. */
  tile: number;
  distance: number;
  record: RegistryRecord;
  labels: Label[];
  thumbnailUrl?: string;
  /** Another match was registered within 60 seconds of this one. */
  contested: boolean;
  /** The creator proved holding the original file in this browser session. */
  proved: boolean;
};

export type SearchResult = { matches: Match[]; loose: boolean };
export type LogLine = { text: string; ms?: number };

type Hit = { tile: number; distance: number };

function merge(found: Map<number, Hit>, ids: readonly number[], tiles: readonly number[], dists: readonly number[]) {
  ids.forEach((id, i) => {
    const prev = found.get(id);
    if (!prev || dists[i] < prev.distance) found.set(id, { tile: tiles[i], distance: dists[i] });
  });
}

/** One search pass over all orientation variants: earliest-first, then the paged walk if a bucket is long. */
async function pass(variants: readonly bigint[], maxDistance: number, radius: number): Promise<Map<number, Hit>> {
  const found = new Map<number, Hit>();
  await Promise.all(
    variants.map(async (h) => {
      const [ids, tiles, dists, complete] = await publicClient.readContract({
        address: REGISTRY,
        abi: registryAbi,
        functionName: "findEarliest",
        args: [h, maxDistance, radius, PER_BUCKET],
      });
      merge(found, ids, tiles, dists);
      if (complete) return;
      let cursor = 0n;
      do {
        const [pIds, pTiles, pDists, next] = await publicClient.readContract({
          address: REGISTRY,
          abi: registryAbi,
          functionName: "findMatches",
          args: [h, maxDistance, radius, cursor, PAGE],
        });
        merge(found, pIds, pTiles, pDists);
        cursor = next;
      } while (cursor !== 0n);
    }),
  );
  return found;
}

export async function thumbnailOf(id: number, block: bigint): Promise<string | undefined> {
  // Lists never come from logs (RPC range limits); a single-block read per record is fine.
  const logs = await publicClient.getContractEvents({
    address: REGISTRY,
    abi: registryAbi,
    eventName: "Registered",
    args: { id },
    fromBlock: block,
    toBlock: block,
  });
  const bytes = logs[0]?.args.thumbnail;
  if (!bytes || bytes === "0x") return undefined;
  const raw = Uint8Array.from(bytes.slice(2).match(/../g)!.map((b) => parseInt(b, 16)));
  return URL.createObjectURL(new Blob([raw]));
}

const PROVED_KEY = "origo.proved";

/** Record ids whose original file was proven in this browser session (Record page). */
export function provedIds(): Set<number> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(PROVED_KEY) ?? "[]") as number[]);
  } catch {
    return new Set();
  }
}

export function markProved(id: number) {
  try {
    sessionStorage.setItem(PROVED_KEY, JSON.stringify([...provedIds().add(id)]));
  } catch {
    // Private mode or blocked storage: the proof still shows on the page, it just is not remembered.
  }
}

/** Evidence order from ARCHITECTURE.md section 10. */
function rank(a: Match, b: Match) {
  const proved = Number(b.proved) - Number(a.proved);
  if (proved) return proved;
  const labeled = Number(b.labels.length > 0) - Number(a.labels.length > 0);
  if (labeled) return labeled;
  if (a.record.registeredBlock !== b.record.registeredBlock) return a.record.registeredBlock < b.record.registeredBlock ? -1 : 1;
  return a.id - b.id;
}

export async function searchRegistry(variants: readonly bigint[], log: (line: LogLine) => void): Promise<SearchResult> {
  let t = performance.now();
  let found = await pass(variants, MATCH_DISTANCE, 1);
  let loose = false;
  log({ text: `findEarliest, ${variants.length} orientations, up to ${MATCH_DISTANCE} bits`, ms: performance.now() - t });

  if (found.size === 0) {
    t = performance.now();
    found = await pass(variants, LOOSE_DISTANCE, 2);
    loose = found.size > 0;
    log({ text: `wider pass, up to ${LOOSE_DISTANCE} bits`, ms: performance.now() - t });
  }
  if (found.size === 0) return { matches: [], loose: false };

  t = performance.now();
  const ids = [...found.keys()];
  const records = (await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "getRecords",
    args: [ids],
  })) as readonly RegistryRecord[];
  const creators = [...new Set(records.map((r) => r.creator))];
  const labelLists = await Promise.all(
    creators.map((c) => publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "labelsOf", args: [c] })),
  );
  const labelsBy = new Map(
    creators.map((c, i) => [c, labelLists[i][0].map((by, j) => ({ by, label: labelLists[i][1][j] }))] as const),
  );
  const thumbs = await Promise.all(
    records.map((r, i) => (r.hasThumbnail ? thumbnailOf(ids[i], r.registeredBlock).catch(() => undefined) : undefined)),
  );
  log({ text: `read ${records.length} record${records.length === 1 ? "" : "s"} and labels`, ms: performance.now() - t });

  const proved = provedIds();
  const matches: Match[] = ids.map((id, i) => ({
    id,
    ...found.get(id)!,
    record: records[i],
    labels: labelsBy.get(records[i].creator) ?? [],
    thumbnailUrl: thumbs[i],
    contested: false,
    proved: proved.has(id),
  }));
  for (const m of matches) {
    m.contested = matches.some(
      (o) => o !== m && Math.abs(Number(o.record.registeredAt) - Number(m.record.registeredAt)) <= CONTESTED_SECONDS,
    );
  }
  matches.sort(rank);
  return { matches, loose };
}
