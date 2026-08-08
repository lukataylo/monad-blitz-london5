// Shared shapes for challenge state. Mirrors WalkPool.sol views:
// getChallenge(id) -> (creator, stake, endTime, settled, pot, participantCount, title, kind)
// getParticipants(id) -> (address[], steps[], payout[], names[])
export type Participant = {
    address: `0x${string}`;
    steps: number;
    /** wei payout set after settle; 0n before */
    payout: bigint;
    /** on-chain display name (falls back to short address; "Name (you)" for self) */
    name: string;
    isYou: boolean;
};

export type Challenge = {
    id: number;
    creator: `0x${string}`;
    /** on-chain challenge title (e.g. "10K Club") */
    title: string;
    /** stake per person, wei */
    stake: bigint;
    /** unix seconds */
    endTime: number;
    settled: boolean;
    /** total pot, wei */
    pot: bigint;
    /** challenge kind: 0 = steps (phone/manual), 1 = reps (camera exercise tracker) */
    kind: 0 | 1;
    participants: Participant[];
};
