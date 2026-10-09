import { PRODUCTION_RP_ID, TESTNET_FAUCET, type RGBAImage } from "@origo/sdk";
import { type ReactNode, useEffect, useState } from "react";
import { Shore, Stars } from "../landing/Space";
import { isTestHost, signOut, useAccount } from "../lib/account";
import { CHAIN, EXPLORER } from "../lib/chain";
import { blobToRGBA } from "../lib/image";
import { mon, useBalance } from "../lib/balance";
import { shortAddress } from "../lib/registry";
import {
  type Draft,
  type Fingerprint,
  type Registered,
  fingerprint,
  makeThumbnail,
  OWN_DEADLINE_SECONDS,
  RELAY_DEADLINE_SECONDS,
  price,
  registerErrorMessage,
  relayLink,
  send as sendRegistration,
  sign,
} from "../lib/register";
import { saveOriginal } from "../lib/originals";
import { onLinkClick } from "../router";
import { BitGrid } from "../ui/BitGrid";
import { type Match, searchRegistry } from "./search";
import { SignIn } from "./SignIn";

type Photo = { file: File; url: string; img: RGBAImage; source: 0 | 1; fp: Fingerprint; ms: number; earlier: Match[] };
type Step = "done" | "active" | "todo";


function StepBlock({ n, title, state, aside, children }: { n: number; title: string; state: Step; aside?: ReactNode; children?: ReactNode }) {
  return (
    <li className={`step ${state}`}>
      <span className="step-mark" aria-hidden="true">
        {state === "done" ? "✓" : n}
      </span>
      <div className="step-body">
        <div className="step-head">
          <h2>
            <span className="visually-hidden">Step {n}{state === "done" ? ", done" : ""}: </span>
            {title}
          </h2>
          {aside}
        </div>
        {state !== "todo" && children}
      </div>
    </li>
  );
}

