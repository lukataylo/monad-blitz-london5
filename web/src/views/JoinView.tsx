import { useEffect, useMemo, useRef, useState } from "react";
import { ProfileModal } from "../components/ProfileModal";
import { Avatar, formatMon, WalletPill } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";
import { useWalletContext } from "../context/WalletContext";
import { loadProfile } from "../lib/profile";

const FAUCET_URL = "https://testnet.monad.xyz";

/** Challenge id from the invite link (?c=123), captured once on load. */
const INVITED_ID: number | null = (() => {
    try {
        const v = new URLSearchParams(window.location.search).get("c");
        if (v != null && v !== "" && !Number.isNaN(Number(v))) {
            return Number(v);
        }
    } catch {
        /* no URL access — ignore */
    }
    return null;
})();

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

function formatEndsIn(secs: number): string {
    if (secs <= 0) return "Ended";
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `Ends in ${d}d ${h}h`;
    if (h > 0) return `Ends in ${h}h ${m}m`;
    return `Ends in ${Math.max(1, m)}m`;
}

/** Shimmering placeholder while the invited challenge loads — never fake data. */
function InviteSkeleton() {
    return (
        <div className="card card--lime">
            <div className="caption caption--ink">You're invited! 🎉</div>
            <div
                className="skeleton"
                style={{ width: "70%", height: 36, margin: "12px 0 14px" }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div className="skeleton" style={{ width: 110, height: 30 }} />
                <div className="skeleton" style={{ width: 96, height: 30 }} />
                <div className="skeleton" style={{ width: 104, height: 30 }} />
            </div>
            <div style={{ display: "flex" }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="skeleton"
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            marginLeft: i === 0 ? 0 : -8,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

/** Dedicated arrival flow when the page was opened via an invite link. */
function InviteHero({
    inviteId,
    requireProfile,
    onStartOwn,
}: {
    inviteId: number;
    requireProfile: (action: () => void) => void;
    onStartOwn: () => void;
}) {
    const { challenge, challengeNotFound, txPending, demoMode, join } =
        useChallengeContext();
    const { address, balance } = useWalletContext();
    const now = useNow();
    const [addrCopied, setAddrCopied] = useState(false);

    const copyAddress = () => {
        if (!address) return;
        navigator.clipboard?.writeText(address).catch(() => {});
        setAddrCopied(true);
        setTimeout(() => setAddrCopied(false), 1500);
    };

    // Invite points nowhere: contract not deployed, or id never created on-chain.
    if (demoMode || challengeNotFound) {
        return (
            <>
                <div className="card card--pink">
                    <div className="caption caption--ink">
                        Invite · challenge #{inviteId}
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 800,
                            letterSpacing: -0.5,
                            margin: "8px 0 6px",
                        }}
                    >
                        This invite isn't live yet
                    </div>
                    <div
                        style={{ fontSize: 15, fontWeight: 600, opacity: 0.7 }}
                    >
                        {demoMode
                            ? "The contract isn't deployed yet, so this challenge can't be found on-chain."
                            : "We couldn't find this challenge on-chain. Ask your friend for a fresh link — or lead the way."}
                    </div>
                </div>
                <button className="pill-btn" onClick={onStartOwn}>
                    Start your own challenge →
                </button>
            </>
        );
    }

    if (!challenge) {
        return (
            <>
                <InviteSkeleton />
                <div className="caption" style={{ textAlign: "center" }}>
                    Loading challenge #{inviteId} from chain…
                </div>
            </>
        );
    }

    const stakeLabel = `${formatMon(challenge.stake, 3)} MON`;
    const secsLeft = challenge.endTime - now;
    const ended = secsLeft <= 0;
    const count = challenge.participants.length;
    const needsFunds = balance < challenge.stake;
    const walkerNames = challenge.participants
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ");

    return (
        <>
            {/* invite hero */}
            <div className="card card--lime">
                <div className="caption caption--ink">You're invited! 🎉</div>
                <div
                    style={{
                        fontSize: 40,
                        fontWeight: 800,
                        letterSpacing: -1,
                        lineHeight: 1.08,
                        margin: "8px 0 12px",
                    }}
                >
                    {challenge.title.trim() || `Challenge #${challenge.id}`}
                </div>
                <div className="chips-row" style={{ marginBottom: 14 }}>
                    <span className="chip">Stake to join: {stakeLabel}</span>
                    <span className="chip">{formatEndsIn(secsLeft)}</span>
                    <span className="chip">
                        {count === 0
                            ? "Be the first to join"
                            : `${count} walking so far`}
                    </span>
                </div>
                {count > 0 && (
                    <>
                        <div className="avatar-row">
                            {challenge.participants.slice(0, 6).map((p) => (
                                <Avatar
                                    key={p.address}
                                    name={p.name}
                                    address={p.address}
                                />
                            ))}
                        </div>
                        <div
                            className="caption caption--ink"
                            style={{ marginTop: 8 }}
                        >
                            {walkerNames}
                            {count > 3 ? ` + ${count - 3} more` : ""} are in
                        </div>
                    </>
                )}
            </div>

            {ended ? (
                <div className="card card--pink">
                    <div className="caption caption--ink">Too late</div>
                    <div
                        style={{
                            fontSize: 18,
                            fontWeight: 800,
                            margin: "6px 0 14px",
                        }}
                    >
                        This challenge has already ended
                    </div>
                    <button className="pill-btn" onClick={onStartOwn}>
                        Start your own challenge →
                    </button>
                </div>
            ) : needsFunds ? (
                /* balance guard: fund the wallet first — CTA activates once
                   the 10s balance poll sees the funds arrive */
                <div className="card card--lavender">
                    <div className="caption caption--ink">Almost there</div>
                    <div
                        style={{
                            fontSize: 20,
                            fontWeight: 800,
                            margin: "6px 0 12px",
                        }}
                    >
                        You need {stakeLabel} to join
                    </div>
                    <div className="invite-box" style={{ marginBottom: 12 }}>
                        <span className="invite-link">
                            {address ?? "Creating wallet…"}
                        </span>
                        <button
                            className="chip-btn"
                            onClick={copyAddress}
                            disabled={!address}
                        >
                            {addrCopied ? "Copied!" : "Copy"}
                        </button>
                    </div>
                    <a
                        href={FAUCET_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="faucet-link"
                    >
                        testnet.monad.xyz
                    </a>
                    <div className="caption" style={{ marginTop: 6 }}>
                        Get free testnet MON, then come back — this unlocks
                        automatically
                    </div>
                </div>
            ) : (
                <div className="card card--lavender">
                    <div className="caption caption--ink">Your stake</div>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 800,
                            margin: "6px 0 14px",
                        }}
                    >
                        {stakeLabel}
                    </div>
                    <button
                        className="pill-btn"
                        onClick={() =>
                            requireProfile(() => void join(challenge.id))
                        }
                        disabled={txPending}
                    >
                        {txPending
                            ? "Confirming…"
                            : `Stake ${stakeLabel} & Join →`}
                    </button>
                    <div
                        className="caption"
                        style={{ marginTop: 10, textAlign: "center" }}
                    >
                        Joining challenge #{challenge.id}
                    </div>
                </div>
            )}

            {!ended && (
                <button className="text-btn" onClick={onStartOwn}>
                    Or start your own challenge
                </button>
            )}
        </>
    );
}

export function JoinView({
    onStartChallenge,
}: {
    onStartChallenge: () => void;
}) {
    const {
        activeChallengeId,
        challenge,
        challengeNotFound,
        txPending,
        demoMode,
        join,
        setActiveChallengeId,
    } = useChallengeContext();

    const [code, setCode] = useState("");
    const [linkCopied, setLinkCopied] = useState(false);
    // Once the visitor bails from an invite ("start your own"), stay bailed.
    const [inviteDismissed, setInviteDismissed] = useState(false);
    // Profile gate: first join/create asks for name + email, then continues
    // the original action.
    const [showProfile, setShowProfile] = useState(false);
    const pendingAction = useRef<(() => void) | null>(null);

    const requireProfile = (action: () => void) => {
        if (loadProfile() != null) {
            action();
        } else {
            pendingAction.current = action;
            setShowProfile(true);
        }
    };

    // Arrived via invite link and still pointed at that challenge -> show the
    // dedicated invite flow instead of the default join screen.
    const inviteMode =
        INVITED_ID != null &&
        !inviteDismissed &&
        activeChallengeId === INVITED_ID;

    // Only ever display data that actually came from chain.
    const hasActive =
        activeChallengeId != null &&
        challenge != null &&
        !demoMode &&
        !challengeNotFound;

    const inviteLink = useMemo(
        () =>
            hasActive
                ? `${window.location.origin}?c=${activeChallengeId}`
                : null,
        [hasActive, activeChallengeId]
    );

    const joinByCode = () => {
        const id = Number(code.trim());
        if (code.trim() === "" || Number.isNaN(id) || id < 0) return;
        requireProfile(() => {
            void join(id);
            setCode("");
        });
    };

    const copyInvite = () => {
        if (!inviteLink) return;
        navigator.clipboard?.writeText(inviteLink).catch(() => {});
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
    };

    const startOwnFromInvite = () => {
        setInviteDismissed(true);
        // Drop the dead invite id so it doesn't stick around in storage.
        if (demoMode || challengeNotFound) setActiveChallengeId(null);
        requireProfile(onStartChallenge);
    };

    return (
        <>
            <WalletPill />

            {inviteMode ? (
                <InviteHero
                    inviteId={INVITED_ID}
                    requireProfile={requireProfile}
                    onStartOwn={startOwnFromInvite}
                />
            ) : (
                <>
                    {/* hero — real pot when a challenge is loaded, the app
                        promise otherwise. Never invented numbers. */}
                    <div className="card card--lime">
                        <div className="caption caption--ink">
                            {hasActive
                                ? challenge.title.trim() ||
                                  `Challenge #${activeChallengeId}`
                                : "Walk The Walk"}
                        </div>
                        <div
                            style={{
                                fontSize: hasActive ? 52 : 40,
                                fontWeight: 800,
                                letterSpacing: -1,
                                lineHeight: 1.08,
                                margin: "8px 0 6px",
                            }}
                        >
                            {hasActive ? (
                                `${formatMon(challenge.pot)} MON`
                            ) : (
                                <>
                                    Walk more.
                                    <br />
                                    Win together.
                                </>
                            )}
                        </div>
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                opacity: 0.75,
                            }}
                        >
                            {hasActive
                                ? "In the pot — walk more, win together."
                                : "Stake MON. Most steps wins."}
                        </div>
                    </div>

                    {/* chips — real facts, or the static how-it-works explainer */}
                    <div className="chips-row">
                        {hasActive ? (
                            <>
                                <span className="chip">
                                    {formatMon(challenge.stake, 3)} MON stake
                                </span>
                                <span className="chip">
                                    {challenge.participants.length} walking
                                </span>
                                <span className="chip">Winner takes 70%</span>
                            </>
                        ) : (
                            <>
                                <span className="chip">Winner takes 70%</span>
                                <span className="chip">Runner-up gets 30%</span>
                                <span className="chip">Most steps wins</span>
                            </>
                        )}
                    </div>

                    {/* avatars — only real participants */}
                    {hasActive && challenge.participants.length > 0 && (
                        <div className="avatar-row">
                            {challenge.participants.slice(0, 6).map((p) => (
                                <Avatar
                                    key={p.address}
                                    name={p.name}
                                    address={p.address}
                                />
                            ))}
                        </div>
                    )}

                    {/* CTA card */}
                    {hasActive &&
                    (challenge.settled ||
                        challenge.endTime <= Math.floor(Date.now() / 1000)) ? (
                        <div className="card card--pink">
                            <div className="caption caption--ink">
                                Challenge over
                            </div>
                            <div
                                style={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    margin: "6px 0 14px",
                                }}
                            >
                                “{challenge.title.trim() || `#${challenge.id}`}”
                                has ended
                            </div>
                            <button
                                className="pill-btn"
                                onClick={() => {
                                    setActiveChallengeId(null);
                                    requireProfile(onStartChallenge);
                                }}
                            >
                                Start your own challenge →
                            </button>
                        </div>
                    ) : hasActive ? (
                        <div className="card card--lavender">
                            <div className="caption caption--ink">
                                Your stake
                            </div>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    margin: "6px 0 14px",
                                }}
                            >
                                {formatMon(challenge.stake, 3)} MON
                            </div>
                            <button
                                className="pill-btn"
                                onClick={() =>
                                    requireProfile(
                                        () => void join(challenge.id)
                                    )
                                }
                                disabled={txPending}
                            >
                                {txPending ? "Confirming…" : "Stake & Join →"}
                            </button>
                            <div
                                className="caption"
                                style={{ marginTop: 10, textAlign: "center" }}
                            >
                                Joining challenge #{activeChallengeId}
                            </div>
                            <button
                                className="text-btn"
                                style={{ width: "100%", marginTop: 8 }}
                                onClick={() =>
                                    requireProfile(onStartChallenge)
                                }
                                disabled={txPending}
                            >
                                Start your own challenge
                            </button>
                        </div>
                    ) : (
                        <div className="card card--lavender">
                            <div className="caption caption--ink">
                                Get started
                            </div>
                            <div
                                style={{
                                    fontSize: 15,
                                    fontWeight: 600,
                                    opacity: 0.75,
                                    margin: "6px 0 14px",
                                }}
                            >
                                Set the stakes, pick a duration, invite your
                                crew.
                            </div>
                            <button
                                className="pill-btn"
                                onClick={() =>
                                    requireProfile(onStartChallenge)
                                }
                                disabled={txPending || demoMode}
                            >
                                Start a challenge →
                            </button>
                            {demoMode && (
                                <div
                                    className="caption"
                                    style={{
                                        marginTop: 10,
                                        textAlign: "center",
                                    }}
                                >
                                    Contract not deployed yet — transactions
                                    disabled
                                </div>
                            )}
                        </div>
                    )}

                    {/* invite */}
                    <div>
                        <div className="caption" style={{ marginBottom: 8 }}>
                            Invite your crew
                        </div>
                        {inviteLink ? (
                            <div className="invite-box">
                                <span className="invite-link">
                                    {inviteLink}
                                </span>
                                <button
                                    className="chip-btn"
                                    onClick={copyInvite}
                                >
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
                                disabled={
                                    txPending ||
                                    demoMode ||
                                    code.trim() === ""
                                }
                            >
                                Join
                            </button>
                        </div>
                        {demoMode && (
                            <div className="caption" style={{ marginTop: 8 }}>
                                Joining is disabled until the contract is
                                deployed
                            </div>
                        )}
                    </div>
                </>
            )}

            {showProfile && (
                <ProfileModal
                    onSaved={() => {
                        setShowProfile(false);
                        const action = pendingAction.current;
                        pendingAction.current = null;
                        action?.();
                    }}
                    onClose={() => {
                        setShowProfile(false);
                        pendingAction.current = null;
                    }}
                />
            )}
        </>
    );
}
