# Origo: Gaps, Blockers, and Weaknesses

Audit done on 2026-10-09, before any code. Every item has a status:

- **Resolved (spec):** fixed by a design change, already written into `ARCHITECTURE.md`.
- **Resolve in code:** the design is decided, but it can only be proven or finished while coding. Each one has a task in `BUILD_PLAN.md`.
- **Accepted limitation:** cannot be fully solved in this hackathon. It is stated honestly in the README and the pitch.

Update the status here when an item changes.

## Summary

| # | Item | Severity | Status |
| --- | --- | --- | --- |
| G1 | History cannot be read from event logs (RPC `eth_getLogs` limit) | Blocker | Resolved (spec) |
| G2 | Front-runner copies the pHash and `fileCommit` from a pending transaction | High | Resolved (spec) |
| G3 | Evidence ranking trusted self-reported fields | High | Resolved (spec) |
| G4 | In-app capture loses the original file, so ownership cannot be proven later | High | Resolved (spec) + code |
| G5 | New users have 0 MON and cannot register | High | Resolved (spec) + code |
| G6 | Passkeys are bound to the domain (rpId) | High | Resolved (spec) |
| G7 | Desktop Chrome returns `PRF_UNAVAILABLE` | Medium | Resolved (spec) |
| G8 | Passkey loss means losing the creator identity | Medium | Resolved (spec) |
| G9 | Bucket flooding makes search too expensive (griefing) | Medium | Resolved (spec) + code |
| G10 | No way to see the matched photo, so the user cannot confirm a match visually | Medium | Resolved (spec) |
| G11 | Changing the hash algorithm later breaks old records | Medium | Resolved (spec) |
| G12 | Sequential nonces break relayed or batched registrations | Low | Resolved (spec) |
| G13 | Screenshots and text overlays are not handled by border trim alone | Medium | Measured: manual crop required (code on Day 2) |
| G14 | Hash determinism across browsers and Node | High | Resolve in code |
| G15 | HEIC photos cannot be decoded in Chrome | Medium | Resolve in code |
| G16 | `MATCH_DISTANCE` and the false-positive rate are unproven | High | Resolved (measured) |
| G17 | Testnet can be reset | Medium | Resolved (spec) |
| G18 | RPC rate limits | Low | Resolved (spec) |
| G19 | Track 04 needs proof that other apps can build on Origo | Medium | Resolved (spec) + code |
| G20 | Mirrored copies cannot be linked on-chain | Low | Accepted limitation |
| G21 | Perceptual hashes are not robust against deliberate adversarial attacks | Medium | Accepted limitation |
| G22 | A thief who has the real original file has equal evidence | Low | Accepted limitation |
| G23 | Attesters are centrally managed | Low | Accepted limitation |
| G24 | Crops of 10% or more do not match in the MVP | Medium | Accepted limitation, measured (tiles are stretch) |
| G28 | Tampering with signed fields makes ecrecover return a different creator | Low | Accepted (harmless) |
| G29 | `findMatches` with an unbounded `maxCandidates` allocates memory proportional to the registry | Low | Resolved (SDK always pages with 256) |
| G25 | `source = Capture` can be faked | Low | Accepted limitation |
| G26 | Ownership proof is not recorded on-chain | Low | Accepted limitation |
| G27 | On-chain thumbnails are permanent and public | Low | Resolved (spec): opt-in |

## Details

### G1. History cannot be read from event logs (Blocker, resolved)
Public Monad RPCs limit `eth_getLogs` to 100 blocks (QuickNode, Monad Foundation) or 1,000 blocks (Alchemy, Ankr). With sub-second blocks, that is less than a few minutes of history. So "my registrations", "creator profile", and feeds cannot come from scanning events.
**Fix:** every list the UI needs is readable from contract state through `view` functions: `recordsOf(creator, offset, limit)`, `recordCount()`, `getRecords(ids)`. Each record stores its `registeredBlock`, so a single-block `eth_getLogs` can fetch that record's event data (for example a thumbnail) without any range scan. Envio stays a stretch goal for a richer feed.

