import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEther } from "viem";
import { Avatar, formatMon } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";
import { useWalletContext } from "../context/WalletContext";
import { copyForChallenge } from "../lib/kindCopy";

const CONFETTI_COLORS = ["#D9E856", "#C8BDF4", "#F6C8D8", "#E8B84B", "#111111"];
const CONFETTI_COUNT = 22;

// The contract never exposes "claimed" through its views (payout stays
// non-zero after a claim), so this flag is the only claimed-status source.
const claimedKey = (id: number) => `walkthewalk.claimed.${id}`;

function wasClaimed(id: number): boolean {
    try {
        return localStorage.getItem(claimedKey(id)) === "1";
    } catch {
        return false;
    }
}

function markClaimed(id: number) {
    try {
        localStorage.setItem(claimedKey(id), "1");
    } catch {
        /* storage unavailable — the ref guard still covers this session */
    }
}

function Confetti() {
    const pieces = useMemo(
        () =>
            Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
                left: Math.random() * 100,
                top: Math.random() * 25,
                delay: Math.random() * 2.4,
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                rotate: Math.random() * 180,
            })),
        []
    );
    return (
        <div className="confetti-wrap" aria-hidden>
            {pieces.map((p, i) => (
                <span
                    key={i}
                    className="confetti"
                    style={{
                        left: `${p.left}%`,
                        top: `${p.top}vh`,
                        background: p.color,
                        animationDelay: `${p.delay}s`,
                        transform: `rotate(${p.rotate}deg)`,
                    }}
                />
            ))}
        </div>
    );
}

/**
 * Exact payout via formatEther, with a short count-up on first render.
 * Skipped entirely under prefers-reduced-motion.
 */
function CountUpMon({ wei }: { wei: bigint }) {
    const finalStr = formatEther(wei);
    const target = Number(finalStr);
    const decimals = finalStr.includes(".")
        ? Math.min(finalStr.split(".")[1].length, 6)
        : 0;
    const [display, setDisplay] = useState(finalStr);

    useEffect(() => {
        const reduced = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)"
        )?.matches;
        if (reduced || !Number.isFinite(target) || target <= 0) {
            setDisplay(finalStr);
            return;
        }
        let raf = 0;
        const start = performance.now();
        const duration = 900;
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            if (t >= 1) {
                setDisplay(finalStr); // land on the exact string
                return;
            }
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay((target * eased).toFixed(decimals));
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [finalStr, target, decimals]);

    return <span className="countup-num">{display}</span>;
}

type ClaimState = "idle" | "claiming" | "claimed" | "failed";

