import { ImageTooSmallError, type RGBAImage, type Rect, isDegenerate, phashVariants } from "@origo/sdk";
import { type DragEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Owl } from "../landing/Owl";
import { Shore, Stars } from "../landing/Space";
import { EXPLORER } from "../lib/chain";
import { blobToRGBA } from "../lib/image";
import { shortAddress } from "../lib/registry";
import { onLinkClick } from "../router";
import { BitGrid } from "../ui/BitGrid";
import { LOOSE_DISTANCE, type LogLine, type Match, type SearchResult, searchRegistry } from "./search";

type Photo = { url: string; name: string; img: RGBAImage };
type Phase =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; result: SearchResult }
  | { kind: "error"; message: string };
/** Crop in fractions of the photo, so it survives layout changes. */
type FracRect = { x: number; y: number; w: number; h: number };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const when = (r: Match["record"]) => dateFmt.format(new Date(Number(r.registeredAt) * 1000));

function toPixels(c: FracRect, img: RGBAImage): Rect {
  return {
    x: Math.round(c.x * img.width),
    y: Math.round(c.y * img.height),
    width: Math.round(c.w * img.width),
    height: Math.round(c.h * img.height),
  };
}

function messageOf(err: unknown): string {
  if (err instanceof ImageTooSmallError) return "This image is too small to fingerprint. It needs at least 32 pixels on each side.";
  if (err instanceof Error && /fetch|network|http|rpc/i.test(err.message)) return "Could not reach a Monad RPC. Check your connection and try again.";
  return err instanceof Error ? err.message : String(err);
}

