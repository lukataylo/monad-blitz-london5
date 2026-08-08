import { useMemo, useState } from "react";
import { parseEther } from "viem";
import { useChallengeContext } from "../context/ChallengeContext";
import { useWalletContext } from "../context/WalletContext";
import {
    saveExerciseChoice,
    type StoredExercise,
} from "../lib/exerciseChoice";
import { getKindCopy } from "../lib/kindCopy";
import { loadProfile } from "../lib/profile";

// Start-a-challenge flow: a step wizard ending in the "Challenge is live!"
// moment with the shareable invite link. Kind comes first so the name
// suggestions (and all later copy) match the sport. Steps kind gets the full
// 5 steps (kind → name → pace → stakes → review); rep challenges happen live
// in front of the camera, so they're Blitz-only — the pace step is dropped
// and the flow is 4 steps (kind → name → stakes → review). Rendered at App
// level so it survives the auto-switch to the leaderboard after creation.

const MIN_STAKE_MON = 0.001;
const MAX_TITLE_LENGTH = 64;

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

// Name suggestions swap with the selected kind so a squat challenge never
// gets pitched "Step Wars".
const TITLE_SUGGESTIONS: Record<KindKey, readonly string[]> = {
    steps: ["10K Club", "Step Wars", "Monday Miles"],
    squat: ["Squad Goals", "Drop It Low", "Squat Squad"],
    jumping_jack: ["Jack Attack", "Star Jumpers"],
};

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

// Rep challenges are a live camera race — their paces are minutes, not days.
// 3 minutes is the headline format (hackathon demo length); 1 minute is the
// all-out burner; 15 minutes is the endurance version.
const REP_PACES = [
    {
        key: "rep3",
        emoji: "🔥",
        name: "Showdown",
        durationLabel: "3 minutes",
        secs: 3 * 60,
        note: "The demo format — all killer",
    },
    {
        key: "rep1",
        emoji: "💥",
        name: "Minute Madness",
        durationLabel: "1 minute",
        secs: 60,
        note: "Empty the tank",
    },
    {
        key: "rep15",
        emoji: "⚡",
        name: "Endurance",
        durationLabel: "15 minutes",
        secs: 15 * 60,
        note: "Pace yourself",
    },
] as const;

type RepPaceKey = (typeof REP_PACES)[number]["key"];
const REP_MAX_SECS = 15 * 60;

type StepName = "kind" | "name" | "pace" | "stakes" | "review";
const STEPS_WITH_PACE: readonly StepName[] = [
    "kind",
    "name",
    "pace",
    "stakes",
    "review",
];
const STEP_LABELS: Record<StepName, string> = {
    kind: "Kind",
    name: "Name",
    pace: "Pace",
    stakes: "Stakes",
    review: "Review",
};

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

// The create tx costs its full 400k gas LIMIT on Monad (~0.041 MON) on top
// of the stake — without this headroom a freshly dripped wallet (0.15 MON)
// could fire a doomed "insufficient funds" create.
const CREATE_GAS_HEADROOM_WEI = 45_000_000_000_000_000n; // 0.045 MON

