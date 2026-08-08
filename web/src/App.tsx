import { useEffect, useState } from "react";
import { CreateChallengeModal } from "./components/CreateChallengeModal";
import { TabBar } from "./components/TabBar";
import { useChallengeContext } from "./context/ChallengeContext";
import { OnboardingModal } from "./onboarding/OnboardingModal";
import { loadProfile } from "./lib/profile";
import { JoinView } from "./views/JoinView";
import { LeaderboardView } from "./views/LeaderboardView";
import { ResultsView } from "./views/ResultsView";
import { WalletView } from "./views/WalletView";

type View = "join" | "board" | "results" | "wallet";

export default function App() {
    const { activeChallengeId, challenge, error, clearError, demoMode } =
        useChallengeContext();
    const [override, setOverride] = useState<View | null>(null);
    // Create-challenge modal lives at App level so its "Challenge is live!"
    // stage survives the auto-switch from Join to Leaderboard.
    const [showCreate, setShowCreate] = useState(false);
    // Mandatory front door: the app is gated behind an account.
    const [onboarded, setOnboarded] = useState(() => loadProfile() != null);

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

    if (!onboarded) {
        return (
            <div className="shell">
                <div className="card card--lime" style={{ marginTop: 24 }}>
                    <div className="caption caption--ink">Walk The Walk</div>
                    <div
                        style={{
                            fontSize: 40,
                            fontWeight: 800,
                            letterSpacing: -1,
                            lineHeight: 1.08,
                            margin: "8px 0 6px",
                        }}
                    >
                        Walk more.
                        <br />
                        Win together.
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.7 }}>
                        Stake MON with your crew — most steps (or squats) wins
                        the pot.
                    </div>
                </div>
                <OnboardingModal
                    mandatory
                    onSaved={() => setOnboarded(true)}
                    onClose={() => {}}
                />
            </div>
        );
    }

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
            {view === "wallet" && <WalletView />}

            {showCreate && (
                <CreateChallengeModal onClose={() => setShowCreate(false)} />
            )}

            <TabBar view={view} onSelect={(v) => setOverride(v)} />
        </div>
    );
}
