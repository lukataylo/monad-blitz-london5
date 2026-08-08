import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Avatar, formatMon } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";
import { useMotionSteps } from "../hooks/useMotionSteps";
import {
    loadExerciseChoice,
    saveExerciseChoice,
    type StoredExercise,
} from "../lib/exerciseChoice";
import { getKindCopy } from "../lib/kindCopy";
import type { Challenge } from "../lib/types";

// Camera rep tracker only mounts for kind-1 challenges — keep it out of the
// main bundle (MediaPipe itself is a further dynamic import inside start()).
const ExerciseTracker = lazy(() =>
    import("../exercise").then((m) => ({ default: m.ExerciseTracker }))
);

// Auto-submit cadence: reps blitzes race in real time, steps can amble.
const AUTO_SYNC_STEPS_MS = 15_000;
const AUTO_SYNC_REPS_MS = 4_000; // push reps fast — event watchers relay them to every device
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

// One score card for both kinds: a live counter (`extra` — accelerometer
// steps for kind 0, camera reps for kind 1) ADDS onto the manual base, giving
// a single monotonic total that auto-syncs on-chain.
function ScoreCard({
    challenge,
    extra,
    unit,
    motionUi,
    collapseManual = false,
}: {
    challenge: Challenge;
    extra: number;
    unit: "steps" | "reps";
    motionUi?: React.ReactNode;
    /** kind 1: camera is the input — tuck manual entry behind a disclosure */
    collapseManual?: boolean;
}) {
    const { submitSteps, txPending, demoMode } = useChallengeContext();
    const you = challenge.participants.find((p) => p.isYou);

    const [base, setBase] = useState<number>(you?.steps ?? 0);
    const [manualOpen, setManualOpen] = useState(!collapseManual);
    const total = base + extra;

    const seeded = useRef(false);
    const lastSubmitted = useRef<number>(you?.steps ?? 0);
    const totalRef = useRef(total);
    totalRef.current = total;
    const extraRef = useRef(extra);
    extraRef.current = extra;
    const pendingRef = useRef(txPending);
    pendingRef.current = txPending;

    // Seed the counter from chain state once it's known.
    useEffect(() => {
        if (!seeded.current && you != null) {
            seeded.current = true;
            setBase(Math.max(0, you.steps - extraRef.current));
            lastSubmitted.current = you.steps;
        }
    }, [you]);

    const sync = async () => {
        const value = totalRef.current;
        // Guard against overlapping submits: skip while a tx is pending.
        if (value === lastSubmitted.current || pendingRef.current) return;
        lastSubmitted.current = value;
        await submitSteps(value);
    };
    const syncRef = useRef(sync);
    syncRef.current = sync;

    // Auto-submit when the counter changed — every 6s for reps (kind 1) so
    // the shared board moves in near-real-time, every 15s for steps.
    const autoSyncMs =
        challenge.kind === 1 ? AUTO_SYNC_REPS_MS : AUTO_SYNC_STEPS_MS;
    useEffect(() => {
        const t = setInterval(() => syncRef.current(), autoSyncMs);
        return () => clearInterval(t);
    }, [autoSyncMs]);

    const dirty = total !== lastSubmitted.current;

    return (
        <div className="card">
            <div className="caption" style={{ marginBottom: 10 }}>
                Your {unit}
            </div>
            {manualOpen ? (
                <input
                    className="steps-input"
                    inputMode="numeric"
                    value={String(total)}
                    onChange={(e) => {
                        const n = Number(
                            e.target.value.replace(/[^0-9]/g, "")
                        );
                        // Editing sets the total; the live counter keeps adding on top.
                        setBase(
                            Math.max(0, (Number.isNaN(n) ? 0 : n) - extra)
                        );
                    }}
                />
            ) : (
                <div className="score-big">
                    {total.toLocaleString()}
                    <span className="score-big-unit">{unit}</span>
                </div>
            )}

            {motionUi}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
                    ? `Contract not deployed — ${unit} stay local`
                    : dirty
                      ? `Auto-syncs on-chain every ${autoSyncMs / 1000}s`
                      : "Synced on-chain"}
            </div>

            {/* demo fallback, visually secondary — kind 1 keeps it (and the
                editable total) tucked behind a "manual entry" disclosure */}
            {manualOpen ? (
                <div className="demo-controls">
                    <div className="caption" style={{ marginBottom: 8 }}>
                        {collapseManual ? "Manual entry" : "Demo controls"}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className="chip-btn chip-btn--ghost"
                            onClick={() => setBase((s) => s + 100)}
                        >
                            +100
                        </button>
                        <button
                            className="chip-btn chip-btn--ghost"
                            onClick={() => setBase((s) => s + 1000)}
                        >
                            +1000
                        </button>
                        {collapseManual && (
                            <button
                                className="text-btn"
                                style={{ marginLeft: "auto" }}
                                onClick={() => setManualOpen(false)}
                            >
                                Hide
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <button
                    className="text-btn"
                    style={{ width: "100%", marginTop: 10 }}
                    onClick={() => setManualOpen(true)}
                >
                    Manual entry
                </button>
            )}
        </div>
    );
}

/** Kind 0 — accelerometer steps feed the total (motion hook lives here only). */
function StepControls({ challenge }: { challenge: Challenge }) {
    const {
        state: motionState,
        steps: motionSteps,
        requestPermission,
    } = useMotionSteps();

    return (
        <ScoreCard
            challenge={challenge}
            extra={motionSteps}
            unit="steps"
            motionUi={
                <>
                    {motionState === "prompt" && (
                        <button
                            className="pill-btn"
                            style={{ marginTop: 10 }}
                            onClick={requestPermission}
                        >
                            Enable motion tracking 👟
                        </button>
                    )}
                    {motionState === "granted" && (
                        <div className="motion-live">
                            <span className="dot dot--live" />
                            Walked with your phone:{" "}
                            {motionSteps.toLocaleString()} steps
                        </div>
                    )}
                    {motionState === "denied" && (
                        <div className="caption" style={{ marginTop: 10 }}>
                            Motion access denied — use the controls below
                        </div>
                    )}
                </>
            }
        />
    );
}

/** Kind 1 — camera reps (accumulated in LeaderboardView) feed the total. */
function RepControls({
    challenge,
    trackerReps,
}: {
    challenge: Challenge;
    trackerReps: number;
}) {
    return (
        <ScoreCard
            challenge={challenge}
            extra={trackerReps}
            unit="reps"
            collapseManual
        />
    );
}

export function LeaderboardView({
    onBackToJoin,
}: {
    onBackToJoin?: () => void;
}) {
    const { challenge, activeChallengeId, settle, txPending } =
        useChallengeContext();
    const now = useNow();
    const [inviteCopied, setInviteCopied] = useState(false);

    // ---- kind-1 camera tracker state ----
    // The exercise itself isn't on-chain (only kind is), so it's a local
    // choice: creator's pick from the wizard, "squat" default for joiners.
    const [exercise, setExercise] = useState<StoredExercise>("squat");
    useEffect(() => {
        if (activeChallengeId != null) {
            setExercise(loadExerciseChoice(activeChallengeId));
        }
    }, [activeChallengeId]);
    const pickExercise = (ex: StoredExercise) => {
        setExercise(ex);
        if (activeChallengeId != null) {
            saveExerciseChoice(activeChallengeId, ex);
        }
    };

    // Tracker sessions reset to 0 when the camera restarts — accumulate
    // positive deltas so the contribution to the score stays monotonic.
    const [trackerReps, setTrackerReps] = useState(0);
    const lastSessionReps = useRef(0);
    const onRepsChange = useCallback((n: number) => {
        const delta = n - lastSessionReps.current;
        lastSessionReps.current = n;
        if (delta > 0) setTrackerReps((t) => t + delta);
    }, []);

    const sorted = useMemo(
        () =>
            challenge
                ? [...challenge.participants].sort((a, b) => b.steps - a.steps)
                : [],
        [challenge]
    );

    // "Live" pulse: rows whose score moved since the previous poll get a
    // pulsing dot (keyed by timestamp so the 2s fade restarts on each change).
    const prevScores = useRef<Map<string, number>>(new Map());
    const [pulses, setPulses] = useState<Record<string, number>>({});
    useEffect(() => {
        if (!challenge) return;
        const next = new Map<string, number>();
        const changed: string[] = [];
        for (const p of challenge.participants) {
            const prev = prevScores.current.get(p.address);
            next.set(p.address, p.steps);
            if (prev != null && p.steps !== prev) changed.push(p.address);
        }
        prevScores.current = next;
        if (changed.length > 0) {
            const now = Date.now();
            setPulses((cur) => {
                const merged = { ...cur };
                for (const a of changed) merged[a] = now;
                return merged;
            });
        }
    }, [challenge]);

    const copyInvite = () => {
        if (challenge == null) return;
        const link = `${window.location.origin}?c=${challenge.id}`;
        navigator.clipboard?.writeText(link).catch(() => {});
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 1500);
    };

    // No challenge at all — point back to Join instead of pretending.
    if (activeChallengeId == null || !challenge) {
        const loading = activeChallengeId != null;
        return (
            <>
                <h1 className="title-heavy">
                    No leaderboard{" "}
                    <span className="highlight-lime">yet</span>
                </h1>
                <div className="card" style={{ textAlign: "center" }}>
                    <div className="caption" style={{ marginBottom: 14 }}>
                        {loading
                            ? "Loading challenge from chain…"
                            : "Join or start a challenge to get moving"}
                    </div>
                    {!loading && onBackToJoin && (
                        <button className="pill-btn" onClick={onBackToJoin}>
                            Go to Join →
                        </button>
                    )}
                </div>
            </>
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
    const isReps = challenge.kind === 1;
    // Copy tracks the live toggle so the headline flips with the exercise.
    const copy = getKindCopy(challenge.kind, exercise);

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
                {copy.boardTitle.pre}
                <span
                    className={
                        isReps ? "highlight-pink" : "highlight-lime"
                    }
                >
                    {copy.boardTitle.highlight}
                </span>
                {copy.boardTitle.post}
            </h1>

            <div className="pot-pill">
                Shared pot · {formatMon(challenge.pot)} MON
            </div>

            {/* kind 1: camera rep tracker above the standings */}
            {isReps && !ended && (
                <>
                    <div className="exercise-toggle">
                        <button
                            className={`seg-btn${
                                exercise === "squat" ? " seg-btn--active" : ""
                            }`}
                            onClick={() => pickExercise("squat")}
                        >
                            🏋️ Squats
                        </button>
                        <button
                            className={`seg-btn${
                                exercise === "jumping_jack"
                                    ? " seg-btn--active"
                                    : ""
                            }`}
                            onClick={() => pickExercise("jumping_jack")}
                        >
                            ⭐ Jumping jacks
                        </button>
                    </div>
                    <Suspense
                        fallback={
                            <div
                                className="card"
                                style={{ textAlign: "center" }}
                            >
                                <div className="caption">
                                    Loading camera tracker…
                                </div>
                            </div>
                        }
                    >
                        <ExerciseTracker
                            exercise={exercise}
                            onRepsChange={onRepsChange}
                            hero
                            offCaption={copy.cameraCaption}
                        />
                    </Suspense>
                </>
            )}

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
                            {pulses[p.address] != null && (
                                <span
                                    key={pulses[p.address]}
                                    className="row-live-dot"
                                    aria-hidden
                                />
                            )}
                            <span className="row-steps">
                                {p.steps.toLocaleString()}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* only walker so far — nudge to share the invite link */}
            {challenge.participants.length <= 1 && (
                <div
                    className="card card--lavender"
                    style={{ textAlign: "center" }}
                >
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                        Waiting for your crew
                    </div>
                    <div
                        className="caption caption--ink"
                        style={{ margin: "6px 0 14px" }}
                    >
                        Share the invite link to fill the board
                    </div>
                    <button className="chip-btn" onClick={copyInvite}>
                        {inviteCopied ? "Copied!" : "Copy invite link"}
                    </button>
                </div>
            )}

            {isReps ? (
                <RepControls
                    challenge={challenge}
                    trackerReps={trackerReps}
                />
            ) : (
                <StepControls challenge={challenge} />
            )}

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
