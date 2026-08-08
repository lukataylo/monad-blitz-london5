import { useMemo } from "react";
import { Avatar, formatMon } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";

const CONFETTI_COLORS = ["#D9E856", "#C8BDF4", "#F6C8D8", "#E8B84B", "#111111"];
const CONFETTI_COUNT = 22;

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

export function ResultsView() {
    const { challenge, claim, txPending, setActiveChallengeId } =
        useChallengeContext();

    const sorted = useMemo(
        () =>
            challenge
                ? [...challenge.participants].sort((a, b) => b.steps - a.steps)
                : [],
        [challenge]
    );

    if (!challenge || sorted.length === 0) {
        return (
            <div className="card" style={{ textAlign: "center" }}>
                <div className="caption">No results yet</div>
            </div>
        );
    }

    const winner = sorted[0];
    const runnerUp = sorted[1] ?? null;
    const you = sorted.find((p) => p.isYou) ?? null;
    const youWon = winner.isYou;

    // Payouts come from chain after settle; fall back to the 70/30 split for display.
    const winnerAmt =
        winner.payout > 0n ? winner.payout : (challenge.pot * 70n) / 100n;
    const runnerUpAmt =
        runnerUp == null
            ? 0n
            : runnerUp.payout > 0n
              ? runnerUp.payout
              : (challenge.pot * 30n) / 100n;
    const yourPayout = you?.payout ?? 0n;

    const runItBack = () => setActiveChallengeId(null);

    return (
        <>
            <Confetti />

            <h1 className="title-heavy" style={{ paddingTop: 12 }}>
                {youWon ? (
                    <>
                        You walked.
                        <br />
                        You <span className="won-ellipse">won.</span>
                    </>
                ) : (
                    <>
                        You walked.
                        <br />
                        They <span className="won-ellipse">won.</span>
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
                            {you.steps.toLocaleString()}
                        </span>
                        <span className="podium-amt">
                            {formatMon(yourPayout)} MON
                        </span>
                    </div>
                )}
            </div>

            {yourPayout > 0n && (
                <button
                    className="pill-btn"
                    onClick={claim}
                    disabled={txPending}
                >
                    {txPending ? "Claiming…" : "Claim winnings →"}
                </button>
            )}
            <button className="pill-btn pill-btn--outline" onClick={runItBack}>
                Run it back
            </button>
        </>
    );
}
