import { parseEther } from "viem";
import { Challenge } from "./types";

// Mock challenge matching the reference mockup ("10K Club").
// UI screens build against this; ChallengeContext swaps in live chain data.
export const MOCK_CHALLENGE: Challenge = {
    id: 1,
    title: "10K Club",
    creator: "0xA11ce00000000000000000000000000000000001",
    stake: parseEther("0.5"),
    endTime: Math.floor(Date.now() / 1000) + 3 * 24 * 3600 + 8 * 3600,
    settled: false,
    pot: parseEther("12.5"),
    participants: [
        { address: "0xA11ce00000000000000000000000000000000001", steps: 48320, payout: 0n, name: "Alex", isYou: false },
        { address: "0xB0b0000000000000000000000000000000000002", steps: 36890, payout: 0n, name: "Maya", isYou: false },
        { address: "0xCa10000000000000000000000000000000000003", steps: 28450, payout: 0n, name: "You", isYou: true },
        { address: "0xDad0000000000000000000000000000000000004", steps: 22120, payout: 0n, name: "Jordan", isYou: false },
        { address: "0xEve0000000000000000000000000000000000005", steps: 14210, payout: 0n, name: "Taylor", isYou: false },
    ],
};

// Settled variant for the results screen ("You walked. You won.")
export const MOCK_SETTLED: Challenge = {
    ...MOCK_CHALLENGE,
    settled: true,
    endTime: Math.floor(Date.now() / 1000) - 3600,
    participants: MOCK_CHALLENGE.participants.map((p, i) => ({
        ...p,
        payout: i === 0 ? parseEther("8.75") : i === 1 ? parseEther("3.75") : 0n,
    })),
};

export const MOCK_WEEK_STEPS = [
    { day: "Mon", steps: 6200 },
    { day: "Tue", steps: 8700 },
    { day: "Wed", steps: 7400 },
    { day: "Thu", steps: 9600 },
    { day: "Fri", steps: 10100 },
    { day: "Sat", steps: 12700 },
    { day: "Sun", steps: 8400 },
];
