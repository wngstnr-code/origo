# Origo: Build Plan

**Hard deadline:** Tue Oct 13, 2026, 11:59 PM ET = **Wed Oct 14, 10:59 WIB**. Late submissions are rejected, and the version saved at the deadline is the one judged.
**Internal target:** submission complete by **Tue Oct 13, 22:00 WIB**. Wed morning is buffer only.

Rule of thumb: the MVP must work end to end on testnet by the end of Day 3. Nothing from the stretch list starts before that.

## Day-by-day

### Day 0: Fri Oct 9 (setup)
- [ ] Dashboard (owner): create team (solo), create project "Origo", Track 04, add bounty "Mera: One Passkey, Many Keys" (Envio only if the stretch happens)
- [x] `git init`, MIT license
- [x] First commits, public GitHub repo https://github.com/wngstnr-code/origo
- [x] pnpm workspace scaffold: `contracts/` (forge init + OpenZeppelin), `packages/sdk`, `apps/web` (Vite React TS); `examples/verify-widget` is created on Day 3
- [x] Production domain fixed: `origo-monad.vercel.app` (rpId, G6)
- [x] Vercel project `origo-app` (config in root `vercel.json`), domain https://origo-monad.vercel.app, auto-deploy from `main`
- [ ] Deployer wallet + demo wallet; testnet MON from https://faucet.monad.xyz (owner solves the Cloudflare check); a small amount of mainnet MON for the Day 3 deploy

### Day 1: Sat Oct 10 (core logic)
- [x] SDK hash: trim, crop, luma, area resize, DCT, pHash, 8 variants, Hamming, degenerate check, thumbnail encoder moved to Day 2 web app (ARCHITECTURE section 5)
- [x] SDK index-math: segments, probe order, cursor encoding (mirrors the contract)
- [x] Fixtures: 20+ public-domain photos with attribution
- [x] Robustness suite v1, then freeze `MATCH_DISTANCE` and record the false-positive rate (G16)
- [x] Contract: `register` (EIP-712, random nonces, creator-bound commit, thumbnail), buckets, paginated `findMatches`, `recordsOf`, `getRecords`, `linkDerivative`, attesters (ARCHITECTURE section 7)
- [x] Foundry tests incl. the front-run test, the "no false negatives within 7" fuzz test, and the 10,000-record bucket gas test (G2, G9)
- [x] Deploy to testnet (verified on Sourcify), record the address and gas per `register`

### Day 2: Sun Oct 11 (web app, happy path)
- [ ] Mera onboarding: wallet + creator keys, backup mnemonic, `PRF_UNAVAILABLE` message, injected-wallet fallback (G7, G8)
- [ ] Register (upload): hash, commit, sign, IndexedDB + "Save original", pay with own wallet (G4)
- [ ] Verify: drop image, manual crop, 8 variants, paginated search, thumbnails via single-block `getLogs`, ranking (G1, G3, G10, G13)
- [ ] Cross-runtime hash check: the same 10 files in Chrome, Safari, and Node (G14)
- [ ] End-to-end test with a real photo sent through WhatsApp and back

### Day 3: Mon Oct 12 (MVP complete)
- [ ] Capture via the native camera input; check what iPhone Safari returns (JPEG or HEIC) (G4, G15)
- [ ] Relay link / QR + `/relay` page (G5)
- [ ] Prove-ownership page (G2 check bound to the creator)
- [ ] "Me" page: my records via `recordsOf`, backup
- [ ] `examples/verify-widget` working against the deployed contract (G19)
- [ ] Deploy the contract to **mainnet** (canonical, G17), register several real photos, deploy the web app to the fixed Vercel domain
- [ ] **MVP freeze at end of day**

### Day 4: Tue Oct 13 (ship)
- [ ] README: problem and user, architecture, "How Origo uses Monad" with mainnet and testnet addresses and tx hashes, setup steps, limitations (from `GAPS.md`), AI tool disclosure
- [ ] `ROBUSTNESS.md` generated from the suite
- [ ] Record the demo video (script below), upload publicly
- [ ] Fill in the project profile on the dashboard and **submit by 22:00 WIB**
- [ ] Stretch only if everything above is done: tiles for crops (G24), then Envio feed

