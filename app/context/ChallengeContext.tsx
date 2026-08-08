import { walkPoolAbi } from "@/lib/abi";
import { isContractConfigured, WALKPOOL_ADDRESS } from "@/lib/chain";
import { Challenge, Participant } from "@/lib/types";
import { useWalletContext } from "@/context/WalletContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { parseEventLogs } from "viem";

const ACTIVE_ID_KEY = "activeChallengeId";
const NAMES_KEY = "names";
const PROFILE_KEY = "walkthewalk.profile";

export type Profile = {
    name: string;
    email: string;
};

const POLL_INTERVAL_MS = 4000;
const GAS_WRITE = 300_000n;
const GAS_CREATE = 3_000_000n;

function shortAddr(addr: string): string {
    return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

interface ChallengeContextType {
    activeChallengeId: number | null;
    challenge: Challenge | null;
    loading: boolean;
    error: string | null;
    txPending: boolean;
    /** true when the contract address is not configured — challenge stays null, actions no-op */
    demoMode: boolean;
    /** local signup identity, persisted in AsyncStorage; null until signup */
    profile: Profile | null;
    setProfile: (profile: Profile) => void;
    setActiveChallengeId: (id: number | null) => void;
    setName: (addr: string, name: string) => void;
    refresh: () => Promise<void>;
    /** returns the new challenge id, or null on failure */
    createChallenge: (
        stakeWei: bigint,
        durationSec: number,
        title: string
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
    >(null);
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [profile, setProfileState] = useState<Profile | null>(null);
    const [names, setNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txPending, setTxPending] = useState(false);

    const fetchInFlight = useRef(false);
    // Refs so the polling closure always sees current values without re-subscribing.
    const namesRef = useRef(names);
    namesRef.current = names;
    const addressRef = useRef(address);
    addressRef.current = address;
    const profileRef = useRef(profile);
    profileRef.current = profile;

    // ---- persistence ----
    useEffect(() => {
        (async () => {
            try {
                const [storedId, storedNames, storedProfile] =
                    await Promise.all([
                        AsyncStorage.getItem(ACTIVE_ID_KEY),
                        AsyncStorage.getItem(NAMES_KEY),
                        AsyncStorage.getItem(PROFILE_KEY),
                    ]);
                if (storedId != null && !Number.isNaN(Number(storedId))) {
                    setActiveChallengeIdState(Number(storedId));
                }
                if (storedNames) {
                    setNames(JSON.parse(storedNames) as Record<string, string>);
                }
                if (storedProfile) {
                    const parsed = JSON.parse(storedProfile) as Profile;
                    if (parsed && typeof parsed.name === "string") {
                        profileRef.current = parsed;
                        setProfileState(parsed);
                    }
                }
            } catch (e) {
                console.warn("ChallengeContext: failed to load storage", e);
            }
        })();
    }, []);

    const setActiveChallengeId = useCallback((id: number | null) => {
        setActiveChallengeIdState(id);
        setChallenge(null);
        setError(null);
        if (id == null) {
            AsyncStorage.removeItem(ACTIVE_ID_KEY).catch(() => {});
        } else {
            AsyncStorage.setItem(ACTIVE_ID_KEY, String(id)).catch(() => {});
        }
    }, []);

    const setProfile = useCallback((next: Profile) => {
        // Update the ref synchronously so a tx fired right after signup
        // already carries the name (state commit lags a render).
        profileRef.current = next;
        setProfileState(next);
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(
            () => {}
        );
    }, []);

    const setName = useCallback((addr: string, name: string) => {
        setNames((prev) => {
            const next = { ...prev, [addr.toLowerCase()]: name };
            AsyncStorage.setItem(NAMES_KEY, JSON.stringify(next)).catch(
                () => {}
            );
            return next;
        });
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
                const [creator, stake, endTime, settled, pot, , title] = info;
                const [addrs, steps, payouts, chainNames] = parts;
                const you = addressRef.current?.toLowerCase();
                const localNames = namesRef.current;
                const participants: Participant[] = addrs.map((addr, i) => {
                    const lower = addr.toLowerCase();
                    const isYou = you != null && lower === you;
                    const chainName = (chainNames[i] ?? "").trim();
                    return {
                        address: addr,
                        steps: Number(steps[i] ?? 0n),
                        payout: payouts[i] ?? 0n,
                        name: isYou
                            ? profileRef.current?.name || chainName || "You"
                            : chainName ||
                              (localNames[lower] ?? shortAddr(addr)),
                        isYou,
                    };
                });
                setChallenge({
                    id,
                    title,
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
                setError(e instanceof Error ? e.message : "Failed to load challenge");
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
            // Contract not configured — no chain to read from, challenge stays null.
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
            durationSec: number,
            title: string
        ): Promise<number | null> => {
            if (demoMode) {
                console.warn("[demo] createChallenge — contract not configured");
                return null;
            }
            if (!walletClient || !publicClient) return null;
            setTxPending(true);
            setError(null);
            try {
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "createChallenge",
                    args: [
                        stakeWei,
                        BigInt(durationSec),
                        title,
                        profileRef.current?.name ?? "",
                    ],
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
                    args: [BigInt(id), profileRef.current?.name ?? ""],
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
            if (
                !walletClient ||
                !publicClient ||
                activeChallengeId == null
            )
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
            if (
                !walletClient ||
                !publicClient ||
                activeChallengeId == null
            )
                return;
            setTxPending(true);
            setError(null);
            try {
                const hash = await walletClient.writeContract({
                    address: WALKPOOL_ADDRESS,
                    abi: walkPoolAbi,
                    functionName: "submitSteps",
                    args: [BigInt(activeChallengeId), BigInt(Math.floor(steps))],
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
                profile,
                setProfile,
                setActiveChallengeId,
                setName,
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
