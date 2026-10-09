import { MATCH_DISTANCE, hamming, hashToHex, phash } from "@origo/sdk";
import { type DragEvent, useEffect, useState } from "react";
import { encodeAbiParameters, keccak256 } from "viem";
import { Owl } from "../landing/Owl";
import { Shore, Stars } from "../landing/Space";
import { CHAIN, EXPLORER } from "../lib/chain";
import { blobToRGBA } from "../lib/image";
import { loadOriginal } from "../lib/originals";
import { REGISTRY, type RegistryRecord, publicClient, registryAbi, shortAddress } from "../lib/registry";
import { onLinkClick } from "../router";
import { BitGrid } from "../ui/BitGrid";
import { type Label, markProved, provedIds, thumbnailOf } from "./search";

type Loaded = { record: RegistryRecord; labels: Label[]; thumbnailUrl?: string };
type Load = { state: "loading" } | { state: "missing" } | { state: "error"; message: string } | { state: "ready"; value: Loaded };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "medium" });

async function loadRecord(id: number): Promise<Loaded | null> {
  const count = await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "recordCount" });
  if (id < 1 || BigInt(id) > count) return null;
  const record = (await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "getRecord",
    args: [id],
  })) as RegistryRecord;
  const [by, labels] = await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "labelsOf",
    args: [record.creator],
  });
  const thumbnailUrl = record.hasThumbnail ? await thumbnailOf(id, record.registeredBlock).catch(() => undefined) : undefined;
  return { record, labels: by.map((b, i) => ({ by: b, label: labels[i] })), thumbnailUrl };
}

export function RecordPage({ id }: { id: number }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [proved, setProved] = useState(() => provedIds().has(id));

  useEffect(() => {
    let live = true;
    loadRecord(id).then(
      (value) => live && setLoad(value ? { state: "ready", value } : { state: "missing" }),
      () => live && setLoad({ state: "error", message: "Could not reach a Monad RPC." }),
    );
    return () => {
      live = false;
    };
  }, [id, attempt]);

  return (
    <main id="main">
      <section className="sky sky-record">
        <Stars />
        <div className="wrap sky-inner">
          {load.state === "loading" && <p className="sky-status">Reading record #{id} from Monad…</p>}
          {load.state === "missing" && (
            <div className="sky-status">
              <h1>No record #{id}</h1>
              <p>
                The registry has no record with this number.{" "}
                <a href="/app" onClick={onLinkClick}>
                  Check a photo instead
                </a>
                .
              </p>
            </div>
          )}
          {load.state === "error" && (
            <p className="sky-status">
              {load.message}{" "}
              <button type="button" className="link-button on-dark" onClick={() => {
                  setLoad({ state: "loading" });
                  setAttempt((n) => n + 1);
                }}>
                Try again
              </button>
            </p>
          )}
          {load.state === "ready" && <Certificate id={id} data={load.value} proved={proved} />}
        </div>
        <Owl className="sky-owl" />
        <Shore />
      </section>
      {load.state === "ready" && <Prove id={id} record={load.value.record} onProved={() => setProved(true)} />}
    </main>
  );
}

function Certificate({ id, data, proved }: { id: number; data: Loaded; proved: boolean }) {
  const { record: r, labels, thumbnailUrl } = data;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  };

  return (
    <article className="certificate">
      <header>
        <span>{CHAIN.name}</span>
        <h1>Record #{id}</h1>
      </header>
      <div className="certificate-body">
        <div className="certificate-visual">
          {thumbnailUrl ? <img src={thumbnailUrl} alt={`Preview stored with record ${id}`} /> : <BitGrid hash={r.pHash} />}
          <p className="mono small">{hashToHex(r.pHash)}</p>
        </div>
        <dl className="certificate-facts">
          <div>
            <dt>Registered by</dt>
            <dd className="mono" title={r.creator}>
              {shortAddress(r.creator)}
            </dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{dateFmt.format(new Date(Number(r.registeredAt) * 1000))}</dd>
          </div>
          <div>
            <dt>Block</dt>
            <dd className="mono">
              <a href={`${EXPLORER}/block/${r.registeredBlock}`} target="_blank" rel="noreferrer">
                {r.registeredBlock.toLocaleString("en-US")}
              </a>
            </dd>
          </div>
          <div>
            <dt>Original size</dt>
            <dd>
              {r.width}×{r.height}
            </dd>
          </div>
          <div>
            <dt>Crop protection</dt>
            <dd>{r.tileCount > 0 ? `${r.tileCount} tiles` : "off"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{r.source === 1 ? "Camera" : "Upload"} (self-reported)</dd>
          </div>
          {r.submitter !== r.creator && (
            <div>
              <dt>Paid for by</dt>
              <dd className="mono">{shortAddress(r.submitter)}</dd>
            </div>
          )}
        </dl>
      </div>
      {(labels.length > 0 || proved) && (
        <p className="match-tags certificate-tags">
          {proved && <span className="tag good">original proven in this browser</span>}
          {labels.map((l) => (
            <span key={l.by} className="tag good" title={`Attester ${l.by}`}>
              {l.label}
            </span>
          ))}
        </p>
      )}
      <footer>
        <button type="button" className="button primary small-button" onClick={copy}>
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a className="button outline small-button" href={`${EXPLORER}/address/${REGISTRY}`} target="_blank" rel="noreferrer">
          Registry on explorer
        </a>
      </footer>
    </article>
  );
}

type Check = { label: string; ok: boolean; detail: string };
type ProveState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; name: string; checks: Check[] }
  | { kind: "error"; message: string };

