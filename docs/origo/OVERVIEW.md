# Origo: Product Overview

> "Labels can be stripped. A photo's face cannot be hidden."

## One-liner

Origo is an on-chain registry of visual fingerprints for photos. Any copy of a registered photo (compressed by WhatsApp, screenshotted, resized, mirrored) can be traced back to its original creator and registration time in under a second, with no backend.

## Problem

- Photojournalists and photographers lose credit when their photos spread through WhatsApp, Instagram, and X.
- Old or out-of-context photos are reused for hoaxes ("flood in Bekasi today" using a photo from last year), and fact-checkers cannot prove where a photo came from.
- Existing provenance (C2PA / Content Credentials) stores proof in file **metadata**. Messaging apps and social platforms strip metadata and re-encode the image, so the proof disappears exactly where misinformation spreads.
- Cryptographic file hashes break when a single pixel changes, so they cannot match re-encoded copies.

## Users

| User | Job to be done |
| --- | --- |
| Photographer / photojournalist (primary, registers) | "Prove this photo is mine and when I took it, even after it has been copied everywhere." |
| Fact-checker / journalist (primary, verifies) | "Where did this viral photo first appear, and who took it?" |
| Newsroom / platform / app developer (integrator) | "Add a 'check origin' button or bulk-register our archive using the SDK." |

Origo is infrastructure first (Track 04 requires protocols and primitives that other apps build on). The web app is the reference client for the SDK and the registry.

## How it works (plain version)

1. **Register.** The photographer takes or selects a photo. The browser computes a perceptual hash (a 64-bit fingerprint of the photo's light and dark structure) and a SHA-256 commitment of the original file. The photographer confirms with Face ID or Touch ID (a passkey via Mera), and the record is written to Monad.
2. **Spread.** The photo is compressed, screenshotted, and resized. The file changes completely, but the fingerprint stays nearly the same.
3. **Verify.** Anyone drops the copy into Origo. The browser computes its fingerprint (in 8 orientations) and asks the contract for close matches. The result shows the original creator, registration time, block, and evidence strength.

## Differentiation

| | C2PA / Content Credentials | Numbers Protocol, Truepic | Origo |
| --- | --- | --- | --- |
| Survives metadata stripping | No | Partly (needs their app or service) | Yes, matching is on visual content |
| Search for near-duplicates | No | Centralized service | On-chain, multi-index hashing in a `view` call |
| Backend required | Signing infrastructure | Yes | No |
| Ownership disputes | Out of scope | Platform decides | Evidence ranking: capture-time registration, original-file commitment, attestations |

## Handling the two hard cases

**Crops, mirrors, and screenshots**
- Mirrors and rotations: the verifier checks all 8 orientations (4 rotations times normal or mirrored). Nothing extra is stored.
- Screenshots: uniform borders are trimmed automatically, and the verifier can manually crop the photo area out of a chat screenshot.
- Crops (stretch goal): overlapping tile fingerprints let a partial crop match "4 of 9 parts".
- Honest limit: if too little of the photo remains, Origo says "not enough evidence" instead of guessing.

**A thief registers someone else's photo first**
Origo never treats "first registrant" as the owner. It shows the strongest evidence:
1. Capture-time registration from the in-app camera, labeled differently from gallery uploads.
2. Original-file commitment, bound to the creator: the record stores `keccak256(sha256(original file), creator)`. In a dispute, the real owner reveals the original (higher resolution, wider frame, camera EXIF) and anyone's browser checks it against the commitment. A copy always carries less information than the original, and an 800 px copy cannot be turned back into the 6000 px file that matches. Because the commitment includes the creator's address, a front-runner who copies it from a pending transaction gains nothing.
3. Attestations: accounts verified by an institution show a badge.

Ranking order: proven ownership, then attested creator, then earliest registration. Self-reported fields (capture flag, resolution) are only tie-breakers and are labeled as such.
4. Earlier near-duplicates: every verification lists all earlier records within the threshold, so a later copy can never pose as a new original. This is computed at read time from the on-chain index, not stored as a permanent on-chain label (a permissionless label could be abused).
5. Stake and on-chain challenges (stretch goal) make mass-registering stolen photos costly.

## Why Monad

- **Capture-time registration needs fast finality.** Sub-second blocks mean a photo is anchored seconds after the shutter, before it can spread.
- **Cheap state for an on-chain index.** Every registration writes a record, 4 index buckets, and an optional thumbnail, about 424k gas (measured). At Monad's minimum base fee that is about 0.04 MON (around $0.001), so a newsroom can register its whole archive.
- **Free, fast on-chain search.** Similarity search runs as an `eth_call` against the contract, so verification needs no indexer or server.
- **Mera passkeys** give non-crypto users (photographers) an account with Face ID, and Origo uses the passkey PRF output for more than a wallet (a separate creator identity key).

## Mapping to the judging rubric (each criterion 20%)

| Criterion | How Origo scores |
| --- | --- |
| Product Quality & Completeness | Working web app (register, verify, prove ownership), SDK, deployed contract, README a third party can run |
| Technical Excellence | Deterministic perceptual hashing in TypeScript, multi-index hashing on-chain with a pigeonhole guarantee, EIP-712 creator signatures from a PRF-derived key, robustness test report |
| Monad Integration | Contract on Monad, capture-time anchoring, on-chain similarity search, Mera passkeys, explicit "why Monad" section |
| Track Fit & Problem Relevance | A provenance primitive plus SDK for other apps, matching the official Track 04 example "provenance for generated media that survives re-encoding" |
| Innovation & Impact | Content-based provenance that survives the channels where hoaxes actually spread |

## Bounties to target

| Bounty | Fit |
| --- | --- |
| Monad Foundation, "Mera: One Passkey, Many Keys" ($2,500) | PRF output derives both a wallet key and a separate creator identity key (non-wallet use) |
| Envio, "Best Use of Envio" ($1,000), stretch | HyperIndex for the public feed and creator history |

## Business model

- The registry and verification are free for the public.
- Newsrooms and platforms pay for bulk registration and higher API quotas through an on-chain subscription or per-registration fee.
- Paid verified-creator attestations through partner institutions.
- First users: 3 to 5 local photographers, a fact-checking community, and student press.

## Scope

**MVP (must be in the demo):** register (upload and native camera capture) with the original saved locally, relay link so someone else can pay gas, verify with 8 orientations, border trim, manual crop and thumbnails, prove ownership by revealing the original file, creator key via Mera with mnemonic backup, injected-wallet fallback, attester badge, contract on mainnet, SDK package plus a verify-widget example, robustness report.

**Stretch:** tile fingerprints for crops, stake and challenge flow, sponsored gas, Envio indexer feed, PDQ 256-bit second-stage check, WASM HEIC decoder.

Known gaps and accepted limitations are tracked in `GAPS.md`.

**Out of scope:** video, AI-generated detection, storing image files on-chain.
