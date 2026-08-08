import { useEffect, useState } from "react";
import { CreateChallengeModal } from "./components/CreateChallengeModal";
import { useChallengeContext } from "./context/ChallengeContext";
import { JoinView } from "./views/JoinView";
import { LeaderboardView } from "./views/LeaderboardView";
import { ResultsView } from "./views/ResultsView";

type View = "join" | "board" | "results";

export default function App() {
    const { activeChallengeId, challenge, error, clearError, demoMode } =
        useChallengeContext();
    const [override, setOverride] = useState<View | null>(null);
    // Create-challenge modal lives at App level so its "Challenge is live!"
    // stage survives the auto-switch from Join to Leaderboard.
    const [showCreate, setShowCreate] = useState(false);

    const joined = challenge?.participants.some((p) => p.isYou) ?? false;

    // Auto-switch: no active id or not joined -> Join; joined & running ->
    // Leaderboard; settled -> Results. Manual nav links can override.
    const autoView: View =
        activeChallengeId == null || challenge == null || !joined
            ? "join"
            : challenge.settled
              ? "results"
              : "board";
    const view = override ?? autoView;

    // A state transition (join confirmed, challenge settled, run it back)
    // drops any manual override so the flow moves forward on its own.
    useEffect(() => {
        setOverride(null);
    }, [autoView]);

    return (
        <div className="shell">
            {demoMode && (
                <div className="demo-badge">
                    Contract not deployed yet — transactions disabled
                </div>
            )}
            {error && (
                <div className="error-banner" onClick={clearError}>
                    <span>{error}</span>
                    <button className="error-dismiss" aria-label="Dismiss">
                        ✕
                    </button>
                </div>
            )}

            {view === "join" && (
                <JoinView onStartChallenge={() => setShowCreate(true)} />
            )}
            {view === "board" && (
                <LeaderboardView onBackToJoin={() => setOverride("join")} />
            )}
            {view === "results" && (
                <ResultsView onBackToJoin={() => setOverride("join")} />
            )}

            {showCreate && (
                <CreateChallengeModal onClose={() => setShowCreate(false)} />
            )}

            <div style={{ flex: 1 }} />
            <nav className="nav-links">
                {(
                    [
                        ["join", "Join"],
                        ["board", "Leaderboard"],
                        ["results", "Results"],
                    ] as const
                ).map(([v, label]) => (
                    <button
                        key={v}
                        className={`nav-link${view === v ? " nav-link--active" : ""}`}
                        onClick={() => setOverride(v)}
                    >
                        {label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
