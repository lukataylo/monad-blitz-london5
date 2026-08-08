// Shared shapes for challenge state. Mirrors WalkPool.sol views:
// getChallenge(id) -> (creator, stake, endTime, settled, pot, participantCount, title, kind)
// getParticipants(id) -> (address[], steps[], payout[])
export type Participant = {
    address: `0x${string}`;
    steps: number;
    /** wei payout set after settle; 0n before */
    payout: bigint;
    /** display name derived locally (email prefix or short address) */
    name: string;
    isYou: boolean;
};

export type Challenge = {
    id: number;
    /** display title chosen by the creator (e.g. "10K Club") */
    title: string;
    creator: `0x${string}`;
    /** stake per person, wei */
    stake: bigint;
    /** unix seconds */
    endTime: number;
    settled: boolean;
    /** total pot, wei */
    pot: bigint;
    /** challenge kind: 0 = steps, 1 = reps (camera exercise tracker on web) */
    kind: 0 | 1;
    participants: Participant[];
};
