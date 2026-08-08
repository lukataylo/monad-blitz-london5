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
// screen's Stake & Join state stays previewable.
export type PreviewName = "ended" | "live" | "board";

const PREVIEW_ID = 999;

/** The requested preview, or null when not in dev / no ?preview= param. */
export function previewName(): PreviewName | null {
    if (!import.meta.env.DEV) return null;
    try {
        const v = new URLSearchParams(window.location.search).get("preview");
        if (v === "ended" || v === "live" || v === "board") return v;
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

/** Synthetic challenge for the named preview. Dev builds only. */
export function previewChallenge(name: PreviewName): Challenge {
    const now = Math.floor(Date.now() / 1000);
    return {
        id: PREVIEW_ID,
        creator: "0x1b00000000000000000000000000000000000002",
        title: "Drop It Low",
        stake: 100_000_000_000_000_000n, // 0.1 MON
        // ended: finished an hour ago and settled. otherwise an hour left.
        endTime: name === "ended" ? now - 3600 : now + 3600,
        settled: name === "ended",
        pot: 400_000_000_000_000_000n, // 0.4 MON
        // "board" needs you on the roster for App to route to the leaderboard;
        // the other previews are about screens you're not staked in.
        kind: 1,
        participants: name === "board" ? [...RIVALS, YOU] : RIVALS,
    };
}
