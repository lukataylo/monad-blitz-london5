import { formatMon } from "./ui";
import type { ChallengeSummary } from "../hooks/useMyChallenges";

// Compact rows used by the home screen's "Ongoing challenges" section and
// the leaderboard's history. Tapping one makes it the active challenge —
// the App's auto-view routing then lands on the right screen (board for
// running, results for ended/settled).

function timeLeftShort(secs: number): string {
    if (secs <= 0) return "ended";
    if (secs < 90) return `${Math.ceil(secs)}s left`;
    if (secs < 3600) return `${Math.round(secs / 60)}m left`;
    if (secs < 172800) return `${Math.round(secs / 3600)}h left`;
    return `${Math.round(secs / 86400)}d left`;
}

function rankLabel(rank: number | null): string | null {
    if (rank == null) return null;
    const suffix =
        rank % 10 === 1 && rank % 100 !== 11
            ? "st"
            : rank % 10 === 2 && rank % 100 !== 12
              ? "nd"
              : rank % 10 === 3 && rank % 100 !== 13
                ? "rd"
                : "th";
    return `${rank}${suffix}`;
}

export function ChallengeSummaryRow({
    summary,
    onOpen,
    history = false,
}: {
    summary: ChallengeSummary;
    onOpen: (id: number) => void;
    /** ended/settled style — muted, outcome-focused */
    history?: boolean;
}) {
    const s = summary;
    const now = Date.now() / 1000;
    const running = !s.settled && s.endTime > now;
    const emoji = s.kind === 1 ? "🏋️" : "🚶";
    const rank = rankLabel(s.yourRank);

    return (
        <button
            type="button"
            className={`chal-row${history ? " chal-row--history" : ""}`}
            onClick={() => onOpen(s.id)}
        >
            <span className="chal-row-emoji" aria-hidden>
                {emoji}
            </span>
            <span className="chal-row-main">
                <span className="chal-row-title">
                    {s.title.trim() || `Challenge #${s.id}`}
                </span>
                <span className="chal-row-meta">
                    {running
                        ? `${timeLeftShort(s.endTime - now)} · ${formatMon(s.pot, 2)} MON pot`
                        : `${s.settled ? "settled" : "ended"} · ${formatMon(s.pot, 2)} MON pot`}
                    {s.participantCount > 1
                        ? ` · ${s.participantCount} in`
                        : " · solo so far"}
                </span>
            </span>
            {rank != null && (
                <span
                    className={`chal-row-rank${
                        s.yourRank === 1 ? " chal-row-rank--lead" : ""
                    }`}
                >
                    {s.yourRank === 1 && running ? "leading" : rank}
                </span>
            )}
            <span className="chal-row-arrow" aria-hidden>
                →
            </span>
        </button>
    );
}