export function Register() {
  const account = useAccount();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cropProtection, setCropProtection] = useState(true);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState<Registered | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [relay, setRelay] = useState<string | null>(null);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const balance = useBalance(account?.wallet.address, refresh);

  const pick = async (file: File | undefined, source: 0 | 1) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    setDraft(null);
    setRelay(null);
    setDone(null);
    setSendError(null);
    try {
      const img = await blobToRGBA(file);
      const t = performance.now();
      const fp = await fingerprint(file, img);
      const ms = performance.now() - t;
      // Is this photo already in the registry? Searching is free and tells the person before they pay.
      const earlier = await searchRegistry([fp.pHash], () => undefined).then(
        (r) => r.matches,
        () => [],
      );
      setPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { file, url: URL.createObjectURL(file), img, source, fp, ms, earlier };
      });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  // Sign and price the registration whenever its inputs change. Signing is local, no prompt.
  useEffect(() => {
    if (!account || !photo || done) return;
    let live = true;
    (async () => {
      try {
        const thumbnail = preview ? await makeThumbnail(photo.file) : null;
        const signed = await sign({
          fp: photo.fp,
          width: photo.img.width,
          height: photo.img.height,
          source: photo.source,
          thumbnail,
          cropProtection,
          creator: account.creator,
          validForSeconds: OWN_DEADLINE_SECONDS,
        });
        const d = await price(signed, account.wallet.address);
        if (live) {
          setDraft(d);
          setDraftError(null);
        }
      } catch (err) {
        if (live) {
          setDraft(null);
          setDraftError(registerErrorMessage(err));
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [account, photo, preview, cropProtection, done, refresh]);

  // A second signature with a seven-day deadline, so someone else has time to pay. Still no prompt.
  const makeRelay = async () => {
    if (!account || !photo) return;
    setRelayError(null);
    try {
      const signed = await sign({
        fp: photo.fp,
        width: photo.img.width,
        height: photo.img.height,
        source: photo.source,
        thumbnail: preview ? await makeThumbnail(photo.file) : null,
        cropProtection,
        creator: account.creator,
        validForSeconds: RELAY_DEADLINE_SECONDS,
      });
      setRelay(relayLink(signed));
    } catch (err) {
      setRelayError(registerErrorMessage(err));
    }
  };

  const copyRelay = async () => {
    if (!relay) return;
    try {
      await navigator.clipboard.writeText(relay);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the link is selectable in the box.
    }
  };

  const send = async () => {
    if (!account || !draft) return;
    setSending(true);
    setSendError(null);
    try {
      const result = await sendRegistration(draft, account.walletClient);
      setDone(result);
      if (photo) {
        await saveOriginal(result.id, photo.file).then(
          () => setSavedLocally(true),
          () => setSavedLocally(false),
        );
      }
      setRefresh((n) => n + 1);
    } catch (err) {
      setSendError(registerErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setDraft(null);
    setDone(null);
    setRelay(null);
  };

  const enough = draft && balance !== null && balance >= draft.cost;
  const s1: Step = account ? "done" : "active";
  const s2: Step = !account ? "todo" : photo ? "done" : "active";
  const s3: Step = !account || !photo ? "todo" : done ? "done" : "active";
  const s4: Step = !account || !photo ? "todo" : done ? "done" : "active";

  return (
    <main id="main">
      <section className="sky sky-short">
        <Stars />
        <div className="wrap sky-inner">
          <h1>Register a photo you took</h1>
          <p>
            Your photo's fingerprint and the time go on Monad, signed by your passkey. The photo itself stays on your device.
          </p>
        </div>
        <Shore />
      </section>

      <div className="wrap register">
        {isTestHost() && (
          <p className="notice warn-notice">
            You are on a test address ({location.hostname}). A passkey made here only works here. For records you want to
            keep, use <a href={`https://${PRODUCTION_RP_ID}/app/register`}>{PRODUCTION_RP_ID}</a>.
          </p>
        )}
        <ol className="steps">
          <StepBlock
            n={1}
            title={account ? (account.kind === "browser" ? "Connected with your browser wallet" : "Signed in with your passkey") : "Sign in with a passkey"}
            state={s1}
            aside={
              account && (
                <button type="button" className="link-button" onClick={signOut}>
                  Sign out
                </button>
              )
            }
          >
            {!account && (
              <SignIn intro="No seed phrase, no extension. Face ID, Touch ID or your device PIN creates your account keys on this device." />
            )}
            {account?.kind === "browser" && (
              <p className="notice">
                Browser wallet mode: {shortAddress(account.creator.address)} is both your creator ID and the payer. You sign
                the registration in your wallet, then confirm the transaction.
              </p>
            )}
            {account && (
              <dl className="account-facts">
                <div>
                  <dt>Creator ID, goes on your records</dt>
                  <dd className="mono" title={account.creator.address}>
                    {shortAddress(account.creator.address)}
                  </dd>
                </div>
                <div>
                  <dt>Wallet, pays the gas</dt>
                  <dd className="mono" title={account.wallet.address}>
                    {shortAddress(account.wallet.address)} · {balance === null ? "…" : mon(balance)}
                  </dd>
                </div>
              </dl>
            )}
          </StepBlock>

          <StepBlock
            n={2}
            title="Choose the photo"
            state={s2}
            aside={
              photo &&
              !done && (
                <button type="button" className="link-button" onClick={reset}>
                  Change
                </button>
              )
            }
          >
            {!photo && (
              <>
                <p className="step-text">Use the original file from your camera, not a copy that went through a chat app.</p>
                <div className="step-actions">
                  <label className="button primary small-button file-button">
                    Choose a photo
                    <input type="file" accept="image/*" disabled={photoBusy} onChange={(e) => pick(e.target.files?.[0], 0)} />
                  </label>
                  <label className="button outline small-button file-button">
                    Take a photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={photoBusy}
                      onChange={(e) => pick(e.target.files?.[0], 1)}
                    />
                  </label>
                </div>
                {photoBusy && <p className="step-text">Fingerprinting the photo and its 39 crop tiles…</p>}
                {photoError && <p className="notice warn-notice">{photoError}</p>}
              </>
            )}
            {photo && (
              <div className="photo-row">
                <figure className="print tilt-left photo-thumb">
                  <img src={photo.url} alt="The photo you are registering" />
                </figure>
                <div className="photo-facts">
                  <p className="mono small">
                    {photo.file.name} · {photo.img.width}×{photo.img.height} · {photo.source === 1 ? "camera" : "upload"}
                  </p>
                  <BitGrid hash={photo.fp.pHash} />
                  <p className="mono small">fingerprint and 39 tiles in {Math.round(photo.ms)} ms</p>
                </div>
              </div>
            )}
            {photo && photo.earlier.length > 0 && (
              <p className="notice warn-notice">
                This photo is already in the registry:{" "}
                {photo.earlier.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ", "}
                    <a href={`/app/record/${m.id}`} onClick={onLinkClick}>
                      record #{m.id}
                    </a>{" "}
                    by {shortAddress(m.record.creator)}
                  </span>
                ))}
                . You can still register it, and everyone will see who was first.
              </p>
            )}
          </StepBlock>

          <StepBlock n={3} title="Options" state={s3}>
            <div className="options">
              <label className="option">
                <input type="checkbox" checked={cropProtection} disabled={!!done} onChange={(e) => {
                    setDraft(null);
                    setRelay(null);
                    setCropProtection(e.target.checked);
                  }} />
                <span>
                  <strong>Crop protection</strong>
                  <span className="option-note">Also stores 39 fingerprints of parts of the photo, so crops are still found. Costs more gas.</span>
                </span>
              </label>
              <label className="option">
                <input type="checkbox" checked={preview} disabled={!!done} onChange={(e) => {
                    setDraft(null);
                    setRelay(null);
                    setPreview(e.target.checked);
                  }} />
                <span>
                  <strong>Public preview</strong>
                  <span className="option-note">
                    A 96 px thumbnail anyone can see next to the record. Leave it off for sensitive photos.
                  </span>
                </span>
              </label>
            </div>
            {!done && (
              <p className="cost">
                {draft ? (
                  <>
                    Cost <strong>about {mon(draft.cost)}</strong> on {CHAIN.name}
                    {balance !== null && <> · your wallet has {mon(balance)}</>}
                  </>
                ) : draftError ? (
                  <span className="warn">{draftError}</span>
                ) : (
                  "Pricing the registration…"
                )}
              </p>
            )}
          </StepBlock>

          <StepBlock n={4} title={done ? `Registered as record #${done.id}` : "Register on Monad"} state={s4}>
            {!done && (
              <>
                {draft && balance !== null && !enough && (
                  <p className="notice warn-notice">
                    Your wallet needs {mon(draft.cost)}. Get test MON from the{" "}
                    <a href={TESTNET_FAUCET} target="_blank" rel="noreferrer">
                      Monad faucet
                    </a>{" "}
                    for <span className="mono">{account?.wallet.address}</span>, then come back: the balance refreshes on its own.
                  </p>
                )}
                <div className="step-actions">
                  <button type="button" className="button primary small-button" disabled={!enough || sending} onClick={send}>
                    {sending ? "Registering…" : "Register this photo"}
                  </button>
                  <button type="button" className="link-button" disabled={sending || !draft} onClick={makeRelay}>
                    Ask someone else to pay
                  </button>
                </div>
                {sendError && <p className="notice warn-notice">{sendError}</p>}
                {relayError && <p className="notice warn-notice">{relayError}</p>}
                {relay && (
                  <div className="relay-box">
                    <p>
                      <strong>Relay link, valid for 7 days.</strong> Anyone with MON can open it and pay. The record will
                      still be yours: they only pay the gas.
                    </p>
                    <input className="mono" readOnly value={relay} onFocus={(e) => e.currentTarget.select()} aria-label="Relay link" />
                    <div className="step-actions">
                      <button type="button" className="button primary small-button" onClick={copyRelay}>
                        {copied ? "Link copied" : "Copy link"}
                      </button>
                      {"share" in navigator && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => navigator.share({ title: "Register my photo on Origo", url: relay }).catch(() => undefined)}
                        >
                          Share
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {done && (
              <div className="registered">
                <span className="stamp">Registered</span>
                <p>
                  Confirmed in block{" "}
                  <a className="mono" href={`${EXPLORER}/tx/${done.hash}`} target="_blank" rel="noreferrer">
                    {done.block.toLocaleString("en-US")}
                  </a>
                  , {(done.ms / 1000).toFixed(1)} s after you clicked.
                </p>
                <p className="hint">
                  Keep the original file safe. It is the only thing that can prove the record is yours.
                  {savedLocally && " A copy is also kept in this browser, but browsers can clear it."}
                </p>
                <div className="step-actions">
                  <a className="button primary small-button" href={`/app/record/${done.id}`} onClick={onLinkClick}>
                    Open record #{done.id}
                  </a>
                  {photo && (
                    <a className="button outline small-button" href={photo.url} download={photo.file.name || `origo-${done.id}.jpg`}>
                      Save original
                    </a>
                  )}
                  <button type="button" className="link-button" onClick={reset}>
                    Register another photo
                  </button>
                </div>
              </div>
            )}
          </StepBlock>
        </ol>
      </div>
    </main>
  );
}
