# Origo: Architecture and Technical Spec

This is the source of truth for implementation. If the code needs to differ, update this file in the same change and log the decision in `PROGRESS.md`. Gap references (G1, G2, ...) point to `GAPS.md`.

## 1. System overview

```
Browser (static PWA on Vercel)                         Monad
+-------------------------------------------+         +-----------------------------+
| apps/web (Vite + React + TS)              |         | OrigoRegistry.sol           |
|   uses packages/sdk                       |  tx     |  records[]                  |
|   - hash: decode, trim, crop, pHash, x8   |-------->|  buckets (4 x 16-bit, v1)   |
|   - keys: Mera PRF -> wallet + creator    |  call   |  recordsOf(creator)         |
|   - chain: viem, EIP-712, fallback RPCs   |<--------|  findMatches() paginated    |
|   - IndexedDB: originals + my records     |         |  attesters, labels          |
+-------------------------------------------+         +-----------------------------+
        |                                                      |
        | public RPCs (fallback)          single-block eth_getLogs for thumbnails
        v
   No backend of our own. Vercel serves static files only (no serverless functions).
```

The only shared state is the contract. Nothing about a photo leaves the device except the 64-bit fingerprint, the creator-bound commitment, the claimed dimensions, and (opt-in) a 96 px thumbnail.

