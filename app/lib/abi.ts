import { parseAbi } from "viem";

// Reconciled against contracts/abi.json (WalkPool.sol, 12/12 tests green).
export const walkPoolAbi = parseAbi([
    "function createChallenge(uint256 stake, uint64 duration) payable returns (uint256 id)",
    "function join(uint256 id) payable",
    "function submitSteps(uint256 id, uint256 steps)",
    "function settle(uint256 id)",
    "function claim(uint256 id)",
    "function nextId() view returns (uint256)",
    "function getChallenge(uint256 id) view returns (address creator, uint256 stake, uint64 endTime, bool settled, uint256 pot, uint256 participantCount)",
    "function getParticipants(uint256 id) view returns (address[] addrs, uint256[] steps, uint256[] payouts)",
    "event ChallengeCreated(uint256 indexed id, address indexed creator, uint256 stake, uint64 endTime)",
    "event Joined(uint256 indexed id, address indexed who)",
    "event StepsSubmitted(uint256 indexed id, address indexed who, uint256 steps)",
    "event Settled(uint256 indexed id, address indexed winner, address indexed runnerUp)",
    "event Claimed(uint256 indexed id, address indexed who, uint256 amount)",
]);