### G2. Front-running copies the commitment (High, resolved)
A pending `register` transaction exposes `pHash` and `fileCommit` in its calldata. Before the fix, an attacker could copy both and land first. Then the real owner's ownership proof would also "pass" for the attacker's record, because the file matches the same commitment.
**Fix:** bind the commitment to the creator: `fileCommit = keccak256(abi.encode(sha256(originalFileBytes), creator))`. The raw SHA-256 never appears on-chain. An attacker who copies the value gets a commitment bound to someone else's address, so their own record fails the ownership check. They cannot build a valid commitment for their own address without the original file. The attacker can still copy the pHash, but an unproven record never outranks a proven one (G3).

### G3. Ranking trusted self-reported fields (High, resolved)
`source`, `width`, and `height` are self-reported, so an attacker could claim "Capture, 8000 px" to outrank the real owner.
**Fix:** a new ranking order (ARCHITECTURE section 10):
1. Ownership proof passed in this browser.
2. Creator attested.
3. Earliest registration (block number, then id).

Self-reported fields are only used as tie-breakers and are always labeled "self-reported". Two records registered within 60 seconds of each other are flagged "contested: registered at nearly the same time".

### G4. In-app capture loses the original file (High, resolved + code)
The commitment is over the exact bytes that were registered. If those bytes exist only in browser memory, the photographer can never prove ownership. Also, a `getUserMedia` video frame is not the full-resolution photo.
**Fix:**
- Capture uses `<input type="file" accept="image/*" capture="environment">`, which opens the native camera app and returns the full-resolution file.
- The exact registered bytes are stored in IndexedDB, and the user is prompted to "Save original" (download) right after registering.
- The UI warns that edited or re-exported versions will not match the commitment.

**Code task:** verify on iPhone Safari which bytes the input returns (JPEG transcode or HEIC). Persistence works the same either way.

### G5. New users have 0 MON (High, resolved + code)
A fresh passkey wallet cannot pay gas. Registration costs about 200k gas, which is about 0.02 MON (about $0.0005) at the 100 gwei minimum base fee. That is cheap, but the user still needs some MON.
**Fix (no backend):** the creator key signs an EIP-712 registration that **anyone** can submit (G12 makes this safe). The app offers three ways to pay:
1. Own wallet: fund the passkey wallet (testnet faucet link with the address prefilled, or a transfer).
2. **Relay link:** export the signed registration as a link or QR code. A newsroom, editor, or friend opens it with any funded wallet (MetaMask) and submits it. This matches the newsroom story: the outlet pays, the photographer keeps their identity.
3. Stretch: a sponsored paymaster (Alchemy or Pimlico gas policy) if time allows.

### G6. Passkeys are bound to the domain (High, resolved)
Mera passkeys use `rpId = hostname`. Vercel preview URLs have different hostnames, and changing domains later makes existing accounts unreachable (Mera docs warn about this).
**Fix:** the production domain is fixed as `origo-monad.vercel.app` (decided on Day 0) and hardcode `RP_ID` to it in production. Preview deployments show a banner "test accounts only". Development uses `localhost` (separate accounts).

### G7. Desktop Chrome `PRF_UNAVAILABLE` (Medium, resolved)
Only passkeys saved in Google Password Manager return PRF on desktop Chrome, and judges may test on desktop Chrome.
**Fix:**
- Verify needs no account, so the core demo always works.
- Registration catches `PRF_UNAVAILABLE` and explains the fix (save the passkey to Google Password Manager, use a phone, iCloud Keychain, or 1Password).
- It also offers a fallback: "Use an injected wallet (MetaMask)". In that case the wallet address is both creator and payer, and the app labels that mode.

