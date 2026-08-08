import { useMemo, useState } from "react";
import { parseEther } from "viem";
import { useChallengeContext } from "../context/ChallengeContext";
import {
    saveExerciseChoice,
    type StoredExercise,
} from "../lib/exerciseChoice";
import { loadProfile } from "../lib/profile";

// Start-a-challenge flow: a 5-step wizard (name → kind → pace → stakes →
// review) ending in the "Challenge is live!" moment with the shareable
// invite link. Rendered at App level so it survives the auto-switch to the
// leaderboard after creation confirms.

const MIN_STAKE_MON = 0.001;
const MAX_TITLE_LENGTH = 64;

const TITLE_SUGGESTIONS = [
    "10K Club",
    "Step Wars",
    "Walk It Off",
    "Monday Miles",
] as const;

// What gets counted. On-chain the contract stores only kind (0 steps /
// 1 reps); the specific exercise for kind 1 is the creator's local choice,
// persisted per challenge id in localStorage (see lib/exerciseChoice.ts).
// Joiners on other devices default to "squat".
const KINDS = [
    {
        key: "steps",
        emoji: "🚶",
        name: "Steps",
        desc: "Walk it out — phone counts your steps",
        kind: 0,
        exercise: null,
    },
    {
        key: "squat",
        emoji: "🏋️",
        name: "Squats",
        desc: "Camera counts your squats",
        kind: 1,
        exercise: "squat",
    },
    {
        key: "jumping_jack",
        emoji: "⭐",
        name: "Jumping jacks",
        desc: "Camera counts your jacks",
        kind: 1,
        exercise: "jumping_jack",
    },
] as const;

type KindKey = (typeof KINDS)[number]["key"];

const PACES = [
    {
        key: "blitz",
        emoji: "⚡",
        name: "Blitz",
        durationLabel: "15 minutes",
        secs: 15 * 60,
        note: "Quick fire — great for testing",
    },
    {
        key: "sprint",
        emoji: "☀️",
        name: "Sprint",
        durationLabel: "1 day",
        secs: 86400,
        note: null,
    },
    {
        key: "classic",
        emoji: "📅",
        name: "Classic",
        durationLabel: "1 week",
        secs: 7 * 86400,
        note: null,
    },
    {
        key: "marathon",
        emoji: "🏔",
        name: "Marathon",
        durationLabel: "1 month",
        secs: 30 * 86400,
        note: null,
    },
] as const;

type PaceKey = (typeof PACES)[number]["key"];

const STAKE_PRESETS = ["0.1", "0.5", "1"] as const;

