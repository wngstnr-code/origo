import {
  MATCH_DISTANCE,
  TILE_WINDOWS,
  hamming,
  hashToHex,
  phash,
  phashVariants,
  phashWithTiles,
  tileRect,
} from "@origo/sdk";
import { useEffect, useState } from "react";
import { loadRGBA } from "../lib/image";
import { BitGrid } from "../ui/BitGrid";
import { CHAIN, EXPLORER, REGISTRY, publicClient, registryAbi, shortAddress } from "../lib/registry";

type Async<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

function useAsync<T>(run: () => Promise<T>, deps: unknown[] = []): [Async<T>, () => void] {
  const [result, setResult] = useState<Async<T>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setResult({ state: "loading" });
    run().then(
      (value) => live && setResult({ state: "ready", value }),
      (err: unknown) => live && setResult({ state: "error", message: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return [result, () => setAttempt((n) => n + 1)];
}

const ORIGINAL = "/demo/original.jpg";
const WHATSAPP = "/demo/whatsapp-twice.jpg";
const CROP = "/demo/crop-20.jpg";

async function fileSize(url: string) {
  const res = await fetch(url, { method: "HEAD" });
  return Number(res.headers.get("content-length") ?? 0);
}
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

function Pending({ label }: { label: string }) {
  return <p className="demo-status">{label}</p>;
}

function Failed({ message, retry }: { message: string; retry: () => void }) {
  return (
    <p className="demo-status demo-error">
      {message}{" "}
      <button type="button" className="link-button" onClick={retry}>
        Try again
      </button>
    </p>
  );
}

/** Hashes the original and a twice-compressed copy right here in the browser and compares them. */
export function WhatsAppDemo() {
  const [result, retry] = useAsync(async () => {
    const [a, b, sizeA, sizeB] = await Promise.all([loadRGBA(ORIGINAL), loadRGBA(WHATSAPP), fileSize(ORIGINAL), fileSize(WHATSAPP)]);
    const t0 = performance.now();
    const original = phash(a);
    const variants = phashVariants(b);
    const copy = variants.reduce((best, v) => (hamming(v, original) < hamming(best, original) ? v : best));
    return {
      original,
      copy,
      distance: hamming(copy, original),
      ms: Math.round(performance.now() - t0),
      a: { w: a.width, h: a.height, size: sizeA },
      b: { w: b.width, h: b.height, size: sizeB },
    };
  });

  return (
    <figure className="demo">
      <div className="prints">
        <div className="print tilt-left">
          <img src={ORIGINAL} alt="Red Cross volunteers checking aid boxes, the original photo" width={1280} height={960} />
          <figcaption>Original</figcaption>
        </div>
        <div className="print tilt-right">
          <img src={WHATSAPP} alt="The same photo after WhatsApp-style compression twice" width={800} height={600} />
          <figcaption>Forwarded twice</figcaption>
        </div>
      </div>
      {result.state === "loading" && <Pending label="Hashing both photos in your browser…" />}
      {result.state === "error" && <Failed message={result.message} retry={retry} />}
      {result.state === "ready" && (
        <div className="demo-result">
          <div className="grids">
            <div>
              <BitGrid hash={result.value.original} />
              <p className="mono small">
                {result.value.a.w}×{result.value.a.h}, {kb(result.value.a.size)}
              </p>
            </div>
            <div>
              <BitGrid hash={result.value.copy} against={result.value.original} />
              <p className="mono small">
                {result.value.b.w}×{result.value.b.h}, {kb(result.value.b.size)}
              </p>
            </div>
          </div>
          <p className={`verdict ${result.value.distance <= MATCH_DISTANCE ? "match" : "warn"}`}>
            <strong>{result.value.distance} of 64 bits</strong> differ.{" "}
            {result.value.distance <= MATCH_DISTANCE ? "Same photo." : "Not a confident match."}
            <span className="mono small"> hashed in {result.value.ms} ms, on this device</span>
          </p>
        </div>
      )}
    </figure>
  );
}

/** Shows which of the 39 registered tiles catches a 20% crop that the whole-photo hash misses. */
export function CropDemo() {
  const [result, retry] = useAsync(async () => {
    const [a, b] = await Promise.all([loadRGBA(ORIGINAL), loadRGBA(CROP)]);
    const tiled = phashWithTiles(a);
    const variants = phashVariants(b);
    const dist = (h: bigint) => Math.min(...variants.map((v) => hamming(v, h)));
    const whole = dist(tiled.pHash);
    let best = { index: 0, distance: 64 };
    tiled.tiles.forEach((t, index) => {
      const d = dist(t);
      if (d < best.distance) best = { index, distance: d };
    });
    const rect = tileRect(TILE_WINDOWS[best.index], tiled.content);
    return { whole, best, rect, size: { w: a.width, h: a.height } };
  });

  const box =
    result.state === "ready"
      ? {
          left: `${(100 * result.value.rect.x) / result.value.size.w}%`,
          top: `${(100 * result.value.rect.y) / result.value.size.h}%`,
          width: `${(100 * result.value.rect.width) / result.value.size.w}%`,
          height: `${(100 * result.value.rect.height) / result.value.size.h}%`,
        }
      : undefined;

  return (
    <figure className="demo">
      <div className="prints">
        <div className="print tilt-right crop-stage">
          <div className="frame">
            <img src={ORIGINAL} alt="The original photo, with the matching tile outlined" width={1280} height={960} />
            {box && (
              <span className="tile-box" style={box}>
                <i className="mark tl" />
                <i className="mark tr" />
                <i className="mark bl" />
                <i className="mark br" />
              </span>
            )}
          </div>
          <figcaption>Registered, with 39 tiles</figcaption>
        </div>
        <div className="print tilt-left small-print">
          <img src={CROP} alt="A copy with 20% cropped off the edges" width={1024} height={768} />
          <figcaption>Someone cropped it</figcaption>
        </div>
      </div>
      {result.state === "loading" && <Pending label="Hashing the crop and all 39 tiles…" />}
      {result.state === "error" && <Failed message={result.message} retry={retry} />}
      {result.state === "ready" && (
        <dl className="demo-facts">
          <div>
            <dt>Whole-photo fingerprint</dt>
            <dd className={result.value.whole <= MATCH_DISTANCE ? "match" : "warn"}>{result.value.whole} bits off</dd>
          </div>
          <div>
            <dt>Best tile, #{result.value.best.index + 1} of 39</dt>
            <dd className={result.value.best.distance <= MATCH_DISTANCE ? "match" : "warn"}>
              {result.value.best.distance} bits off
            </dd>
          </div>
        </dl>
      )}
    </figure>
  );
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

/** Reads the newest record straight from the registry contract on Monad. */
export function LatestRecord() {
  const [result, retry] = useAsync(async () => {
    const count = await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "recordCount" });
    if (count === 0n) return null;
    const t0 = performance.now();
    const rec = await publicClient.readContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: "getRecord",
      args: [Number(count)],
    });
    return { id: Number(count), rec, ms: Math.round(performance.now() - t0) };
  });

  return (
    <figure className="ticket">
      <header>
        <span className="ticket-chain">{CHAIN.name}</span>
        <a className="mono small" href={`${EXPLORER}/address/${REGISTRY}`} target="_blank" rel="noreferrer">
          {shortAddress(REGISTRY)}
        </a>
      </header>
      {result.state === "loading" && <Pending label="Reading the registry on Monad…" />}
      {result.state === "error" && <Failed message="Could not reach a Monad RPC." retry={retry} />}
      {result.state === "ready" && result.value === null && <Pending label="No records yet." />}
      {result.state === "ready" && result.value && (
        <>
          <p className="ticket-id">Record #{result.value.id}</p>
          <dl className="ticket-rows">
            <div>
              <dt>Creator</dt>
              <dd className="mono">{shortAddress(result.value.rec.creator)}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{timeFmt.format(new Date(Number(result.value.rec.registeredAt) * 1000))}</dd>
            </div>
            <div>
              <dt>Block</dt>
              <dd className="mono">{result.value.rec.registeredBlock.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt>Fingerprint</dt>
              <dd className="mono">{hashToHex(result.value.rec.pHash)}</dd>
            </div>
            <div>
              <dt>Crop tiles</dt>
              <dd>{result.value.rec.tileCount}</dd>
            </div>
          </dl>
          <p className="mono small ticket-foot">read live in {result.value.ms} ms, no server in between</p>
        </>
      )}
    </figure>
  );
}
