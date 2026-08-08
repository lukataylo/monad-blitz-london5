// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title WalkPool — step-challenge staking pools (Monad testnet)
/// @notice Participants stake MON into a challenge, submit step counts before
///         the deadline, and after the deadline anyone can settle: the top
///         stepper gets 70% of the pot, the runner-up 30% (division dust goes
///         to the winner). Ties go to the earlier joiner. Payouts are claimed
///         via a pull pattern.
contract WalkPool {
    struct Participant {
        uint256 steps;
        bool joined;
        uint256 payout;
        bool claimed;
    }

    struct Challenge {
        address creator;
        uint256 stake;
        uint64 endTime;
        bool settled;
        address[] participants;
        mapping(address => Participant) info;
    }

    uint256 public nextId;
    mapping(uint256 => Challenge) private challenges;

    event ChallengeCreated(
        uint256 indexed id,
        address indexed creator,
        uint256 stake,
        uint64 endTime
    );
    event Joined(uint256 indexed id, address indexed who);
    event StepsSubmitted(uint256 indexed id, address indexed who, uint256 steps);
    event Settled(uint256 indexed id, address indexed winner, address indexed runnerUp);
    event Claimed(uint256 indexed id, address indexed who, uint256 amount);

    /// @notice Create a challenge; the creator stakes and auto-joins.
    function createChallenge(uint256 stake, uint64 duration)
        external
        payable
        returns (uint256 id)
    {
        require(msg.value == stake, "stake mismatch");
        require(duration > 0, "duration zero");

        id = nextId++;
        Challenge storage c = challenges[id];
        c.creator = msg.sender;
        c.stake = stake;
        c.endTime = uint64(block.timestamp) + duration;

        c.participants.push(msg.sender);
        c.info[msg.sender].joined = true;

        emit ChallengeCreated(id, msg.sender, stake, c.endTime);
        emit Joined(id, msg.sender);
    }

    /// @notice Join an open challenge by matching its stake.
    function join(uint256 id) external payable {
        Challenge storage c = challenges[id];
        require(c.creator != address(0), "no challenge");
        require(block.timestamp < c.endTime, "ended");
        require(msg.value == c.stake, "stake mismatch");
        require(!c.info[msg.sender].joined, "already joined");

        c.participants.push(msg.sender);
        c.info[msg.sender].joined = true;

        emit Joined(id, msg.sender);
    }

    /// @notice Submit a (monotonically non-decreasing) step count before the deadline.
    function submitSteps(uint256 id, uint256 steps) external {
        Challenge storage c = challenges[id];
        Participant storage p = c.info[msg.sender];
        require(p.joined, "not joined");
        require(block.timestamp <= c.endTime, "ended");
        require(steps >= p.steps, "steps decreased");

        p.steps = steps;
        emit StepsSubmitted(id, msg.sender, steps);
    }

    /// @notice Settle a finished challenge: 70% to the winner, 30% to the
    ///         runner-up, dust to the winner. Solo challenges are fully refunded.
    function settle(uint256 id) external {
        Challenge storage c = challenges[id];
        require(c.creator != address(0), "no challenge");
        require(block.timestamp > c.endTime, "not ended");
        require(!c.settled, "settled");
        c.settled = true;

        uint256 count = c.participants.length;
        uint256 pot = c.stake * count;

        if (count == 1) {
            address solo = c.participants[0];
            c.info[solo].payout = pot;
            emit Settled(id, solo, address(0));
            return;
        }

        address winner;
        address runnerUp;
        uint256 winnerSteps;
        uint256 runnerUpSteps;
        bool haveWinner;
        bool haveRunnerUp;

        for (uint256 i = 0; i < count; i++) {
            address who = c.participants[i];
            uint256 s = c.info[who].steps;
            // Strictly-greater comparisons: on a tie the earlier joiner keeps the slot.
            if (!haveWinner || s > winnerSteps) {
                if (haveWinner) {
                    runnerUp = winner;
                    runnerUpSteps = winnerSteps;
                    haveRunnerUp = true;
                }
                winner = who;
                winnerSteps = s;
                haveWinner = true;
            } else if (!haveRunnerUp || s > runnerUpSteps) {
                runnerUp = who;
                runnerUpSteps = s;
                haveRunnerUp = true;
            }
        }

        uint256 runnerUpAmt = pot * 30 / 100;
        uint256 winnerAmt = pot - runnerUpAmt; // dust to winner

        c.info[winner].payout = winnerAmt;
        c.info[runnerUp].payout = runnerUpAmt;

        emit Settled(id, winner, runnerUp);
    }

    /// @notice Pull-pattern claim of a settled payout.
    function claim(uint256 id) external {
        Challenge storage c = challenges[id];
        require(c.settled, "not settled");
        Participant storage p = c.info[msg.sender];
        require(p.payout > 0, "no payout");
        require(!p.claimed, "claimed");

        p.claimed = true; // effects before interaction
        uint256 amount = p.payout;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        emit Claimed(id, msg.sender, amount);
    }

    /// @notice Challenge summary.
    function getChallenge(uint256 id)
        external
        view
        returns (
            address creator,
            uint256 stake,
            uint64 endTime,
            bool settled,
            uint256 pot,
            uint256 participantCount
        )
    {
        Challenge storage c = challenges[id];
        creator = c.creator;
        stake = c.stake;
        endTime = c.endTime;
        settled = c.settled;
        participantCount = c.participants.length;
        pot = c.stake * participantCount;
    }

    /// @notice Parallel arrays of participants, their steps, and their payouts.
    function getParticipants(uint256 id)
        external
        view
        returns (
            address[] memory addrs,
            uint256[] memory steps,
            uint256[] memory payouts
        )
    {
        Challenge storage c = challenges[id];
        uint256 count = c.participants.length;
        addrs = new address[](count);
        steps = new uint256[](count);
        payouts = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            address who = c.participants[i];
            addrs[i] = who;
            steps[i] = c.info[who].steps;
            payouts[i] = c.info[who].payout;
        }
    }
}