function formatEndDate(secsFromNow: number): string {
    const d = new Date(Date.now() + secsFromNow * 1000);
    const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${weekday} ${d.getDate()} ${month}, ${hh}:${mm}`;
}

function formatMonNumber(n: number): string {
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Squash raw viem/wallet errors into something a human can act on. */
function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("insufficient"))
        return "Not enough MON in your wallet to cover the stake + gas.";
    if (m.includes("user rejected") || m.includes("user denied"))
        return "Transaction rejected in your wallet.";
    return msg.length > 180 ? `${msg.slice(0, 180)}…` : msg;
}

export function CreateChallengeModal({ onClose }: { onClose: () => void }) {
    const { createChallenge, txPending, error } = useChallengeContext();

    const [step, setStep] = useState(1);
    const [title, setTitle] = useState("");
    const [kindKey, setKindKey] = useState<KindKey>("steps");
    const [paceKey, setPaceKey] = useState<PaceKey>("classic");
    const [stakeStr, setStakeStr] = useState("0.1");
    const [liveId, setLiveId] = useState<number | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);
    const [submitFailed, setSubmitFailed] = useState(false);

    const pace = PACES.find((p) => p.key === paceKey) ?? PACES[2];
    const kindDef = KINDS.find((k) => k.key === kindKey) ?? KINDS[0];
    const unit = kindDef.kind === 1 ? "reps" : "steps";

    const titleOk = title.trim() !== "";
    const stakeNum = Number(stakeStr);
    const stakeOk =
        stakeStr.trim() !== "" &&
        Number.isFinite(stakeNum) &&
        stakeNum >= MIN_STAKE_MON;

    const profileNameLabel = loadProfile()?.name.trim() || "—";

    const inviteLink = useMemo(
        () =>
            liveId != null ? `${window.location.origin}?c=${liveId}` : null,
        [liveId]
    );
    const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

    const create = async () => {
        if (!titleOk || !stakeOk || txPending) return;
        let stakeWei: bigint;
        try {
            stakeWei = parseEther(stakeStr.trim());
        } catch {
            return;
        }
        setSubmitFailed(false);
        const id = await createChallenge(
            stakeWei,
            pace.secs,
            title.trim().slice(0, MAX_TITLE_LENGTH),
            kindDef.kind
        );
        if (id != null) {
            // Remember which exercise the creator picked — the contract only
            // stores kind, so this stays local (joiners default to squats).
            if (kindDef.exercise != null) {
                saveExerciseChoice(id, kindDef.exercise as StoredExercise);
            }
            setLiveId(id);
        } else {
            setSubmitFailed(true);
        }
    };

    const copyInvite = () => {
        if (!inviteLink) return;
        navigator.clipboard?.writeText(inviteLink).catch(() => {});
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
    };

    const shareInvite = () => {
        if (!inviteLink || !canShare) return;
        navigator
            .share({
                title: `Walk The Walk — ${title.trim() || `${unit} challenge`}`,
                text: `Stake ${stakeStr} MON, most ${unit} wins. You in?`,
                url: inviteLink,
            })
            .catch(() => {});
    };

    // Backdrop / cancel: past step 1 (or with a typed title) ask before
    // throwing the setup away — inline, no browser confirm().
    const requestClose = () => {
        if (txPending) return;
        if (liveId != null || (step === 1 && !titleOk)) {
            onClose();
            return;
        }
        setConfirmingDiscard(true);
    };

    // ---- final stage: challenge is live ----
    if (liveId != null) {
        return (
            <div className="modal-overlay">
                <div className="modal-sheet">
                    <div className="caption">Challenge #{liveId}</div>
                    <div className="modal-title">Challenge is live! 🎉</div>
                    <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.7 }}>
                        Send this link to your crew — everyone who joins{" "}
                        <strong>{title.trim()}</strong> stakes {stakeStr} MON.
                    </div>
                    <div className="invite-big">{inviteLink}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className="chip-btn"
                            style={{ flex: 1 }}
                            onClick={copyInvite}
                        >
                            {linkCopied ? "Copied!" : "Copy"}
                        </button>
                        {canShare && (
                            <button
                                className="chip-btn"
                                style={{ flex: 1 }}
                                onClick={shareInvite}
                            >
                                Share
                            </button>
                        )}
                    </div>
                    <button className="pill-btn" onClick={onClose}>
                        Let's walk →
                    </button>
                </div>
            </div>
        );
    }

    // ---- wizard ----
    return (
        <div className="modal-overlay" onClick={requestClose}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                {/* header: back link + progress dots */}
                <div className="wiz-head">
                    {step > 1 ? (
                        <button
                            className="wiz-back"
                            onClick={() => setStep(step - 1)}
                            disabled={txPending}
                        >
                            ← Back
                        </button>
                    ) : (
                        <span className="caption">New challenge</span>
                    )}
                    <div
                        className="wiz-dots"
                        aria-label={`Step ${step} of 5`}
                    >
                        {[1, 2, 3, 4, 5].map((n) => (
                            <span
                                key={n}
                                className={`wiz-dot${
                                    n === step
                                        ? " wiz-dot--active"
                                        : n < step
                                          ? " wiz-dot--done"
                                          : ""
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {confirmingDiscard && (
                    <div className="discard-bar">
                        <span style={{ flex: 1 }}>Discard this challenge?</span>
                        <button
                            className="chip-btn"
                            style={{ height: 36, padding: "0 14px", fontSize: 13 }}
                            onClick={() => setConfirmingDiscard(false)}
                        >
                            Keep editing
                        </button>
                        <button
                            className="text-btn"
                            style={{ padding: "0 4px" }}
                            onClick={onClose}
                        >
                            Discard
                        </button>
                    </div>
                )}

                {/* STEP 1 — name */}
                {step === 1 && (
                    <div className="wiz-step" key="s1">
                        <div className="modal-title">Name your challenge</div>
                        <input
                            className="field-input"
                            placeholder="Office Step War"
                            maxLength={MAX_TITLE_LENGTH}
                            value={title}
                            autoFocus
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && titleOk) setStep(2);
                            }}
                        />
                        <div className="chips-row">
                            {TITLE_SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    className="suggest-chip"
                                    onClick={() => setTitle(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <button
                            className="pill-btn"
                            onClick={() => setStep(2)}
                            disabled={!titleOk}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP 2 — kind */}
                {step === 2 && (
                    <div className="wiz-step" key="s2">
                        <div className="modal-title">
                            What kind of challenge?
                        </div>
                        <div className="kind-stack">
                            {KINDS.map((k) => (
                                <button
                                    key={k.key}
                                    className={`pace-card kind-card${
                                        k.key === kindKey
                                            ? " pace-card--active"
                                            : ""
                                    }`}
                                    onClick={() => setKindKey(k.key)}
                                >
                                    <span className="pace-emoji">
                                        {k.emoji}
                                    </span>
                                    <span>
                                        <span className="pace-name">
                                            {k.name}
                                        </span>
                                        <span
                                            className="pace-dur"
                                            style={{ display: "block" }}
                                        >
                                            {k.desc}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                        <button
                            className="pill-btn"
                            onClick={() => setStep(3)}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP 3 — pace */}
                {step === 3 && (
                    <div className="wiz-step" key="s3">
                        <div className="modal-title">Pick the pace</div>
                        <div className="pace-grid">
                            {PACES.map((p) => {
                                // Rep challenges happen on the spot in front
                                // of the camera — nudge towards Blitz.
                                const recommended =
                                    kindDef.kind === 1 && p.key === "blitz";
                                return (
                                    <button
                                        key={p.key}
                                        className={`pace-card${
                                            p.key === paceKey
                                                ? " pace-card--active"
                                                : ""
                                        }`}
                                        onClick={() => setPaceKey(p.key)}
                                    >
                                        <span className="pace-emoji">
                                            {p.emoji}
                                        </span>
                                        <span className="pace-name">
                                            {p.name}
                                            {recommended && (
                                                <span className="rec-badge">
                                                    Recommended
                                                </span>
                                            )}
                                        </span>
                                        <span className="pace-dur">
                                            {p.durationLabel}
                                        </span>
                                        {p.note && (
                                            <span className="pace-note">
                                                {p.note}
                                            </span>
                                        )}
                                        <span className="pace-ends">
                                            Ends {formatEndDate(p.secs)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            className="pill-btn"
                            onClick={() => setStep(4)}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP 4 — stakes */}
                {step === 4 && (
                    <div className="wiz-step" key="s4">
                        <div className="modal-title">Set the stakes</div>
                        <div className="chips-row">
                            {STAKE_PRESETS.map((s) => (
                                <button
                                    key={s}
                                    className={`seg-btn${
                                        stakeStr === s
                                            ? " seg-btn--active"
                                            : ""
                                    }`}
                                    onClick={() => setStakeStr(s)}
                                >
                                    {s} MON
                                </button>
                            ))}
                        </div>
                        <div>
                            <div className="caption" style={{ marginBottom: 6 }}>
                                Or custom · MON
                            </div>
                            <input
                                className="field-input"
                                inputMode="decimal"
                                placeholder="0.25"
                                value={stakeStr}
                                onChange={(e) =>
                                    setStakeStr(
                                        e.target.value.replace(/[^0-9.]/g, "")
                                    )
                                }
                            />
                            {!stakeOk && stakeStr.trim() !== "" && (
                                <div className="field-error">
                                    Minimum stake is {MIN_STAKE_MON} MON
                                </div>
                            )}
                        </div>
                        <div className="summary-line">
                            Each walker stakes{" "}
                            <strong>
                                {stakeOk ? formatMonNumber(stakeNum) : "?"} MON
                            </strong>
                        </div>
                        <div className="payout-row">
                            <span>🥇 70%</span>
                            <span>🥈 30%</span>
                            <span>🐢 bottom walker's stake stays in the pot</span>
                        </div>
                        <button
                            className="pill-btn"
                            onClick={() => setStep(5)}
                            disabled={!stakeOk}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP 5 — review & launch */}
                {step === 5 && (
                    <div className="wiz-step" key="s5">
                        <div className="modal-title">Review & launch</div>
                        <div className="review-card">
                            <div className="review-row">
                                <span className="review-label">Challenge</span>
                                <span className="review-value">
                                    {title.trim()}
                                </span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Kind</span>
                                <span className="review-value">
                                    {kindDef.emoji} {kindDef.name}
                                </span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Pace</span>
                                <span className="review-value">
                                    {pace.emoji} {pace.name} ·{" "}
                                    {pace.durationLabel}
                                </span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Ends</span>
                                <span className="review-value">
                                    {formatEndDate(pace.secs)}
                                </span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Stake</span>
                                <span className="review-value">
                                    {formatMonNumber(stakeNum)} MON each
                                </span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Walker</span>
                                <span className="review-value">
                                    {profileNameLabel}
                                </span>
                            </div>
                        </div>
                        {submitFailed && error && (
                            <div className="field-error wiz-error">
                                {friendlyError(error)}
                            </div>
                        )}
                        <button
                            className="pill-btn"
                            onClick={create}
                            disabled={txPending}
                        >
                            {txPending ? (
                                <>
                                    <span className="spinner" />
                                    Confirming…
                                </>
                            ) : (
                                `Create & stake ${formatMonNumber(stakeNum)} MON →`
                            )}
                        </button>
                    </div>
                )}

                {!confirmingDiscard && (
                    <button
                        className="text-btn"
                        onClick={requestClose}
                        disabled={txPending}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}