## 2. Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Monorepo | pnpm workspaces | Node 24, pnpm 10 (installed) |
| Contracts | Solidity 0.8.30, Foundry (forge 1.8.3), forge-std v1.16.1 and OpenZeppelin v5.6.1 as git submodules (EIP712, ECDSA, Ownable) | Tests in `contracts/test` |
| SDK | TypeScript, ESM, built with `tsc` (tsup's DTS step is incompatible with TypeScript 6), vitest | Pure functions on RGBA buffers: same code in browser and Node |
| Web app | Vite + React + TypeScript, PWA | Static deploy on **Vercel** |
| Chain client | viem (`monad`, `monadTestnet` from `viem/chains`) | `fallback()` transport |
| Accounts | `@category-labs/mera`, `@category-labs/mera/viem`, `@scure/bip32`, `@scure/bip39`, `@noble/hashes` (HKDF) | Injected-wallet fallback (G7) |
| Local storage | IndexedDB (via `idb`) | Originals and the user's records (G4) |
| Test decoding (Node only) | sharp, devDependency | Never shipped to the browser |

## 3. Repository layout

```
monad/
  CLAUDE.md
  README.md                 # submission README (setup, architecture, AI disclosure)
  LICENSE                   # MIT
  package.json
  pnpm-workspace.yaml
  scripts/check-dashes.py
  contracts/
    foundry.toml
    src/OrigoRegistry.sol
    test/OrigoRegistry.t.sol
    script/Deploy.s.sol
  packages/sdk/
    src/hash/               # trim, crop, luma, area resize, dct, phash, dihedral variants
    src/index-math/         # segments, probes, hamming (mirrors the contract)
    src/keys/               # Mera PRF -> wallet key + creator key, backup mnemonic
    src/chain/              # ABI, addresses, EIP-712 types, register/verify/relay helpers
    src/proof/              # ownership proof (reveal) checks
    test/                   # unit tests + robustness suite
    fixtures/               # public-domain photos + ATTRIBUTION.md
  apps/web/
    src/pages/              # Register, Verify, Prove, Relay, Me (records + backup)
    src/lib/                # browser decode, capture input, IndexedDB
  examples/verify-widget/   # one static HTML page that uses the SDK (G19)
  docs/
```

## 4. Networks and RPC

| | Mainnet (canonical for submission, G17) | Testnet (development) |
| --- | --- | --- |
| Chain ID | 143 | 10143 |
| RPCs (viem `fallback`, in order) | `https://rpc.monad.xyz` (QuickNode, 25 rps), `https://rpc1.monad.xyz` (Alchemy, 15 rps), `https://rpc3.monad.xyz` (Ankr), `https://rpc-mainnet.monadinfra.com` (20 rps, no batch) | `https://testnet-rpc.monad.xyz` (QuickNode, 50 rps, 25 rps for `eth_call`), `https://rpc.ankr.com/monad_testnet` (300 req / 10 s), `https://rpc-testnet.monadinfra.com` (20 rps, no batch) |
| Explorers | monadvision.com, monadscan.com | testnet.monadvision.com, testnet.monadscan.com |
| Faucet | none | https://faucet.monad.xyz (wallet address + Cloudflare check; more tokens with X or Discord linked) |

RPC facts that shape the design (Monad docs, checked 2026-10-09):
- `eth_getLogs` is limited to 100 blocks (QuickNode, Monad Foundation) or 1,000 blocks (Alchemy, Ankr). **Never scan ranges.** Read state through views, and use a single-block `getLogs` only (G1).
- `eth_call` gas limit is 200M on the main providers. Calls at or under 8.1M gas use a faster low-gas pool, so keep each `findMatches` page under that.
- The `pending` tag behaves like `latest` (Proposed state, speculative).
- **Gas charging:** Monad charges the declared gas limit, not gas used. Always `estimateGas` and add +15%.
- Block gas limit 150M, transaction gas limit 30M, minimum base fee 100 MON-gwei. About 200k gas is about 0.02 MON.

Record deployed addresses in `packages/sdk/src/chain/addresses.ts` and in `PROGRESS.md`.

## 5. Perceptual hash spec (must be deterministic, G14)

**Input:** RGBA `{ width, height, data }` at native size.
- Browser: `createImageBitmap(file, { imageOrientation: "from-image", colorSpaceConversion: "none" })`, then draw onto an `OffscreenCanvas` of the same size (no scaling) and call `getImageData`.
- Node tests: sharp, auto-rotated, raw RGBA, **without** ICC conversion to sRGB.
- HEIC on non-Safari browsers: detect and show a message (G15).

**Steps (exact definitions, any deviation breaks determinism):**
1. **Border trim.** Compute luma (step 3) per pixel. For each side independently, the reference is the median luma of that side's outermost row or column in the original image. Drop rows (top, bottom) or columns (left, right) while at least 98% of the pixels in that line are within luma distance 8 of the reference, and stop after 20% of the height (rows) or width (columns) per side. The four sides are measured on the original image, then cropped once. Applied at registration and verification.
2. **Manual crop (verification only, optional).** The user selects the photo area in a screenshot (G13). It is applied before step 1.
3. **Luma.** `Y = 0.299 R + 0.587 G + 0.114 B` as float64 from 0..255 channel values. Alpha is ignored.
4. **Area-average resize to 32 x 32** in our own code. Output pixel (ox, oy) is the coverage-weighted mean of the source pixels inside the source rectangle `[ox * W / 32, (ox + 1) * W / 32) x [oy * H / 32, (oy + 1) * H / 32)`, with fractional weights for partially covered pixels. Images smaller than 32 px in either dimension are rejected. Never use canvas scaling.
5. **2D DCT-II, unnormalized:** `X[k] = sum over n of x[n] * cos(pi / 32 * (n + 0.5) * k)`, applied to every row, then to every column, with a precomputed cosine table. No scaling factors.
6. **Low frequencies.** `D[ky][kx]` for ky, kx in 0..7 (64 coefficients, including DC).
7. **Threshold.** Median of the 64 values (mean of the 32nd and 33rd sorted values). Bit = 1 if coefficient > median.
8. **Bit order.** ky = 0..7 outer, kx = 0..7 inner. `D[0][0]` is bit 63 (MSB), `D[7][7]` is bit 0. `bigint` in TS, `uint64` in Solidity. Hex form: 16 lowercase hex digits with `0x`.
9. **Version.** `HASH_VERSION = 1`. Any change to steps 1 to 8 requires a new version (G11).

Floating point note: `Math.cos` may differ in the last bit between engines. That can only flip a bit whose coefficient sits exactly at the median, which the distance threshold absorbs. The cross-runtime check (G14) measures it.

**Degenerate hashes:** popcount < 8 or > 56 is rejected by the SDK and the contract (G9).

**Orientation variants (verification only):** the 8 dihedral transforms of the resized 32 x 32 luma matrix before the DCT. Variant `v` in 0..3 = rotate clockwise `v` times. Variant `v` in 4..7 = mirror left-right, then rotate clockwise `v - 4` times. Variant 0 is the registered hash.

**Thresholds (frozen on 2026-10-09 from `ROBUSTNESS.md`, G16):**
- `MATCH_DISTANCE = 7`: "same photo". Every compression, resize, brightness, mirror, rotation, and border case measured at most 4 bits.
- 8 to 11, found with probe radius 2: "likely the same photo, edited or cropped". The closest pair of *different* photos measured 18 bits, even for 5 shots of the same flood scene, so this band is still safe.
- `LINK_DISTANCE = 7`: on-chain limit for `linkDerivative`.

**Thumbnail (opt-in, G10, G27):** long edge 96 px, WebP, quality reduced until at most 4,096 bytes.

## 6. On-chain index: multi-index hashing

- **Segments:** `seg[i] = (h >> (48 - 16 i)) & 0xFFFF`, i = 0..3.
- **Buckets:** `mapping(bytes32 => uint32[]) buckets`, key `keccak256(abi.encodePacked(uint8(HASH_VERSION), uint8(i), uint16(seg[i])))`. Ids are `uint32`, so 8 ids pack into one slot.
- **Guarantee:** if `hamming(a, b) <= r`, at least one segment differs by at most `floor(r / 4)` bits. With per-segment probe radius `p = floor(r / 4)`:
  - `p = 0`: 4 bucket reads, `r <= 3`.
  - `p = 1`: 68 bucket reads, `r <= 7` (default).
  - `p = 2`: 548 bucket reads, `r <= 11` (low-confidence pass).
- **Probe order (contract and SDK must match):** for a 16-bit segment value `v` and radius `p`:
  - radius 0: `[v]`
  - radius 1 adds `v ^ (1 << b)` for b = 0..15, so the list is `[v, v^1, v^2, v^4, ..., v^32768]` (17 probes)
  - radius 2 also adds `v ^ (1 << i) ^ (1 << j)` for i = 0..14, j = i+1..15, in that nested order (137 probes)

  Segments are walked in order 0, 1, 2, 3, all probes of a segment before the next segment.
- **Search** is paginated (G9). The state is `(segment, probeIndex, offsetInBucket)`. Cursor encoding: `cursor = (segment << 160) | (probeIndex << 96) | (offset << 1) | 1`. An input cursor of 0 means "start at (0, 0, 0)". A returned `nextCursor` of 0 means "done". `maxCandidates` counts bucket entries examined (not matches). Each examined entry loads the record's pHash and is returned only if its Hamming distance is at most `maxDistance`. Duplicates across probes or segments are possible; the client de-duplicates by id.
- **Gas estimate** (pages of 128 slots: 8,000 load + 2,800 write + 17,000 growth on the first touch): record (2 to 3 slots, mostly one page) + 4 bucket appends on random pages + optional thumbnail calldata (about 64k). Measured: **about 424k gas** without a thumbnail and **about 525k** with a 4 KB thumbnail (about 0.04 to 0.05 MON at the minimum base fee). A `findMatches` page of 256 candidates at radius 1 over a 10,000-entry bucket costs about 910k gas, well under the 8.1M fast-pool limit.

## 7. Contract: `OrigoRegistry.sol`

```solidity
// Sketch. Names and types are the contract between packages; keep them stable.
contract OrigoRegistry is EIP712, Ownable {
    uint8  public constant HASH_VERSION = 1;
    uint8  public constant LINK_DISTANCE = 7;

    enum Source { Upload, Capture }

    struct Record {
        // slot 0
        address creator;          // creator identity key (recovered from the EIP-712 signature)
        uint40  registeredAt;     // block.timestamp
        Source  source;           // self-reported (G25)
        uint16  width;            // self-reported original width (px)
        uint16  height;           // self-reported original height (px)
        uint8   hashVersion;
        bool    hasThumbnail;
        // slot 1
        address submitter;        // msg.sender, the gas payer (may differ from creator)
        uint64  pHash;
        uint32  parentId;         // 0 = none; set by linkDerivative
        // slot 2
        bytes32 fileCommit;       // keccak256(abi.encode(sha256(originalBytes), creator))  (G2)
        // slot 3
        uint64  registeredBlock;  // for single-block getLogs (G1, G10)
    }

    struct Registration {         // EIP-712 typed data
        uint64  pHash;
        bytes32 fileCommit;
        uint16  width;
        uint16  height;
        uint8   source;
        uint8   hashVersion;
        bytes32 thumbnailHash;    // keccak256(thumbnail bytes), or 0 if none
        uint256 nonce;            // random, unordered (G12)
        uint256 deadline;
    }

    Record[] internal records;                               // id = index + 1
    mapping(bytes32 => uint32[]) internal buckets;
    mapping(address => uint32[]) internal creatorRecords;    // G1
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedCommitKey;           // key = keccak256(abi.encode(creator, fileCommit))
    mapping(address => bool) public isAttester;
    mapping(address => string) public creatorLabel;
    mapping(address => address) public labelAttester;

    event Registered(uint32 indexed id, address indexed creator, uint64 pHash, bytes32 fileCommit,
                     Source source, bytes thumbnail);        // thumbnail may be empty
    event Linked(uint32 indexed childId, uint32 indexed parentId, uint8 distance);
    event Attested(address indexed creator, address indexed attester, string label);

    function register(Registration calldata r, bytes calldata creatorSig, bytes calldata thumbnail)
        external returns (uint32 id);
    // Checks: signature recovers creator; deadline >= now; nonce unused; hashVersion == HASH_VERSION;
    // popcount(pHash) in [8, 56]; width, height > 0; source in {0, 1}; fileCommit != 0;
    // (creator, fileCommit) not used before. Uniqueness is per creator, NOT global, so a front-runner who
    // copies a pending fileCommit cannot block the honest registration (G2).
    // thumbnail.length <= 4096 and keccak256(thumbnail) == r.thumbnailHash (or both empty / zero).

    function linkDerivative(uint32 childId, uint32 parentId) external;
    // Permissionless. parent registered earlier (lower id); hamming <= LINK_DISTANCE; only if parentId == 0.

    function findMatches(uint64 h, uint8 maxDistance, uint8 probeRadius, uint256 cursor, uint256 maxCandidates)
        external view returns (uint32[] memory ids, uint8[] memory distances, uint256 nextCursor);

    function getRecord(uint32 id) external view returns (Record memory);
    function getRecords(uint32[] calldata ids) external view returns (Record[] memory);
    function recordCount() external view returns (uint256);
    function recordsOf(address creator, uint256 offset, uint256 limit) external view returns (uint32[] memory);

    function attest(address creator, string calldata label) external;   // onlyAttester
    function setAttester(address attester, bool allowed) external;      // onlyOwner
}
```

EIP-712 domain: name `Origo`, version `1`, chainId, verifyingContract. Owner is the deployer (`Ownable(msg.sender)`).

**Tests (Foundry):** happy path; bad signature; reused nonce; expired deadline; wrong hash version; degenerate hash; duplicate (creator, commit); same commit by two different creators both succeed; oversize or mismatched thumbnail; relay (submitter differs from creator); front-run scenario (a copied commit fails the proof check bound to the attacker's address); `findMatches` fuzz test with no false negatives within distance 7 at radius 1; pagination returns the same set as one big call; 10,000 records in one bucket stays under 8.1M gas per page; `linkDerivative` rules; attester permissions; gas report.

## 8. Keys and accounts

```
passkey (Face ID / Touch ID)
  -> Mera PRF output (32 bytes, never stored)
       |-> BIP-39 entropy -> seed -> m/44'/60'/0'/0/0  = WALLET key (pays gas, portable to MetaMask)
       |-> HKDF-SHA256(ikm = prf, salt = "origo", info = "origo/creator/v1") = CREATOR key
       '-> backup: BIP-39 mnemonic of the 32 PRF bytes restores BOTH keys (G8)
```

- Sessions: `createSecp256k1SigningSession` + `toViemAccount`. Call `session.end()` after each signing.
- Storage: only `{ credentialId, transports }` in `localStorage` under `origo.credential`.
- **rpId (G6):** production is the fixed Vercel domain decided on Day 0 (recorded in `PROGRESS.md`). Preview deployments show a "test accounts only" banner. Development uses `localhost`.
- **`PRF_UNAVAILABLE` (G7):** show the fix, and offer "Use an injected wallet". In that mode the wallet address is both creator and payer (signs EIP-712 with `eth_signTypedData_v4`), labeled in the UI.
- Read-only verification needs no account.

## 9. Data flows

**Register**
1. Get the file: upload, or capture via `<input type="file" accept="image/*" capture="environment">`, which sets `source = Capture` (G4).
2. Decode and hash (section 5). Reject degenerate hashes.
3. `digest = sha256(fileBytes)` (WebCrypto), `fileCommit = keccak256(abi.encode(digest, creator))`.
4. Optional thumbnail (opt-in notice).
5. Sign the EIP-712 `Registration` with the creator key (random nonce, deadline +7 days for relay links).
6. Store `{ fileBytes, digest, fileCommit, signedRegistration }` in IndexedDB and prompt **Save original** (G4).
7. Pay with one of:
   - **Own wallet:** `estimateGas` +15%, then send.
   - **Relay link:** encode the signed registration (and thumbnail) into a URL fragment or QR code. Any funded wallet opens `/relay`, reviews, and submits (G5).
8. Show the id, tx hash, block, and explorer link. Save the id in IndexedDB.

**Verify**
1. Decode, then optional manual crop, then trim, then 8 orientation hashes.
2. For each variant, page through `findMatches(h, 7, 1, cursor, 256)`. Merge results, keeping the minimum distance per id.
3. If nothing is found, run a low-confidence pass with radius 2 and max distance 11.
4. `getRecords(ids)`, `creatorLabel(creator)`. For records with `hasThumbnail`, fetch the `Registered` log with `fromBlock = toBlock = registeredBlock`.
5. Rank (section 10) and render cards with thumbnails side by side with the query image.

**Prove ownership (reveal)**
1. The claimant drops the original file.
2. The browser checks, for the selected record:
   - `keccak256(abi.encode(sha256(file), record.creator)) == record.fileCommit`
   - decoded dimensions equal `record.width` and `record.height`
   - `hamming(phash(file), record.pHash) <= MATCH_DISTANCE`
3. Show a pass or fail checklist. The file never leaves the device. Warn that EXIF (for example GPS) is visible to whoever receives the original.

## 10. Evidence ranking (UI rule, G3)

For the records that match a query, sort by:
1. Ownership proof passed in this browser session.
2. Creator has an attester label.
3. Earliest `registeredBlock`, then lower id.
4. Tie-breakers, always labeled "self-reported": `source == Capture`, larger `width * height`.

Records registered within 60 seconds of each other get a "contested" flag. Never display "owner". Display "Strongest evidence: @creator" with the reasons listed.

## 11. Robustness suite (judge-facing, G16)

`packages/sdk/test/robustness.test.ts` plus a script that writes `docs/origo/ROBUSTNESS.md`.
- **Inputs:** 20 or more public-domain photos (Wikimedia Commons), attribution in `fixtures/ATTRIBUTION.md`.
- **Transformations:**
  - JPEG quality 90, 70, 50, and 30
  - resize to 50% and 25%
  - WhatsApp-like: long edge 1600 px, quality about 70
  - uniform borders, a WhatsApp-like chat screenshot frame, caption bars, a text overlay
  - brightness +/-10%
  - mirror, rotate 90
  - crop 5%, 10%, and 20%
- **Output:** distance distribution per transformation; pairwise distances between different photos (false-positive rate at each threshold); cross-runtime check (Node vs Chrome vs Safari) for 10 files (G14).

## 12. Stretch designs (only after the MVP is done)

- **Tiles for crops (G24):** 9 overlapping tiles (50% size, 25% stride) stored in the same buckets with a tile flag. The query's full hash is compared against tile hashes.
- **Deposit and challenge (G9, G26):** refundable deposit per registration; attesters resolve disputes on-chain.
- **Sponsored gas (G5):** Alchemy or Pimlico gas policy.
- **Envio HyperIndex:** public feed of recent registrations.
- **PDQ 256-bit** as a second-stage check (G21).
- **WASM HEIC decoder** (G15).
