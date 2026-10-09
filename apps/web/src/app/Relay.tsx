import { useEffect, useState } from "react";
import { createWalletClient, custom, recoverTypedDataAddress } from "viem";
import { Shore, Stars } from "../landing/Space";
import { useAccount } from "../lib/account";
import { mon, useBalance } from "../lib/balance";
import { CHAIN, EXPLORER } from "../lib/chain";
import { shortAddress } from "../lib/registry";
import {
  type Draft,
  type Registered,
  type Signed,
  TYPED_DATA,
  parseRelayFragment,
  price,
  registerErrorMessage,
  send,
} from "../lib/register";
import { onLinkClick } from "../router";
import { BitGrid } from "../ui/BitGrid";
import { SignIn } from "./SignIn";

type Ticket = { signed: Signed; creator: `0x${string}`; thumbnailUrl?: string };
type Check =
  | { state: "loading" }
  | { state: "invalid"; message: string }
  | { state: "ready"; ticket: Ticket; draft: Draft | null; problem: string | null };

const timeLeft = (deadline: bigint) => {
  const s = Number(deadline) - Date.now() / 1000;
  if (s <= 0) return "expired";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d} day${d === 1 ? "" : "s"} ${h} h left` : `${h} h ${Math.floor((s % 3600) / 60)} min left`;
};

/** Decodes the link and checks it the way the contract will: signature, deadline, and not registered yet. */
async function checkTicket(fragment: string): Promise<Check> {
  let signed: Signed;
  try {
    signed = parseRelayFragment(fragment);
  } catch (err) {
    return { state: "invalid", message: err instanceof Error ? err.message : String(err) };
  }
  const [message, signature, thumbnail] = signed;
  const creator = await recoverTypedDataAddress({ ...TYPED_DATA, message, signature });
  const thumbnailUrl =
    thumbnail !== "0x"
      ? URL.createObjectURL(new Blob([Uint8Array.from(thumbnail.slice(2).match(/../g)!.map((b) => parseInt(b, 16)))]))
      : undefined;
  const ticket = { signed, creator, thumbnailUrl };
  if (Number(message.deadline) <= Date.now() / 1000) {
    return { state: "ready", ticket, draft: null, problem: "This link expired. Ask the photographer for a new one." };
  }
  try {
    // Pricing simulates the call, so a bad signature or an existing registration shows up before anyone pays.
    const draft = await price(signed, creator);
    return { state: "ready", ticket, draft, problem: null };
  } catch (err) {
    return { state: "ready", ticket, draft: null, problem: registerErrorMessage(err) };
  }
}

export function Relay() {
  const account = useAccount();
  const [check, setCheck] = useState<Check>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Registered | null>(null);
  const balance = useBalance(account?.wallet.address, done ? 1 : 0);

  const [hash, setHash] = useState(() => location.hash);

  // Opening another relay link in the same tab only changes the fragment.
  useEffect(() => {
    const onHash = () => {
      setCheck({ state: "loading" });
      setDone(null);
      setError(null);
      setHash(location.hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let live = true;
    checkTicket(hash).then((c) => live && setCheck(c));
    return () => {
      live = false;
    };
  }, [hash]);

  const draft = check.state === "ready" ? check.draft : null;

  const payWith = async (how: "passkey" | "browser") => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      if (how === "passkey") {
        if (!account) return;
        setDone(await send(draft, account.walletClient));
      } else {
        const provider = window.ethereum;
        if (!provider) throw new Error("No browser wallet found. Install one, or pay with an Origo passkey.");
        const [address] = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
        const client = createWalletClient({ account: address, chain: CHAIN, transport: custom(provider) });
        try {
          await client.switchChain({ id: CHAIN.id });
        } catch {
          await client.addChain({ chain: CHAIN });
        }
        setDone(await send(draft, client));
      }
    } catch (err) {
      setError(registerErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main">
      <section className="sky sky-record">
        <Stars />
        <div className="wrap sky-inner">
          {check.state === "loading" && <p className="sky-status">Checking the relay link…</p>}
          {check.state === "invalid" && (
            <div className="sky-status">
              <h1>This link does not work</h1>
              <p>{check.message}</p>
            </div>
          )}
          {check.state === "ready" && (
            <>
              <p className="sky-kicker">Someone asked you to pay for registering their photo</p>
              <article className="certificate draft-ticket">
                <header>
                  <span>{done ? CHAIN.name : "Signed draft"}</span>
                  <h1>{done ? `Record #${done.id}` : timeLeft(check.ticket.signed[0].deadline)}</h1>
                </header>
                <div className="certificate-body">
                  <div className="certificate-visual">
                    {check.ticket.thumbnailUrl ? (
                      <img src={check.ticket.thumbnailUrl} alt="Preview the photographer chose to publish" />
                    ) : (
                      <BitGrid hash={check.ticket.signed[0].pHash} />
                    )}
                  </div>
                  <dl className="certificate-facts">
                    <div>
                      <dt>Creator</dt>
                      <dd className="mono" title={check.ticket.creator}>
                        {shortAddress(check.ticket.creator)}
                      </dd>
                    </div>
                    <div>
                      <dt>Photo size</dt>
                      <dd>
                        {check.ticket.signed[0].width}×{check.ticket.signed[0].height}
                      </dd>
                    </div>
                    <div>
                      <dt>Crop protection</dt>
                      <dd>{check.ticket.signed[3].length > 0 ? `${check.ticket.signed[3].length} tiles` : "off"}</dd>
                    </div>
                    <div>
                      <dt>You pay</dt>
                      <dd>{draft ? `about ${mon(draft.cost)}` : "nothing yet"}</dd>
                    </div>
                  </dl>
                </div>
                {done && <span className="stamp">Registered</span>}
              </article>
            </>
          )}
        </div>
        <Shore />
      </section>

      {check.state === "ready" && (
        <section className="wrap register relay-pay">
          {check.problem && !done && <p className="notice warn-notice">{check.problem}</p>}
          {done ? (
            <div className="registered">
              <p>
                Thank you. Confirmed in block{" "}
                <a className="mono" href={`${EXPLORER}/tx/${done.hash}`} target="_blank" rel="noreferrer">
                  {done.block.toLocaleString("en-US")}
                </a>
                . The record belongs to {shortAddress(check.ticket.creator)}, not to you.
              </p>
              <a className="button primary small-button" href={`/app/record/${done.id}`} onClick={onLinkClick}>
                Open record #{done.id}
              </a>
            </div>
          ) : (
            draft && (
              <>
                <h2>Pay with</h2>
                <p className="step-text">
                  You only pay the gas. The record names the photographer as creator, and only their original file can
                  prove it.
                </p>
                <div className="pay-options">
                  <div className="pay-option">
                    <h3>Your Origo passkey</h3>
                    {account ? (
                      <>
                        <p className="option-note mono">
                          {shortAddress(account.wallet.address)} · {balance === null ? "…" : mon(balance)}
                        </p>
                        <button
                          type="button"
                          className="button primary small-button"
                          disabled={busy || balance === null || balance < draft.cost}
                          onClick={() => payWith("passkey")}
                        >
                          Pay {mon(draft.cost)}
                        </button>
                        {balance !== null && balance < draft.cost && <p className="option-note warn">Not enough MON in this wallet.</p>}
                      </>
                    ) : (
                      <SignIn intro="Sign in to pay from your Origo wallet." />
                    )}
                  </div>
                  <div className="pay-option">
                    <h3>A browser wallet</h3>
                    <p className="option-note">MetaMask, Rabby or any wallet on {CHAIN.name}.</p>
                    <button type="button" className="button outline small-button" disabled={busy} onClick={() => payWith("browser")}>
                      Connect and pay
                    </button>
                  </div>
                </div>
                {busy && <p className="verdict-pending">Registering…</p>}
                {error && <p className="notice warn-notice">{error}</p>}
              </>
            )
          )}
        </section>
      )}
    </main>
  );
}