### Buffer: Wed Oct 14, until 10:59 WIB
- Fixes only. The submission can be edited until the deadline.

## MVP vs stretch

| Feature | Priority |
| --- | --- |
| pHash + 8 orientations + border trim | MVP |
| Contract with on-chain multi-index search | MVP |
| Mera passkey: wallet key + creator key (EIP-712) | MVP |
| Register (upload), Verify | MVP |
| In-app camera capture | MVP |
| Prove ownership (reveal original) | MVP |
| Attester label, linkDerivative | MVP (small) |
| Robustness report | MVP (judge-facing) |
| SDK package usable by other apps | MVP (Track 04 fit) |
| Relay link (someone else pays gas) | MVP (G5) |
| Manual crop in Verify, thumbnails | MVP (G10, G13) |
| Mnemonic backup, injected-wallet fallback | MVP (G7, G8) |
| verify-widget example | MVP (G19) |
| Tile hashes for crops | Stretch |
| Stake and challenge | Stretch |
| Envio HyperIndex feed | Stretch |
| PDQ second stage | Stretch |

## Submission checklist (from the official rules)

- [ ] Public GitHub repo with complete source, OSI license (MIT), attribution of external code and libraries
- [ ] Commit history across the build window
- [ ] README: project description, the problem and intended user, architecture overview, tech stack, setup and deploy steps a third party can follow, pre-existing code (none) disclosed
- [ ] README: "AI tool disclosure" section (required by the rules; neutral wording, AI is not listed as a contributor)
- [ ] README: "How Origo uses Monad" section with contract addresses (testnet and mainnet) and example tx hashes
- [ ] Demo video of at most 3 minutes, public, showing the real product and real Monad transactions (no slides or mockups)
- [ ] Project profile on hackathon.monad.xyz: demo link, write-up, code link, track, bounties
- [ ] No private keys, `.env` values, or third-party personal data in the repo
- [ ] Em dash check passes on all docs

## Demo video script (at most 3:00)

| Time | Shot | Line |
| --- | --- | --- |
| 0:00 to 0:20 | A viral hoax photo in a WhatsApp chat | "This photo is spreading as 'today's flood'. Who took it, and when? Content Credentials cannot tell you, because WhatsApp stripped the metadata." |
| 0:20 to 0:50 | Photographer opens Origo, Face ID, takes a photo in-app | "Origo anchors a visual fingerprint on Monad at the moment of capture. No seed phrase, just a passkey." Show the tx confirming in about a second. |
| 0:50 to 1:30 | Send the photo through WhatsApp, screenshot it, mirror it, drop it into Verify | "Different file, different bytes, mirrored. Origo still finds it, in under a second." Show the result card and explorer link. |
| 1:30 to 2:00 | A "thief" registers a WhatsApp copy from the gallery, then Verify shows both | "First is not the same as owner. Origo ranks evidence." Run Prove ownership with the original file, all checks pass. |
| 2:00 to 2:35 | Code and architecture | On-chain multi-index search with the pigeonhole guarantee, deterministic hashing, PRF-derived creator key, robustness table. |
| 2:35 to 3:00 | SDK snippet + close | "Origo is a primitive any newsroom or app can build on. Labels can be stripped. A photo's face cannot be hidden." |

## Risks to watch

| Risk | Mitigation |
| --- | --- |
| Hash differs between browsers | Own resize code; cross-runtime check on Day 2 (G14) |
| Judges test on desktop Chrome without PRF | Verify needs no account; injected-wallet fallback for registering (G7) |
| Testnet reset | Mainnet deployment is canonical (G17) |
| PRF unavailable on desktop Chrome | Clear error message; demo on iPhone Safari or with iCloud Keychain |
| Gas higher than expected | Measure on Day 1; packing already minimizes slots |
| Running out of time | MVP freeze on Day 3, stretch only after submission is drafted |
