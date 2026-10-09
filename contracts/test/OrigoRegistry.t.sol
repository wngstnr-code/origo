// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, Vm, console2} from "forge-std/Test.sol";
import {OrigoRegistry} from "../src/OrigoRegistry.sol";

contract OrigoRegistryTest is Test {
    OrigoRegistry internal registry;

    Vm.Wallet internal alice;
    Vm.Wallet internal bob;
    address internal relayer = makeAddr("relayer");

    uint64 internal constant H = 0xF0F0_0F0F_AAAA_5555; // popcount 32
    uint256 internal nonceCounter;

    function setUp() public {
        registry = new OrigoRegistry();
        alice = vm.createWallet("alice");
        bob = vm.createWallet("bob");
        vm.warp(1_800_000_000);
    }

    // ------------------------------------------------------------------ helpers

    function _reg(uint64 h, bytes32 commit) internal returns (OrigoRegistry.Registration memory r) {
        r = OrigoRegistry.Registration({
            pHash: h,
            fileCommit: commit,
            width: 1024,
            height: 768,
            source: 0,
            hashVersion: 1,
            thumbnailHash: bytes32(0),
            nonce: ++nonceCounter,
            deadline: block.timestamp + 1 hours
        });
    }

    function _sign(Vm.Wallet memory w, OrigoRegistry.Registration memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(w.privateKey, registry.hashRegistration(r));
        return abi.encodePacked(rr, s, v);
    }

    function _register(Vm.Wallet memory w, uint64 h, bytes32 commit) internal returns (uint32) {
        OrigoRegistry.Registration memory r = _reg(h, commit);
        bytes memory sig = _sign(w, r);
        vm.prank(relayer);
        return registry.register(r, sig, "");
    }

    function _commit(uint256 i) internal pure returns (bytes32) {
        return keccak256(abi.encode("commit", i));
    }

    function _pop(uint64 x) internal pure returns (uint256 c) {
        while (x != 0) {
            c += x & 1;
            x >>= 1;
        }
    }

    function _flip(uint64 h, uint256 seed, uint256 k) internal pure returns (uint64) {
        uint64 mask;
        uint256 n;
        uint256 i;
        while (n < k) {
            uint256 pos = uint256(keccak256(abi.encode(seed, i++))) % 64;
            if ((mask >> pos) & 1 == 0) {
                mask |= uint64(1) << pos;
                n++;
            }
        }
        return h ^ mask;
    }

    function _contains(uint32[] memory ids, uint32 id) internal pure returns (bool) {
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == id) return true;
        }
        return false;
    }

    function _page(uint64 h, uint8 maxD, uint8 radius, uint256 maxC)
        internal
        view
        returns (uint32[] memory ids, uint8[] memory ds)
    {
        uint256 cursor;
        ids = new uint32[](0);
        ds = new uint8[](0);
        uint256 guard;
        do {
            (uint32[] memory a, uint8[] memory b, uint256 next) = registry.findMatches(h, maxD, radius, cursor, maxC);
            uint32[] memory ni = new uint32[](ids.length + a.length);
            uint8[] memory nd = new uint8[](ids.length + a.length);
            for (uint256 i = 0; i < ids.length; i++) {
                ni[i] = ids[i];
                nd[i] = ds[i];
            }
            for (uint256 i = 0; i < a.length; i++) {
                ni[ids.length + i] = a[i];
                nd[ds.length + i] = b[i];
            }
            ids = ni;
            ds = nd;
            cursor = next;
            guard++;
            require(guard < 20000, "paging runaway");
        } while (cursor != 0);
    }

    /// @dev De-duplicates by id; result is an array indexed by id holding distance + 1 (0 = absent).
    function _dedupe(uint32[] memory ids, uint8[] memory ds, uint256 maxId) internal pure returns (uint256[] memory m) {
        m = new uint256[](maxId + 1);
        for (uint256 i = 0; i < ids.length; i++) {
            if (m[ids[i]] != 0) assertEq(m[ids[i]], uint256(ds[i]) + 1, "inconsistent distance");
            m[ids[i]] = uint256(ds[i]) + 1;
        }
    }

    // ------------------------------------------------------------------ 1. happy path

    function test_register_happyPath() public {
        OrigoRegistry.Registration memory r = _reg(H, _commit(1));
        bytes memory sig = _sign(alice, r);

        vm.expectEmit(true, true, false, true);
        emit OrigoRegistry.Registered(1, alice.addr, H, r.fileCommit, OrigoRegistry.Source.Upload, "");
        vm.prank(relayer);
        uint256 g = gasleft();
        uint32 id = registry.register(r, sig, "");
        g -= gasleft();
        console2.log("register gas (no thumbnail):", g);

        assertEq(id, 1);
        assertEq(registry.recordCount(), 1);
        OrigoRegistry.Record memory rec = registry.getRecord(1);
        assertEq(rec.creator, alice.addr);
        assertEq(rec.registeredAt, block.timestamp);
        assertEq(uint8(rec.source), 0);
        assertEq(rec.width, 1024);
        assertEq(rec.height, 768);
        assertEq(rec.hashVersion, 1);
        assertFalse(rec.hasThumbnail);
        assertEq(rec.submitter, relayer);
        assertEq(rec.pHash, H);
        assertEq(rec.parentId, 0);
        assertEq(rec.fileCommit, r.fileCommit);
        assertEq(rec.registeredBlock, block.number);

        for (uint8 i = 0; i < 4; i++) {
            bytes32 key = registry.bucketKey(i, uint16(H >> (48 - 16 * uint256(i))));
            assertEq(registry.bucketLength(key), 1);
        }
        uint32[] memory mine = registry.recordsOf(alice.addr, 0, 10);
        assertEq(mine.length, 1);
        assertEq(mine[0], 1);
        assertEq(registry.creatorRecordCount(alice.addr), 1);
        assertTrue(registry.usedNonce(alice.addr, r.nonce));
    }

    function test_bucketKeyMatchesSpec() public view {
        assertEq(registry.bucketKey(2, 0xBEEF), keccak256(abi.encodePacked(uint8(1), uint8(2), uint16(0xBEEF))));
    }

    // ------------------------------------------------------------------ 2. relay

    function test_relay_submitterDiffersFromCreator() public {
        uint32 id = _register(alice, H, _commit(1));
        OrigoRegistry.Record memory rec = registry.getRecord(id);
        assertEq(rec.submitter, relayer);
        assertEq(rec.creator, alice.addr);
        assertTrue(rec.submitter != rec.creator);
    }

    // ------------------------------------------------------------------ 3. rejections

    function test_revert_badSignature() public {
        OrigoRegistry.Registration memory r = _reg(H, _commit(1));
        bytes memory sig = _sign(alice, r);
        r.width = 999; // tamper after signing: recovers a different signer, which is not a revert by itself
        vm.prank(relayer);
        uint32 id = registry.register(r, sig, "");
        assertTrue(registry.getRecord(id).creator != alice.addr);

        bytes memory garbage = new bytes(65);
        OrigoRegistry.Registration memory r2 = _reg(H, _commit(2));
        vm.expectRevert(OrigoRegistry.InvalidSignature.selector);
        registry.register(r2, garbage, "");

        vm.expectRevert(OrigoRegistry.InvalidSignature.selector);
        registry.register(r2, hex"1234", "");
    }

    function test_revert_nonceReused() public {
        OrigoRegistry.Registration memory r = _reg(H, _commit(1));
        registry.register(r, _sign(alice, r), "");
        OrigoRegistry.Registration memory r2 = _reg(H, _commit(2));
        r2.nonce = r.nonce;
        bytes memory sig = _sign(alice, r2);
        vm.expectRevert(OrigoRegistry.NonceUsed.selector);
        registry.register(r2, sig, "");
    }

    function test_revert_expired() public {
        OrigoRegistry.Registration memory r = _reg(H, _commit(1));
        r.deadline = block.timestamp - 1;
        bytes memory sig = _sign(alice, r);
        vm.expectRevert(OrigoRegistry.Expired.selector);
        registry.register(r, sig, "");
        // deadline == now is accepted
        r.deadline = block.timestamp;
        sig = _sign(alice, r);
        registry.register(r, sig, "");
    }

    function test_revert_wrongHashVersion() public {
        OrigoRegistry.Registration memory r = _reg(H, _commit(1));
        r.hashVersion = 2;
        bytes memory sig = _sign(alice, r);
        vm.expectRevert(OrigoRegistry.WrongHashVersion.selector);
        registry.register(r, sig, "");
    }

    function test_revert_degenerateHash() public {
        uint64[4] memory bad = [uint64(0x7F), ~uint64(0x7F), 0, type(uint64).max];
        for (uint256 i = 0; i < 4; i++) {
            OrigoRegistry.Registration memory r = _reg(bad[i], _commit(i + 1));
            bytes memory sig = _sign(alice, r);
            vm.expectRevert(OrigoRegistry.DegenerateHash.selector);
            registry.register(r, sig, "");
        }
        assertEq(_pop(0x7F), 7);
        assertEq(_pop(~uint64(0x7F)), 57);
        // boundaries 8 and 56 are accepted
        _register(alice, 0xFF, _commit(10));
        _register(alice, ~uint64(0xFF), _commit(11));
    }

    function test_revert_zeroDimensions() public {
        OrigoRegistry.Registration memory r = _reg(H, _commit(1));
        r.width = 0;
        bytes memory sig = _sign(alice, r);
        vm.expectRevert(OrigoRegistry.InvalidDimensions.selector);
        registry.register(r, sig, "");

        r = _reg(H, _commit(1));
        r.height = 0;
        sig = _sign(alice, r);
        vm.expectRevert(OrigoRegistry.InvalidDimensions.selector);
        registry.register(r, sig, "");
    }

    function test_revert_invalidSource() public {
        OrigoRegistry.Registration memory r = _reg(H, _commit(1));
        r.source = 2;
        bytes memory sig = _sign(alice, r);
        vm.expectRevert(OrigoRegistry.InvalidSource.selector);
        registry.register(r, sig, "");

        r.source = 1; // Capture is fine
        sig = _sign(alice, r);
        uint32 id = registry.register(r, sig, "");
        assertEq(uint8(registry.getRecord(id).source), 1);
    }

    function test_revert_zeroCommit() public {
        OrigoRegistry.Registration memory r = _reg(H, bytes32(0));
        bytes memory sig = _sign(alice, r);
        vm.expectRevert(OrigoRegistry.EmptyCommit.selector);
        registry.register(r, sig, "");
    }

    function test_revert_duplicateCreatorCommit() public {
        _register(alice, H, _commit(1));
        OrigoRegistry.Registration memory r = _reg(H ^ 1, _commit(1));
        bytes memory sig = _sign(alice, r);
        vm.expectRevert(OrigoRegistry.CommitAlreadyRegistered.selector);
        registry.register(r, sig, "");
    }

    // ------------------------------------------------------------------ 4. front-run

    function test_sameCommitTwoCreators_frontRunCannotBlock() public {
        bytes memory original = "original photo bytes";
        bytes32 digest = sha256(original);
        bytes32 honestCommit = keccak256(abi.encode(digest, alice.addr));

        // Attacker sees the pending commit and registers the same fileCommit first.
        uint32 attackerId = _register(bob, H, honestCommit);
        // Honest registration with the same commit still succeeds.
        uint32 honestId = _register(alice, H, honestCommit);
        assertEq(attackerId, 1);
        assertEq(honestId, 2);
        assertEq(registry.getRecord(honestId).creator, alice.addr);

        // Off-chain ownership proof: commit is bound to the honest address.
        assertEq(keccak256(abi.encode(digest, alice.addr)), registry.getRecord(honestId).fileCommit);
        assertTrue(keccak256(abi.encode(digest, bob.addr)) != registry.getRecord(honestId).fileCommit);
        assertTrue(keccak256(abi.encode(digest, bob.addr)) != honestCommit);
    }

    // ------------------------------------------------------------------ 5. thumbnail

    function _regThumb(bytes memory thumb, bytes32 hashOverride, bool useOverride)
        internal
        returns (OrigoRegistry.Registration memory r, bytes memory sig)
    {
        r = _reg(H, _commit(++nonceCounter + 1000));
        r.thumbnailHash = useOverride ? hashOverride : (thumb.length == 0 ? bytes32(0) : keccak256(thumb));
        sig = _sign(alice, r);
    }

    function test_thumbnail_emptyOk() public {
        uint32 id = _register(alice, H, _commit(1));
        assertFalse(registry.getRecord(id).hasThumbnail);
    }

    function test_thumbnail_emptyWithNonzeroHashReverts() public {
        (OrigoRegistry.Registration memory r, bytes memory sig) = _regThumb("", keccak256("x"), true);
        vm.expectRevert(OrigoRegistry.ThumbnailHashMismatch.selector);
        registry.register(r, sig, "");
    }

    function test_thumbnail_4096Ok_andGas() public {
        bytes memory t = new bytes(4096);
        for (uint256 i = 0; i < t.length; i++) {
            t[i] = bytes1(uint8(i * 7 + 3));
        }
        (OrigoRegistry.Registration memory r, bytes memory sig) = _regThumb(t, 0, false);
        vm.expectEmit(true, true, false, true);
        emit OrigoRegistry.Registered(1, alice.addr, H, r.fileCommit, OrigoRegistry.Source.Upload, t);
        uint256 g = gasleft();
        uint32 id = registry.register(r, sig, t);
        g -= gasleft();
        console2.log("register gas (4096 byte thumbnail):", g);
        assertTrue(registry.getRecord(id).hasThumbnail);
    }

    function test_thumbnail_4097Reverts() public {
        bytes memory t = new bytes(4097);
        (OrigoRegistry.Registration memory r, bytes memory sig) = _regThumb(t, 0, false);
        vm.expectRevert(OrigoRegistry.ThumbnailTooLarge.selector);
        registry.register(r, sig, t);
    }

    function test_thumbnail_hashMismatchReverts() public {
        bytes memory t = hex"010203";
        (OrigoRegistry.Registration memory r, bytes memory sig) = _regThumb(t, keccak256("other"), true);
        vm.expectRevert(OrigoRegistry.ThumbnailHashMismatch.selector);
        registry.register(r, sig, t);
    }

    // ------------------------------------------------------------------ 6. findMatches basics

    function test_find_exactAtRadius0() public {
        uint32 id = _register(alice, H, _commit(1));
        (uint32[] memory ids, uint8[] memory ds) = _page(H, 0, 0, type(uint256).max);
        assertTrue(_contains(ids, id));
        for (uint256 i = 0; i < ids.length; i++) {
            assertEq(ds[i], 0);
        }
    }

    function test_find_sevenFlipsAtRadius1() public {
        uint32 id = _register(alice, H, _commit(1));
        // Spread 7 flips so that some segment has at most 1 flip: bits 0, 16, 32, 48 get 1 each plus 3 more in segment 0.
        uint64 q = H ^ (uint64(1) << 0) ^ (uint64(1) << 1) ^ (uint64(1) << 2) ^ (uint64(1) << 3) ^ (uint64(1) << 20)
            ^ (uint64(1) << 36) ^ (uint64(1) << 52);
        assertEq(_pop(q ^ H), 7);
        (uint32[] memory ids, uint8[] memory ds) = _page(q, 7, 1, type(uint256).max);
        assertTrue(_contains(ids, id));
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == id) assertEq(ds[i], 7);
        }
    }

    function test_find_threeFlipsAtRadius0() public {
        uint32 id = _register(alice, H, _commit(1));
        uint64 q = H ^ 1 ^ (uint64(1) << 20) ^ (uint64(1) << 40);
        (uint32[] memory ids, uint8[] memory ds) = _page(q, 3, 0, type(uint256).max);
        assertTrue(_contains(ids, id));
        assertEq(ds[0], 3);
    }

    function test_find_distanceEightNotReturned() public {
        _register(alice, H, _commit(1));
        // 8 flips, two per segment
        uint64 q = H ^ 0x0003_0003_0003_0003;
        assertEq(_pop(q ^ H), 8);
        (uint32[] memory ids,) = _page(q, 7, 1, type(uint256).max);
        assertEq(ids.length, 0);
    }

    function test_find_radiusTooLarge() public {
        vm.expectRevert(OrigoRegistry.RadiusTooLarge.selector);
        registry.findMatches(H, 7, 3, 0, 10);
    }

    function test_find_radius2() public {
        uint32 id = _register(alice, H, _commit(1));
        // 11 flips: 2 in each of the segments 0..2 plus 3 in seg 3... distribution (2,3,3,3) => seg 0 has 2
        uint64 q = H ^ 0x0000_0007_0007_0007 ^ (uint64(3) << 48);
        assertEq(_pop(q ^ H), 11);
        (uint32[] memory ids,) = _page(q, 11, 2, 64);
        assertTrue(_contains(ids, id));
    }

    function test_find_probeOrderCoversAllRadius2Probes() public {
        // For every pair (i, j) in segment 3, a record whose segment 3 differs in exactly those bits is reachable
        // via a radius 2 probe; the other segments are far from the query so only segment 3 can match.
        uint256 n;
        uint256 expected;
        for (uint256 i = 0; i < 16; i++) {
            for (uint256 j = i + 1; j < 16; j++) {
                // keep popcount valid
                uint64 h = (uint64(0xAAAA) << 48) | (uint64(0x5555) << 32) | (uint64(0x3C3C) << 16)
                    | (uint64(0xFF00) ^ (uint64(1) << i) ^ (uint64(1) << j));
                _register(alice, h, _commit(++n));
                expected++;
            }
        }
        uint64 q = (uint64(0xAAAA) << 48) | (uint64(0x5555) << 32) | (uint64(0x3C3C) << 16) | uint64(0xFF00);
        (uint32[] memory ids, uint8[] memory ds) = _page(q, 2, 2, type(uint256).max);
        uint256[] memory m = _dedupe(ids, ds, expected);
        for (uint256 id = 1; id <= expected; id++) {
            assertEq(m[id], 3, "pair record found at distance 2");
        }
    }

    // ------------------------------------------------------------------ 7. fuzz

    function testFuzz_noFalseNegatives(uint64 h, uint256 seed, uint8 kRaw) public {
        uint256 pc = _pop(h);
        vm.assume(pc >= 8 && pc <= 56);
        uint256 k = bound(kRaw, 0, 7);
        uint32 id = _register(alice, h, _commit(1));
        uint64 q = _flip(h, seed, k);
        assertEq(_pop(q ^ h), k);
        (uint32[] memory ids, uint8[] memory ds) = _page(q, 7, 1, 3);
        bool ok;
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == id) {
                ok = true;
                assertEq(ds[i], k);
            }
        }
        assertTrue(ok, "false negative");
    }

    // ------------------------------------------------------------------ 8. pagination equivalence

    function test_pagination_equivalence() public {
        // 30 records that share buckets: vary only a few bits around a base.
        for (uint256 i = 0; i < 30; i++) {
            uint64 h = H ^ uint64(i % 8) ^ (uint64(i / 8) << 20) ^ (uint64(i % 3) << 40);
            _register(i % 2 == 0 ? alice : bob, h, _commit(i + 1));
        }
        uint64 q = H ^ 0x5;
        (uint32[] memory a, uint8[] memory da) = _page(q, 7, 1, 1);
        (uint32[] memory b, uint8[] memory db) = _page(q, 7, 1, 5);
        (uint32[] memory c, uint8[] memory dc) = _page(q, 7, 1, type(uint256).max);
        uint256[] memory ma = _dedupe(a, da, 30);
        uint256[] memory mb = _dedupe(b, db, 30);
        uint256[] memory mc = _dedupe(c, dc, 30);
        uint256 hits;
        for (uint256 i = 0; i <= 30; i++) {
            assertEq(ma[i], mc[i]);
            assertEq(mb[i], mc[i]);
            if (mc[i] != 0) hits++;
        }
        assertGt(hits, 10);
        // raw (non-deduped) entries are identical in count too
        assertEq(a.length, c.length);
        assertEq(b.length, c.length);
    }

    function test_cursorEncoding() public {
        for (uint256 i = 0; i < 3; i++) {
            _register(alice, H ^ uint64(i), _commit(i + 1));
        }
        (,, uint256 next) = registry.findMatches(H, 7, 0, 0, 1);
        // (segment 0, probe 0, offset 1)
        assertEq(next, (uint256(0) << 160) | (uint256(0) << 96) | (uint256(1) << 1) | 1);
        (,, uint256 n0) = registry.findMatches(H, 7, 0, 0, 0);
        assertEq(n0, 1);
    }

    // ------------------------------------------------------------------ 9. gas

    function test_gas_findMatchesPageWithBigBucket() public {
        vm.pauseGasMetering();
        uint64 seg0 = uint64(0xF0F0) << 48;
        for (uint256 i = 0; i < 10_000; i++) {
            uint64 low = uint64(uint256(keccak256(abi.encode("h", i))) & 0xFFFF_FFFF_FFFF);
            OrigoRegistry.Registration memory r = _reg(seg0 | low, _commit(i + 1));
            bytes memory sig = _sign(alice, r);
            registry.register(r, sig, "");
        }
        vm.resumeGasMetering();
        assertEq(registry.recordCount(), 10_000);
        assertEq(registry.bucketLength(registry.bucketKey(0, 0xF0F0)), 10_000);

        uint64 q = seg0 | 0x1234_5678_9ABC;
        uint256 before = gasleft();
        (,, uint256 next) = registry.findMatches(q, 7, 1, 0, 256);
        uint256 used = before - gasleft();
        console2.log("findMatches page gas (256 candidates, radius 1, 10k bucket):", used);
        assertGt(next, 0);
        assertLt(used, 8_100_000);

        // later pages deep in the bucket stay cheap as well
        before = gasleft();
        registry.findMatches(q, 7, 1, (uint256(0) << 160) | (uint256(0) << 96) | (uint256(9000) << 1) | 1, 256);
        used = before - gasleft();
        console2.log("findMatches deep page gas:", used);
        assertLt(used, 8_100_000);
    }

    // ------------------------------------------------------------------ 10. linkDerivative

    function test_link_success() public {
        uint32 parent = _register(alice, H, _commit(1));
        uint32 child = _register(bob, H ^ 0x7F, _commit(2)); // distance 7
        vm.expectEmit(true, true, false, true);
        emit OrigoRegistry.Linked(child, parent, 7);
        registry.linkDerivative(child, parent);
        assertEq(registry.getRecord(child).parentId, parent);
    }

    function test_link_reverts() public {
        uint32 a = _register(alice, H, _commit(1));
        uint32 b = _register(bob, H ^ 0x3, _commit(2));
        uint32 far = _register(bob, H ^ 0xFF, _commit(3)); // distance 8

        vm.expectRevert(OrigoRegistry.NotEarlier.selector);
        registry.linkDerivative(a, b);
        vm.expectRevert(OrigoRegistry.NotEarlier.selector);
        registry.linkDerivative(a, a);

        vm.expectRevert(OrigoRegistry.TooFar.selector);
        registry.linkDerivative(far, a);

        registry.linkDerivative(b, a);
        vm.expectRevert(OrigoRegistry.AlreadyLinked.selector);
        registry.linkDerivative(b, a);

        vm.expectRevert(OrigoRegistry.UnknownRecord.selector);
        registry.linkDerivative(99, a);
        vm.expectRevert(OrigoRegistry.UnknownRecord.selector);
        registry.linkDerivative(b, 0);
        vm.expectRevert(OrigoRegistry.UnknownRecord.selector);
        registry.linkDerivative(0, 0);
    }

    function test_getRecord_unknown() public {
        vm.expectRevert(OrigoRegistry.UnknownRecord.selector);
        registry.getRecord(0);
        vm.expectRevert(OrigoRegistry.UnknownRecord.selector);
        registry.getRecord(1);
        _register(alice, H, _commit(1));
        registry.getRecord(1);
        vm.expectRevert(OrigoRegistry.UnknownRecord.selector);
        registry.getRecord(2);
    }

    function test_getRecords() public {
        _register(alice, H, _commit(1));
        _register(bob, H ^ 1, _commit(2));
        uint32[] memory ids = new uint32[](2);
        ids[0] = 2;
        ids[1] = 1;
        OrigoRegistry.Record[] memory rs = registry.getRecords(ids);
        assertEq(rs.length, 2);
        assertEq(rs[0].creator, bob.addr);
        assertEq(rs[1].creator, alice.addr);
    }

    // ------------------------------------------------------------------ 11. attesters

    function test_attester_permissions() public {
        address att = makeAddr("attester");
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert();
        registry.setAttester(att, true);

        vm.expectEmit(true, false, false, true);
        emit OrigoRegistry.AttesterSet(att, true);
        registry.setAttester(att, true); // test contract is the owner
        assertTrue(registry.isAttester(att));

        vm.prank(stranger);
        vm.expectRevert(OrigoRegistry.NotAttester.selector);
        registry.attest(alice.addr, "Alice Photo");

        vm.expectEmit(true, true, false, true);
        emit OrigoRegistry.Attested(alice.addr, att, "Alice Photo");
        vm.prank(att);
        registry.attest(alice.addr, "Alice Photo");
        assertEq(registry.creatorLabel(alice.addr), "Alice Photo");
        assertEq(registry.labelAttester(alice.addr), att);

        vm.prank(att);
        registry.attest(alice.addr, "");
        assertEq(registry.creatorLabel(alice.addr), "");
        assertEq(registry.labelAttester(alice.addr), address(0));

        registry.setAttester(att, false);
        vm.prank(att);
        vm.expectRevert(OrigoRegistry.NotAttester.selector);
        registry.attest(alice.addr, "x");
    }

    function test_eip712Domain() public view {
        (, string memory name, string memory version,,,,) = registry.eip712Domain();
        assertEq(name, "Origo");
        assertEq(version, "1");
        assertEq(registry.owner(), address(this));
    }

    // ------------------------------------------------------------------ 12. recordsOf

    function test_recordsOf_paginationAndClamping() public {
        for (uint256 i = 0; i < 5; i++) {
            _register(alice, H ^ uint64(i), _commit(i + 1));
            _register(bob, H ^ (uint64(i) << 8), _commit(i + 100));
        }
        assertEq(registry.creatorRecordCount(alice.addr), 5);
        uint32[] memory p = registry.recordsOf(alice.addr, 0, 2);
        assertEq(p.length, 2);
        assertEq(p[0], 1);
        assertEq(p[1], 3);
        p = registry.recordsOf(alice.addr, 2, 2);
        assertEq(p[0], 5);
        assertEq(p[1], 7);
        p = registry.recordsOf(alice.addr, 4, 100); // clamped
        assertEq(p.length, 1);
        assertEq(p[0], 9);
        assertEq(registry.recordsOf(alice.addr, 5, 10).length, 0);
        assertEq(registry.recordsOf(alice.addr, 500, 10).length, 0);
        assertEq(registry.recordsOf(makeAddr("nobody"), 0, 10).length, 0);
    }
}
