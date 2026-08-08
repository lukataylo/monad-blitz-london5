import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, formatMon } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";
import type { Challenge } from "../lib/types";

const AUTO_SYNC_MS = 15_000;
const CHALLENGE_DAYS = 7;

function useNow(): number {
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
    useEffect(() => {
        const t = setInterval(
            () => setNow(Math.floor(Date.now() / 1000)),
            1000
        );
        return () => clearInterval(t);
    }, []);
    return now;
}

function formatTimeLeft(secs: number): string {
    if (secs <= 0) return "Time's up";
    if (secs >= 86400) {
        const d = Math.floor(secs / 86400);
        const h = Math.floor((secs % 86400) / 3600);
        return `${d}d ${h}h left`;
    }
    if (secs >= 3600) {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return `${h}h ${m}m left`;
    }
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function StepControls({ challenge }: { challenge: Challenge }) {
    const { submitSteps, txPending, demoMode } = useChallengeContext();
    const you = challenge.participants.find((p) => p.isYou);

    const [steps, setSteps] = useState<number>(you?.steps ?? 0);
    const seeded = useRef(false);
    const lastSubmitted = useRef<number>(you?.steps ?? 0);
    const stepsRef = useRef(steps);
    stepsRef.current = steps;
    const pendingRef = useRef(txPending);
    pendingRef.current = txPending;

    // Seed the counter from chain state once it's known.
    useEffect(() => {
        if (!seeded.current && you != null) {
            seeded.current = true;
            setSteps(you.steps);
            lastSubmitted.current = you.steps;
        }
    }, [you]);

    const sync = async () => {
        const value = stepsRef.current;
        if (value === lastSubmitted.current || pendingRef.current) return;
        lastSubmitted.current = value;
        await submitSteps(value);
    };
    const syncRef = useRef(sync);
    syncRef.current = sync;

    // Auto-submit every 15s when the counter changed.
    useEffect(() => {
        const t = setInterval(() => syncRef.current(), AUTO_SYNC_MS);
        return () => clearInterval(t);
    }, []);

    const dirty = steps !== lastSubmitted.current;

    return (
        <div className="card">
            <div className="caption" style={{ marginBottom: 10 }}>
                Your steps · web counter
            </div>
            <input
                className="steps-input"
                inputMode="numeric"
                value={String(steps)}
                onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^0-9]/g, ""));
                    setSteps(Number.isNaN(n) ? 0 : n);
                }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                    className="chip-btn"
                    onClick={() => setSteps((s) => s + 100)}
                >
                    +100
                </button>
                <button
                    className="chip-btn"
                    onClick={() => setSteps((s) => s + 1000)}
                >
                    +1000
                </button>
                <button
                    className="chip-btn"
                    style={{ marginLeft: "auto" }}
                    onClick={sync}
                    disabled={txPending || !dirty}
                >
                    {txPending ? "Syncing…" : "Sync now"}
                </button>
            </div>
            <div className="caption" style={{ marginTop: 10 }}>
                {demoMode
                    ? "Demo mode — steps stay local"
                    : dirty
                      ? "Auto-syncs on-chain every 15s"
                      : "Synced on-chain"}
            </div>
        </div>
    );
}

export function LeaderboardView() {
    const { challenge, settle, txPending } = useChallengeContext();
    const now = useNow();

    const sorted = useMemo(
        () =>
            challenge
                ? [...challenge.participants].sort((a, b) => b.steps - a.steps)
                : [],
        [challenge]
    );

    if (!challenge) {
        return (
            <div className="card" style={{ textAlign: "center" }}>
                <div className="caption">Loading challenge…</div>
            </div>
        );
    }

    const timeLeft = challenge.endTime - now;
    const daysLeft = Math.max(0, Math.ceil(timeLeft / 86400));
    const dayN = Math.min(
        CHALLENGE_DAYS,
        Math.max(1, CHALLENGE_DAYS - daysLeft + 1)
    );
    const maxSteps = Math.max(1, ...sorted.map((p) => p.steps));
    const ended = timeLeft <= 0;

    return (
        <>
            {/* countdown header */}
            <div style={{ textAlign: "center", paddingTop: 4 }}>
                <div className="caption">
                    Day {dayN} of {CHALLENGE_DAYS}
                </div>
                <div
                    style={{
                        fontSize: 26,
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        marginTop: 2,
                    }}
                >
                    {formatTimeLeft(timeLeft)}
                </div>
            </div>

            <h1 className="title-heavy">
                Who's <span className="highlight-lime">walking</span> the walk?
            </h1>

            <div className="pot-pill">
                Shared pot · {formatMon(challenge.pot)} MON
            </div>

            {/* ranked rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sorted.map((p, i) => {
                    const bg =
                        i === 0
                            ? "var(--lime)"
                            : p.isYou
                              ? "var(--lavender)"
                              : undefined;
                    return (
                        <div
                            key={p.address}
                            className="row-card"
                            style={bg ? { background: bg } : undefined}
                        >
                            <span
                                className="rank"
                                style={
                                    bg ? { color: "var(--ink)" } : undefined
                                }
                            >
                                {i + 1}
                            </span>
                            <Avatar name={p.name} address={p.address} />
                            <div className="row-main">
                                <div className="row-name">{p.name}</div>
                                <div className="progress-track">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.round((p.steps / maxSteps) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>
                            <span className="row-steps">
                                {p.steps.toLocaleString()}
                            </span>
                        </div>
                    );
                })}
            </div>

            <StepControls challenge={challenge} />

            {ended && !challenge.settled && (
                <button
                    className="pill-btn"
                    onClick={settle}
                    disabled={txPending}
                >
                    {txPending ? "Settling…" : "Settle challenge"}
                </button>
            )}
        </>
    );
}
