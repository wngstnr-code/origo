# Origo

**Photo provenance that survives re-encoding, on Monad.**

Labels can be stripped. A photo's face cannot be hidden.

Origo is an on-chain registry of visual fingerprints for photos. Any copy of a registered photo (compressed by WhatsApp, screenshotted, resized, mirrored) can be traced back to its original creator and registration time, with similarity search running directly against the contract and no backend.

> Status: in development for the Monad Metropolis Hackathon (Track 04: Trust, Identity & AI Infrastructure). This README is completed before submission.

## Problem and users

- Photographers and photojournalists lose credit when their photos spread through messaging apps and social platforms.
- Fact-checkers cannot prove where a viral photo came from, because metadata-based provenance (C2PA) is stripped on re-encoding.
- Newsrooms and app developers need a provenance primitive they can build on.

## How it works

1. **Register:** the browser computes a 64-bit perceptual hash and a creator-bound commitment to the original file. The creator signs with a passkey (Mera) and the record is written to Monad.
2. **Verify:** anyone drops a copy. The browser hashes it in 8 orientations and the contract's multi-index search returns close matches, ranked by evidence.
3. **Prove ownership:** the claimant reveals the original file and any browser checks it against the on-chain commitment.

## Repository layout

| Path | What it is |
| --- | --- |
| `contracts/` | Foundry project for `OrigoRegistry` |
| `packages/sdk/` | `@origo/sdk`: hashing, index math, keys, chain helpers |
| `apps/web/` | Static web app (Vite + React), deployed on Vercel |
| `docs/origo/` | Overview, architecture, build plan, gaps, progress |

## Development

Requirements: Node 22+, pnpm 10, Foundry.

```bash
git clone --recurse-submodules <repo-url>
pnpm install
pnpm build            # builds the SDK and the web app
pnpm test             # SDK tests + forge tests
pnpm dev              # web app on localhost
```

## How Origo uses Monad

To be completed with contract addresses and transaction hashes.

## Limitations

See `docs/origo/GAPS.md`.

## AI tool disclosure

AI coding tools were used during development, as permitted by the hackathon rules (section 4.1.4).

## License

MIT
