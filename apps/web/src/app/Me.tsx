import { TESTNET_FAUCET, creatorKey, prfFromBackupPhrase } from "@origo/sdk";
import { useEffect, useState } from "react";
import { bytesToHex } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import { type Account, passkeyErrorMessage, revealBackupPhrase, signOut, useAccount } from "../lib/account";
import { mon, useBalance } from "../lib/balance";
import { CHAIN, EXPLORER } from "../lib/chain";
import { REGISTRY, type RegistryRecord, publicClient, registryAbi, shortAddress } from "../lib/registry";
import { Shore, Stars } from "../landing/Space";
import { onLinkClick } from "../router";
import { BitGrid } from "../ui/BitGrid";
import { thumbnailOf } from "./search";
import { SignIn } from "./SignIn";

type Row = { id: number; record: RegistryRecord; thumbnailUrl?: string };
type Load = { state: "loading" } | { state: "error" } | { state: "ready"; rows: Row[]; total: number };

const PAGE = 100;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

async function loadPhotos(creator: `0x${string}`): Promise<{ rows: Row[]; total: number }> {
  const total = Number(
    await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "creatorRecordCount", args: [creator] }),
  );
  if (total === 0) return { rows: [], total };
  // Newest first: read the last page of the creator's list.
  const offset = Math.max(0, total - PAGE);
  const ids = await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "recordsOf",
    args: [creator, BigInt(offset), BigInt(PAGE)],
  });
  const records = (await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "getRecords",
    args: [ids],
  })) as readonly RegistryRecord[];
  const thumbs = await Promise.all(
    records.map((r, i) => (r.hasThumbnail ? thumbnailOf(ids[i], r.registeredBlock).catch(() => undefined) : undefined)),
  );
  const rows = ids.map((id, i) => ({ id, record: records[i], thumbnailUrl: thumbs[i] })).reverse();
  return { rows, total };
}

export function Me() {
  const account = useAccount();
  return (
    <main id="main">
      <section className="sky sky-short sky-title">
        <Stars />
        <div className="wrap sky-inner">
          <h1>My photos</h1>
        </div>
        <Shore />
      </section>
      <div className="wrap me">
        {account ? (
          <SignedIn account={account} />
        ) : (
          <div className="me-signin">
            <SignIn intro="Sign in to see the photos you registered, your wallet and your backup phrase." />
          </div>
        )}
      </div>
    </main>
  );
}

function SignedIn({ account }: { account: Account }) {
  const balance = useBalance(account.wallet.address, 0);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadPhotos(account.creator.address).then(
      (v) => live && setLoad({ state: "ready", ...v }),
      () => live && setLoad({ state: "error" }),
    );
    return () => {
      live = false;
    };
  }, [account, attempt]);

  return (
    <div className="me-grid">
      <aside className="account-panel">
        <p className="eyebrow">Account</p>
        <dl>
          <div>
            <dt>Creator ID</dt>
            <dd className="mono">
              <a href={`${EXPLORER}/address/${account.creator.address}`} target="_blank" rel="noreferrer" title={account.creator.address}>
                {shortAddress(account.creator.address)}
              </a>
            </dd>
            <dd className="option-note">Goes on every record you register.</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd className="mono">
              <a href={`${EXPLORER}/address/${account.wallet.address}`} target="_blank" rel="noreferrer" title={account.wallet.address}>
                {shortAddress(account.wallet.address)}
              </a>
            </dd>
            <dd className="balance">{balance === null ? "…" : mon(balance)}</dd>
            <dd className="option-note">Pays gas on {CHAIN.name}.</dd>
          </div>
        </dl>
        <div className="panel-actions">
          <a className="button outline small-button" href={TESTNET_FAUCET} target="_blank" rel="noreferrer">
            Get test MON
          </a>
          {account.kind === "passkey" && <Backup creator={account.creator.address} />}
          <button type="button" className="link-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <section className="photo-list-wrap" aria-live="polite">
        {load.state === "loading" && <p className="verdict-pending">Reading your records from Monad…</p>}
        {load.state === "error" && (
          <p className="notice warn-notice">
            Could not reach a Monad RPC.{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setLoad({ state: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </p>
        )}
        {load.state === "ready" && load.total === 0 && (
          <div className="verdict none">
            <h2>No photos yet</h2>
            <p>
              Photos you register with this account show up here.{" "}
              <a href="/app/register" onClick={onLinkClick}>
                Register your first photo
              </a>
              .
            </p>
          </div>
        )}
        {load.state === "ready" && load.total > 0 && (
          <>
            <p className="eyebrow">
              {load.total} photo{load.total === 1 ? "" : "s"}
              {load.total > load.rows.length ? `, newest ${load.rows.length} shown` : ""}
            </p>
            <ol className="photo-list">
              {load.rows.map((row) => (
                <li key={row.id}>
                  <a href={`/app/record/${row.id}`} onClick={onLinkClick} className="photo-row-link">
                    <span className="row-thumb">
                      {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" /> : <BitGrid hash={row.record.pHash} />}
                    </span>
                    <span className="row-id">#{row.id}</span>
                    <span className="row-date">{dateFmt.format(new Date(Number(row.record.registeredAt) * 1000))}</span>
                    <span className="row-meta">
                      {row.record.width}×{row.record.height} · {row.record.tileCount > 0 ? `${row.record.tileCount} tiles` : "no tiles"}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}

/** Shows the 24-word phrase after a fresh passkey check, and refuses if the passkey belongs to another account. */
function Backup({ creator }: { creator: `0x${string}` }) {
  const [phrase, setPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await revealBackupPhrase();
      const prf = prfFromBackupPhrase(p);
      const derived = privateKeyToAddress(bytesToHex(creatorKey(prf)));
      prf.fill(0);
      if (derived !== creator) throw new Error("That passkey belongs to a different Origo account. Choose the one you signed in with.");
      setPhrase(p);
    } catch (err) {
      setError(passkeyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (phrase) {
    return (
      <div className="backup">
        <p className="option-note">
          Write these 24 words down and keep them offline. They restore this account on any device. Anyone who has them
          controls it.
        </p>
        <ol className="words mono">
          {phrase.split(" ").map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
        <button type="button" className="button primary small-button" onClick={() => setPhrase(null)}>
          I wrote it down, hide it
        </button>
      </div>
    );
  }
  return (
    <>
      <button type="button" className="button outline small-button" disabled={busy} onClick={reveal}>
        Show backup phrase
      </button>
      {error && <p className="notice warn-notice">{error}</p>}
    </>
  );
}
