import { OwlMark } from "../landing/Logo";
import { onLinkClick } from "../router";
import "../styles/site.css";
import "./app.css";
import { Me } from "./Me";
import { RecordPage } from "./Record";
import { Relay } from "./Relay";
import { Register } from "./Register";
import { Verify } from "./Verify";

const TABS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/app", label: "Verify" },
  { href: "/app/register", label: "Register" },
  { href: "/app/me", label: "My photos" },
];

function AppNav({ path }: { path: string }) {
  return (
    <header className="nav solid">
      <div className="wrap nav-inner">
        <a className="wordmark" href="/" onClick={onLinkClick} aria-label="Origo home">
          <OwlMark size={44} />
          <span className="wordmark-text">origo</span>
        </a>
        <nav aria-label="App">
          {TABS.map((t) => (
            <a
              key={t.href}
              href={t.href}
              onClick={onLinkClick}
              className={`app-tab${path.replace(/\/$/, "") === t.href ? " active" : ""}`}
              aria-current={path.replace(/\/$/, "") === t.href ? "page" : undefined}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function NotFound() {
  return (
    <main id="main" className="app-empty wrap">
      <h1>Nothing here yet</h1>
      <p>
        This page does not exist.{" "}
        <a href="/app" onClick={onLinkClick}>
          Check a photo instead
        </a>
        .
      </p>
    </main>
  );
}

export default function AppRoot({ path }: { path: string }) {
  const record = /^\/app\/record\/(\d{1,10})\/?$/.exec(path);
  const clean = path.replace(/\/$/, "");
  const page =
    clean === "/app" ? (
      <Verify />
    ) : clean === "/app/register" ? (
      <Register />
    ) : clean === "/app/me" ? (
      <Me />
    ) : clean === "/app/relay" ? (
      <Relay />
    ) : record ? (
      <RecordPage key={record[1]} id={Number(record[1])} />
    ) : (
      <NotFound />
    );
  return (
    <>
      <AppNav path={path} />
      {page}
    </>
  );
}