export function ResultsView({
    onBackToJoin,
}: {
    onBackToJoin?: () => void;
}) {
    const { challenge, claim, settle, txPending, setActiveChallengeId } =
        useChallengeContext();
    const { balance } = useWalletContext();

    const challengeId = challenge?.id ?? null;
    const isSettled = challenge?.settled ?? false;
    const youP = challenge?.participants.find((p) => p.isYou) ?? null;
    const yourPayout = youP?.payout ?? 0n;
    const hasStake = youP != null;
    const ended =
        challenge != null && Date.now() / 1000 > challenge.endTime;
    // Ended but not yet settled, and the viewer has money in it: fire settle
    // from whoever's watching so the win moment is fully automatic.
    const needsSettle = challenge != null && ended && !isSettled && hasStake;

    const [claimState, setClaimState] = useState<ClaimState>(() =>
        challengeId != null && wasClaimed(challengeId) ? "claimed" : "idle"
    );
    // Ref guards: one shot per challenge id per mount, even across re-renders.
    const claimFiredFor = useRef<number | null>(null);
    const settleFiredFor = useRef<number | null>(null);

    // Revisits: a persisted claimed flag wins over any transient state.
    useEffect(() => {
        if (challengeId != null && wasClaimed(challengeId)) {
            setClaimState("claimed");
        }
    }, [challengeId]);

    const fireClaim = useCallback(() => {
        if (challengeId == null) return;
        setClaimState("claiming");
        void claim().then((outcome) => {
            // "already" = the on-chain double-claim revert — money already
            // arrived (other tab / earlier visit). That is success.
            if (outcome === "success" || outcome === "already") {
                markClaimed(challengeId);
                setClaimState("claimed");
            } else {
                setClaimState("failed");
            }
        });
    }, [challengeId, claim]);

    // Auto-claim: payout landed, not yet claimed -> fire once.
    useEffect(() => {
        if (challengeId == null || !isSettled || yourPayout <= 0n) return;
        if (wasClaimed(challengeId)) return;
        if (claimFiredFor.current === challengeId) return;
        claimFiredFor.current = challengeId;
        fireClaim();
    }, [challengeId, isSettled, yourPayout, fireClaim]);

    // Auto-settle: challenge over but nobody pulled the trigger yet. A
    // concurrent settle from another device reverting is treated as success
    // inside the context ("already") — the next poll shows payouts either way.
    useEffect(() => {
        if (!needsSettle || challengeId == null) return;
        if (settleFiredFor.current === challengeId) return;
        settleFiredFor.current = challengeId;
        void settle();
    }, [needsSettle, challengeId, settle]);

    const sorted = useMemo(
        () =>
            challenge
                ? [...challenge.participants].sort((a, b) => b.steps - a.steps)
                : [],
        [challenge]
    );

    if (!challenge || sorted.length === 0) {
        return (
            <>
                <h1 className="title-heavy">
                    No results <span className="highlight-lime">yet</span>
                </h1>
                <div className="card" style={{ textAlign: "center" }}>
                    <div className="caption" style={{ marginBottom: 14 }}>
                        Finish a challenge to see the podium
                    </div>
                    {onBackToJoin && (
                        <button className="pill-btn" onClick={onBackToJoin}>
                            Go to Join →
                        </button>
                    )}
                </div>
            </>
        );
    }

    // Live challenge, tab visited early: never fake a win screen (confetti +
    // 70/30 podium) for a game that's still running.
    if (!ended && !isSettled) {
        return (
            <>
                <h1 className="title-heavy">
                    Still <span className="highlight-lime">running</span>
                </h1>
                <div className="card" style={{ textAlign: "center" }}>
                    <div className="caption" style={{ marginBottom: 4 }}>
                        Results land here when the timer hits zero
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                        Check the Leaderboard tab to see the race
                    </div>
                </div>
            </>
        );
    }

    const winner = sorted[0];
    const runnerUp = sorted[1] ?? null;
    const you = sorted.find((p) => p.isYou) ?? null;
    const youWon = winner.isYou;

    // "You squatted. You won." for rep challenges, walking copy otherwise.
    const copy = copyForChallenge(
        challenge.kind,
        challenge.id,
        challenge.title
    );
    const isReps = challenge.kind === 1;
    const ellipseClass = isReps
        ? "won-ellipse won-ellipse--pink"
        : "won-ellipse";

    // Payouts come from chain after settle; fall back to the 70/30 split for display.
    const winnerAmt =
        winner.payout > 0n ? winner.payout : (challenge.pot * 70n) / 100n;
    const runnerUpAmt =
        runnerUp == null
            ? 0n
            : runnerUp.payout > 0n
              ? runnerUp.payout
              : (challenge.pot * 30n) / 100n;

    const runItBack = () => setActiveChallengeId(null);

    // Claim/settle status block — replaces the old manual claim button.
    let statusBlock: React.ReactNode = null;
    if (needsSettle) {
        statusBlock = (
            <div className="claim-pill" role="status">
                <span className="spinner spinner--ink" />
                Finalizing results…
            </div>
        );
    } else if (isSettled && yourPayout > 0n) {
        if (claimState === "claimed") {
            statusBlock = (
                <div className="claim-card" role="status">
                    <div className="claim-card-amt">
                        <CountUpMon wei={yourPayout} /> MON added to your
                        wallet ✓
                    </div>
                    <div className="claim-card-balance">
                        Wallet: {formatMon(balance, 2)} MON
                    </div>
                </div>
            );
        } else if (claimState === "failed") {
            statusBlock = (
                <button
                    className="pill-btn"
                    onClick={fireClaim}
                    disabled={txPending}
                >
                    Claim {formatEther(yourPayout)} MON →
                </button>
            );
        } else {
            // idle (about to auto-fire) or claiming — same pill, no flash.
            statusBlock = (
                <div className="claim-pill" role="status">
                    <span className="spinner spinner--ink" />
                    💸 Sending your winnings to your wallet…
                </div>
            );
        }
    }
    // Losers / zero payout: no claim UI at all — just the final standings.

    return (
        <>
            <Confetti />

            <h1 className="title-heavy" style={{ paddingTop: 12 }}>
                {youWon ? (
                    <>
                        You {copy.verbPast}.
                        <br />
                        You <span className={ellipseClass}>won.</span>
                    </>
                ) : (
                    <>
                        You {copy.verbPast}.
                        <br />
                        They <span className={ellipseClass}>won.</span>
                    </>
                )}
            </h1>

            <div className="pot-pill">
                Final pot · {formatMon(challenge.pot)} MON
            </div>

            {/* podium */}
            <div className="podium-row">
                {runnerUp && (
                    <div
                        className="podium-col"
                        style={{ background: "var(--pink)", minHeight: 128 }}
                    >
                        <Avatar
                            name={runnerUp.name}
                            address={runnerUp.address}
                        />
                        <span className="podium-name">{runnerUp.name}</span>
                        <span className="caption caption--ink">2nd · 30%</span>
                        <span className="podium-amt">
                            {formatMon(runnerUpAmt)} MON
                        </span>
                    </div>
                )}
                <div
                    className="podium-col"
                    style={{ background: "var(--lime)", minHeight: 156 }}
                >
                    <Avatar name={winner.name} address={winner.address} />
                    <span className="podium-name">{winner.name}</span>
                    <span className="caption caption--ink">1st · 70%</span>
                    <span className="podium-amt">
                        {formatMon(winnerAmt)} MON
                    </span>
                </div>
                {you && !youWon && you !== runnerUp && (
                    <div
                        className="podium-col"
                        style={{
                            background: "var(--lavender)",
                            minHeight: 112,
                        }}
                    >
                        <Avatar name={you.name} address={you.address} />
                        <span className="podium-name">{you.name}</span>
                        <span className="caption caption--ink">
                            #{sorted.indexOf(you) + 1} ·{" "}
                            {you.steps.toLocaleString()} {copy.unit}
                        </span>
                        <span className="podium-amt">
                            {formatMon(you.payout)} MON
                        </span>
                    </div>
                )}
            </div>

            {statusBlock}

            <button className="pill-btn pill-btn--outline" onClick={runItBack}>
                Run it back
            </button>
        </>
    );
}
