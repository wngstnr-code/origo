# OrigoRegistry: Pre-Freeze Security Review

Review of `contracts/src/OrigoRegistry.sol` on 2026-10-09, before freezing the contract for the frontend and the mainnet deploy. Manual line-by-line review plus the Foundry suite (49 tests, two 512-run fuzz tests).

**Verdict:** no critical or high issues. Funds are never held by the contract, records cannot be forged or edited, and every registration requires a valid creator signature. Six changes were made (R5 and R6 in a second pass on the same day); the remaining items are accepted and documented.

## Changes made

| # | Finding | Severity | Change |
| --- | --- | --- | --- |
| R1 | `linkDerivative` was permissionless and set-once: anyone could permanently label an honest record as "derived from" an earlier thief's copy, and the honest owner could not undo it | Medium | Removed `linkDerivative`, `parentId`, `Linked`, and `LINK_DISTANCE`. "Earlier near-duplicates" are computed at read time from the index, which is always complete and cannot be pinned by a third party |
| R2 | A malformed `findMatches` cursor (wrong radius, segment >= 4, or missing marker bit) could walk from an unintended position or revert with an arithmetic panic | Low | Explicit `InvalidCursor` check: low bit set, segment < 4, probe index < probe count for the given radius |
| R3 | `id = uint32(records.length)` would silently truncate after 2^32 records | Low (theoretical) | `TooManyRecords` revert before the push |
| R4 | Single-step ownership: a mistyped `transferOwnership` loses attester management forever | Low | `Ownable2Step` (`transferOwnership` + `acceptOwnership`) |
| R5 | Bucket flooding (was A1): cheap junk entries could push an original record deep into the paginated walk | Medium | `findEarliest`: scans only the oldest `perBucket` entries of every probe bucket. Buckets are append-only, so a later flood can never hide an earlier record. Test: with 300 junk entries the first `findMatches` page misses the original, `findEarliest` returns it in one call |
| R6 | Attester overwrite (was A2): any attester could overwrite another attester's label | Low | Per-attester labels `labelOf[creator][attester]`; `labelsOf` returns only active attesters; revoking an attester hides its labels |

## Checked and fine

- **Signatures:** EIP-712 domain binds chain id and contract address, so testnet signatures cannot be replayed on mainnet. OpenZeppelin `tryRecover` rejects malleable (high-s) signatures and the zero address. Random per-creator nonces plus a deadline prevent replay.
- **Front-running:** copying a pending registration only yields a record under the copier's address, whose creator-bound commitment fails the ownership proof. Uniqueness is per (creator, commit), so the honest registration cannot be blocked. Submitting someone's signed registration first just performs it for them (same creator), and the duplicate reverts with `NonceUsed`.
- **Tampered relay:** changing any signed field recovers a different, random address (G28): the record is attributed to nobody useful and the real creator is unaffected.
- **Bounded loops:** `register` loops over at most 48 tiles; `findMatches` examines at most `MAX_PAGE = 1024` entries per call; other loops are in views over caller-chosen sizes.
- **Storage packing and casts:** `Record` uses 4 slots; casts of `block.timestamp` (uint40), `block.number` (uint64), dimensions (uint16, validated non-zero), and tile index (at most 48, fits uint8) are safe.
- **Reentrancy:** no external calls.
- **ABI sufficiency for the frontend:** Register (`register`, `usedNonce`), Verify (`findMatches`, `getRecords`, `getTiles`, `creatorLabel`, `labelAttester`, thumbnail via the `Registered` event at `registeredBlock`), Prove (`getRecord`), Relay (`register`, `usedNonce`), Me (`recordsOf`, `creatorRecordCount`), attester demo (`isAttester`, `attest`). No missing read path was found.

## Accepted (documented)

| # | Item | Why accepted |
| --- | --- | --- |
| A1 | **Resolved by R5.** Remaining: a flood placed *before* a photo exists would require predicting its hash, and later floods only slow down finding newer copies. Original note: bucket flooding cost. An attacker can stuff a target's buckets with junk entries: about 100 entries per MON without tiles, about 245 per MON with tiles (about 40 to 100 MON for 10,000 entries at the minimum base fee). Search stays correct (no false negatives) but needs more pages | Every junk record is public and attributed to the attacker's address. The SDK streams pages and shows results as they arrive. A refundable deposit is the known fix (stretch) |
| A2 | **Resolved by R6.** Original note: attester overwrite. Any attester can overwrite another attester's label for a creator | Attesters are owner-approved in this version (G23). The label and `labelAttester` are always shown together |
| A3 | **Self-reported fields** (`source`, `width`, `height`) | Only tie-breakers in ranking (G3, G25); dimensions are validated by the ownership proof |
| A4 | **Degenerate tiles are stored but not indexed** | Intended: low-information windows (for example sky) would only add noise |
