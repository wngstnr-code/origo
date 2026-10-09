// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title OrigoRegistry
/// @notice Photo provenance registry. Stores 64-bit perceptual hashes with creator signatures and
/// supports on-chain near-duplicate search using multi-index hashing (4 segments of 16 bits).
contract OrigoRegistry is EIP712, Ownable2Step {
    uint8 public constant HASH_VERSION = 1;
    uint8 public constant MIN_POPCOUNT = 8;
    uint8 public constant MAX_POPCOUNT = 56;
    uint16 public constant MAX_THUMBNAIL_BYTES = 4096;
    uint8 public constant MAX_PROBE_RADIUS = 2;
    uint8 public constant MAX_TILES = 48;
    uint256 public constant MAX_PAGE = 1024;
    uint256 public constant MAX_EARLIEST_PER_BUCKET = 32;

    bytes32 public constant REGISTRATION_TYPEHASH = keccak256(
        "Registration(uint64 pHash,bytes32 fileCommit,uint16 width,uint16 height,uint8 source,uint8 hashVersion,bytes32 thumbnailHash,bytes32 tilesHash,uint256 nonce,uint256 deadline)"
    );

    enum Source {
        Upload,
        Capture
    }

    struct Record {
        // slot 0
        address creator;
        uint40 registeredAt;
        Source source;
        uint16 width;
        uint16 height;
        uint8 hashVersion;
        bool hasThumbnail;
        // slot 1
        address submitter;
        uint64 pHash;
        // slot 2
        bytes32 fileCommit;
        // slot 3
        uint64 registeredBlock;
        uint8 tileCount;
    }

    struct Registration {
        uint64 pHash;
        bytes32 fileCommit;
        uint16 width;
        uint16 height;
        uint8 source;
        uint8 hashVersion;
        bytes32 thumbnailHash;
        bytes32 tilesHash;
        uint256 nonce;
        uint256 deadline;
    }

    Record[] internal records;
    /// @dev Entry = (uint64(id) << 8) | tileIndex. tileIndex 0 is the full hash.
    mapping(bytes32 => uint64[]) internal buckets;
    /// @dev Tile i (1-based) of record id is tileHashes[id][i - 1].
    mapping(uint32 => uint64[]) internal tileHashes;
    mapping(address => uint32[]) internal creatorRecords;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedCommitKey;
    mapping(address => bool) public isAttester;
    /// @notice Label per (creator, attester). Each attester controls only its own labels.
    mapping(address => mapping(address => string)) public labelOf;
    address[] internal attesterList;
    mapping(address => bool) internal everAttester;

    event Registered(
        uint32 indexed id, address indexed creator, uint64 pHash,
        bytes32 fileCommit,
        Source source,
        uint8 tileCount,
        bytes thumbnail
    );
    event Attested(address indexed creator, address indexed attester, string label);
    event AttesterSet(address indexed attester, bool allowed);

    error InvalidSignature();
    error Expired();
    error NonceUsed();
    error WrongHashVersion();
    error DegenerateHash();
    error InvalidDimensions();
    error InvalidSource();
    error EmptyCommit();
    error CommitAlreadyRegistered();
    error ThumbnailTooLarge();
    error ThumbnailHashMismatch();
    error UnknownRecord();
    error NotAttester();
    error RadiusTooLarge();
    error TooManyTiles();
    error TilesHashMismatch();
    error InvalidCursor();
    error PerBucketTooLarge();
    error TooManyRecords();

    constructor() EIP712("Origo", "1") Ownable(msg.sender) {}

    // ------------------------------------------------------------------
    // Registration
    // ------------------------------------------------------------------

    /// @notice Returns the full EIP-712 digest a creator must sign for `r`.
    function hashRegistration(Registration calldata r) external view returns (bytes32) {
        return _hashTypedDataV4(_structHash(r));
    }

    /// @notice Registers a photo hash on behalf of the signer. Anyone may relay the signature.
    /// @param r The signed registration.
    /// @param creatorSig EIP-712 signature by the creator over `r`.
    /// @param thumbnail Optional thumbnail bytes (emitted in the event only), at most 4096 bytes.
    /// @param tiles Optional crop protection tiles (hashes of sub-windows), at most MAX_TILES.
    /// `r.tilesHash` must equal `keccak256(abi.encodePacked(tiles))`, where each uint64 element is
    /// encoded as a 32-byte word (left padded). Empty tiles require a zero `tilesHash`.
    /// @return id The new record id (1-based).
    function register(
        Registration calldata r,
        bytes calldata creatorSig,
        bytes calldata thumbnail,
        uint64[] calldata tiles
    ) external returns (uint32 id) {
        _validate(r, thumbnail, tiles);

        address creator = _consume(r, creatorSig);
        if (records.length >= type(uint32).max) revert TooManyRecords();

        records.push(
            Record({
                creator: creator,
                registeredAt: uint40(block.timestamp),
                source: Source(r.source),
                width: r.width,
                height: r.height,
                hashVersion: r.hashVersion,
                hasThumbnail: thumbnail.length != 0,
                submitter: msg.sender,
                pHash: r.pHash,
                fileCommit: r.fileCommit,
                registeredBlock: uint64(block.number),
                tileCount: uint8(tiles.length)
            })
        );
        id = uint32(records.length);

        _index(r.pHash, id, 0);
        _storeTiles(id, tiles);
        creatorRecords[creator].push(id);

        emit Registered(id, creator, r.pHash, r.fileCommit, Source(r.source), uint8(tiles.length), thumbnail);
    }

    /// @dev Recovers the creator and marks the nonce and (creator, fileCommit) as used.
    function _consume(Registration calldata r, bytes calldata creatorSig) private returns (address creator) {
        ECDSA.RecoverError err;
        (creator, err,) = ECDSA.tryRecover(_hashTypedDataV4(_structHash(r)), creatorSig);
        if (err != ECDSA.RecoverError.NoError || creator == address(0)) revert InvalidSignature();

        if (usedNonce[creator][r.nonce]) revert NonceUsed();
        bytes32 commitKey = keccak256(abi.encode(creator, r.fileCommit));
        if (usedCommitKey[commitKey]) revert CommitAlreadyRegistered();
        usedNonce[creator][r.nonce] = true;
        usedCommitKey[commitKey] = true;
    }

    function _validate(Registration calldata r, bytes calldata thumbnail, uint64[] calldata tiles) private view {
        if (block.timestamp > r.deadline) revert Expired();
        if (r.hashVersion != HASH_VERSION) revert WrongHashVersion();
        uint256 pc = _popcount(r.pHash);
        if (pc < MIN_POPCOUNT || pc > MAX_POPCOUNT) revert DegenerateHash();
        if (r.width == 0 || r.height == 0) revert InvalidDimensions();
        if (r.source > 1) revert InvalidSource();
        if (r.fileCommit == bytes32(0)) revert EmptyCommit();

        if (thumbnail.length == 0) {
            if (r.thumbnailHash != bytes32(0)) revert ThumbnailHashMismatch();
        } else {
            if (thumbnail.length > MAX_THUMBNAIL_BYTES) revert ThumbnailTooLarge();
            if (keccak256(thumbnail) != r.thumbnailHash) revert ThumbnailHashMismatch();
        }

        if (tiles.length == 0) {
            if (r.tilesHash != bytes32(0)) revert TilesHashMismatch();
        } else {
            if (tiles.length > MAX_TILES) revert TooManyTiles();
            if (keccak256(abi.encodePacked(tiles)) != r.tilesHash) revert TilesHashMismatch();
        }
    }

    /// @dev Stores every tile; indexes only non-degenerate ones (popcount in [8, 56]).
    function _storeTiles(uint32 id, uint64[] calldata tiles) private {
        uint256 n = tiles.length;
        if (n == 0) return;
        uint64[] storage stored = tileHashes[id];
        for (uint256 i = 0; i < n; i++) {
            uint64 t = tiles[i];
            stored.push(t);
            uint256 pc = _popcount(t);
            if (pc >= MIN_POPCOUNT && pc <= MAX_POPCOUNT) _index(t, id, uint8(i + 1));
        }
    }

    function _index(uint64 h, uint32 id, uint8 tileIndex) private {
        uint64 entry = (uint64(id) << 8) | uint64(tileIndex);
        for (uint8 i = 0; i < 4; i++) {
            buckets[_bucketKey(i, uint16(h >> (48 - 16 * uint256(i))))].push(entry);
        }
    }

    function _structHash(Registration calldata r) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                REGISTRATION_TYPEHASH,
                r.pHash,
                r.fileCommit,
                r.width,
                r.height,
                r.source,
                r.hashVersion,
                r.thumbnailHash,
                r.tilesHash,
                r.nonce,
                r.deadline
            )
        );
    }

    // ------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------

    /// @notice Bucket key for a 16-bit segment value at a segment index.
    function bucketKey(uint8 segmentIndex, uint16 segmentValue) external pure returns (bytes32) {
        return _bucketKey(segmentIndex, segmentValue);
    }

    /// @notice Number of entries stored in a bucket.
    function bucketLength(bytes32 key) external view returns (uint256) {
        return buckets[key].length;
    }

    /// @notice Paginated near-duplicate search (multi-index hashing) over full hashes and tiles.
    /// @param h Query hash.
    /// @param maxDistance Maximum Hamming distance to return.
    /// @param probeRadius Per-segment bit-flip probe radius (0 to 2).
    /// @param cursor 0 to start, otherwise the previous nextCursor.
    /// @param maxCandidates Maximum bucket entries to examine in this call (capped at MAX_PAGE).
    /// @return ids Matching record ids (may contain duplicates across buckets).
    /// @return tileIndexes Matching tile index per id (0 = the full hash).
    /// @return distances Hamming distance for each match.
    /// @return nextCursor 0 when the walk is complete, otherwise the cursor to continue.
    function findMatches(uint64 h, uint8 maxDistance, uint8 probeRadius, uint256 cursor, uint256 maxCandidates)
        external
        view
        returns (uint32[] memory ids, uint8[] memory tileIndexes, uint8[] memory distances, uint256 nextCursor)
    {
        if (probeRadius > MAX_PROBE_RADIUS) revert RadiusTooLarge();
        if (maxCandidates > MAX_PAGE) maxCandidates = MAX_PAGE;
        uint256 probeCount = probeRadius == 0 ? 1 : (probeRadius == 1 ? 17 : 137);

        Walk memory w;
        w.seg = cursor >> 160;
        w.probe = (cursor >> 96) & type(uint64).max;
        w.offset = (cursor >> 1) & ((uint256(1) << 95) - 1);
        // A cursor must come from a call with the same probeRadius (low bit set, position in range).
        if (cursor != 0 && (cursor & 1 == 0 || w.seg >= 4 || w.probe >= probeCount)) revert InvalidCursor();
        w.ids = new uint32[](maxCandidates);
        w.tileIndexes = new uint8[](maxCandidates);
        w.distances = new uint8[](maxCandidates);

        nextCursor = 0;
        while (w.seg < 4) {
            if (!_scanBucket(w, h, maxDistance, maxCandidates)) {
                nextCursor = _encode(w.seg, w.probe, w.offset);
                break;
            }
            w.offset = 0;
            w.probe++;
            if (w.probe == probeCount) {
                w.probe = 0;
                w.seg++;
            }
        }
        _trim(w.ids, w.tileIndexes, w.distances, w.found);
        return (w.ids, w.tileIndexes, w.distances, nextCursor);
    }

    /// @notice Earliest-first search: examines only the first `perBucket` entries (the oldest) of every
    /// probe bucket. Buckets are append-only, so entries registered later (including flooding) can never
    /// push an earlier record out of this window.
    /// @param perBucket Entries examined per bucket, at most MAX_EARLIEST_PER_BUCKET.
    /// @return ids Matching record ids (may contain duplicates across buckets).
    /// @return tileIndexes Matching tile index per id (0 = the full hash).
    /// @return distances Hamming distance for each match.
    /// @return complete True if no bucket had more than `perBucket` entries, so the result is the full answer.
    function findEarliest(uint64 h, uint8 maxDistance, uint8 probeRadius, uint256 perBucket)
        external
        view
        returns (uint32[] memory ids, uint8[] memory tileIndexes, uint8[] memory distances, bool complete)
    {
        if (probeRadius > MAX_PROBE_RADIUS) revert RadiusTooLarge();
        if (perBucket == 0 || perBucket > MAX_EARLIEST_PER_BUCKET) revert PerBucketTooLarge();
        uint256 probeCount = probeRadius == 0 ? 1 : (probeRadius == 1 ? 17 : 137);

        Walk memory w;
        uint256 cap = 4 * probeCount * perBucket;
        w.ids = new uint32[](cap);
        w.tileIndexes = new uint8[](cap);
        w.distances = new uint8[](cap);
        complete = true;
        for (w.seg = 0; w.seg < 4; w.seg++) {
            for (w.probe = 0; w.probe < probeCount; w.probe++) {
                w.offset = 0;
                w.examined = 0;
                if (!_scanBucket(w, h, maxDistance, perBucket)) complete = false;
            }
        }
        _trim(w.ids, w.tileIndexes, w.distances, w.found);
        return (w.ids, w.tileIndexes, w.distances, complete);
    }

    struct Walk {
        uint32[] ids;
        uint8[] tileIndexes;
        uint8[] distances;
        uint256 found;
        uint256 examined;
        uint256 seg;
        uint256 probe;
        uint256 offset;
    }

    /// @dev Scans the current bucket from w.offset. Returns false if the candidate budget ran out
    /// before the bucket was exhausted (w.offset then points at the next unexamined entry).
    function _scanBucket(Walk memory w, uint64 h, uint8 maxDistance, uint256 maxCandidates)
        private
        view
        returns (bool)
    {
        uint16 v = uint16(h >> (48 - 16 * w.seg));
        uint64[] storage bucket = buckets[_bucketKey(uint8(w.seg), _probeValue(v, w.probe))];
        uint256 len = bucket.length;
        uint256 offset = w.offset;
        while (offset < len) {
            if (w.examined == maxCandidates) {
                w.offset = offset;
                return false;
            }
            uint64 entry = bucket[offset];
            uint32 cid = uint32(entry >> 8);
            uint8 ti = uint8(entry);
            uint256 d = _popcount(_hashAt(cid, ti) ^ h);
            if (d <= maxDistance) {
                w.ids[w.found] = cid;
                w.tileIndexes[w.found] = ti;
                w.distances[w.found] = uint8(d);
                w.found++;
            }
            w.examined++;
            offset++;
        }
        w.offset = offset;
        return true;
    }

    /// @dev Hash of record `id` at `tileIndex` (0 = full hash).
    function _hashAt(uint32 id, uint8 tileIndex) private view returns (uint64) {
        if (tileIndex == 0) return records[id - 1].pHash;
        return tileHashes[id][tileIndex - 1];
    }

    function _trim(uint32[] memory ids, uint8[] memory tileIndexes, uint8[] memory distances, uint256 n)
        private
        pure
    {
        assembly ("memory-safe") {
            mstore(ids, n)
            mstore(tileIndexes, n)
            mstore(distances, n)
        }
    }

    function _encode(uint256 seg, uint256 probe, uint256 offset) private pure returns (uint256) {
        return (seg << 160) | (probe << 96) | (offset << 1) | 1;
    }

    /// @dev Maps probe index k to the k-th value in the probe list for segment value v.
    function _probeValue(uint16 v, uint256 k) private pure returns (uint16) {
        if (k == 0) return v;
        if (k <= 16) return v ^ uint16(1 << (k - 1));
        uint256 m = k - 17;
        uint256 i = 0;
        while (m >= 15 - i) {
            m -= 15 - i;
            i++;
        }
        uint256 j = i + 1 + m;
        return v ^ uint16(1 << i) ^ uint16(1 << j);
    }

    function _bucketKey(uint8 segmentIndex, uint16 segmentValue) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(uint8(HASH_VERSION), segmentIndex, segmentValue));
    }

    function _popcount(uint64 x) private pure returns (uint256) {
        unchecked {
            uint256 v = x;
            v = v - ((v >> 1) & 0x5555555555555555);
            v = (v & 0x3333333333333333) + ((v >> 2) & 0x3333333333333333);
            v = (v + (v >> 4)) & 0x0F0F0F0F0F0F0F0F;
            return ((v * 0x0101010101010101) >> 56) & 0xFF;
        }
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    /// @notice Returns a record by id. Reverts for unknown ids.
    function getRecord(uint32 id) external view returns (Record memory) {
        if (id == 0 || id > records.length) revert UnknownRecord();
        return records[id - 1];
    }

    /// @notice Returns the crop protection tiles of a record. Reverts for unknown ids.
    function getTiles(uint32 id) external view returns (uint64[] memory) {
        if (id == 0 || id > records.length) revert UnknownRecord();
        return tileHashes[id];
    }

    /// @notice Returns several records by id. Reverts if any id is unknown.
    function getRecords(uint32[] calldata ids) external view returns (Record[] memory out) {
        out = new Record[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            uint32 id = ids[i];
            if (id == 0 || id > records.length) revert UnknownRecord();
            out[i] = records[id - 1];
        }
    }

    /// @notice Total number of records.
    function recordCount() external view returns (uint256) {
        return records.length;
    }

    /// @notice Paginated list of record ids by creator, clamped to what is available.
    function recordsOf(address creator, uint256 offset, uint256 limit) external view returns (uint32[] memory out) {
        uint32[] storage list = creatorRecords[creator];
        uint256 len = list.length;
        if (offset >= len) return new uint32[](0);
        uint256 n = len - offset;
        if (limit < n) n = limit;
        out = new uint32[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = list[offset + i];
        }
    }

    /// @notice Number of records registered by a creator.
    function creatorRecordCount(address creator) external view returns (uint256) {
        return creatorRecords[creator].length;
    }

    // ------------------------------------------------------------------
    // Attestation
    // ------------------------------------------------------------------

    /// @notice Sets the caller's own label for a creator. Only attesters. An empty label revokes it.
    /// An attester can never change another attester's label.
    function attest(address creator, string calldata label) external {
        if (!isAttester[msg.sender]) revert NotAttester();
        labelOf[creator][msg.sender] = label;
        emit Attested(creator, msg.sender, label);
    }

    /// @notice Grants or revokes attester rights. Only owner. Labels of revoked attesters stay stored
    /// but are no longer returned by labelsOf.
    function setAttester(address attester, bool allowed) external onlyOwner {
        isAttester[attester] = allowed;
        if (allowed && !everAttester[attester]) {
            everAttester[attester] = true;
            attesterList.push(attester);
        }
        emit AttesterSet(attester, allowed);
    }

    /// @notice Currently active attesters.
    function attesters() external view returns (address[] memory out) {
        uint256 n = attesterList.length;
        uint256 count;
        for (uint256 i = 0; i < n; i++) {
            if (isAttester[attesterList[i]]) count++;
        }
        out = new address[](count);
        uint256 k;
        for (uint256 i = 0; i < n; i++) {
            address a = attesterList[i];
            if (isAttester[a]) out[k++] = a;
        }
    }

    /// @notice Non-empty labels for a creator from currently active attesters.
    function labelsOf(address creator) external view returns (address[] memory by, string[] memory labels) {
        uint256 n = attesterList.length;
        uint256 count;
        for (uint256 i = 0; i < n; i++) {
            address a = attesterList[i];
            if (isAttester[a] && bytes(labelOf[creator][a]).length != 0) count++;
        }
        by = new address[](count);
        labels = new string[](count);
        uint256 k;
        for (uint256 i = 0; i < n; i++) {
            address a = attesterList[i];
            string storage l = labelOf[creator][a];
            if (isAttester[a] && bytes(l).length != 0) {
                by[k] = a;
                labels[k] = l;
                k++;
            }
        }
    }
}
