import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { parseEventLogs } from "viem";
import { useWalletContext } from "./WalletContext";
import { walkPoolAbi } from "../lib/abi";
import { isContractConfigured, WALKPOOL_ADDRESS } from "../lib/chain";
import { MOCK_CHALLENGE } from "../lib/mock";
import { loadProfile, MAX_NAME_LENGTH } from "../lib/profile";
import type { Challenge, Participant } from "../lib/types";

const ACTIVE_ID_KEY = "walkthewalk.activeChallengeId";

const POLL_INTERVAL_MS = 4000;
// Monad charges on gas_limit, not gas_used — keep these exact limits.
const GAS_WRITE = 300_000n;
const GAS_CREATE = 3_000_000n;

function shortAddr(addr: string): string {
    return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

/** On-chain display name for writes — from the local profile; email never leaves the device. */
function profileName(): string {
    return loadProfile()?.name.trim().slice(0, MAX_NAME_LENGTH) ?? "";
}

/** Initial active id: URL param ?c=123 wins (invite link), else localStorage. */
function initialActiveId(): number | null {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get("c");
        if (fromUrl != null && fromUrl !== "" && !Number.isNaN(Number(fromUrl))) {
            localStorage.setItem(ACTIVE_ID_KEY, String(Number(fromUrl)));
            return Number(fromUrl);
        }
        const stored = localStorage.getItem(ACTIVE_ID_KEY);
        if (stored != null && !Number.isNaN(Number(stored))) {
            return Number(stored);
        }
    } catch (e) {
        console.warn("ChallengeContext: failed to load storage", e);
    }
    return null;
}

interface ChallengeContextType {
    activeChallengeId: number | null;
    challenge: Challenge | null;
    loading: boolean;
    error: string | null;
    txPending: boolean;
    /** true when the contract address is not configured — serves mock data */
    demoMode: boolean;
    setActiveChallengeId: (id: number | null) => void;
    refresh: () => Promise<void>;
    /** returns the new challenge id, or null on failure */
    createChallenge: (
        stakeWei: bigint,
        durationSec: number
    ) => Promise<number | null>;
    join: (id: number) => Promise<void>;
    submitSteps: (steps: number) => Promise<void>;
    settle: () => Promise<void>;
    claim: () => Promise<void>;
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

    const [activeChallengeId, setActiveChallengeIdState] = useState<
        number | null
    >(initialActiveId);
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txPending, setTxPending] = useState(false);

    const fetchInFlight = useRef(false);
    // Ref so the polling closure always sees the current value without re-subscribing.
    const addressRef = useRef(address);
    addressRef.current = address;

    const setActiveChallengeId = useCallback((id: number | null) => {
        setActiveChallengeIdState(id);
        setChallenge(null);
        setError(null);
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
            if (!publicClient || fetchInFlight.current) return;
            fetchInFlight.current = true;
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
                const [creator, stake, endTime, settled, pot] = info;
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
                setChallenge({
                    id,
                    creator,
                    stake,
                    endTime: Number(endTime),
                    settled,
                    pot,
                    participants,
                });
                setError(null);
            } catch (e) {
                // Keep the last good challenge; just surface the error.
                setError(
                    e instanceof Error ? e.message : "Failed to load challenge"
                );
            } finally {
                fetchInFlight.current = false;
            }
        },
        [publicClient]
    );

    const refresh = useCallback(async () => {
        if (demoMode || activeChallengeId == null) return;
        await fetchChallenge(activeChallengeId);
    }, [demoMode, activeChallengeId, fetchChallenge]);

    // ---- polling ----
    useEffect(() => {
        if (activeChallengeId == null) {
            setChallenge(null);
            return;
        }
        if (demoMode) {
            setChallenge(MOCK_CHALLENGE);
            return;
        }
        if (!publicClient) return;
        let cancelled = false;
        setLoading(true);
        fetchChallenge(activeChallengeId).finally(() => {
            if (!cancelled) setLoading(false);
        });
        const interval = setInterval(() => {
            fetchChallenge(activeChallengeId);
        }, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [activeChallengeId, demoMode, publicClient, fetchChallenge]);

    // ---- writes ----
    const afterWrite = useCallback(async () => {
        await Promise.all([refresh(), refreshBalance()]);
    }, [refresh, refreshBalance]);

    const createChallenge = useCallback(
        async (
            stakeWei: bigint,
            durationSec: number
        ): Promise<number | null> => {
            if (demoMode) {
                console.warn("[demo] createChallenge — contract not configured");
                setActiveChallengeId(MOCK_CHALLENGE.id);
                return MOCK_CHALLENGE.id;
            }
            if (!walletClient || !publicClient) return null;
            setTxPending(true);
            setError(null);
            try {
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "createChallenge",
                    args: [stakeWei, BigInt(durationSec), profileName()],
                    value: stakeWei,
                    // Monad charges on gas_limit, not gas_used — keep it modest.
                    gas: GAS_CREATE,
                });
                const receipt = await publicClient.waitForTransactionReceipt({
                    hash,
                });
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
                console.warn("[demo] join — contract not configured");
                setActiveChallengeId(MOCK_CHALLENGE.id);
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
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "join",
                    args: [BigInt(id), profileName()],
                    value: stake,
                    gas: GAS_WRITE,
                });
                await publicClient.waitForTransactionReceipt({ hash });
                setActiveChallengeId(id);
                await Promise.all([fetchChallenge(id), refreshBalance()]);
            } catch (e) {
                setError(e instanceof Error ? e.message : "join failed");
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
        ): Promise<void> => {
            if (demoMode) {
                console.warn(`[demo] ${label} — contract not configured`);
                return;
            }
            if (!walletClient || !publicClient || activeChallengeId == null)
                return;
            setTxPending(true);
            setError(null);
            try {
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName,
                    args: [BigInt(activeChallengeId)],
                    gas: GAS_WRITE,
                });
                await publicClient.waitForTransactionReceipt({ hash });
                await afterWrite();
            } catch (e) {
                setError(e instanceof Error ? e.message : `${label} failed`);
            } finally {
                setTxPending(false);
            }
        },
        [demoMode, walletClient, publicClient, activeChallengeId, afterWrite]
    );

    const submitSteps = useCallback(
        async (steps: number) => {
            if (demoMode) {
                console.warn("[demo] submitSteps — contract not configured");
                return;
            }
            if (!walletClient || !publicClient || activeChallengeId == null)
                return;
            setTxPending(true);
            setError(null);
            try {
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
                await publicClient.waitForTransactionReceipt({ hash });
                await afterWrite();
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : "submitSteps failed"
                );
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
                activeChallengeId,
                challenge,
                loading,
                error,
                txPending,
                demoMode,
                setActiveChallengeId,
                refresh,
                createChallenge,
                join,
                submitSteps,
                settle,
                claim,
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
