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

export type PreviewName = "ended" | "live";

const PREVIEW_ID = 999;

/** The requested preview, or null when not in dev / no ?preview= param. */
export function previewName(): PreviewName | null {
    if (!import.meta.env.DEV) return null;
    try {
        const v = new URLSearchParams(window.location.search).get("preview");
        if (v === "ended" || v === "live") return v;
    } catch {
        /* no URL access — ignore */
    }
    return null;
}

const PARTICIPANTS: Challenge["participants"] = [
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
];

/** Synthetic challenge for the named preview. Dev builds only. */
export function previewChallenge(name: PreviewName): Challenge {
    const now = Math.floor(Date.now() / 1000);
    return {
        id: PREVIEW_ID,
        creator: "0x1b00000000000000000000000000000000000002",
        title: "Drop It Low",
        stake: 100_000_000_000_000_000n, // 0.1 MON
        // ended: finished an hour ago and settled. live: an hour left.
        endTime: name === "ended" ? now - 3600 : now + 3600,
        settled: name === "ended",
        pot: 200_000_000_000_000_000n, // 0.2 MON
        kind: 1,
        participants: PARTICIPANTS,
    };
}
