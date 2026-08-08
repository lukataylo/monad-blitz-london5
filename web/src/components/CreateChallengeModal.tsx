import { useMemo, useState } from "react";
import { parseEther } from "viem";
import { useChallengeContext } from "../context/ChallengeContext";

// Start-a-challenge flow: stake + duration -> Create & stake -> the
// "Challenge is live!" moment with the shareable invite link.
// Rendered at App level so it survives the auto-switch to the leaderboard
// after creation confirms.

const MIN_STAKE_MON = 0.001;
const ILLUSTRATIVE_FRIENDS = 5;

const DURATIONS = [
    { label: "15 min", secs: 15 * 60 },
    { label: "1 hour", secs: 3600 },
    { label: "1 day", secs: 86400 },
    { label: "7 days", secs: 7 * 86400 },
] as const;

function formatMonNumber(n: number): string {
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function CreateChallengeModal({ onClose }: { onClose: () => void }) {
    const { createChallenge, txPending } = useChallengeContext();

    const [stakeStr, setStakeStr] = useState("0.1");
    const [durationSecs, setDurationSecs] = useState<number>(3600);
    const [customMins, setCustomMins] = useState("");
    const [liveId, setLiveId] = useState<number | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    const stakeNum = Number(stakeStr);
    const stakeOk =
        stakeStr.trim() !== "" &&
        Number.isFinite(stakeNum) &&
        stakeNum >= MIN_STAKE_MON;

    const customMinsNum = Number(customMins);
    const customOk =
        customMins.trim() !== "" &&
        Number.isFinite(customMinsNum) &&
        customMinsNum >= 1;
    const effectiveDuration = customOk
        ? Math.floor(customMinsNum) * 60
        : durationSecs;

    const potPreview = stakeOk ? stakeNum * ILLUSTRATIVE_FRIENDS : 0;

    const inviteLink = useMemo(
        () =>
            liveId != null
                ? `${window.location.origin}?c=${liveId}`
                : null,
        [liveId]
    );
    const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

    const create = async () => {
        if (!stakeOk || txPending) return;
        let stakeWei: bigint;
        try {
            stakeWei = parseEther(stakeStr.trim());
        } catch {
            return;
        }
        const id = await createChallenge(stakeWei, effectiveDuration);
        if (id != null) setLiveId(id);
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
                title: "Walk The Walk",
                text: `Stake ${stakeStr} MON, most steps wins. You in?`,
                url: inviteLink,
            })
            .catch(() => {});
    };

    // ---- stage 2: challenge is live ----
    if (liveId != null) {
        return (
            <div className="modal-overlay">
                <div className="modal-sheet">
                    <div className="caption">Challenge #{liveId}</div>
                    <div className="modal-title">Challenge is live! 🎉</div>
                    <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.7 }}>
                        Send this link to your crew — everyone who joins
                        stakes {stakeStr} MON.
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

    // ---- stage 1: configure ----
    return (
        <div className="modal-overlay" onClick={txPending ? undefined : onClose}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">Start a challenge</div>

                <div>
                    <div className="caption" style={{ marginBottom: 6 }}>
                        Stake per friend · MON
                    </div>
                    <input
                        className="field-input"
                        inputMode="decimal"
                        placeholder="0.1"
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

                <div>
                    <div className="caption" style={{ marginBottom: 6 }}>
                        Duration
                    </div>
                    <div className="seg-row">
                        {DURATIONS.map((d) => (
                            <button
                                key={d.secs}
                                className={`seg-btn${
                                    !customOk && durationSecs === d.secs
                                        ? " seg-btn--active"
                                        : ""
                                }`}
                                onClick={() => {
                                    setDurationSecs(d.secs);
                                    setCustomMins("");
                                }}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                    <input
                        className="field-input"
                        style={{ marginTop: 8, height: 44, fontSize: 14 }}
                        inputMode="numeric"
                        placeholder="Custom minutes (optional)"
                        value={customMins}
                        onChange={(e) =>
                            setCustomMins(
                                e.target.value.replace(/[^0-9]/g, "")
                            )
                        }
                    />
                </div>

                <div className="summary-line">
                    {ILLUSTRATIVE_FRIENDS} friends ×{" "}
                    {stakeOk ? formatMonNumber(stakeNum) : "?"} MON ={" "}
                    <strong>{formatMonNumber(potPreview)} MON pot</strong>
                </div>

                <button
                    className="pill-btn"
                    onClick={create}
                    disabled={!stakeOk || txPending}
                >
                    {txPending ? "Confirming…" : "Create & stake →"}
                </button>
                <button
                    className="text-btn"
                    onClick={onClose}
                    disabled={txPending}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
