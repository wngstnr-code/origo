import { type ReactNode, useEffect, useState } from "react";
import { EXPLORER, REGISTRY } from "../lib/registry";
import { CropDemo, LatestRecord, WhatsAppDemo } from "./demos";
import { Owl } from "./Owl";
import { PlanetCoral, PlanetCraters, PlanetRing, Shore, Stars } from "./Space";
import "./landing.css";

const GITHUB = "https://github.com/wngstnr-code/origo";
const CONTRACT = `${EXPLORER}/address/${REGISTRY}`;

function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`nav${solid ? " solid" : ""}`}>
      <div className="wrap nav-inner">
        <a className="wordmark" href="#top" aria-label="Origo home">
          <span className="wordmark-dot" aria-hidden="true" />
          origo
        </a>
        <nav aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#numbers">Numbers</a>
          <a href={CONTRACT} target="_blank" rel="noreferrer">
            Contract
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <Stars />
      <PlanetCraters className="planet planet-craters" />
      <PlanetRing className="planet planet-ring" />
      <PlanetCoral className="planet planet-coral" />
      <div className="wrap hero-copy">
        <h1>Who took this photo first?</h1>
        <p>
          Origo writes a photo's visual fingerprint to Monad. When a copy shows up again, compressed by WhatsApp,
          screenshotted, mirrored or cropped, it still leads back to the first person who registered it.
        </p>
        <div className="actions">
          <a className="button primary" href="#how">
            See it work
          </a>
          <a className="button secondary" href={CONTRACT} target="_blank" rel="noreferrer">
            Read the contract
          </a>
        </div>
      </div>
      <Owl className="hero-owl" />
      <Shore />
    </section>
  );
}

function Row({
  id,
  title,
  children,
  visual,
  flip,
  tint,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  visual: ReactNode;
  flip?: boolean;
  tint?: boolean;
}) {
  return (
    <section className={`row${tint ? " tint" : ""}`} id={id}>
      <div className={`wrap row-inner${flip ? " flip" : ""}`}>
        <div className="row-copy">
          <h2>{title}</h2>
          {children}
        </div>
        <div className="row-visual">{visual}</div>
      </div>
    </section>
  );
}

const NUMBERS = [
  { big: "27 / 27", text: "photos still found after two rounds of WhatsApp-style compression" },
  { big: "27 / 27", text: "found when mirrored or turned 90 degrees" },
  { big: "93 to 96%", text: "of centered crops (10 to 30% cut off) found through tiles" },
  { big: "0 / 702", text: "pairs of different photos mistaken for each other" },
];

export function Landing() {
  return (
    <>
      <Nav />
      <main>
        <Hero />

        <Row
          id="how"
          title="It survives the group chat"
          visual={<WhatsAppDemo />}
        >
          <p>
            Every app squeezes photos before sending them on. The bytes change, so a file hash breaks. Origo hashes
            what the photo looks like instead: 64 bits that stay put through compression, resizing and screenshots.
          </p>
          <p>
            The two fingerprints on the right are computed by your browser as this page loads, from the original and
            from a copy compressed twice.
          </p>
        </Row>

        <Row title="Cropped? Still found" visual={<CropDemo />} flip tint>
          <p>
            Cutting off the edges changes the whole-photo fingerprint too much. So at registration Origo also stores 39
            fingerprints of smaller windows of the photo. A crop lands close to one of them.
          </p>
          <p>The box shows the window that caught this crop.</p>
        </Row>

        <Row title="Written to Monad, read by anyone" visual={<LatestRecord />}>
          <p>
            The fingerprint, the creator's key and the time go into a public registry contract. Registering confirms in
            about a second. Searching is a free contract read, so there is no Origo server to trust or to go down.
          </p>
          <p>
            The card is the newest record in the registry, read from Monad just now.
          </p>
        </Row>

        <section className="numbers" id="numbers">
          <div className="wrap">
            <h2>Tested on 27 real photos</h2>
            <p className="numbers-lede">
              News and street photos in the public domain, run through the same edits they get in real life.
            </p>
            <ol className="numbers-list">
              {NUMBERS.map((n) => (
                <li key={n.text}>
                  <span className="big">{n.big}</span>
                  <span>{n.text}</span>
                </li>
              ))}
            </ol>
            <p className="numbers-note">
              Full results in{" "}
              <a href={`${GITHUB}/blob/main/docs/origo/ROBUSTNESS.md`} target="_blank" rel="noreferrer">
                ROBUSTNESS.md
              </a>
              . Weak spots are listed too: corner crops and heavy text overlays.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap closing-inner">
            <Owl className="closing-owl" />
            <h2>No server. No sign-up. Just Monad.</h2>
            <p>
              The site is static files, the search runs on a public contract, and the code is open. If Origo disappears
              tomorrow, every record is still there.
            </p>
            <div className="actions">
              <a className="button primary" href={GITHUB} target="_blank" rel="noreferrer">
                Read the code
              </a>
              <a className="button outline" href={CONTRACT} target="_blank" rel="noreferrer">
                Verified contract
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <p>
            Origo, built for the Monad Metropolis Hackathon. MIT licensed.
          </p>
          <p className="small">
            Demo photo:{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Andri_Permana_Banjir.jpg" target="_blank" rel="noreferrer">
              Andri Permana Banjir.jpg
            </a>
            , Wikimedia Commons, CC0.
          </p>
        </div>
      </footer>
    </>
  );
}
