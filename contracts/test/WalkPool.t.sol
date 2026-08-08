// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WalkPool} from "../src/WalkPool.sol";

contract WalkPoolTest is Test {
    WalkPool pool;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address mallory = makeAddr("mallory");

    uint256 constant STAKE = 1 ether;
    uint64 constant DURATION = 1 days;

    function setUp() public {
        pool = new WalkPool();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(mallory, 100 ether);
    }

    function _create(uint256 stake) internal returns (uint256 id) {
        vm.prank(alice);
        id = pool.createChallenge{value: stake}(stake, DURATION, "Morning Walk", "Alice");
    }

    // 1. create + join happy path
    function test_CreateAndJoin() public {
        uint256 id = _create(STAKE);
        vm.prank(bob);
        pool.join{value: STAKE}(id, "Bob");

        (
            address creator,
            uint256 stake,
            uint64 endTime,
            bool settled,
            uint256 pot,
            uint256 count,
            string memory title
        ) = pool.getChallenge(id);

        assertEq(creator, alice);
        assertEq(stake, STAKE);
        assertEq(endTime, uint64(block.timestamp) + DURATION);
        assertFalse(settled);
        assertEq(pot, 2 * STAKE);
        assertEq(count, 2);
        assertEq(title, "Morning Walk");
        assertEq(address(pool).balance, 2 * STAKE);

        (address[] memory addrs, , , string[] memory names) = pool.getParticipants(id);
        assertEq(addrs[0], alice);
        assertEq(addrs[1], bob);
        assertEq(names[0], "Alice");
        assertEq(names[1], "Bob");
    }

    // 2. wrong stake reverts on create and join
    function test_RevertWrongStake() public {
        vm.prank(alice);
        vm.expectRevert(bytes("stake mismatch"));
        pool.createChallenge{value: STAKE - 1}(STAKE, DURATION, "Morning Walk", "Alice");

        uint256 id = _create(STAKE);
        vm.prank(bob);
        vm.expectRevert(bytes("stake mismatch"));
        pool.join{value: STAKE + 1}(id, "Bob");
    }

    // 3. join after endTime reverts
    function test_RevertJoinAfterEnd() public {
        uint256 id = _create(STAKE);
        vm.warp(block.timestamp + DURATION);
        vm.prank(bob);
        vm.expectRevert(bytes("ended"));
        pool.join{value: STAKE}(id, "Bob");
    }

    // 4. submitSteps must be monotonic
    function test_RevertStepsDecrease() public {
        uint256 id = _create(STAKE);
        vm.prank(alice);
        pool.submitSteps(id, 5000);
        vm.prank(alice);
        vm.expectRevert(bytes("steps decreased"));
        pool.submitSteps(id, 4999);
    }

    // 5. submitSteps after endTime reverts
    function test_RevertSubmitAfterEnd() public {
        uint256 id = _create(STAKE);
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(alice);
        vm.expectRevert(bytes("ended"));
        pool.submitSteps(id, 1);
    }

    // 6. non-participant submitSteps reverts
    function test_RevertSubmitNotJoined() public {
        uint256 id = _create(STAKE);
        vm.prank(mallory);
        vm.expectRevert(bytes("not joined"));
        pool.submitSteps(id, 1);
    }

    // 7. settle before endTime reverts
    function test_RevertSettleEarly() public {
        uint256 id = _create(STAKE);
        vm.expectRevert(bytes("not ended"));
        pool.settle(id);
        // exactly at endTime is still too early (must be strictly after)
        vm.warp(block.timestamp + DURATION);
        vm.expectRevert(bytes("not ended"));
        pool.settle(id);
    }

    // 8. settle ranks correctly, exact 70/30 wei split with dust to winner
    function test_SettleSplitWithDust() public {
        uint256 stake = 1 ether + 1 wei; // pot = 3 ether + 3 wei -> odd split
        uint256 id = _create(stake);
        vm.prank(bob);
        pool.join{value: stake}(id, "Bob");
        vm.prank(carol);
        pool.join{value: stake}(id, "Carol");

        vm.prank(alice);
        pool.submitSteps(id, 1000);
        vm.prank(bob);
        pool.submitSteps(id, 3000); // winner
        vm.prank(carol);
        pool.submitSteps(id, 2000); // runner-up

        vm.warp(block.timestamp + DURATION + 1);
        pool.settle(id);

        uint256 pot = stake * 3;
        uint256 runnerUpAmt = pot * 30 / 100;
        uint256 winnerAmt = pot - runnerUpAmt;
        assertEq(winnerAmt + runnerUpAmt, pot); // dust folded into winner

        (address[] memory addrs, , uint256[] memory payouts, ) = pool.getParticipants(id);
        assertEq(addrs[1], bob);
        assertEq(payouts[1], winnerAmt);
        assertEq(addrs[2], carol);
        assertEq(payouts[2], runnerUpAmt);
        assertEq(payouts[0], 0); // alice gets nothing
    }

    // 9. single participant gets full refund
    function test_SettleSoloRefund() public {
        uint256 id = _create(STAKE);
        vm.warp(block.timestamp + DURATION + 1);
        pool.settle(id);

        (, , uint256[] memory payouts, ) = pool.getParticipants(id);
        assertEq(payouts[0], STAKE);

        uint256 before = alice.balance;
        vm.prank(alice);
        pool.claim(id);
        assertEq(alice.balance, before + STAKE);
    }

    // 10. double settle reverts
    function test_RevertDoubleSettle() public {
        uint256 id = _create(STAKE);
        vm.warp(block.timestamp + DURATION + 1);
        pool.settle(id);
        vm.expectRevert(bytes("settled"));
        pool.settle(id);
    }

    // 11. claim transfers exact payout; double claim reverts
    function test_ClaimAndDoubleClaim() public {
        uint256 id = _create(STAKE);
        vm.prank(bob);
        pool.join{value: STAKE}(id, "Bob");

        vm.prank(alice);
        pool.submitSteps(id, 100);
        vm.prank(bob);
        pool.submitSteps(id, 200);

        vm.warp(block.timestamp + DURATION + 1);
        pool.settle(id);

        uint256 pot = 2 * STAKE;
        uint256 runnerUpAmt = pot * 30 / 100;
        uint256 winnerAmt = pot - runnerUpAmt;

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        pool.claim(id);
        assertEq(bob.balance, bobBefore + winnerAmt);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        pool.claim(id);
        assertEq(alice.balance, aliceBefore + runnerUpAmt);
        assertEq(address(pool).balance, 0);

        vm.prank(bob);
        vm.expectRevert(bytes("claimed"));
        pool.claim(id);
    }

    // 12. tie: earlier joiner wins
    function test_TieEarlierJoinerWins() public {
        uint256 id = _create(STAKE);
        vm.prank(bob);
        pool.join{value: STAKE}(id, "Bob");
        vm.prank(carol);
        pool.join{value: STAKE}(id, "Carol");

        vm.prank(alice);
        pool.submitSteps(id, 5000);
        vm.prank(bob);
        pool.submitSteps(id, 5000);
        vm.prank(carol);
        pool.submitSteps(id, 100);

        vm.warp(block.timestamp + DURATION + 1);
        pool.settle(id);

        uint256 pot = 3 * STAKE;
        (, , uint256[] memory payouts, ) = pool.getParticipants(id);
        // alice joined first: she keeps the winner slot on the tie
        assertEq(payouts[0], pot - pot * 30 / 100);
        assertEq(payouts[1], pot * 30 / 100);
        assertEq(payouts[2], 0);
    }

    // 13. names stored + returned for creator and joiners; Joined emits names;
    //     empty name allowed
    function test_NamesStoredAndEmitted() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit WalkPool.Joined(0, alice, "Alice");
        uint256 id = pool.createChallenge{value: STAKE}(STAKE, DURATION, "Morning Walk", "Alice");

        vm.prank(bob);
        vm.expectEmit(true, true, false, true);
        emit WalkPool.Joined(id, bob, "Bob");
        pool.join{value: STAKE}(id, "Bob");

        vm.prank(carol);
        pool.join{value: STAKE}(id, ""); // empty name allowed

        (address[] memory addrs, , , string[] memory names) = pool.getParticipants(id);
        assertEq(addrs.length, 3);
        assertEq(names.length, 3);
        assertEq(names[0], "Alice");
        assertEq(names[1], "Bob");
        assertEq(names[2], "");
    }

    // 14. names longer than 32 bytes revert on create and join
    function test_RevertNameTooLong() public {
        string memory longName = "This display name is 33 bytes !!!"; // 33 bytes
        assertEq(bytes(longName).length, 33);

        vm.prank(alice);
        vm.expectRevert(bytes("name too long"));
        pool.createChallenge{value: STAKE}(STAKE, DURATION, "Morning Walk", longName);

        uint256 id = _create(STAKE);
        vm.prank(bob);
        vm.expectRevert(bytes("name too long"));
        pool.join{value: STAKE}(id, longName);

        // exactly 32 bytes is fine
        string memory maxName = "Exactly thirty-two bytes long!!!";
        assertEq(bytes(maxName).length, 32);
        vm.prank(bob);
        pool.join{value: STAKE}(id, maxName);
        (, , , string[] memory names) = pool.getParticipants(id);
        assertEq(names[1], maxName);
    }

    // 15. title stored, returned by getChallenge, and emitted in ChallengeCreated
    function test_TitleStoredReturnedEmitted() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit WalkPool.ChallengeCreated(
            0, alice, STAKE, uint64(block.timestamp) + DURATION, "10k Steps Showdown"
        );
        uint256 id = pool.createChallenge{value: STAKE}(
            STAKE, DURATION, "10k Steps Showdown", "Alice"
        );

        (, , , , , , string memory title) = pool.getChallenge(id);
        assertEq(title, "10k Steps Showdown");
    }

    // 16. 65-byte title reverts; exactly 64 bytes is fine; empty is fine
    function test_TitleLengthBounds() public {
        string memory title65 =
            "01234567890123456789012345678901234567890123456789012345678901234";
        assertEq(bytes(title65).length, 65);
        vm.prank(alice);
        vm.expectRevert(bytes("title too long"));
        pool.createChallenge{value: STAKE}(STAKE, DURATION, title65, "Alice");

        string memory title64 =
            "0123456789012345678901234567890123456789012345678901234567890123";
        assertEq(bytes(title64).length, 64);
        vm.prank(alice);
        uint256 id64 = pool.createChallenge{value: STAKE}(STAKE, DURATION, title64, "Alice");
        (, , , , , , string memory stored64) = pool.getChallenge(id64);
        assertEq(stored64, title64);

        vm.prank(bob);
        uint256 idEmpty = pool.createChallenge{value: STAKE}(STAKE, DURATION, "", "Bob");
        (, , , , , , string memory storedEmpty) = pool.getChallenge(idEmpty);
        assertEq(storedEmpty, "");
    }
}
