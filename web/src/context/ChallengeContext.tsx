import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { parseEventLogs } from "viem";
import { useWalletContext } from "./WalletContext";
import { walkPoolAbi } from "../lib/abi";
import { isContractConfigured, WALKPOOL_ADDRESS } from "../lib/chain";
import { recordMyChallenge } from "../lib/myChallenges";
import {
    joinPreview,
    previewChallenge,
    previewName,
    settlePreview,
    submitPreviewScore,
} from "../lib/previewChallenge";
import { emitTx } from "../lib/txFeed";
import { loadProfile, MAX_NAME_LENGTH } from "../lib/profile";
import type { Challenge, Participant } from "../lib/types";

const ACTIVE_ID_KEY = "walkthewalk.activeChallengeId";

const POLL_INTERVAL_MS = 6000; // gentler on the public RPC (steps challenges)
// Kind-1 (reps) blitzes are a live 15-minute race — poll tighter so everyone's
// reps move in near-real-time on the standings.
const POLL_INTERVAL_REPS_MS = 4000;
// Monad charges on gas_limit, not gas_used — keep these exact limits.
// Right-sized: Monad charges the LIMIT (102 gwei testnet), so padding = real cost.
// create ~250k used -> 400k; join/submit/claim <=120k -> 200k; settle loops -> 350k.
const GAS_WRITE = 200_000n;
const GAS_SETTLE = 350_000n;
const GAS_CREATE = 400_000n;

