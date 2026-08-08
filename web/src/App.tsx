import { useEffect, useState } from "react";
import { useChallengeContext } from "./context/ChallengeContext";
import { JoinView } from "./views/JoinView";
import { LeaderboardView } from "./views/LeaderboardView";
import { ResultsView } from "./views/ResultsView";

type View = "join" | "board" | "results";

export default function App() {
    const { activeChallengeId, challenge, error, demoMode } =
        useChallengeContext();
    const [override, setOverride] = useState<View | null>(null);

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
                    Demo mode · no contract configured
                </div>
            )}
            {error && <div className="error-banner">{error}</div>}

            {view === "join" && <JoinView />}
            {view === "board" && <LeaderboardView />}
            {view === "results" && <ResultsView />}

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
