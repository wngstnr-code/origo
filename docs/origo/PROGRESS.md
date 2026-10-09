# Origo: Progress Log

Read this first every session. Update it at the end of every session. Keep it short: replace stale status instead of appending forever.

## Current status

- **Phase:** Day 1 done. Contract deployed and verified on testnet; end-to-end smoke test passed (register f01, WhatsApp-like copy found at distance 0).
- **Team:** solo (the project owner). **Hosting:** Vercel (static only).
- **Last updated:** 2026-10-09
- **Deadline:** Wed Oct 14, 10:59 WIB (Oct 13, 11:59 PM ET). Internal target: Tue Oct 13, 22:00 WIB.
- **Repo:** https://github.com/wngstnr-code/origo (public). **App:** https://origo-monad.vercel.app
- **Deployer:** `0x7776BE3f1fdd370097Ee8FaD3A642f04eC9f4Ed1` (key only in local `.env`).
- **Next action:** Day 2 (web app: Mera onboarding, Register, Verify with manual crop).

## Deployments

| Network | Contract | Address | Tx / block | Date |
| --- | --- | --- | --- | --- |
| Monad testnet (10143) | OrigoRegistry | [`0xEe00BC6a082914b5d5455624a3727dEE1B3c78F6`](https://testnet.monadvision.com/address/0xEe00BC6a082914b5d5455624a3727dEE1B3c78F6), verified on Sourcify (exact match). Dev only, testnet can reset | deploy tx `0x52eccb798eebd10c175d61a06ed2b5a211743470df5df29cc2e96348792c4bca`, block 69472733 | 2026-10-09 |
| Monad mainnet (143) | OrigoRegistry | not deployed (canonical for submission) | | |
| Web app (Vercel) | project `origo-app` | https://origo-monad.vercel.app (passkey rpId, never change). Auto-deploys from GitHub `main` | scaffold page live | 2026-10-09 |

## Measured numbers

| Metric | Value | How measured |
| --- | --- | --- |
| Gas per `register` | about 424k (no thumbnail), about 525k (4 KB thumbnail) | `forge test --gas-report` |
| Gas per `findMatches` page (256 candidates, 10k-entry bucket) | about 910k | Foundry test |
| Testnet `register` confirmation time | 1.1 s (send to receipt) | `smoke-testnet.mjs` |
| Testnet gas charged for `register` | 568,162 = estimate x 1.15 (Monad charges the gas limit) | `smoke-testnet.mjs` |
| `MATCH_DISTANCE` | 7 (frozen); 8 to 11 = likely same, edited | `ROBUSTNESS.md` |
| Copies found at <= 7 bits | 100% for compression, resize, WhatsApp x2, brightness, mirror, rotate, borders | `ROBUSTNESS.md` |
| Closest different photos | 18 bits (0% false positives at <= 11) | `ROBUSTNESS.md` |
| `phash` on a 4000 x 3000 image (Node) | 56 ms | vitest |

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
| 2026-10-09 | Commit uniqueness is per (creator, fileCommit), not global | A global check would let a front-runner block the honest registration |
| 2026-10-09 | `MATCH_DISTANCE = 7` frozen; 8 to 11 shown as likely same | Robustness: copies <= 4 bits, different photos >= 18 bits |
| 2026-10-09 | Manual crop in Verify is a must-have | Chat screenshots: 0% found with auto trim, 100% with manual crop |
| 2026-10-09 | Verify contracts on Sourcify (MonadVision) with `--verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/` | No API key needed; owner requires verified contracts |
| 2026-10-09 | `evm_version = "osaka"` pinned | solc 0.8.30 default; confirmed working on Monad testnet; pinning keeps verification reproducible |
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
| 2026-10-09 | Day 1: OrigoRegistry + 36 Foundry tests, SDK hash + index math + 36 vitest tests, 27 public-domain fixtures, robustness report. Cross-checked bucket key and cursor encoding between SDK and contract |
| 2026-10-09 | Testnet deploy + Sourcify verification, end-to-end smoke test on testnet |
