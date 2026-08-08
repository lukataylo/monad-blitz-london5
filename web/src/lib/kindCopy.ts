// Kind-aware copy. Every place the UI talks about the sport goes through
// here so a squat challenge never reads like a reskinned step challenge.
//
// The contract only stores kind (0 steps / 1 reps); the specific exercise
// for kind 1 comes from lib/exerciseChoice.ts localStorage (creator's pick,
// "squat" fallback for joiners).

import {
    loadExerciseChoice,
    resolveExercise,
    type StoredExercise,
} from "./exerciseChoice";

export type ChallengeKind = 0 | 1;

export interface KindCopy {
    /** score unit shown next to numbers */
    unit: "steps" | "reps";
    /** present participle — "3 walking so far" */
    verb: string;
    /** past tense — "You walked." */
    verbPast: string;
    /** sport emoji sticker */
    emoji: string;
    /** meta chip — "🏋️ Squat challenge" */
    sportChip: string;
    /** two-line hero tagline */
    tagline: [string, string];
    /** hero subtitle — "Stake MON. Most steps wins." */
    heroSub: string;
    /** subtitle under a live pot amount */
    potSub: string;
    /** invite hero count — "3 walking so far" */
    inviteCount: (n: number) => string;
    /** leaderboard headline, split so the verb gets the highlight */
    boardTitle: { pre: string; highlight: string; post: string };
    /** what to call a participant — "Walker" / "Athlete" */
    athleteNoun: string;
    /** CTA after creating — "Let's walk →" */
    letsGo: string;
    /** native-share blurb */
    shareText: (stake: string) => string;
    /** caption under the camera-off state (kind 1 only) */
    cameraCaption: string;
}

const STEPS: KindCopy = {
    unit: "steps",
    verb: "walking",
    verbPast: "walked",
    emoji: "👟",
    sportChip: "👟 Step challenge",
    tagline: ["Walk more.", "Win together."],
    heroSub: "Stake MON. Most steps wins.",
    potSub: "In the pot — walk more, win together.",
    inviteCount: (n) => `${n} walking so far`,
    boardTitle: { pre: "Who's ", highlight: "walking", post: " the walk?" },
    athleteNoun: "Walker",
    letsGo: "Let's walk →",
    shareText: (stake) => `Stake ${stake} MON, most steps wins. You in?`,
    cameraCaption: "",
};

const SQUAT: KindCopy = {
    unit: "reps",
    verb: "squatting",
    verbPast: "squatted",
    emoji: "🏋️",
    sportChip: "🏋️ Squat challenge",
    tagline: ["Drop low.", "Win big."],
    heroSub: "Stake MON. Most squats wins.",
    potSub: "In the pot — squat more, win together.",
    inviteCount: (n) => `${n} squatting so far`,
    boardTitle: { pre: "Who's ", highlight: "dropping", post: " the lowest?" },
    athleteNoun: "Athlete",
    letsGo: "Let's squat →",
    shareText: (stake) =>
        `Squat challenge — stake ${stake} MON, most reps wins. You in?`,
    cameraCaption:
        "Your camera counts your squats — reps sync on-chain automatically",
};

const JACK: KindCopy = {
    unit: "reps",
    verb: "jumping",
    verbPast: "jumped",
    emoji: "⭐",
    sportChip: "⭐ Jumping jacks",
    tagline: ["Jump more.", "Win together."],
    heroSub: "Stake MON. Most jacks wins.",
    potSub: "In the pot — jump more, win together.",
    inviteCount: (n) => `${n} jumping so far`,
    boardTitle: { pre: "Who's ", highlight: "jumping", post: " the most?" },
    athleteNoun: "Athlete",
    letsGo: "Let's jump →",
    shareText: (stake) =>
        `Jumping-jack challenge — stake ${stake} MON, most reps wins. You in?`,
    cameraCaption:
        "Your camera counts your jacks — reps sync on-chain automatically",
};

/** Copy for a kind + explicit exercise (kind 1 defaults to squats). */
export function getKindCopy(
    kind: ChallengeKind,
    exercise: StoredExercise = "squat"
): KindCopy {
    if (kind === 0) return STEPS;
    return exercise === "jumping_jack" ? JACK : SQUAT;
}

/**
 * Copy for a loaded challenge: kind from chain, exercise from the local
 * per-challenge choice — or, when this device has none (joiners), inferred
 * from the on-chain title when one is passed (see resolveExercise).
 */
export function copyForChallenge(
    kind: ChallengeKind,
    challengeId: number | null | undefined,
    title?: string
): KindCopy {
    if (kind !== 1) return STEPS;
    if (challengeId == null) return getKindCopy(1, "squat");
    return getKindCopy(
        1,
        title != null
            ? resolveExercise(challengeId, title)
            : loadExerciseChoice(challengeId)
    );
}