export function Verify() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [crop, setCrop] = useState<FracRect | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [log, setLog] = useState<LogLine[]>([]);
  const [dragging, setDragging] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const runId = useRef(0);

  const run = useCallback(async (p: Photo, c: FracRect | null) => {
    const id = ++runId.current;
    const lines: LogLine[] = [];
    const push = (line: LogLine) => {
      lines.push(line);
      if (id === runId.current) setLog([...lines]);
    };
    setPhase({ kind: "working" });
    setLog([]);
    try {
      let t = performance.now();
      const variants = phashVariants(p.img, c ? { crop: toPixels(c, p.img) } : {});
      push({ text: `hashed 8 orientations of ${c ? "the selected area" : "the photo"}`, ms: performance.now() - t });
      if (isDegenerate(variants[0])) {
        throw new Error("This image is almost one flat color, so its fingerprint is not reliable enough to search.");
      }
      t = performance.now();
      const result = await searchRegistry(variants, push);
      if (id !== runId.current) return;
      push({ text: `done, ${result.matches.length} match${result.matches.length === 1 ? "" : "es"} in total`, ms: performance.now() - t });
      setPhase({ kind: "done", result });
    } catch (err) {
      if (id === runId.current) setPhase({ kind: "error", message: messageOf(err) });
    }
  }, []);

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setPhase({ kind: "error", message: "That is not an image file. Try a JPEG, PNG or WebP." });
        return;
      }
      try {
        const img = await blobToRGBA(file);
        const next = { url: URL.createObjectURL(file), name: file.name || "pasted image", img };
        setPhoto((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return next;
        });
        setCrop(null);
        void run(next, null);
      } catch (err) {
        setPhase({ kind: "error", message: messageOf(err) });
      }
    },
    [run],
  );

  // Bring the results into view once the new photo has rendered.
  useEffect(() => {
    if (photo) resultsRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [photo]);

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) void accept(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void accept(e.dataTransfer.files[0]);
  };

  return (
    <main id="main">
      <section className="sky">
        <Stars />
        <div className="wrap sky-inner">
          <h1>Who took this photo first?</h1>
          <p>Drop a photo that reached you. Origo looks for it on Monad, even after compression, mirroring or a crop.</p>
          <label
            className={`dropzone${dragging ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                void accept(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <span className="dropzone-title">Drop a photo here</span>
            <span className="dropzone-sub">or paste it, or tap to choose one. It never leaves your device.</span>
            <span className="button primary">Choose a photo</span>
          </label>
        </div>
        <Owl className="sky-owl" />
        <Shore />
      </section>

      <section className="results wrap" ref={resultsRef} aria-live="polite">
        {phase.kind === "error" && !photo && <p className="notice warn-notice">{phase.message}</p>}
        {photo && (
          <div className="results-grid">
            <YourPhoto photo={photo} crop={crop} setCrop={setCrop} log={log} onSearch={() => run(photo, crop)} busy={phase.kind === "working"} />
            <div className="results-main">
              {phase.kind === "working" && <p className="verdict-pending">Searching Monad…</p>}
              {phase.kind === "error" && <p className="notice warn-notice">{phase.message}</p>}
              {phase.kind === "done" && <Results result={phase.result} cropped={crop !== null} />}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function YourPhoto({
  photo,
  crop,
  setCrop,
  log,
  onSearch,
  busy,
}: {
  photo: Photo;
  crop: FracRect | null;
  setCrop: (c: FracRect | null) => void;
  log: LogLine[];
  onSearch: () => void;
  busy: boolean;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<FracRect | null>(null);

  const frac = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): FracRect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  const shown = draft ?? crop;
  return (
    <aside className="your-photo">
      <h2 className="eyebrow">Your photo</h2>
      <figure className="print">
        <div
          className="frame crop-surface"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = frac(e);
            setDraft(null);
          }}
          onPointerMove={(e) => {
            if (start.current) setDraft(rectFrom(start.current, frac(e)));
          }}
          onPointerUp={(e) => {
            if (!start.current) return;
            const r = rectFrom(start.current, frac(e));
            start.current = null;
            setDraft(null);
            // Ignore taps; a usable area is at least a tenth of each side.
            if (r.w > 0.1 && r.h > 0.1) setCrop(r);
          }}
        >
          <img src={photo.url} alt="The photo you are checking" draggable={false} />
          {shown && (
            <span
              className="tile-box"
              style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }}
            >
              <i className="mark tl" />
              <i className="mark tr" />
              <i className="mark bl" />
              <i className="mark br" />
            </span>
          )}
        </div>
        <figcaption>
          {photo.name} · {photo.img.width}×{photo.img.height}
        </figcaption>
      </figure>
      <p className="hint">
        Screenshot of a chat? Drag a box around the photo itself, then search that area.
      </p>
      <div className="crop-actions">
        <button type="button" className="button primary small-button" disabled={!crop || busy} onClick={onSearch}>
          Search this area
        </button>
        {crop && (
          <button type="button" className="link-button" onClick={() => setCrop(null)}>
            Clear box
          </button>
        )}
      </div>
      {log.length > 0 && (
        <ol className="wire-log mono" aria-label="What happened">
          {log.map((l, i) => (
            <li key={i}>
              <span>{l.text}</span>
              {l.ms !== undefined && <span>{Math.round(l.ms)} ms</span>}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function Results({ result, cropped }: { result: SearchResult; cropped: boolean }) {
  if (result.matches.length === 0) {
    return (
      <div className="verdict none">
        <h2>No registered photo looks like this</h2>
        <p>
          Nobody has registered this photo on Origo, or it was changed beyond recognition.
          {!cropped && " If it is a screenshot or has a caption bar, drag a box around the photo itself and search that area."}
        </p>
      </div>
    );
  }
  const top = result.matches[0];
  const earliest = result.matches.every((m) => m.record.registeredBlock >= top.record.registeredBlock);
  return (
    <>
      <div className="verdict found">
        <p className="eyebrow">Strongest evidence</p>
        <h2 className="mono">{shortAddress(top.record.creator)}</h2>
        <ul className="reasons">
          {top.proved && <li>The creator proved holding the original file in this browser</li>}
          {top.labels.map((l) => (
            <li key={l.by}>
              Labeled <strong>{l.label}</strong> by attester <span className="mono">{shortAddress(l.by)}</span>
            </li>
          ))}
          {earliest && (
            <li>
              Registered first among {result.matches.length === 1 ? "the matches" : `${result.matches.length} matches`}:{" "}
              {when(top.record)}, block {top.record.registeredBlock.toLocaleString("en-US")}
            </li>
          )}
          <li>
            {top.distance} of 64 bits differ{top.tile > 0 ? `, matched as a crop (tile ${top.tile})` : ""}
          </li>
        </ul>
        {result.loose && (
          <p className="notice warn-notice">
            Only similar photos were found (8 to {LOOSE_DISTANCE} bits apart): likely the same photo after edits. Look closely
            before relying on it.
          </p>
        )}
        {top.contested && (
          <p className="notice warn-notice">Contested: another match was registered within a minute of this one.</p>
        )}
        <p className="verdict-note">
          Origo shows who registered this photo first and when. That is strong evidence, not proof of who took it.{" "}
          <a href={`/app/record/${top.id}`} onClick={onLinkClick}>
            Open record #{top.id}
          </a>
        </p>
      </div>
      <h3 className="eyebrow cards-title">All matches</h3>
      <ol className="match-cards">
        {result.matches.map((m, i) => (
          <MatchCard key={m.id} match={m} tilt={i % 2 ? "tilt-right" : "tilt-left"} />
        ))}
      </ol>
    </>
  );
}

function MatchCard({ match: m, tilt }: { match: Match; tilt: string }) {
  return (
    <li className={`print match-card ${tilt}`}>
      <div className="match-visual">
        {m.thumbnailUrl ? (
          <img src={m.thumbnailUrl} alt={`Preview stored with record ${m.id}`} />
        ) : (
          <BitGrid hash={m.record.pHash} className="bitgrid-fill" />
        )}
      </div>
      <p className="match-id">
        <a href={`/app/record/${m.id}`} onClick={onLinkClick} className="stretched">
          Record #{m.id}
        </a>
      </p>
      <dl className="match-facts">
        <div>
          <dt>Match</dt>
          <dd className={m.distance <= 7 ? "match" : "warn"}>
            {m.distance} bits · {m.tile === 0 ? "whole photo" : `tile ${m.tile}`}
          </dd>
        </div>
        <div>
          <dt>Creator</dt>
          <dd className="mono">{shortAddress(m.record.creator)}</dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>{when(m.record)}</dd>
        </div>
        <div>
          <dt>Block</dt>
          <dd className="mono">
            <a href={`${EXPLORER}/block/${m.record.registeredBlock}`} target="_blank" rel="noreferrer">
              {m.record.registeredBlock.toLocaleString("en-US")}
            </a>
          </dd>
        </div>
      </dl>
      {(m.proved || m.contested || m.labels.length > 0 || !m.thumbnailUrl) && (
        <p className="match-tags">
          {m.labels.map((l) => (
            <span key={l.by} className="tag good">
              {l.label}
            </span>
          ))}
          {m.proved && <span className="tag good">original proven</span>}
          {m.contested && <span className="tag warn">contested</span>}
          {!m.thumbnailUrl && <span className="tag">no preview stored</span>}
        </p>
      )}
    </li>
  );
}
