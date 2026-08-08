import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ChallengeSummaryRow } from "../components/ChallengeList";
import { Avatar, formatMon } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";
import { useMotionSteps } from "../hooks/useMotionSteps";
import { useMyChallenges } from "../hooks/useMyChallenges";
import {
    resolveExercise,
    type StoredExercise,
} from "../lib/exerciseChoice";
import { getKindCopy } from "../lib/kindCopy";
import type { Challenge, Participant } from "../lib/types";

// Camera rep tracker only mounts for kind-1 challenges — keep it out of the
// main bundle (MediaPipe itself is a further dynamic import inside start()).
const ExerciseTracker = lazy(() =>
    import("../exercise").then((m) => ({ default: m.ExerciseTracker }))
);

// Auto-submit cadence: reps blitzes race in real time, steps can amble.
const AUTO_SYNC_STEPS_MS = 15_000;
const AUTO_SYNC_REPS_MS = 8_000; // gas economy: each submit costs the gas LIMIT on Monad
const AUTO_SYNC_REPS_SHORT_MS = 5_000; // 1–3 min showdowns: tighter race feel

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
    onTotalChange,
}: {
    challenge: Challenge;
    extra: number;
    unit: "steps" | "reps";
    motionUi?: React.ReactNode;
    /** kind 1: camera is the input — tuck manual entry behind a disclosure */
    collapseManual?: boolean;
    /** live local total (base + camera), for the race strip's "You" chip */
    onTotalChange?: (total: number) => void;
}) {
    const { submitSteps, txPending, demoMode } = useChallengeContext();
    const you = challenge.participants.find((p) => p.isYou);

    const [base, setBase] = useState<number>(you?.steps ?? 0);
    // Steps: editable total + demo controls. Reps: read-only — camera only.
    const manualOpen = !collapseManual;
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

    const ended = Date.now() / 1000 >= challenge.endTime;

    // Surface the live local total (your reps count instantly, no chain lag)
    // so the race strip can pit it against rivals in real time.
    useEffect(() => {
        onTotalChange?.(total);
    }, [total, onTotalChange]);

    const sync = async () => {
        const value = totalRef.current;
        // Guard against overlapping submits: skip while a tx is pending.
        if (value === lastSubmitted.current || pendingRef.current) return;
        // Only mark as submitted when the tx actually landed — otherwise a
        // transient RPC failure would show "Synced on-chain" while the final
        // score never reached the contract (and disable the retry button).
        const landed = await submitSteps(value);
        if (landed) lastSubmitted.current = value;
    };
    const syncRef = useRef(sync);
    syncRef.current = sync;

    // Auto-submit when the counter changed — reps sync tighter than steps so
    // the shared board moves in near-real-time, and short rounds (1–3 min
    // showdowns) tighten further: 8s gaps would eat a fifth of the race.
    // Stops dead at the deadline: the contract reverts "ended" after endTime,
    // and Monad charges the full gas limit for every doomed tx.
    const shortRace =
        challenge.kind === 1 &&
        challenge.endTime - Date.now() / 1000 <= 4 * 60;
    const autoSyncMs =
        challenge.kind === 1
            ? shortRace
                ? AUTO_SYNC_REPS_SHORT_MS
                : AUTO_SYNC_REPS_MS
            : AUTO_SYNC_STEPS_MS;
    useEffect(() => {
        if (ended) return;
        const t = setInterval(() => {
            if (Date.now() / 1000 >= challenge.endTime) return;
            syncRef.current();
        }, autoSyncMs);
        return () => clearInterval(t);
    }, [autoSyncMs, ended, challenge.endTime]);

    const dirty = total !== lastSubmitted.current && !ended;

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
                    : ended
                      ? "Challenge ended — final score locked"
                      : dirty
                        ? `Auto-syncs on-chain every ${autoSyncMs / 1000}s`
                        : "Synced on-chain"}
            </div>

            {/* demo fallback for STEP challenges only. Rep challenges get no
                manual entry at all — the camera is the input, and a +1000
                button in a staked game hands any judge the obvious exploit. */}
            {!collapseManual && manualOpen && (
                <div className="demo-controls">
                    <div className="caption" style={{ marginBottom: 8 }}>
                        Demo controls
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
                    </div>
                </div>
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

// ---- race strip (kind 1) ----
// Compact live-rivals row rendered directly under the camera stage so you
// can watch the race mid-set without scrolling down to the standings.
const RACE_STRIP_MAX = 4;

function firstNameOf(name: string): string {
    return name.replace(/\s*\(you\)\s*$/i, "").split(/\s+/)[0] || "?";
}

function RaceStrip({
    challenge,
    yourLive,
}: {
    challenge: Challenge;
    /** live local rep total — moves instantly with the camera, no chain lag */
    yourLive?: number;
}) {
    const you = challenge.participants.find((p) => p.isYou) ?? null;
    // Your chip counts every rep the moment the camera sees it; the on-chain
    // score is the floor (covers reloads, where the local session starts at 0).
    const yourCount = Math.max(yourLive ?? 0, you?.steps ?? 0);

    // Flash your own chip on every rep, same as rivals get on poll bumps.
    const prevYour = useRef(yourCount);
    const [yourBump, setYourBump] = useState<{
        ts: number;
        delta: number;
    } | null>(null);
    useEffect(() => {
        if (yourCount > prevYour.current) {
            setYourBump({
                ts: Date.now(),
                delta: yourCount - prevYour.current,
            });
        }
        prevYour.current = yourCount;
    }, [yourCount]);
    const rivals = useMemo(
        () =>
            challenge.participants
                .filter((p) => !p.isYou)
                .sort((a, b) => b.steps - a.steps),
        [challenge]
    );

    // Per-rival delta between polls: a chip whose count went up flashes lime
    // and floats a "+N". Keyed by timestamp so the animation restarts on
    // every bump even if a previous one is still fading.
    const prevCounts = useRef<Map<string, number>>(new Map());
    const [bumps, setBumps] = useState<
        Record<string, { ts: number; delta: number }>
    >({});
    useEffect(() => {
        const next = new Map<string, number>();
        const changed: Record<string, { ts: number; delta: number }> = {};
        for (const p of challenge.participants) {
            if (p.isYou) continue;
            const prev = prevCounts.current.get(p.address);
            next.set(p.address, p.steps);
            if (prev != null && p.steps > prev) {
                changed[p.address] = {
                    ts: Date.now(),
                    delta: p.steps - prev,
                };
            }
        }
        prevCounts.current = next;
        if (Object.keys(changed).length > 0) {
            setBumps((cur) => ({ ...cur, ...changed }));
        }
    }, [challenge]);

    if (rivals.length === 0) return null;

    // The rival closest to your LIVE score gets an "ahead/behind" caption.
    let nearest: Participant | null = null;
    if (you != null) {
        nearest = rivals.reduce((best, p) =>
            Math.abs(p.steps - yourCount) < Math.abs(best.steps - yourCount)
                ? p
                : best
        );
    }

    const shown = rivals.slice(0, RACE_STRIP_MAX);
    const hidden = rivals.length - shown.length;

    return (
        <div className="race-strip" aria-label="Live race">
            {you != null && (
                <div className="race-chip race-chip--you">
                    {yourBump != null && (
                        <span
                            key={`flash-you-${yourBump.ts}`}
                            className="race-chip-flash"
                            aria-hidden
                        />
                    )}
                    <Avatar
                        name={you.name}
                        address={you.address}
                        style={{
                            position: "relative",
                            width: 28,
                            height: 28,
                            fontSize: 12,
                            flexShrink: 0,
                        }}
                    />
                    <span className="race-chip-main">
                        <span className="race-chip-name">You</span>
                        <span className="race-chip-count">
                            {yourCount.toLocaleString()}
                        </span>
                    </span>
                    {yourBump != null && (
                        <span
                            key={`plus-you-${yourBump.ts}`}
                            className="race-chip-plus"
                            aria-hidden
                        >
                            +{yourBump.delta.toLocaleString()}
                        </span>
                    )}
                </div>
            )}
            {shown.map((p) => {
                const bump = bumps[p.address];
                const gap =
                    you != null && p === nearest ? p.steps - yourCount : null;
                return (
                    <div key={p.address} className="race-chip">
                        {bump != null && (
                            <span
                                key={`flash-${bump.ts}`}
                                className="race-chip-flash"
                                aria-hidden
                            />
                        )}
                        <Avatar
                            name={p.name}
                            address={p.address}
                            style={{
                                position: "relative",
                                width: 28,
                                height: 28,
                                fontSize: 12,
                                flexShrink: 0,
                            }}
                        />
                        <span className="race-chip-main">
                            <span className="race-chip-name">
                                {firstNameOf(p.name)}
                            </span>
                            <span className="race-chip-count">
                                {p.steps.toLocaleString()}
                            </span>
                            {gap != null && (
                                <span className="race-chip-gap">
                                    ·{" "}
                                    {gap === 0
                                        ? "tied with you"
                                        : gap > 0
                                          ? `ahead by ${gap.toLocaleString()}`
                                          : `behind by ${(-gap).toLocaleString()}`}
                                </span>
                            )}
                        </span>
                        {bump != null && (
                            <span
                                key={`plus-${bump.ts}`}
                                className="race-chip-plus"
                                aria-hidden
                            >
                                +{bump.delta.toLocaleString()}
                            </span>
                        )}
                    </div>
                );
            })}
            {hidden > 0 && (
                <div className="race-chip race-chip--more">
                    +{hidden} more
                </div>
            )}
        </div>
    );
}

/** Kind 1 — camera reps (accumulated in LeaderboardView) feed the total. */
function RepControls({
    challenge,
    trackerReps,
    onTotalChange,
}: {
    challenge: Challenge;
    trackerReps: number;
    onTotalChange?: (total: number) => void;
}) {
    return (
        <ScoreCard
            challenge={challenge}
            extra={trackerReps}
            unit="reps"
            collapseManual
            onTotalChange={onTotalChange}
        />
    );
}

// ---- podium ----
// Top three on pillars, tallest in the middle. Rendered in visual order
// (2nd, 1st, 3rd) rather than rank order so the winner sits centre.
const PODIUM_ORDER = [1, 0, 2] as const;
const PODIUM_MEDAL = ["🥇", "🥈", "🥉"] as const;

function Podium({
    top,
    isReps,
    unit,
}: {
    top: Participant[];
    isReps: boolean;
    unit: "steps" | "reps";
}) {
    return (
        <div className={`podium ${isReps ? "podium--pink" : "podium--lime"}`}>
            <div className="podium-stage">
                {PODIUM_ORDER.map((rank) => {
                    const p = top[rank];
                    // 2 players: no third pillar. Keep the slot empty so the
                    // winner stays centred instead of drifting left.
                    if (!p) {
                        return (
                            <div
                                key={`empty-${rank}`}
                                className="podium-slot podium-slot--empty"
                                aria-hidden
                            />
                        );
                    }
                    return (
                        <div
                            key={p.address}
                            className={`podium-slot podium-slot--${rank + 1}`}
                        >
                            <div className="podium-figure">
                                <Avatar
                                    name={p.name}
                                    address={p.address}
                                    style={{
                                        width: rank === 0 ? 56 : 44,
                                        height: rank === 0 ? 56 : 44,
                                        fontSize: rank === 0 ? 20 : 16,
                                    }}
                                />
                                {/* medal on the winner only — for 2nd and 3rd
                                    the pillar height and position already say
                                    it, and a badge each just adds clutter */}
                                {rank === 0 && (
                                    <span className="podium-medal" aria-hidden>
                                        {PODIUM_MEDAL[0]}
                                    </span>
                                )}
                            </div>
                            <div className="podium-pillar">
                                <span className="podium-name">
                                    {firstNameOf(p.name)}
                                </span>
                                <span className="podium-score">
                                    {p.steps.toLocaleString()}
                                </span>
                                <span className="podium-unit">{unit}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function LeaderboardView({
    onBackToJoin,
}: {
    onBackToJoin?: () => void;
}) {
    const {
        challenge,
        activeChallengeId,
        settle,
        txPending,
        setActiveChallengeId,
    } = useChallengeContext();
    const now = useNow();

    // All challenges this device is in: other running ones become switcher
    // chips, finished ones the history list.
    const { summaries } = useMyChallenges();
    const otherOngoing = summaries.filter(
        (s) =>
            s.youIn &&
            !s.settled &&
            s.endTime > now &&
            s.id !== activeChallengeId
    );
    const pastChallenges = summaries.filter(
        (s) => s.youIn && (s.settled || s.endTime <= now)
    );
    const [inviteCopied, setInviteCopied] = useState(false);

    // ---- kind-1 camera exercise ----
    // The exercise itself isn't on-chain (only kind is). No mid-challenge
    // switching: the creator's stored wizard pick wins, and joiners without
    // one infer it from the on-chain title (see resolveExercise).
    const exercise: StoredExercise = useMemo(
        () =>
            challenge != null && challenge.kind === 1
                ? resolveExercise(challenge.id, challenge.title)
                : "squat",
        [challenge]
    );

    // Warm the camera stack the moment a rep challenge is on screen: lazy
    // chunk + MediaPipe bundle + wasm + 5MB model all enter the HTTP cache
    // so "Enable camera" starts instantly instead of downloading mid-demo.
    useEffect(() => {
        if (challenge?.kind === 1) {
            void import("../exercise").then((m) => m.preloadPose());
        }
    }, [challenge?.kind]);

    // Tracker sessions reset to 0 when the camera restarts — accumulate
    // positive deltas so the contribution to the score stays monotonic.
    const [trackerReps, setTrackerReps] = useState(0);
    const lastSessionReps = useRef(0);
    const onRepsChange = useCallback((n: number) => {
        const delta = n - lastSessionReps.current;
        lastSessionReps.current = n;
        if (delta > 0) setTrackerReps((t) => t + delta);
    }, []);
    // Your live local total (chain base + camera), fed by the ScoreCard so
    // the race strip's "You" chip moves the instant a rep is counted.
    const [liveTotal, setLiveTotal] = useState(0);

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
                {otherOngoing.length > 0 && (
                    <div>
                        <div
                            className="caption"
                            style={{ margin: "6px 0 8px" }}
                        >
                            Ongoing challenges
                        </div>
                        <div className="chal-stack">
                            {otherOngoing.map((s) => (
                                <ChallengeSummaryRow
                                    key={s.id}
                                    summary={s}
                                    onOpen={(id) => setActiveChallengeId(id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {pastChallenges.length > 0 && (
                    <div>
                        <div
                            className="caption"
                            style={{ margin: "6px 0 8px" }}
                        >
                            Past challenges
                        </div>
                        <div className="chal-stack">
                            {pastChallenges.map((s) => (
                                <ChallengeSummaryRow
                                    key={s.id}
                                    summary={s}
                                    history
                                    onOpen={(id) => setActiveChallengeId(id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    }

    const timeLeft = challenge.endTime - now;
    const maxSteps = Math.max(1, ...sorted.map((p) => p.steps));
    const ended = timeLeft <= 0;
    const isReps = challenge.kind === 1;
    // Copy tracks the resolved exercise so the headline matches the sport.
    const copy = getKindCopy(challenge.kind, exercise);

    return (
        <>
            {/* switcher: your other live challenges, one tap away */}
            {otherOngoing.length > 0 && (
                <div className="chal-switch" aria-label="Your challenges">
                    <button
                        type="button"
                        className="chal-switch-chip chal-switch-chip--active"
                    >
                        {challenge.kind === 1 ? "🏋️" : "🚶"}{" "}
                        {challenge.title.trim() || `#${challenge.id}`}
                    </button>
                    {otherOngoing.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className="chal-switch-chip"
                            onClick={() => setActiveChallengeId(s.id)}
                        >
                            {s.kind === 1 ? "🏋️" : "🚶"}{" "}
                            {s.title.trim() || `#${s.id}`}
                        </button>
                    ))}
                </div>
            )}

            {/* header: challenge identity + the two facts that change —
                what it is, and how long is left. Durations range from a
                15-min blitz to a 30-day marathon and total duration isn't
                on-chain, so time left is the only honest progress figure. */}
            <div className="board-head">
                <span className="board-chip board-chip--title">
                    <span aria-hidden>{isReps ? "🏋️" : "🚶"}</span>
                    {challenge.title.trim() || `Challenge #${challenge.id}`}
                </span>
                <span
                    className={`board-chip${
                        timeLeft <= 0 ? " board-chip--over" : ""
                    }`}
                >
                    {formatTimeLeft(timeLeft)}
                </span>
            </div>

            {/* podium — only meaningful once there's someone to beat */}
            {sorted.length >= 2 && (
                <Podium
                    top={sorted.slice(0, 3)}
                    isReps={isReps}
                    unit={copy.unit}
                />
            )}

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

            {/* kind 1: camera rep tracker above the standings — the exercise
                is fixed per challenge (creator's pick / title inference) */}
            {isReps && !ended && (
                <>
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
                    {/* live race, visible without scrolling to standings —
                        your chip counts camera reps instantly, rivals land
                        via the 2s StepsSubmitted watcher */}
                    <RaceStrip challenge={challenge} yourLive={liveTotal} />
                </>
            )}

            {/* standings — rank, name and score on one line with the bar
                spanning underneath, so bar lengths compare across rows */}
            <div className="board-list">
                <div className="caption board-list-head">Standings</div>
                {sorted.map((p, i) => (
                    <div
                        key={p.address}
                        className={`board-row${
                            p.isYou ? " board-row--you" : ""
                        }`}
                    >
                        <div className="board-row-top">
                            <span className="board-rank">{i + 1}</span>
                            <Avatar
                                name={p.name}
                                address={p.address}
                                style={{ width: 28, height: 28, fontSize: 12 }}
                            />
                            <span className="board-name">{p.name}</span>
                            {pulses[p.address] != null && (
                                <span
                                    key={pulses[p.address]}
                                    className="row-live-dot"
                                    aria-hidden
                                />
                            )}
                            <span className="board-score">
                                {p.steps.toLocaleString()}
                                <span className="board-score-unit">
                                    {copy.unit}
                                </span>
                            </span>
                        </div>
                        <div className="board-track">
                            <div
                                className={`board-fill board-fill--${
                                    i === 0 ? "gold" : i === 1 ? "two" : "rest"
                                }`}
                                style={{
                                    width: `${Math.round((p.steps / maxSteps) * 100)}%`,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* payout footer — what the board is actually playing for */}
            <div className="board-prize">
                <span className="board-prize-medal" aria-hidden>
                    🏆
                </span>
                <span>
                    Winner takes <strong>70%</strong> of{" "}
                    {formatMon(challenge.pot)} MON · runner-up{" "}
                    <strong>30%</strong>
                </span>
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
                    onTotalChange={setLiveTotal}
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

            {/* history — finished challenges; tap → its results screen */}
            {pastChallenges.length > 0 && (
                <div>
                    <div className="caption" style={{ margin: "6px 0 8px" }}>
                        Past challenges
                    </div>
                    <div className="chal-stack">
                        {pastChallenges.map((s) => (
                            <ChallengeSummaryRow
                                key={s.id}
                                summary={s}
                                history
                                onOpen={(id) => setActiveChallengeId(id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
