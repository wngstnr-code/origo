import { useState } from "react";
import {
  connectBrowserWallet,
  createAccount,
  hasSavedPasskey,
  passkeyErrorMessage,
  signIn,
  signInWithBackupPhrase,
} from "../lib/account";

/** Passkey sign-in, used by Register, My photos and Relay. */
export function SignIn({ intro }: { intro: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePhrase, setUsePhrase] = useState(false);
  const [phrase, setPhrase] = useState("");

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(passkeyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saved = hasSavedPasskey();
  return (
    <div className="sign-in">
      <p className="step-text">{intro}</p>
      {!usePhrase && (
        <div className="step-actions">
          <button
            type="button"
            className="button primary small-button"
            disabled={busy}
            onClick={() => run(saved ? signIn : createAccount)}
          >
            {saved ? "Sign in with passkey" : "Create a passkey account"}
          </button>
          <button type="button" className="link-button" disabled={busy} onClick={() => run(saved ? createAccount : signIn)}>
            {saved ? "Create a new account" : "I already have one"}
          </button>
          <button type="button" className="link-button" disabled={busy} onClick={() => setUsePhrase(true)}>
            Use a backup phrase
          </button>
        </div>
      )}
      {!usePhrase && (
        <p className="option-note wallet-fallback">
          No passkey support here?{" "}
          <button type="button" className="link-button" disabled={busy} onClick={() => run(connectBrowserWallet)}>
            Use a browser wallet instead
          </button>{" "}
          (MetaMask, Rabby). Its address becomes your creator ID and pays the gas.
        </p>
      )}
      {usePhrase && (
        <form
          className="phrase-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => signInWithBackupPhrase(phrase));
          }}
        >
          <label htmlFor="backup-phrase">Your 24-word backup phrase</label>
          <textarea
            id="backup-phrase"
            className="mono"
            rows={3}
            value={phrase}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setPhrase(e.target.value)}
          />
          <p className="option-note">It stays in this tab. Nothing is sent anywhere.</p>
          <div className="step-actions">
            <button type="submit" className="button primary small-button" disabled={busy || !phrase.trim()}>
              Open account
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setPhrase("");
                setUsePhrase(false);
              }}
            >
              Back to passkey
            </button>
          </div>
        </form>
      )}
      {error && <p className="notice warn-notice">{error}</p>}
    </div>
  );
}