async function proveFile(file: File, r: RegistryRecord): Promise<Check[]> {
  const bytes = await file.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const digestHex = `0x${[...digest].map((b) => b.toString(16).padStart(2, "0")).join("")}` as const;
  const commit = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [digestHex, r.creator]));
  const img = await blobToRGBA(file);
  const distance = hamming(phash(img), r.pHash);
  const sameFile = commit.toLowerCase() === r.fileCommit.toLowerCase();
  return [
    {
      label: "This exact file was registered by this creator",
      ok: sameFile,
      detail: sameFile
        ? "SHA-256 of the file, bound to the creator's address, equals the commitment on chain."
        : "SHA-256 of the file, bound to the creator's address, does not match the commitment on chain.",
    },
    {
      label: "Same size as registered",
      ok: img.width === r.width && img.height === r.height,
      detail: `${img.width}×${img.height} here, ${r.width}×${r.height} on chain.`,
    },
    {
      label: "Looks the same",
      ok: distance <= MATCH_DISTANCE,
      detail: `${distance} of 64 fingerprint bits differ.`,
    },
  ];
}

function Prove({ id, record, onProved }: { id: number; record: RegistryRecord; onProved: () => void }) {
  const [state, setState] = useState<ProveState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState<File | undefined>();

  // If this browser registered the photo, the original is still in IndexedDB.
  useEffect(() => {
    let live = true;
    void loadOriginal(id).then((f) => live && setSaved(f));
    return () => {
      live = false;
    };
  }, [id]);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setState({ kind: "working" });
    // A copy from IndexedDB is a File too, so the proof runs exactly the same way.
    try {
      const checks = await proveFile(file, record);
      if (checks.every((c) => c.ok)) {
        markProved(id);
        onProved();
      }
      setState({ kind: "done", name: file.name, checks });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void accept(e.dataTransfer.files[0]);
  };

  const passed = state.kind === "done" && state.checks.every((c) => c.ok);
  return (
    <section className="prove wrap">
      <div className="prove-copy">
        <h2>Prove you hold the original</h2>
        <p>
          Only the creator has the original file. Drop it here and your browser checks it against the record. The file
          never leaves this device.
        </p>
        <p className="hint">
          If you later send the original to someone, remember it can carry location data in its EXIF.
        </p>
      </div>
      <div className="prove-work">
        <label
          className={`dropzone light${dragging ? " over" : ""}`}
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
          <span className="dropzone-title">Drop the original file</span>
          <span className="dropzone-sub">The one you registered, not a copy from a chat.</span>
        </label>
        {saved && state.kind === "idle" && (
          <p className="hint">
            This browser kept the original when you registered it.{" "}
            <button type="button" className="link-button" onClick={() => accept(saved)}>
              Check with the saved copy
            </button>
          </p>
        )}
        {state.kind === "working" && <p className="verdict-pending">Checking…</p>}
        {state.kind === "error" && <p className="notice warn-notice">{state.message}</p>}
        {state.kind === "done" && (
          <div className={`proof ${passed ? "passed" : "failed"}`}>
            {passed && <span className="stamp">Proven</span>}
            <p className="proof-file mono small">{state.name}</p>
            <ul className="checklist">
              {state.checks.map((c) => (
                <li key={c.label} className={c.ok ? "ok" : "no"}>
                  <span className="check-mark" aria-hidden="true">
                    {c.ok ? "✓" : "✗"}
                  </span>
                  <span>
                    <strong>{c.label}</strong>
                    <span className="check-detail">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {!passed && (
              <p className="hint">
                A copy from a chat app always fails the first check: compression changes the bytes. Only the original file
                passes.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