### G8. Passkey loss (Medium, resolved)
Losing the passkey loses the wallet and the creator keys.
**Fix:** offer "Back up": show the BIP-39 mnemonic of the 32 PRF bytes (Mera's standard derivation). The PRF bytes can be rebuilt from the mnemonic, so **both** the wallet key and the HKDF creator key can be restored. Ownership proofs do not depend on keys at all, only on the original file and the creator address.

### G9. Bucket flooding (Medium, resolved + code)
Registration is cheap (about $0.0005), so an attacker could register thousands of records into the same buckets and make `findMatches` exceed RPC gas limits (200M per `eth_call`, with a faster pool under 8.1M).
**Fix:**
- `findMatches` is paginated (`cursor`, `maxCandidates`) and returns `nextCursor`. The client loops, so no single call gets too heavy.
- Degenerate hashes (popcount below 8 or above 56, for example flat or blank images) are rejected on-chain.
- Stretch: a small refundable deposit per registration raises the cost of spam.

**Code task:** gas-test `findMatches` with 10,000 records in one bucket.

### G10. No visual confirmation (Medium, resolved)
Without seeing the matched photo, users cannot tell "the same photo" from "a similar shot of the same scene".
**Fix:** an optional low-resolution thumbnail (long edge 96 px, WebP, at most 4 KB) is emitted in the `Registered` event as calldata. It costs about 16 gas per byte, so about 64k gas. The verifier fetches it with a single-block `eth_getLogs` using `registeredBlock` (G1). It is opt-in and on by default for "Capture", with a clear notice that it is public and permanent (G27).

### G11. Hash algorithm changes (Medium, resolved)
**Fix:** `HASH_VERSION = 1` is part of the EIP-712 type, the record, and the bucket key `keccak256(version, segmentIndex, segmentValue)`. A future algorithm lives in separate buckets without breaking old records.

### G12. Sequential nonces (Low, resolved)
Signed registrations relayed by different people can arrive out of order.
**Fix:** unordered nonces: a random `uint256` per signature, tracked in `usedNonce[creator][nonce]`, plus a `deadline`.

### G13. Screenshots and overlays (Medium, resolved + code)
Real screenshots have non-uniform status bars and app UI, and hoax images often have caption text added.
**Fix:**
- Auto border trim first, then a **manual crop tool** in Verify ("select the photo area"). This is simple, robust, and honest.
- The robustness suite adds cases for a WhatsApp chat screenshot, caption bars, and a text overlay, so the README can show the real limits.

### G13 measured (2026-10-09)
- Chat screenshot with auto trim only: 0% found (median 26 bits), because the chat UI is not a uniform border. With the manual crop: 100% found at distance 0.
- Caption bars with text: 4% found at 11 bits, because the bars contain text and are not uniform. Manual crop fixes this the same way.
- Text overlay on the photo: 70% at 7 bits, 93% at 11 bits.

Consequence: the manual crop tool in Verify is a must-have, not optional. Stretch: automatic photo-region detection inside screenshots.

### G14. Determinism across browsers (High, resolve in code)
JPEG decoders, chroma upsampling, ICC color management (Display P3 iPhone photos), and EXIF orientation can differ between Chrome, Safari, and Node (sharp).
**Plan:**
- Our own resize removes the largest source of difference.
- Use `colorSpaceConversion: "none"` and `imageOrientation: "from-image"`. In Node, decode without ICC conversion.
- Day 2 test: hash the same 10 files in Chrome, Safari, and Node and compare. Small differences (1 to 2 bits) are absorbed by the distance threshold. Larger ones are bugs.

### G15. HEIC in Chrome (Medium, resolve in code)
iPhone gallery photos may be HEIC, which Chrome cannot decode.
**Plan:** Safari decodes HEIC natively. On other browsers, detect HEIC and show "Open in Safari, or export as JPEG". The capture path returns a browser-decodable file (to verify in G4). A WASM HEIC decoder is a stretch goal only.

### G16. Thresholds (High, resolved by measurement)
Measured on 27 real photos (`ROBUSTNESS.md`): every compression, resize, WhatsApp-like double compression, brightness, mirror, rotation, and border case stayed within 4 bits. Different photos were never closer than 18 bits, including 5 shots of the same flood scene. `MATCH_DISTANCE = 7` is frozen, and 8 to 11 is shown as "likely the same photo, edited or cropped".

Original plan:
**Plan:** the robustness suite on Day 1 (more than 20 public-domain photos, all transformations, plus pairwise distances between different photos) decides the threshold and reports the false-positive rate. If needed, use probe radius 2 for verification (`r <= 11`, still a view call).

### G17. Testnet resets (Medium, resolved)
The Monad testnet was reset from genesis on 2025-12-16.
**Fix:** testnet for development only. The **mainnet deployment is canonical** for the submission and demo, since registration costs about $0.0005. The README lists both.

### G18. RPC rate limits (Low, resolved)
Testnet: QuickNode allows 50 rps (25 rps for `eth_call`), Ankr 300 requests per 10 s, Monad Foundation 20 rps with no batching.
**Fix:** viem `fallback()` transport over several endpoints. Verification needs 8 search calls plus 1 records call per image, which is well within the limits.

### G19. Proof that Track 04 is infrastructure (Medium, resolved + code)
**Fix:** ship `examples/verify-widget/`, a single static HTML page that imports the SDK and verifies an image in about 30 lines. This proves a third party can build on the registry. The SDK is consumable from GitHub (npm publish optional).

### G20. Mirrored copies cannot be linked on-chain (Low, accepted)
A median-thresholded pHash cannot be transformed exactly by bit operations, so the contract cannot verify a mirrored link. Verification still finds mirrored copies through the 8 variants, and ranking still shows the earliest proven record. Only the on-chain `parentId` shortcut is missing for mirrors.

### G21. Adversarial robustness (Medium, accepted)
Perceptual hashes can be attacked: small crafted perturbations can push a copy beyond the threshold, or a crafted image can collide with someone's hash. Origo is an evidence tool for good-faith verification (fact-checkers, newsrooms), not an adversarially robust classifier. The README states this. Mitigations: the ownership proof (cannot be faked without the original) and, as a stretch, a PDQ second stage.

### G22. A thief with the real original (Low, accepted)
If the original file itself is stolen (hacked cloud, a client leak), the thief has equal evidence. Capture-time registration is the defense: the earliest proven record wins.

### G23. Central attesters (Low, accepted)
The owner manages the attester list in the MVP. Roadmap: multiple independent attesters or an ERC-8004-style registry. The demo uses a clearly fictional "Origo Demo Attester", never a real organization.

### G24. Crops (Medium, accepted for MVP, measured)
Measured: center crop 5% is found 67% at 7 bits and 96% at 11 bits; center crop 10%, 4% and 41%; center crop 20% and one-side crop 10%, 0% and 0 to 7%. Tiles are the first stretch goal.

Original note:
Without tiles, crops beyond about 10 to 20% may not match. The manual crop in Verify does not help when the query *is* a crop. Tiles are the first stretch goal. The README states the measured limit from the robustness suite.

### G25. `source = Capture` can be faked (Low, accepted)
It is self-reported and therefore labeled "self-reported", and it is only a tie-breaker (G3).

### G26. Ownership proof is not on-chain (Low, accepted)
A contract cannot decode images, so the proof runs in the verifier's browser. It is portable: anyone given the original file can re-run it and get the same result. Stretch: attesters record dispute outcomes on-chain.

### G27. Thumbnails are permanent and public (Low, resolved)
Opt-in, with a clear notice. Upload of others' photos defaults to no thumbnail.

### G28. Tampered signed fields (Low, accepted)
If a relayer changes a signed field, `ecrecover` returns a different, random address instead of reverting, so the record is attributed to an address nobody controls. The original creator is not affected and the relayer gains nothing. Inherent to ECDSA recovery.

### G29. Unbounded search page (Low, resolved)
`findMatches` sizes its result arrays by `min(maxCandidates, 4 * recordCount)`. The SDK always pages with `maxCandidates = 256`, so a page stays under 1M gas.
