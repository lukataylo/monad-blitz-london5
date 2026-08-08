import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletContext } from "../context/WalletContext";
import { walkPoolAbi } from "../lib/abi";
import { isContractConfigured, WALKPOOL_ADDRESS } from "../lib/chain";
import { loadMyChallengeIds } from "../lib/myChallenges";

// Light summary of one challenge you're part of — enough for the home
// screen's "Ongoing" cards and the leaderboard's switcher/history without
// pulling full participant rosters into every view.
export interface ChallengeSummary {
    id: number;
    title: string;
    kind: 0 | 1;
    stake: bigint;
    pot: bigint;
    endTime: number;
    settled: boolean;
    participantCount: number;
    /** whether the current wallet is actually staked in (registry may lag a login switch) */
    youIn: boolean;
    /** your current rank (1-based) among participants, when you're in */
    yourRank: number | null;
}

// Gentle: this feeds overview lists only, and it costs 2 reads PER TRACKED
// ID per tick — at 20s it was a real contributor to public-RPC 429s once a
// device had a few challenges. The active challenge has its own fast poll.
const REFRESH_MS = 45_000;
const MAX_FETCHED_IDS = 12;
const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Summaries for every challenge this device created/joined, newest first.
 * Polls gently (20s) — the per-challenge live views keep their own tighter
 * cadence; this only feeds overview lists.
 */
export function useMyChallenges(): {
    summaries: ChallengeSummary[];
    loading: boolean;
    refresh: () => void;
} {
    const { publicClient, address } = useWalletContext();
    const [summaries, setSummaries] = useState<ChallengeSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const inFlight = useRef(false);
    // Registry snapshot; refresh() re-reads it (e.g. right after create/join).
    const [ids, setIds] = useState<number[]>(() => loadMyChallengeIds());
    const refresh = useCallback(() => setIds(loadMyChallengeIds()), []);

    useEffect(() => {
        if (!isContractConfigured || !publicClient || ids.length === 0) {
            setSummaries([]);
            setLoading(false);
            return;
        }
        let cancelled = false;

        const load = async () => {
            if (inFlight.current) return;
            // Backgrounded tab: don't burn rate limit on an invisible list.
            if (document.hidden) return;
            inFlight.current = true;
            try {
                const you = address?.toLowerCase();
                const results = await Promise.all(
                    ids.slice(0, MAX_FETCHED_IDS).map(async (id) => {
                        try {
                            const [info, parts] = await Promise.all([
                                publicClient.readContract({
                                    address: WALKPOOL_ADDRESS,
                                    abi: walkPoolAbi,
                                    functionName: "getChallenge",
                                    args: [BigInt(id)],
                                }),
                                publicClient.readContract({
                                    address: WALKPOOL_ADDRESS,
                                    abi: walkPoolAbi,
                                    functionName: "getParticipants",
                                    args: [BigInt(id)],
                                }),
                            ]);
                            const [
                                creator,
                                stake,
                                endTime,
                                settled,
                                pot,
                                ,
                                title,
                                kind,
                            ] = info;
                            if (creator.toLowerCase() === ZERO) return null;
                            const [addrs, steps] = parts;
                            const yourIdx =
                                you == null
                                    ? -1
                                    : addrs.findIndex(
                                          (a) => a.toLowerCase() === you
                                      );
                            let yourRank: number | null = null;
                            if (yourIdx >= 0) {
                                const mine = steps[yourIdx] ?? 0n;
                                yourRank =
                                    1 +
                                    steps.filter((s) => (s ?? 0n) > mine)
                                        .length;
                            }
                            const summary: ChallengeSummary = {
                                id,
                                title,
                                kind: Number(kind) === 1 ? 1 : 0,
                                stake,
                                pot,
                                endTime: Number(endTime),
                                settled,
                                participantCount: addrs.length,
                                youIn: yourIdx >= 0,
                                yourRank,
                            };
                            return summary;
                        } catch {
                            // Missing/reverted id or RPC hiccup — drop this
                            // row for now; the next poll retries.
                            return null;
                        }
                    })
                );
                if (!cancelled) {
                    setSummaries(
                        results.filter((s): s is ChallengeSummary => s != null)
                    );
                    setLoading(false);
                }
            } finally {
                inFlight.current = false;
            }
        };

        setLoading(true);
        load();
        const t = setInterval(load, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [publicClient, address, ids]);

    return { summaries, loading, refresh };
}