function shortAddr(addr: string): string {
    return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

/**
 * Truncate to a UTF-8 BYTE budget (the contract limits name/title in bytes,
 * not JS characters — emoji/CJK names would otherwise revert "too long").
 * Never splits a code point: decodes back ignoring a trailing partial char.
 */
function truncateUtf8Bytes(s: string, maxBytes: number): string {
    const bytes = new TextEncoder().encode(s);
    if (bytes.length <= maxBytes) return s;
    let end = maxBytes;
    // Back off any continuation bytes (0b10xxxxxx) at the cut point.
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
    return new TextDecoder().decode(bytes.slice(0, end));
}

/** On-chain display name for writes — from the local profile; email never leaves the device. */
function profileName(): string {
    const name = loadProfile()?.name.trim() ?? "";
    return truncateUtf8Bytes(name, MAX_NAME_LENGTH);
}

/** Strictly-a-nonnegative-integer parse; anything else is not a challenge id. */
function parseChallengeId(v: string | null): number | null {
    if (v == null || !/^\d{1,10}$/.test(v.trim())) return null;
    return Number(v.trim());
}

/** Initial active id: URL param ?c=123 wins (invite link), else localStorage. */
function initialActiveId(): number | null {
    try {
        const fromUrl = parseChallengeId(
            new URLSearchParams(window.location.search).get("c")
        );
        if (fromUrl != null) {
            localStorage.setItem(ACTIVE_ID_KEY, String(fromUrl));
            // Keep the invite context for THIS TAB: login does a full
            // location.reload(), and stripping ?c= below would otherwise
            // erase the invite mid-onboarding — the second phone then lands
            // on the generic home screen with no join CTA at all.
            // sessionStorage survives the reload but dies with the tab, so
            // old invites never resurrect on later visits.
            try {
                sessionStorage.setItem("walkthewalk.invitedId", String(fromUrl));
            } catch {
                /* storage unavailable — URL param already consumed */
            }
            // Consume the param: otherwise every refresh resurrects this id
            // even after the user leaves the challenge ("Run it back").
            const u = new URL(window.location.href);
            u.searchParams.delete("c");
            history.replaceState(null, "", u);
            return fromUrl;
        }
        const stored = parseChallengeId(localStorage.getItem(ACTIVE_ID_KEY));
        if (stored != null) return stored;
    } catch (e) {
        console.warn("ChallengeContext: failed to load storage", e);
    }
    return null;
}

/** Does this read failure look like "challenge doesn't exist" rather than a network hiccup? */
function looksLikeMissingChallenge(msg: string): boolean {
    return /revert|out-of-bounds|returned no data|invalid opcode|position `?0x/i.test(
        msg
    );
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Outcome of a settle/claim write.
 * "already" = the action was already done on-chain (double-claim from another
 * tab, concurrent settle from another device) — callers should treat it as
 * success, never as an error.
 */
export type TxOutcome = "success" | "already" | "failed";

interface ChallengeContextType {
    activeChallengeId: number | null;
    challenge: Challenge | null;
    loading: boolean;
    error: string | null;
    clearError: () => void;
    txPending: boolean;
    /** true when the contract address is not configured — writes are disabled */
    demoMode: boolean;
    /** true when the active id doesn't exist on-chain (getChallenge reverted / zero data) */
    challengeNotFound: boolean;
    setActiveChallengeId: (id: number | null) => void;
    refresh: () => Promise<void>;
    /** returns the new challenge id, or null on failure */
    createChallenge: (
        stakeWei: bigint,
        durationSec: number,
        title: string,
        kind: number
    ) => Promise<number | null>;
    join: (id: number) => Promise<void>;
    /** resolves true only when the score actually landed on-chain */
    submitSteps: (steps: number) => Promise<boolean>;
    settle: () => Promise<TxOutcome>;
    claim: () => Promise<TxOutcome>;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(
    undefined
);

export function ChallengeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { address, publicClient, walletClient, refreshBalance } =
        useWalletContext();
    const demoMode = !isContractConfigured;

    // Dev-only: ?preview=ended|live serves a synthetic challenge so states
    // that need real on-chain history can be looked at without producing one.
    // The import.meta.env.DEV guard sits at the CALL SITE, not just inside
    // previewName(): Vite substitutes it with `false` in a production build,
    // so the ternaries fold to null and the fixtures tree-shake out of the
    // bundle entirely rather than shipping as unreachable strings.
    const preview = useMemo(
        () => (import.meta.env.DEV ? previewName() : null),
        []
    );
    // Held in state, not derived: the mock writes below (submit / settle /
    // join) update it, so the whole flow is walkable instead of frozen.
    const [previewData, setPreviewData] = useState<Challenge | null>(() =>
        import.meta.env.DEV && preview ? previewChallenge(preview) : null
    );

    const [activeChallengeId, setActiveChallengeIdState] = useState<
        number | null
    >(initialActiveId);
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txPending, setTxPending] = useState(false);
    const [challengeNotFound, setChallengeNotFound] = useState(false);

    // Id currently being fetched (null = none). Per-id, so switching to a new
    // challenge is never starved by an in-flight poll for the old one.
    const fetchInFlight = useRef<number | null>(null);
    // Ref so the polling closure always sees the current value without re-subscribing.
    const addressRef = useRef(address);
    addressRef.current = address;
    // Ref mirror of activeChallengeId: async fetch results must never write
    // state for a challenge the user has already left (stale-response race).
    const activeIdRef = useRef(activeChallengeId);
    activeIdRef.current = activeChallengeId;

    const setActiveChallengeId = useCallback((id: number | null) => {
        setActiveChallengeIdState(id);
        setChallenge(null);
        setError(null);
        setChallengeNotFound(false);
        try {
            if (id == null) {
                localStorage.removeItem(ACTIVE_ID_KEY);
            } else {
                localStorage.setItem(ACTIVE_ID_KEY, String(id));
            }
        } catch {
            /* storage unavailable — ignore */
        }
    }, []);

    // ---- chain reads ----
    const fetchChallenge = useCallback(
        async (id: number) => {
            if (!publicClient || fetchInFlight.current === id) return;
            fetchInFlight.current = id;
            // Any state write below must still be about the ACTIVE challenge —
            // a slow RPC response for a previous id must never clobber the new
            // one (it would silently mix rosters/scores across challenges).
            const stillActive = () => activeIdRef.current === id;
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
                const [creator, stake, endTime, settled, pot, , title, kind] =
                    info;
                // Unset mapping/array slot -> zero struct: the id was never created.
                if (creator.toLowerCase() === ZERO_ADDRESS) {
                    if (!stillActive()) return;
                    setChallenge(null);
                    setChallengeNotFound(true);
                    setError(null);
                    return;
                }
                const [addrs, steps, payouts, names] = parts;
                const you = addressRef.current?.toLowerCase();
                const participants: Participant[] = addrs.map((addr, i) => {
                    const isYou =
                        you != null && addr.toLowerCase() === you;
                    // On-chain name wins; fall back to short address.
                    // Self shows the real name + "(you)" when set.
                    const onChainName = (names?.[i] ?? "").trim();
                    const name = isYou
                        ? onChainName
                            ? `${onChainName} (you)`
                            : "You"
                        : onChainName || shortAddr(addr);
                    return {
                        address: addr,
                        steps: Number(steps[i] ?? 0n),
                        payout: payouts[i] ?? 0n,
                        name,
                        isYou,
                    };
                });
                // Backfill the device-local "my challenges" registry: any
                // challenge that turns out to include this wallet belongs in
                // the home screen's Ongoing list and the history.
                if (participants.some((p) => p.isYou)) recordMyChallenge(id);
                if (!stillActive()) return;
                setChallenge({
                    id,
                    creator,
                    title,
                    stake,
                    endTime: Number(endTime),
                    settled,
                    pot,
                    kind: Number(kind) === 1 ? 1 : 0,
                    participants,
                });
                setChallengeNotFound(false);
            } catch (e) {
                const msg =
                    e instanceof Error ? e.message : "Failed to load challenge";
                // A revert on getChallenge means the id doesn't exist on-chain —
                // that's a state, not an error banner.
                if (looksLikeMissingChallenge(msg)) {
                    if (!stillActive()) return;
                    setChallenge(null);
                    setChallengeNotFound(true);
                    setError(null);
                } else {
                    // Transient RPC/poll hiccups are common on public testnet
                    // RPCs — never surface them as a banner. The next poll
                    // (4s) will recover; the banner is reserved for actions
                    // the user actually took (writes).
                    console.warn("[poll] challenge fetch failed:", msg);
                }
            } finally {
                if (fetchInFlight.current === id) fetchInFlight.current = null;
            }
        },
        [publicClient]
    );

    const refresh = useCallback(async () => {
        if (demoMode || activeChallengeId == null) return;
        await fetchChallenge(activeChallengeId);
    }, [demoMode, activeChallengeId, fetchChallenge]);

    // ---- initial load ----
    useEffect(() => {
        if (activeChallengeId == null) {
            setChallenge(null);
            return;
        }
        if (demoMode) {
            // No contract -> nothing real to show. Never serve fake data.
            setChallenge(null);
            return;
        }
        if (!publicClient) return;
        let cancelled = false;
        setLoading(true);
        fetchChallenge(activeChallengeId).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [activeChallengeId, demoMode, publicClient, fetchChallenge]);

    // ---- polling (cadence follows the loaded challenge's kind) ----
    // Reps (kind 1) blitzes poll every 4s while unsettled; steps keep 6s.
    const pollMs =
        challenge?.kind === 1 && !challenge.settled
            ? POLL_INTERVAL_REPS_MS
            : POLL_INTERVAL_MS;
    useEffect(() => {
        if (activeChallengeId == null || demoMode || !publicClient) return;
        const interval = setInterval(() => {
            fetchChallenge(activeChallengeId);
        }, pollMs);
        return () => clearInterval(interval);
    }, [activeChallengeId, demoMode, publicClient, fetchChallenge, pollMs]);

    // ---- event push: refetch the moment ANY device submits a score ----
    // During a live rep blitz, polling alone leaves multi-second gaps between
    // devices. Watching StepsSubmitted logs (2s log-poll, far cheaper than a
    // full state read) makes everyone's board jump within ~2s of a submit.
    const repsLive = challenge?.kind === 1 && !challenge.settled;
    useEffect(() => {
        if (!repsLive || activeChallengeId == null || demoMode || !publicClient)
            return;
        const unwatch = publicClient.watchContractEvent({
            address: WALKPOOL_ADDRESS,
            abi: walkPoolAbi,
            eventName: "StepsSubmitted",
            args: { id: BigInt(activeChallengeId) },
            pollingInterval: 2_000,
            onLogs: () => fetchChallenge(activeChallengeId),
            onError: () => {
                /* transient RPC errors — the regular poll still covers us */
            },
        });
        return unwatch;
    }, [repsLive, activeChallengeId, demoMode, publicClient, fetchChallenge]);

    // ---- writes ----
    const afterWrite = useCallback(async () => {
        await Promise.all([refresh(), refreshBalance()]);
    }, [refresh, refreshBalance]);

    const createChallenge = useCallback(
        async (
            stakeWei: bigint,
            durationSec: number,
            title: string,
            kind: number
        ): Promise<number | null> => {
            if (demoMode) {
                setError(
                    "Contract not deployed yet — transactions are disabled"
                );
                return null;
            }
            if (!walletClient || !publicClient) return null;
            setTxPending(true);
            setError(null);
            try {
                const t0 = performance.now();
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "createChallenge",
                    args: [
                        stakeWei,
                        BigInt(durationSec),
                        truncateUtf8Bytes(title, 64), // contract limit is BYTES
                        profileName(),
                        kind,
                    ],
                    value: stakeWei,
                    // Monad charges on gas_limit, not gas_used — keep it modest.
                    gas: GAS_CREATE,
                });
                const receipt = await publicClient.waitForTransactionReceipt({
                    hash,
                });
                if (receipt.status === "success") {
                    emitTx({
                        hash,
                        label: "Challenge created",
                        ms: Math.round(performance.now() - t0),
                    });
                }
                const logs = parseEventLogs({
                    abi: walkPoolAbi,
                    eventName: "ChallengeCreated",
                    logs: receipt.logs,
                });
                const created = logs[0];
                if (!created) {
                    setError("Challenge created but id not found in logs");
                    return null;
                }
                const id = Number(created.args.id);
                recordMyChallenge(id);
                setActiveChallengeId(id);
                await Promise.all([fetchChallenge(id), refreshBalance()]);
                return id;
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : "createChallenge failed"
                );
                return null;
            } finally {
                setTxPending(false);
            }
        },
        [
            demoMode,
            walletClient,
            publicClient,
            setActiveChallengeId,
            fetchChallenge,
            refreshBalance,
        ]
    );

    const join = useCallback(
        async (id: number) => {
            if (demoMode) {
                setError(
                    "Contract not deployed yet — transactions are disabled"
                );
                return;
            }
            if (!walletClient || !publicClient) return;
            setTxPending(true);
            setError(null);
            try {
                const [, stake] = await publicClient.readContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "getChallenge",
                    args: [BigInt(id)],
                });
                // Pre-flight: Monad charges the full gas LIMIT, so a doomed
                // join burns real MON. "already joined" is success, not error.
                try {
                    await publicClient.simulateContract({
                        address: WALKPOOL_ADDRESS,
                        abi: walkPoolAbi,
                        functionName: "join",
                        args: [BigInt(id), profileName()],
                        value: stake,
                        account: walletClient.account,
                    });
                } catch (simErr) {
                    const msg = simErr instanceof Error ? simErr.message : "";
                    if (/already joined/i.test(msg)) {
                        // You're in this challenge from another tab/device —
                        // just make it active.
                        recordMyChallenge(id);
                        setActiveChallengeId(id);
                        await Promise.all([
                            fetchChallenge(id),
                            refreshBalance(),
                        ]);
                        return;
                    }
                    if (/\bended\b/i.test(msg)) {
                        setError("This challenge has already ended.");
                        return;
                    }
                    throw simErr;
                }
                const t0 = performance.now();
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "join",
                    args: [BigInt(id), profileName()],
                    value: stake,
                    gas: GAS_WRITE,
                });
                const receipt = await publicClient.waitForTransactionReceipt({
                    hash,
                });
                if (receipt.status === "success") {
                    emitTx({
                        hash,
                        label: "Stake joined",
                        ms: Math.round(performance.now() - t0),
                    });
                }
                recordMyChallenge(id);
                setActiveChallengeId(id);
                await Promise.all([fetchChallenge(id), refreshBalance()]);
            } catch (e) {
                const msg = e instanceof Error ? e.message : "join failed";
                // A raw viem dump helps nobody mid-demo — map the two
                // common failures to something actionable.
                if (/insufficient|exceeds the balance/i.test(msg)) {
                    setError(
                        "Not enough MON to cover the stake + gas. Top up in the Wallet tab and try again."
                    );
                } else if (/429|rate limit/i.test(msg)) {
                    setError(
                        "The network is busy — wait a few seconds and tap Join again."
                    );
                } else {
                    setError(msg);
                }
            } finally {
                setTxPending(false);
            }
        },
        [
            demoMode,
            walletClient,
            publicClient,
            setActiveChallengeId,
            fetchChallenge,
            refreshBalance,
        ]
    );

    const simpleWrite = useCallback(
        async (
            functionName: "settle" | "claim",
            label: string
        ): Promise<TxOutcome> => {
            if (demoMode) {
                console.warn(`[demo] ${label} — contract not configured`);
                return "failed";
            }
            if (!walletClient || !publicClient || activeChallengeId == null)
                return "failed";
            // WalkPool reverts with "settled" on a repeat settle and "claimed"
            // on a repeat claim. Both mean the money already moved — surface
            // them as "already" (success), never as an error banner.
            const alreadyDoneRe =
                functionName === "settle" ? /\bsettled\b/i : /\bclaimed\b/i;
            const simulate = () =>
                publicClient.simulateContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName,
                    args: [BigInt(activeChallengeId)],
                    account: walletClient.account,
                });
            setTxPending(true);
            setError(null);
            try {
                // Pre-flight eth_call: Monad charges the full gas LIMIT, so a
                // doomed tx costs real money. A revert here that matches the
                // "already done" reason is success — just re-sync state.
                // Settle has one extra transient revert: "not ended". The
                // client clock and block.timestamp disagree by a few seconds,
                // so a settle fired right at the deadline can be early from
                // the chain's point of view. Retry quietly instead of
                // erroring — the deadline passes on-chain within seconds.
                const NOT_ENDED_RETRIES = 5;
                const NOT_ENDED_WAIT_MS = 4000;
                let attempt = 0;
                for (;;) {
                    try {
                        await simulate();
                        break;
                    } catch (simErr) {
                        const msg =
                            simErr instanceof Error ? simErr.message : "";
                        if (alreadyDoneRe.test(msg)) {
                            await afterWrite();
                            return "already";
                        }
                        if (
                            functionName === "settle" &&
                            /not ended/i.test(msg) &&
                            attempt < NOT_ENDED_RETRIES
                        ) {
                            attempt++;
                            await new Promise((r) =>
                                setTimeout(r, NOT_ENDED_WAIT_MS)
                            );
                            continue;
                        }
                        if (
                            functionName === "settle" &&
                            /not ended/i.test(msg)
                        ) {
                            // Still early after ~20s of retries — bail
                            // WITHOUT the raw error wall; the caller retries
                            // on the next poll tick.
                            console.warn(
                                "[settle] chain still says 'not ended' — will retry"
                            );
                            return "failed";
                        }
                        throw simErr;
                    }
                }
                const t0 = performance.now();
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName,
                    args: [BigInt(activeChallengeId)],
                    // settle ranks the whole roster in one tx — give it headroom
                    gas: functionName === "settle" ? GAS_SETTLE : GAS_WRITE,
                });
                const receipt = await publicClient.waitForTransactionReceipt({
                    hash,
                });
                if (receipt.status === "reverted") {
                    // Simulation passed but the tx reverted — almost always a
                    // race (another device settled / another tab claimed in
                    // between). Re-simulate to classify the revert reason.
                    try {
                        await simulate();
                    } catch (postErr) {
                        const msg =
                            postErr instanceof Error ? postErr.message : "";
                        if (alreadyDoneRe.test(msg)) {
                            await afterWrite();
                            return "already";
                        }
                        setError(msg || `${label} failed`);
                        return "failed";
                    }
                    setError(`${label} failed (transaction reverted)`);
                    return "failed";
                }
                emitTx({
                    hash,
                    label:
                        functionName === "settle"
                            ? "Pot settled"
                            : "Winnings claimed",
                    ms: Math.round(performance.now() - t0),
                });
                await afterWrite();
                return "success";
            } catch (e) {
                setError(e instanceof Error ? e.message : `${label} failed`);
                return "failed";
            } finally {
                setTxPending(false);
            }
        },
        [demoMode, walletClient, publicClient, activeChallengeId, afterWrite]
    );

    const submitSteps = useCallback(
        async (steps: number): Promise<boolean> => {
            if (demoMode) {
                console.warn("[demo] submitSteps — contract not configured");
                return false;
            }
            if (!walletClient || !publicClient || activeChallengeId == null)
                return false;
            setTxPending(true);
            setError(null);
            try {
                // Pre-flight eth_call: a reverting submit (challenge ended,
                // lower-than-recorded score) would burn the full gas limit.
                await publicClient.simulateContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "submitSteps",
                    args: [
                        BigInt(activeChallengeId),
                        BigInt(Math.floor(steps)),
                    ],
                    account: walletClient.account,
                });
                const t0 = performance.now();
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "submitSteps",
                    args: [
                        BigInt(activeChallengeId),
                        BigInt(Math.floor(steps)),
                    ],
                    gas: GAS_WRITE,
                });
                const receipt = await publicClient.waitForTransactionReceipt({
                    hash,
                });
                if (receipt.status === "success") {
                    emitTx({
                        hash,
                        label: "Score synced",
                        ms: Math.round(performance.now() - t0),
                    });
                }
                await afterWrite();
                return receipt.status === "success";
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : "submitSteps failed"
                );
                return false;
            } finally {
                setTxPending(false);
            }
        },
        [demoMode, walletClient, publicClient, activeChallengeId, afterWrite]
    );

    const settle = useCallback(
        () => simpleWrite("settle", "settle"),
        [simpleWrite]
    );
    const claim = useCallback(
        () => simpleWrite("claim", "claim"),
        [simpleWrite]
    );

    return (
        <ChallengeContext.Provider
            value={{
                // In preview mode the synthetic challenge replaces whatever
                // the chain reads produced, so the screen renders without a
                // real on-chain challenge. Dev builds only.
                activeChallengeId: previewData
                    ? previewData.id
                    : activeChallengeId,
                challenge: previewData ?? challenge,
                loading: previewData ? false : loading,
                error,
                clearError: () => setError(null),
                txPending,
                // The consumers gate "is this real chain data?" on these two;
                // a preview has to clear both or the screen falls back to the
                // empty state instead of rendering.
                demoMode: previewData ? false : demoMode,
                challengeNotFound: previewData ? false : challengeNotFound,
                setActiveChallengeId,
                refresh,
                createChallenge,
                // In preview the writes are mocked against local state — the
                // synthetic challenge has no on-chain counterpart, so the real
                // ones would revert and the flow would dead-end.
                join: previewData
                    ? async () => setPreviewData(joinPreview(previewData))
                    : join,
                submitSteps: previewData
                    ? async (n: number) => {
                          setPreviewData(submitPreviewScore(previewData, n));
                          return true;
                      }
                    : submitSteps,
                settle: previewData
                    ? async () => {
                          setPreviewData(settlePreview(previewData));
                          return "success" as TxOutcome;
                      }
                    : settle,
                claim: previewData
                    ? async () => "success" as TxOutcome
                    : claim,
            }}
        >
            {children}
        </ChallengeContext.Provider>
    );
}

export function useChallengeContext() {
    const ctx = useContext(ChallengeContext);
    if (!ctx)
        throw new Error(
            "useChallengeContext must be used within a ChallengeProvider"
        );
    return ctx;
}
