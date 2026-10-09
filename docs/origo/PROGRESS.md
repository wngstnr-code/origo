# Origo: Progress Log

Read this first every session. Update it at the end of every session. Keep it short: replace stale status instead of appending forever.

## Current status

- **Phase:** Day 0. Repo scaffolded locally (pnpm workspace, Foundry, SDK, web app). SDK, web, and contracts build. No feature code yet.
- **Team:** solo (the project owner). **Hosting:** Vercel (static only).
- **Last updated:** 2026-10-09
- **Deadline:** Wed Oct 14, 10:59 WIB (Oct 13, 11:59 PM ET). Internal target: Tue Oct 13, 22:00 WIB.
- **Repo:** https://github.com/wngstnr-code/origo (public). **App:** https://origo-monad.vercel.app
- **Next action:** owner creates the dashboard team/project and gets faucet MON. Then Day 1.

## Deployments

| Network | Contract | Address | Tx / block | Date |
| --- | --- | --- | --- | --- |
| Monad testnet (10143) | OrigoRegistry | not deployed (dev only, testnet can reset) | | |
| Monad mainnet (143) | OrigoRegistry | not deployed (canonical for submission) | | |
| Web app (Vercel) | project `origo-app` | https://origo-monad.vercel.app (passkey rpId, never change). Auto-deploys from GitHub `main` | scaffold page live | 2026-10-09 |

## Measured numbers

| Metric | Value | How measured |
| --- | --- | --- |
| Gas per `register` | not measured (estimate 200k to 300k, about 0.02 to 0.03 MON) | `forge test --gas-report` |
| `MATCH_DISTANCE` | 7 (provisional) | robustness suite |
| False-positive rate at threshold | not measured | robustness suite |

## Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-09 | Build Origo for Track 04 | Only idea that is fully backend-free and oracle-free, strongest demo moment, fits the official Track 04 example |
| 2026-10-09 | Name "Origo" (earlier working names: Sidik, Rupa) | Chosen by the project owner |
| 2026-10-09 | 64-bit pHash with our own area-average resize | Deterministic across browsers; canvas resampling differs by engine |
| 2026-10-09 | Multi-index hashing, 4 x 16-bit segments, probe radius 1 | Pigeonhole guarantee finds every record within distance 7 in a view call |
| 2026-10-09 | `register` does not scan for duplicates; `linkDerivative` is permissionless | Keeps registration gas low on Monad's page-priced storage |
| 2026-10-09 | Wallet key via BIP-44, creator key via HKDF from Mera PRF | Separates identity from the gas payer; targets the "One Passkey, Many Keys" bounty |
| 2026-10-09 | Evidence ranking instead of "first registrant is owner" | Defends against a thief registering first |
| 2026-10-09 | Testnet first, mainnet deploy on Day 3 | Fast iteration, credible final submission |
| 2026-10-09 | Solo build, web app on Vercel (static only) | Owner decision |
| 2026-10-09 | Mainnet is canonical, testnet for development | Testnet was reset on 2025-12-16; mainnet registration costs well under $0.001 (G17) |
| 2026-10-09 | No `eth_getLogs` range scans; lists come from views, thumbnails from single-block logs | Public RPCs cap `getLogs` at 100 to 1,000 blocks (G1) |
| 2026-10-09 | `fileCommit = keccak256(sha256(file), creator)` | Copying a pending commit gains a front-runner nothing (G2) |
| 2026-10-09 | Ranking: proof, then attestation, then earliest block; self-reported fields only tie-break | Self-reported fields can be inflated (G3) |
| 2026-10-09 | Random unordered nonces + relay links | Lets anyone pay gas for a signed registration (G5, G12) |
| 2026-10-09 | `HASH_VERSION` in signature, record, and bucket key | Future hash changes do not break old records (G11) |
| 2026-10-09 | Production domain `origo-monad.vercel.app` | `origo-app.vercel.app` was already taken by an unrelated site; owner chose this. It is the passkey rpId (G6) |
| 2026-10-09 | Foundry deps as pinned git submodules; SDK built with `tsc` | Reproducible builds; tsup DTS fails on TypeScript 6 |

## Open questions

- [ ] What does iPhone Safari return from the capture input: JPEG or HEIC? (G4, G15)
- [ ] Is Multicall3 deployed on Monad mainnet and testnet? (optional batching)

## Network facts (checked 2026-10-09)

- Testnet chain 10143, RPC `https://testnet-rpc.monad.xyz` (+ Ankr, Monad Foundation fallbacks), explorer testnet.monadvision.com, faucet https://faucet.monad.xyz (wallet address + Cloudflare check, more with X/Discord). Testnet was reset on 2025-12-16.
- Mainnet chain 143, RPC `https://rpc.monad.xyz` (+ rpc1, rpc2, rpc3, monadinfra fallbacks).
- Full details in `ARCHITECTURE.md` section 4.

## Session history

| Date | Summary |
| --- | --- |
| 2026-10-09 | Hackathon research, 5 ideas compared, Origo chosen, build docs and CLAUDE.md written, existing docs translated to English |
| 2026-10-09 | Gap audit (27 items in `GAPS.md`), spec updated, testnet RPC and faucet checked, solo + Vercel confirmed |
| 2026-10-09 | GitHub repo created, Vercel project `origo-app` linked with domain `origo-monad.vercel.app`. Repo scaffolded: git, pnpm workspace, contracts (Foundry + OZ), `@origo/sdk` (constants, networks), `@origo/web` (Vite React, Vercel config), README, MIT license |
