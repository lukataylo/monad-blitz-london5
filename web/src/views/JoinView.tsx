import { useEffect, useMemo, useRef, useState } from "react";
import { ChallengeSummaryRow } from "../components/ChallengeList";
import { InviteQR } from "../components/InviteQR";
import { ProfileModal } from "../components/ProfileModal";
import { Avatar, formatMon, WalletPill } from "../components/ui";
import { useChallengeContext } from "../context/ChallengeContext";
import { useWalletContext } from "../context/WalletContext";
import { useMyChallenges } from "../hooks/useMyChallenges";
import { copyForChallenge } from "../lib/kindCopy";
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
    // Stake alone isn't enough — the join tx costs its full 200k gas LIMIT on
    // Monad (~0.02 MON). Without headroom, balance === stake unlocks the CTA
    // and the tx dies with a raw "insufficient funds" error.
    const GAS_HEADROOM_WEI = 25_000_000_000_000_000n; // 0.025 MON
    const needsFunds = balance < challenge.stake + GAS_HEADROOM_WEI;
    const isReps = challenge.kind === 1;
    const copy = copyForChallenge(
        challenge.kind,
        challenge.id,
        challenge.title
    );
    const walkerNames = challenge.participants
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ");

    return (
        <>
            {/* invite hero — rep challenges swap lime for the pink scheme so
                a squat invite reads as a different sport at a glance */}
            <div
                className={`card card--sticker ${
                    isReps ? "card--pink" : "card--lime"
                }`}
            >
                <span className="hero-sticker" aria-hidden>
                    {copy.emoji}
                </span>
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
                    {isReps && (
                        <span className="chip">{copy.sportChip}</span>
                    )}
                    <span className="chip">Stake to join: {stakeLabel}</span>
                    <span className="chip">{formatEndsIn(secsLeft)}</span>
                    <span className="chip">
                        {count === 0
                            ? "Be the first to join"
                            : copy.inviteCount(count)}
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

            {challenge.participants.some((p) => p.isYou) ? (
                /* re-opened your own invite link: you're already staked in —
                   a join CTA here would only revert "already joined" */
                <div className="card card--lime">
                    <div className="caption caption--ink">You're in</div>
                    <div
                        style={{
                            fontSize: 20,
                            fontWeight: 800,
                            margin: "6px 0 6px",
                        }}
                    >
                        Your stake is down — go get those {copy.unit}!
                    </div>
                    <div className="caption caption--ink">
                        The Leaderboard tab has the live race
                    </div>
                </div>
            ) : ended ? (
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

    // Every challenge this device created/joined — feeds the "Ongoing" list.
    const { summaries, refresh: refreshMine } = useMyChallenges();
    useEffect(() => {
        refreshMine();
    }, [activeChallengeId, refreshMine]);
    const nowSec = Date.now() / 1000;
    const ongoing = summaries.filter(
        (s) => s.youIn && !s.settled && s.endTime > nowSec
    );

    const [code, setCode] = useState("");
    const [linkCopied, setLinkCopied] = useState(false);
    // Progressive disclosure: "join by code" starts hidden behind a link so
    // a first-time visitor sees one primary action, not three at once.
    const [showCodeEntry, setShowCodeEntry] = useState(false);
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

    // Kind-aware wording/coloring for a loaded challenge (walking default).
    const heroCopy = copyForChallenge(
        hasActive ? challenge.kind : 0,
        activeChallengeId,
        hasActive ? challenge.title : undefined
    );
    const heroIsReps = hasActive && challenge.kind === 1;

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

    // The clear, always-available create CTA — the home screen's anchor.
    const createCard = (
        <div className="card card--lavender">
            <div className="caption caption--ink">Create a challenge</div>
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 600,
                    opacity: 0.75,
                    margin: "6px 0 14px",
                }}
            >
                Steps or squats — set the stakes, pick a round, invite your
                crew.
            </div>
            <button
                className="pill-btn"
                onClick={() => requireProfile(onStartChallenge)}
                disabled={txPending || demoMode}
            >
                Start a challenge →
            </button>
            {demoMode && (
                <div
                    className="caption"
                    style={{ marginTop: 10, textAlign: "center" }}
                >
                    Contract not deployed yet — transactions disabled
                </div>
            )}
        </div>
    );

    return (
        <>
            <WalletPill />

            {inviteMode ? (
                <InviteHero
                    inviteId={INVITED_ID}
                    requireProfile={requireProfile}
                    onStartOwn={startOwnFromInvite}
                />
            ) : hasActive ? (
                <>
                    {/* hero — real pot for the loaded challenge. Rep
                        challenges get the pink scheme + sport sticker. */}
                    <div
                        className={`card card--sticker ${
                            heroIsReps ? "card--pink" : "card--lime"
                        }`}
                    >
                        <span className="hero-sticker" aria-hidden>
                            {heroCopy.emoji}
                        </span>
                        <div className="caption caption--ink">
                            {challenge.title.trim() ||
                                `Challenge #${activeChallengeId}`}
                        </div>
                        <div
                            style={{
                                fontSize: 52,
                                fontWeight: 800,
                                letterSpacing: -1,
                                lineHeight: 1.08,
                                margin: "8px 0 6px",
                            }}
                        >
                            {formatMon(challenge.pot)} MON
                        </div>
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                opacity: 0.75,
                            }}
                        >
                            {heroCopy.potSub}
                        </div>
                    </div>

                    {/* chips — real facts about the loaded challenge */}
                    <div className="chips-row">
                        {heroIsReps && (
                            <span className="chip">{heroCopy.sportChip}</span>
                        )}
                        <span className="chip">
                            {formatMon(challenge.stake, 3)} MON stake
                        </span>
                        <span className="chip">
                            {challenge.participants.length} {heroCopy.verb}
                        </span>
                        <span className="chip">Winner takes 70%</span>
                    </div>

                    {/* avatars — only real participants */}
                    {challenge.participants.length > 0 && (
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
                    {challenge.settled ||
                    challenge.endTime <= Math.floor(Date.now() / 1000) ? (
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
                    ) : challenge.participants.some((p) => p.isYou) ? (
                        /* already joined: the challenge lives in "Ongoing"
                           below — the CTA slot goes to creating the next one */
                        createCard
                    ) : (
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
                    )}

                    {/* ongoing challenges — everything you're staked in */}
                    {ongoing.length > 0 && (
                        <div>
                            <div
                                className="caption"
                                style={{ marginBottom: 8 }}
                            >
                                Ongoing challenges
                            </div>
                            <div className="chal-stack">
                                {ongoing.map((s) => (
                                    <ChallengeSummaryRow
                                        key={s.id}
                                        summary={s}
                                        onOpen={(id) =>
                                            setActiveChallengeId(id)
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* invite — only shown once there's a real link to share */}
                    <div>
                        <div className="caption" style={{ marginBottom: 8 }}>
                            Invite your crew
                        </div>
                        {inviteLink != null && (
                            <div style={{ marginBottom: 8 }}>
                                <InviteQR link={inviteLink} />
                            </div>
                        )}
                        <div className="invite-box">
                            <span className="invite-link">{inviteLink}</span>
                            <button className="chip-btn" onClick={copyInvite}>
                                {linkCopied ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>
                </>
            ) : ongoing.length > 0 ? (
                /* returning player, nothing selected: straight to business —
                   create CTA + everything they're staked in. The illustrated
                   landing below is reserved for first-timers. */
                <>
                    {createCard}
                    <div>
                        <div className="caption" style={{ marginBottom: 8 }}>
                            Ongoing challenges
                        </div>
                        <div className="chal-stack">
                            {ongoing.map((s) => (
                                <ChallengeSummaryRow
                                    key={s.id}
                                    summary={s}
                                    onOpen={(id) => setActiveChallengeId(id)}
                                />
                            ))}
                        </div>
                    </div>
                    {showCodeEntry ? (
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                className="code-input"
                                inputMode="numeric"
                                placeholder="Challenge id, e.g. 3"
                                autoFocus
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
                    ) : (
                        <button
                            className="text-btn"
                            onClick={() => setShowCodeEntry(true)}
                        >
                            Have an invite code?
                        </button>
                    )}
                </>
            ) : (
                /* onboarding-style landing: headline up top, a full-bleed
                   illustration band at the bottom, one primary action riding
                   on it. Everything else is a step away. */
                <div className="onboard">
                    <div className="onboard-copy">
                        <div className="caption caption--ink">
                            Walk The Walk
                        </div>
                        <h1 className="onboard-title">
                            {heroCopy.tagline[0]}
                            <br />
                            {heroCopy.tagline[1]}
                        </h1>
                        <p className="onboard-sub">{heroCopy.heroSub}</p>
                    </div>

                    {/* illustration band — bleeds past the shell padding and
                        is cropped by the band edges, like the reference */}
                    <div className="onboard-band">
                        {/* shapes sit within x≈60–360 of the viewBox so the
                            "slice" crop can't shave the accent colours off */}
                        <svg
                            className="onboard-art"
                            viewBox="0 0 420 300"
                            preserveAspectRatio="xMidYMax slice"
                            aria-hidden
                        >
                            <circle cx="298" cy="112" r="62" fill="var(--pink)" />
                            <circle cx="96" cy="212" r="112" fill="var(--ochre)" />
                            <circle
                                cx="332"
                                cy="214"
                                r="124"
                                fill="var(--lavender)"
                            />
                            <circle cx="206" cy="252" r="158" fill="var(--lime)" />

                            {/* hand-drawn face — the curves are deliberately
                                uneven (eyes at slightly different heights,
                                off-centre grin) so it reads as drawn, not
                                geometric */}
                            <g
                                fill="none"
                                stroke="var(--ink)"
                                strokeWidth="6.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                transform="rotate(-1.5 206 160)"
                            >
                                <path d="M171 139 C177 124 191 123 198 137" />
                                <path d="M216 137 C223 122 237 123 242 139" />
                                <path d="M159 158 C181 195 233 197 254 156" />
                            </g>
                        </svg>

                        <div className="onboard-cta">
                            {/* join by code — secondary path, hidden behind a
                                link until asked for so the landing state has
                                one primary action, not several competing */}
                            {showCodeEntry && (
                                <div className="onboard-code">
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <input
                                            className="code-input"
                                            inputMode="numeric"
                                            placeholder="Challenge id, e.g. 3"
                                            autoFocus
                                            value={code}
                                            onChange={(e) =>
                                                setCode(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter")
                                                    joinByCode();
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
                                </div>
                            )}

                            <button
                                className="pill-btn"
                                onClick={() => requireProfile(onStartChallenge)}
                                disabled={txPending || demoMode}
                            >
                                Start a challenge →
                            </button>

                            {demoMode ? (
                                <div
                                    className="caption caption--ink"
                                    style={{
                                        marginTop: 10,
                                        textAlign: "center",
                                    }}
                                >
                                    Contract not deployed yet — transactions
                                    disabled
                                </div>
                            ) : (
                                !showCodeEntry && (
                                    <button
                                        className="text-btn onboard-code-link"
                                        onClick={() => setShowCodeEntry(true)}
                                    >
                                        Have an invite code?
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
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
