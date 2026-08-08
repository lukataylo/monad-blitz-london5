import { useMemo, useState } from "react";
import { parseEther } from "viem";
import { Avatar, formatMon, WalletPill } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";
import { MOCK_CHALLENGE } from "../lib/mock";

const DEFAULT_STAKE = parseEther("0.1");
const DEFAULT_DURATION_SEC = 3600;

export function JoinView() {
    const {
        activeChallengeId,
        challenge,
        txPending,
        demoMode,
        createChallenge,
        join,
    } = useChallengeContext();

    const [code, setCode] = useState("");
    const [linkCopied, setLinkCopied] = useState(false);

    // Show real numbers when a challenge is loaded; mock otherwise.
    const display = challenge ?? MOCK_CHALLENGE;
    const hasActive = activeChallengeId != null && challenge != null;
    const stake = hasActive ? challenge.stake : DEFAULT_STAKE;
    const friendCount = display.participants.length;

    const inviteLink = useMemo(
        () =>
            activeChallengeId != null
                ? `${window.location.origin}?c=${activeChallengeId}`
                : null,
        [activeChallengeId]
    );

    const stakeAndJoin = async () => {
        // Join by active id even if the first fetch hasn't resolved yet —
        // join() reads the stake from chain itself.
        if (activeChallengeId != null) {
            await join(activeChallengeId);
        } else {
            await createChallenge(DEFAULT_STAKE, DEFAULT_DURATION_SEC);
        }
    };

    const joinByCode = async () => {
        const id = Number(code.trim());
        if (code.trim() === "" || Number.isNaN(id) || id < 0) return;
        await join(id);
        setCode("");
    };

    const copyInvite = () => {
        if (!inviteLink) return;
        navigator.clipboard?.writeText(inviteLink).catch(() => {});
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
    };

    return (
        <>
            <WalletPill />

            {/* hero */}
            <div className="card card--lime">
                <div className="caption caption--ink">10K Club</div>
                <div
                    style={{
                        fontSize: 52,
                        fontWeight: 800,
                        letterSpacing: -1,
                        lineHeight: 1.05,
                        margin: "8px 0 6px",
                    }}
                >
                    {formatMon(display.pot)} MON
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.75 }}>
                    Walk more. Win together.
                </div>
            </div>

            {/* chips */}
            <div className="chips-row">
                <span className="chip">7 days</span>
                <span className="chip">{friendCount} friends</span>
                <span className="chip">Bottom walker loses</span>
            </div>

            {/* avatars */}
            <div className="avatar-row">
                {display.participants.slice(0, 6).map((p) => (
                    <Avatar key={p.address} name={p.name} address={p.address} />
                ))}
            </div>

            {/* stake card */}
            <div className="card card--lavender">
                <div className="caption caption--ink">Your stake</div>
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 800,
                        margin: "6px 0 14px",
                    }}
                >
                    {formatMon(stake, 3)} MON
                </div>
                <button
                    className="pill-btn"
                    onClick={stakeAndJoin}
                    disabled={txPending}
                >
                    {txPending
                        ? "Confirming…"
                        : activeChallengeId != null
                          ? "Stake & Join →"
                          : "Stake & Start →"}
                </button>
                {!demoMode && (
                    <div
                        className="caption"
                        style={{ marginTop: 10, textAlign: "center" }}
                    >
                        {activeChallengeId != null
                            ? `Joining challenge #${activeChallengeId}`
                            : "Starts a fresh 1-hour challenge"}
                    </div>
                )}
            </div>

            {/* invite */}
            <div>
                <div className="caption" style={{ marginBottom: 8 }}>
                    Invite your crew
                </div>
                {inviteLink ? (
                    <div className="invite-box">
                        <span className="invite-link">{inviteLink}</span>
                        <button className="chip-btn" onClick={copyInvite}>
                            {linkCopied ? "Copied!" : "Copy"}
                        </button>
                    </div>
                ) : (
                    <div className="invite-box">
                        <span className="invite-link">
                            Start a challenge to get an invite link
                        </span>
                    </div>
                )}
            </div>

            {/* join by code */}
            <div>
                <div className="caption" style={{ marginBottom: 8 }}>
                    Have a code?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        className="code-input"
                        inputMode="numeric"
                        placeholder="Challenge id, e.g. 3"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") joinByCode();
                        }}
                    />
                    <button
                        className="chip-btn"
                        onClick={joinByCode}
                        disabled={txPending || code.trim() === ""}
                    >
                        Join
                    </button>
                </div>
            </div>
        </>
    );
}
