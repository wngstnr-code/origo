import { hashToHex } from "@origo/sdk";

/** 8 x 8 grid of the 64 hash bits, in the SDK's bit order (D[0][0] is bit 63). */
export function BitGrid({ hash, against, className }: { hash: bigint; against?: bigint; className?: string }) {
  const cells = [];
  for (let i = 0; i < 64; i++) {
    const bit = 63n - BigInt(i);
    const on = (hash >> bit) & 1n;
    const differs = against !== undefined && ((hash ^ against) >> bit) & 1n;
    cells.push(<span key={i} className={`bit${on ? " on" : ""}${differs ? " diff" : ""}`} />);
  }
  return (
    <div className={`bitgrid${className ? ` ${className}` : ""}`} role="img" aria-label={`Fingerprint ${hashToHex(hash)}`}>
      {cells}
    </div>
  );
}
