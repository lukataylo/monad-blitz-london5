// Dev-only screen previews.
//
// Some states need on-chain history that takes real time and real MON to
// produce — a finished challenge is the obvious one. This hands back a
// synthetic Challenge so those screens can be looked at on demand:
//
//   http://localhost:5173/?preview=ended
//   http://localhost:5173/?preview=live
//
// Hard-gated on import.meta.env.DEV. In a production build previewName()
// always returns null and the fixtures below are dead code, so the app's
// "only ever display data that actually came from chain" rule still holds
// everywhere a user can reach.

import type { Challenge } from "./types";

// "board" is a running challenge you're already in — App auto-switches to the
// leaderboard for it, which is the only way to reach that screen without a
// real staked challenge. "live" deliberately leaves you out so the join
// screen's Stake & Join state stays previewable. "results" is settled with
// payouts, so the winnings screen renders. "ending" has seconds left, for
// watching the running -> settled handover.
export type PreviewName =
    | "ended"
    | "live"
    | "board"
    | "reps"
    | "results"
    | "ending";

const PREVIEW_NAMES: readonly string[] = [
    "ended",
    "live",
    "board",
    "reps",
    "results",
    "ending",
];

const PREVIEW_ID = 999;

/** The requested preview, or null when not in dev / no ?preview= param. */
export function previewName(): PreviewName | null {
    if (!import.meta.env.DEV) return null;
    try {
        const v = new URLSearchParams(window.location.search).get("preview");
        if (v != null && PREVIEW_NAMES.includes(v)) return v as PreviewName;
    } catch {
        /* no URL access — ignore */
    }
    return null;
}

const RIVALS: Challenge["participants"] = [
    {
        address: "0x1b00000000000000000000000000000000000002",
        steps: 148,
        payout: 0n,
        name: "Luka",
        isYou: false,
    },
    {
        address: "0x1b00000000000000000000000000000000000003",
        steps: 121,
        payout: 0n,
        name: "Rae",
        isYou: false,
    },
    {
        address: "0x1b00000000000000000000000000000000000004",
        steps: 96,
        payout: 0n,
        name: "Sam",
        isYou: false,
    },
];

// Matches how ChallengeContext names self: "<on-chain name> (you)".
const YOU: Challenge["participants"][number] = {
    address: "0x1b0000000000000000000000000000000000000e",
    steps: 133,
    payout: 0n,
    name: "Maya (you)",
    isYou: true,
};

/** You're on the roster for these — the screens that need a staked player. */
const WITH_YOU: readonly PreviewName[] = [
    "board",
    "reps",
    "results",
    "ending",
];

// Rep challenges are camera-only on purpose (no manual "+1" in a staked
// game), so the walkable previews are STEP challenges — those keep the
// manual total and the +100/+1000 demo controls you can actually submit
// with. "reps" is the camera board, for looking at rather than driving.
const REP_PREVIEWS: readonly PreviewName[] = ["reps", "ended", "live"];

/** Synthetic challenge for the named preview. Dev builds only. */
export function previewChallenge(name: PreviewName): Challenge {
    const now = Math.floor(Date.now() / 1000);
    const endTime =
        name === "ended" || name === "results"
            ? now - 3600
            : name === "ending"
              ? now + 25
              : now + 3600;
    const isReps = REP_PREVIEWS.includes(name);
    const base: Challenge = {
        id: PREVIEW_ID,
        creator: "0x1b00000000000000000000000000000000000002",
        title: isReps ? "Drop It Low" : "Office Step War",
        stake: 100_000_000_000_000_000n, // 0.1 MON
        endTime,
        settled: false,
        pot: 400_000_000_000_000_000n, // 0.4 MON
        kind: isReps ? 1 : 0,
        participants: WITH_YOU.includes(name) ? [...RIVALS, YOU] : RIVALS,
    };
    return name === "results" || name === "ended"
        ? settlePreview(base)
        : base;
}

/**
 * Settlement the way WalkPool.sol does it: top scorer takes 70% of the pot,
 * runner-up 30%, everyone else nothing. Used both for the pre-settled
 * previews and by the mock settle() so the flow is walkable end to end.
 */
export function settlePreview(c: Challenge): Challenge {
    const ranked = [...c.participants].sort((a, b) => b.steps - a.steps);
    const first = ranked[0]?.address;
    const second = ranked[1]?.address;
    return {
        ...c,
        settled: true,
        participants: c.participants.map((p) => ({
            ...p,
            payout:
                p.address === first
                    ? (c.pot * 70n) / 100n
                    : p.address === second
                      ? (c.pot * 30n) / 100n
                      : 0n,
        })),
    };
}

/** Mock score submission — replaces your on-chain total in the preview. */
export function submitPreviewScore(c: Challenge, score: number): Challenge {
    return {
        ...c,
        participants: c.participants.map((p) =>
            p.isYou ? { ...p, steps: score } : p
        ),
    };
}

/** Mock join — puts you on the roster of a preview you weren't staked in. */
export function joinPreview(c: Challenge): Challenge {
    if (c.participants.some((p) => p.isYou)) return c;
    return {
        ...c,
        pot: c.pot + c.stake,
        participants: [...c.participants, { ...YOU, steps: 0 }],
    };
}
