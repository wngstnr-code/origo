# Origo: Progress Log

Read this first every session. Update it at the end of every session. Keep it short: replace stale status instead of appending forever.

## Current status

- **Phase:** Contract **frozen** after the pre-freeze review and R5/R6 fixes (`CONTRACT_REVIEW.md`, 54 tests). v4 deployed and verified on testnet; smoke test passes (copy and 20% crop found at distance 0 via earliest-first search); attester flow tested on testnet. Next: frontend. Mainnet only after the frontend is safe.
- **Freeze rule:** no contract changes unless a frontend blocker is found; any change needs a new review entry and a testnet redeploy.
- **Team:** solo (the project owner). **Hosting:** Vercel (static only).
- **Last updated:** 2026-10-09
- **Deadline:** Wed Oct 14, 10:59 WIB (Oct 13, 11:59 PM ET). Internal target: Tue Oct 13, 22:00 WIB.
- **Repo:** https://github.com/wngstnr-code/origo (public). **App:** https://origo-monad.vercel.app
- **Deployer:** `0x7776BE3f1fdd370097Ee8FaD3A642f04eC9f4Ed1` (key only in local `.env`).
- **Frontend:** landing page v1 built (`apps/web/src/landing`): composition modeled on joinmastodon.org, rebuilt from scratch (their repo has no license, so no code or art copied), own owl mascot and owl logo, live demos (in-browser hashing and a live registry read, lazy loaded), site footer, share metadata and OG image. Waiting on the app: passkey feature row, a working "Launch app" target (`/app`), and a user-flow section.
- **App:** all five pages built against testnet v4 (`apps/web/src/app`): Verify, Record (with Prove), Register (Mera passkey, crop protection, optional preview, own wallet or relay link), My photos (account, backup phrase, restore from phrase), Relay (pay with passkey or browser wallet). Prove was merged into the Record page. SDK gained `keys/` (wallet BIP-44 + creator HKDF + backup phrase) with 5 tests.
- **Tested in the browser:** Verify (WhatsApp copy 0 bits, mirror 0 bits, chat screenshot found after manual crop at 2 bits, unknown photo), Record and Prove (copy fails, original passes), Register signing and pricing (about 1.0 MON with tiles, 0.06 MON without), relay link round trip with thumbnail, invalid and already-registered relay links.
- **Not yet tested:** the real passkey prompt and a paid registration (needs the owner's Touch ID and faucet MON), and paying a relay link with a browser wallet.
- **Next action:** owner tests passkey + registration on localhost, then on origo-monad.vercel.app; then mainnet deploy.

## Deployments

| Network | Contract | Address | Tx / block | Date |
| --- | --- | --- | --- | --- |
| Monad testnet (10143) | **OrigoRegistry v4 (frozen)** | [`0x3cdFC7B2CF9aCbC0476a72b03b259719aFfBbC7C`](https://testnet.monadvision.com/address/0x3cdFC7B2CF9aCbC0476a72b03b259719aFfBbC7C), verified on Sourcify (exact match). Dev only, testnet can reset | deploy tx `0xaac4116579a5b294d1b935dd4a402df31dc281497d9c2639e44c05f33989cc0d`, block 69477105 | 2026-10-09 |
| Monad testnet (10143) | OrigoRegistry v3 (superseded) | `0xf9C32b380540F0E66104687224296224B794b21F` | deploy tx `0xb7fb2f123ab1033dd17d2a0abd59d7095cebe256868aee4b54b5a20f654db036`, block 69476056 | 2026-10-09 |
| Monad testnet (10143) | OrigoRegistry v2 (superseded) | `0x438a903afa6be86dcab7F013cCdB438Bf44c3488` | deploy tx `0x2ca2c96a6de35d7b5d0883f9298292ea5dd38c8e366fc38e532968065381084b`, block 69475101 | 2026-10-09 |
| Monad testnet (10143) | OrigoRegistry v1 (superseded, no tiles) | `0xEe00BC6a082914b5d5455624a3727dEE1B3c78F6` | block 69472733 | 2026-10-09 |
| Monad mainnet (143) | OrigoRegistry | not deployed (canonical for submission) | | |
| Web app (Vercel) | project `origo-app` | https://origo-monad.vercel.app (passkey rpId, never change). Auto-deploys from GitHub `main` | scaffold page live | 2026-10-09 |

## Measured numbers

| Metric | Value | How measured |
| --- | --- | --- |
| Gas per `register` | 425k (no tiles), 526k (4 KB thumbnail), 7.74M (39 tiles), 7.84M (39 tiles + thumbnail) | Foundry, fresh state |
| Cost of `register` with 39 tiles at 100 gwei | about 0.77 MON used; about 1 MON charged with the 15% gas-limit margin | testnet smoke |
| Gas per `findMatches` page (256 candidates, 10k-entry bucket) | about 1.01M | Foundry test |
| Testnet `register` confirmation time | 1.1 s (send to receipt) | `smoke-testnet.mjs` |
| Testnet gas charged for `register` | 568,162 without tiles; 9,981,958 with 39 tiles (= estimate x 1.15; Monad charges the gas limit) | `smoke-testnet.mjs` |
| Testnet smoke v2 | WhatsApp-like copy found at distance 0 (tile 0); 20% center crop found at distance 0 via tile 14 | `smoke-testnet.mjs` |
| `MATCH_DISTANCE` | 7 (frozen); 8 to 11 = likely same, edited | `ROBUSTNESS.md` |
| Copies found at <= 7 bits | 100% for compression, resize, WhatsApp x2, brightness, mirror, rotate, borders | `ROBUSTNESS.md` |
| Closest different photos | 18 bits (0% false positives at <= 11) | `ROBUSTNESS.md` |
| `phash` on a 4000 x 3000 image (Node) | 56 ms | vitest |

## Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-09 | Build Origo for Track 04 | Only idea that is fully backend-free and oracle-free, strongest demo moment, fits the official Track 04 example |
| 2026-10-09 | Name "Origo" (earlier working names: Sidik, Rupa) | Chosen by the project owner |
| 2026-10-09 | Prove ownership lives on the Record page, not its own page | The proof is always about one record; fewer pages to build and explain |
| 2026-10-09 | Passkey keys stay in Mera sessions for the tab's lifetime (ended on sign out and pagehide) | One prompt per visit instead of per signature; nothing but the credential id is stored |
| 2026-10-09 | Landing follows the joinmastodon.org layout, rebuilt from scratch with our own owl mascot | Owner picked Mastodon after five reference rounds; its repo has no license, so copying code or art would be infringement and impersonation |
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
| 2026-10-09 | Finish and freeze the contract before the frontend; mainnet only after the frontend is safe | Owner decision: avoid redeploying mainnet after users register |
| 2026-10-09 | Opt-in crop protection with 39 tiles (S3 layout) in the contract | Tiles experiment: crops of 10 to 30% go from 0 to 4% found to 93 to 96%, false positives stay 0% |
| 2026-10-09 | Remove `linkDerivative`/`parentId`; add `InvalidCursor`, `TooManyRecords`, `Ownable2Step` | Pre-freeze review (`CONTRACT_REVIEW.md`): a permissionless set-once link could mislabel honest records |
| 2026-10-09 | Earliest-first search (`findEarliest`) instead of a deposit | A deposit only raises attack cost; append-only buckets make the oldest entries immune to later floods, at no cost to honest users |
| 2026-10-09 | Per-attester labels (`labelOf`, `labelsOf`) | Attesters cannot overwrite each other |
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
| 2026-10-09 | Tiles experiment, opt-in crop protection in contract (49 tests) and SDK (43 tests), testnet v2 deploy + verification + smoke test |
| 2026-10-09 | Pre-freeze contract review: removed linkDerivative, added cursor validation, id bound, Ownable2Step. Testnet v3 deployed, verified, smoke-tested. Contract frozen |
| 2026-10-09 | Closed flooding (findEarliest) and attester overwrite (per-attester labels); 54 tests; testnet v4 deployed, verified, smoke-tested, attester flow tested |
| 2026-10-09 | Frontend reference rounds 3 to 5 (playful, landing only), landing v1 with live hash demos and a live record read |
| 2026-10-09 | Landing polish: owl logo and favicon, footer, launch button, mobile fixes, lazy demos (initial JS 508 KB to 237 KB), OG image and meta, RPC error state checked |
| 2026-10-09 | App pages: Verify, Record + Prove, Register, My photos, Relay; SDK keys module |