export function CreateChallengeModal({ onClose }: { onClose: () => void }) {
    const { createChallenge, txPending, error } = useChallengeContext();
    const { balance } = useWalletContext();

    const [step, setStep] = useState(1);
    const [title, setTitle] = useState("");
    const [kindKey, setKindKey] = useState<KindKey>("steps");
    const [paceKey, setPaceKey] = useState<PaceKey>("classic");
    // Rep race length — separate state so switching kind back and forth
    // never leaks a 1-week pace into a camera race (or vice versa).
    const [repPaceKey, setRepPaceKey] = useState<RepPaceKey>("rep3");
    const [stakeStr, setStakeStr] = useState("0.1");
    const [liveId, setLiveId] = useState<number | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);
    const [submitFailed, setSubmitFailed] = useState(false);

    const kindDef = KINDS.find((k) => k.key === kindKey) ?? KINDS[0];
    // Reps happen live in front of the camera — minutes-long formats, with
    // the 3-minute Showdown as the default (hackathon demo length).
    const isReps = kindDef.kind === 1;
    const pace = isReps
        ? (REP_PACES.find((p) => p.key === repPaceKey) ?? REP_PACES[0])
        : (PACES.find((p) => p.key === paceKey) ?? PACES[2]);
    const stepList = STEPS_WITH_PACE;
    const stepName: StepName = stepList[Math.min(step, stepList.length) - 1];
    const copy = getKindCopy(
        kindDef.kind,
        (kindDef.exercise ?? "squat") as StoredExercise
    );
    const unit = copy.unit;

    const titleOk = title.trim() !== "";
    const stakeNum = Number(stakeStr);
    const stakeOk =
        stakeStr.trim() !== "" &&
        Number.isFinite(stakeNum) &&
        stakeNum >= MIN_STAKE_MON;

    // First-run race: the faucet drip may still be mining while the user
    // walks the wizard. Gate the launch on balance — the 10s balance poll
    // unlocks it the moment funds land, instead of letting a doomed
    // "insufficient funds" create fire.
    let stakeWeiPreview: bigint | null = null;
    try {
        if (stakeOk) stakeWeiPreview = parseEther(stakeStr.trim());
    } catch {
        stakeWeiPreview = null;
    }
    const awaitingFunds =
        stakeWeiPreview != null &&
        balance < stakeWeiPreview + CREATE_GAS_HEADROOM_WEI;

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
        // Defensive clamp: a camera race is minutes, never days — even if the
        // pace derivation ever regresses, cap rep challenges at 15 minutes.
        const durationSec =
            kindDef.kind === 1 ? Math.min(pace.secs, REP_MAX_SECS) : pace.secs;
        const id = await createChallenge(
            stakeWei,
            durationSec,
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
                text: copy.shareText(stakeStr),
                url: inviteLink,
            })
            .catch(() => {});
    };

    // Backdrop / cancel: once there's real input (a typed title) ask before
    // throwing the setup away — inline, no browser confirm().
    const requestClose = () => {
        if (txPending) return;
        if (liveId != null || step === 1 || (step === 2 && !titleOk)) {
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
                        {copy.letsGo}
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
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 4,
                        }}
                    >
                        <div
                            className="wiz-dots"
                            aria-label={`Step ${step} of ${stepList.length}: ${STEP_LABELS[stepName]}`}
                        >
                            {stepList.map((s, i) => (
                                <span
                                    key={s}
                                    title={STEP_LABELS[s]}
                                    className={`wiz-dot${
                                        i + 1 === step
                                            ? " wiz-dot--active"
                                            : i + 1 < step
                                              ? " wiz-dot--done"
                                              : ""
                                    }`}
                                />
                            ))}
                        </div>
                        <span className="caption" style={{ fontSize: 10 }}>
                            {STEP_LABELS[stepName]} · {step}/{stepList.length}
                        </span>
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

                {/* STEP — kind (first, so everything after speaks the
                    right sport) */}
                {stepName === "kind" && (
                    <div className="wiz-step" key="s1">
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
                            onClick={() => setStep(2)}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP — name (suggestions match the chosen kind) */}
                {stepName === "name" && (
                    <div className="wiz-step" key="s2">
                        <div className="modal-title">Name your challenge</div>
                        <input
                            className="field-input"
                            placeholder={
                                kindDef.kind === 1
                                    ? "Office Rep Battle"
                                    : "Office Step War"
                            }
                            maxLength={MAX_TITLE_LENGTH}
                            value={title}
                            autoFocus
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && titleOk)
                                    setStep(step + 1);
                            }}
                        />
                        <div className="chips-row">
                            {TITLE_SUGGESTIONS[kindKey].map((s) => (
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
                            onClick={() => setStep(step + 1)}
                            disabled={!titleOk}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP — pace (day/week paces for steps, minute rounds for
                    camera rep races — 3-min Showdown is the default) */}
                {stepName === "pace" && (
                    <div className="wiz-step" key="s3">
                        <div className="modal-title">
                            {isReps ? "Pick the round" : "Pick the pace"}
                        </div>
                        <div className="pace-grid">
                            {(isReps ? REP_PACES : PACES).map((p) => {
                                const active = isReps
                                    ? p.key === repPaceKey
                                    : p.key === paceKey;
                                return (
                                    <button
                                        key={p.key}
                                        className={`pace-card${
                                            active ? " pace-card--active" : ""
                                        }`}
                                        onClick={() =>
                                            isReps
                                                ? setRepPaceKey(
                                                      p.key as RepPaceKey
                                                  )
                                                : setPaceKey(p.key as PaceKey)
                                        }
                                    >
                                        <span className="pace-emoji">
                                            {p.emoji}
                                        </span>
                                        <span className="pace-name">
                                            {p.name}
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
                                            {isReps
                                                ? "Starts the moment you create it"
                                                : `Ends ${formatEndDate(p.secs)}`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            className="pill-btn"
                            onClick={() => setStep(step + 1)}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP — stakes */}
                {stepName === "stakes" && (
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
                            Each player stakes{" "}
                            <strong>
                                {stakeOk ? formatMonNumber(stakeNum) : "?"} MON
                            </strong>
                        </div>
                        <div className="payout-row">
                            <span>🥇 70%</span>
                            <span>🥈 30%</span>
                            <span>🐢 bottom player's stake stays in the pot</span>
                        </div>
                        <button
                            className="pill-btn"
                            onClick={() => setStep(step + 1)}
                            disabled={!stakeOk}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* STEP — review & launch */}
                {stepName === "review" && (
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
                                <span className="review-label">
                                    {isReps ? "Round" : "Pace"}
                                </span>
                                <span className="review-value">
                                    {`${pace.emoji} ${pace.name} · ${pace.durationLabel}`}
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
                                <span className="review-label">
                                    {copy.athleteNoun}
                                </span>
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
                        {awaitingFunds && (
                            <div className="summary-line">
                                Waiting for your wallet top-up — you need ~
                                {formatMonNumber(stakeNum + 0.045)} MON
                                (stake + gas). This unlocks automatically
                                when the faucet drip lands.
                            </div>
                        )}
                        <button
                            className="pill-btn"
                            onClick={create}
                            disabled={txPending || awaitingFunds}
                        >
                            {txPending ? (
                                <>
                                    <span className="spinner" />
                                    Confirming…
                                </>
                            ) : awaitingFunds ? (
                                <>
                                    <span className="spinner" />
                                    Topping up your wallet…
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
