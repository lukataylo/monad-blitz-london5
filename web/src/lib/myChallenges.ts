// Registry of every challenge this device has created or joined. The
// contract has no "challenges by wallet" index, so the client keeps one:
// ids are recorded on create/join (and backfilled whenever a fetched
// challenge turns out to include you), then the home screen's "Ongoing"
// section and the leaderboard's history read from it.
const MY_CHALLENGES_KEY = "walkthewalk.myChallenges";
const MAX_TRACKED = 40; // plenty for a hackathon lifetime, bounds RPC fan-out

export function loadMyChallengeIds(): number[] {
    try {
        const raw = localStorage.getItem(MY_CHALLENGES_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (v): v is number =>
                typeof v === "number" && Number.isInteger(v) && v >= 0
        );
    } catch {
        return [];
    }
}

/** Record an id (newest first, de-duped). Returns true if the list changed. */
export function recordMyChallenge(id: number): boolean {
    if (!Number.isInteger(id) || id < 0) return false;
    try {
        const cur = loadMyChallengeIds();
        if (cur.includes(id)) return false;
        const next = [id, ...cur].slice(0, MAX_TRACKED);
        localStorage.setItem(MY_CHALLENGES_KEY, JSON.stringify(next));
        return true;
    } catch {
        return false;
    }
}
