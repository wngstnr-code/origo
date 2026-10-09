// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title OrigoRegistry
/// @notice Photo provenance registry. Stores 64-bit perceptual hashes with creator signatures and
/// supports on-chain near-duplicate search using multi-index hashing (4 segments of 16 bits).
contract OrigoRegistry is EIP712, Ownable {
    uint8 public constant HASH_VERSION = 1;
    uint8 public constant LINK_DISTANCE = 7;
    uint8 public constant MIN_POPCOUNT = 8;
    uint8 public constant MAX_POPCOUNT = 56;
    uint16 public constant MAX_THUMBNAIL_BYTES = 4096;
    uint8 public constant MAX_PROBE_RADIUS = 2;

    bytes32 public constant REGISTRATION_TYPEHASH = keccak256(
        "Registration(uint64 pHash,bytes32 fileCommit,uint16 width,uint16 height,uint8 source,uint8 hashVersion,bytes32 thumbnailHash,uint256 nonce,uint256 deadline)"
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
        uint32 parentId;
        // slot 2
        bytes32 fileCommit;
        // slot 3
        uint64 registeredBlock;
    }

    struct Registration {
        uint64 pHash;
        bytes32 fileCommit;
        uint16 width;
        uint16 height;
        uint8 source;
        uint8 hashVersion;
        bytes32 thumbnailHash;
        uint256 nonce;
        uint256 deadline;
    }

    Record[] internal records;
    mapping(bytes32 => uint32[]) internal buckets;
    mapping(address => uint32[]) internal creatorRecords;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedCommitKey;
    mapping(address => bool) public isAttester;
    mapping(address => string) public creatorLabel;
    mapping(address => address) public labelAttester;

    event Registered(
        uint32 indexed id, address indexed creator, uint64 pHash, bytes32 fileCommit, Source source, bytes thumbnail
    );
    event Linked(uint32 indexed childId, uint32 indexed parentId, uint8 distance);
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
    error NotEarlier();
    error AlreadyLinked();
    error TooFar();
    error NotAttester();
    error RadiusTooLarge();
    error WrongVersionLink();

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
    /// @return id The new record id (1-based).
    function register(Registration calldata r, bytes calldata creatorSig, bytes calldata thumbnail)
        external
        returns (uint32 id)
    {
        _validate(r, thumbnail);

        (address creator, ECDSA.RecoverError err,) =
            ECDSA.tryRecover(_hashTypedDataV4(_structHash(r)), creatorSig);
        if (err != ECDSA.RecoverError.NoError || creator == address(0)) revert InvalidSignature();

        if (usedNonce[creator][r.nonce]) revert NonceUsed();
        bytes32 commitKey = keccak256(abi.encode(creator, r.fileCommit));
        if (usedCommitKey[commitKey]) revert CommitAlreadyRegistered();
        usedNonce[creator][r.nonce] = true;
        usedCommitKey[commitKey] = true;

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
                parentId: 0,
                fileCommit: r.fileCommit,
                registeredBlock: uint64(block.number)
            })
        );
        id = uint32(records.length);

        _index(r.pHash, id);
        creatorRecords[creator].push(id);

        emit Registered(id, creator, r.pHash, r.fileCommit, Source(r.source), thumbnail);
    }

    function _validate(Registration calldata r, bytes calldata thumbnail) private view {
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
    }

    function _index(uint64 h, uint32 id) private {
        for (uint8 i = 0; i < 4; i++) {
            buckets[_bucketKey(i, uint16(h >> (48 - 16 * uint256(i))))].push(id);
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

    /// @notice Number of record ids stored in a bucket.
    function bucketLength(bytes32 key) external view returns (uint256) {
        return buckets[key].length;
    }

    /// @notice Paginated near-duplicate search (multi-index hashing).
    /// @param h Query hash.
    /// @param maxDistance Maximum Hamming distance to return.
    /// @param probeRadius Per-segment bit-flip probe radius (0 to 2).
    /// @param cursor 0 to start, otherwise the previous nextCursor.
    /// @param maxCandidates Maximum bucket entries to examine in this call.
    /// @return ids Matching record ids (may contain duplicates across buckets).
    /// @return distances Hamming distance for each id.
    /// @return nextCursor 0 when the walk is complete, otherwise the cursor to continue.
    function findMatches(uint64 h, uint8 maxDistance, uint8 probeRadius, uint256 cursor, uint256 maxCandidates)
        external
        view
        returns (uint32[] memory ids, uint8[] memory distances, uint256 nextCursor)
    {
        if (probeRadius > MAX_PROBE_RADIUS) revert RadiusTooLarge();

        Walk memory w;
        w.seg = cursor >> 160;
        w.probe = (cursor >> 96) & type(uint64).max;
        w.offset = (cursor >> 1) & ((uint256(1) << 95) - 1);
        uint256 cap = 4 * records.length;
        if (maxCandidates < cap) cap = maxCandidates;
        w.ids = new uint32[](cap);
        w.distances = new uint8[](cap);

        uint256 probeCount = probeRadius == 0 ? 1 : (probeRadius == 1 ? 17 : 137);
        while (w.seg < 4) {
            if (!_scanBucket(w, h, maxDistance, maxCandidates)) {
                _trim(w.ids, w.distances, w.found);
                return (w.ids, w.distances, _encode(w.seg, w.probe, w.offset));
            }
            w.offset = 0;
            w.probe++;
            if (w.probe == probeCount) {
                w.probe = 0;
                w.seg++;
            }
        }
        _trim(w.ids, w.distances, w.found);
        return (w.ids, w.distances, 0);
    }

    struct Walk {
        uint32[] ids;
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
        uint32[] storage bucket = buckets[_bucketKey(uint8(w.seg), _probeValue(v, w.probe))];
        uint256 len = bucket.length;
        uint256 offset = w.offset;
        while (offset < len) {
            if (w.examined == maxCandidates) {
                w.offset = offset;
                return false;
            }
            uint32 cid = bucket[offset];
            uint256 d = _popcount(records[cid - 1].pHash ^ h);
            if (d <= maxDistance) {
                w.ids[w.found] = cid;
                w.distances[w.found] = uint8(d);
                w.found++;
            }
            w.examined++;
            offset++;
        }
        w.offset = offset;
        return true;
    }

    function _trim(uint32[] memory ids, uint8[] memory distances, uint256 n) private pure {
        assembly ("memory-safe") {
            mstore(ids, n)
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
    // Derivatives, reads
    // ------------------------------------------------------------------

    /// @notice Links a later record as a derivative of an earlier one if their hashes are close.
    function linkDerivative(uint32 childId, uint32 parentId) external {
        if (childId == 0 || childId > records.length || parentId == 0 || parentId > records.length) {
            revert UnknownRecord();
        }
        if (parentId >= childId) revert NotEarlier();
        Record storage child = records[childId - 1];
        Record storage parent = records[parentId - 1];
        if (child.parentId != 0) revert AlreadyLinked();
        if (child.hashVersion != parent.hashVersion) revert WrongHashVersion();
        uint256 d = _popcount(child.pHash ^ parent.pHash);
        if (d > LINK_DISTANCE) revert TooFar();
        child.parentId = parentId;
        emit Linked(childId, parentId, uint8(d));
    }

    /// @notice Returns a record by id. Reverts for unknown ids.
    function getRecord(uint32 id) external view returns (Record memory) {
        if (id == 0 || id > records.length) revert UnknownRecord();
        return records[id - 1];
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

    /// @notice Sets a label for a creator. Only attesters. An empty label revokes it.
    function attest(address creator, string calldata label) external {
        if (!isAttester[msg.sender]) revert NotAttester();
        creatorLabel[creator] = label;
        if (bytes(label).length == 0) {
            delete labelAttester[creator];
        } else {
            labelAttester[creator] = msg.sender;
        }
        emit Attested(creator, msg.sender, label);
    }

    /// @notice Grants or revokes attester rights. Only owner.
    function setAttester(address attester, bool allowed) external onlyOwner {
        isAttester[attester] = allowed;
        emit AttesterSet(attester, allowed);
    }
}
