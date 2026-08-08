// Which camera exercise a kind-1 ("reps") challenge uses.
//
// The contract only stores kind (0 steps / 1 reps) — NOT the specific
// exercise. The creator's pick is remembered locally per challenge id;
// on devices without a stored choice (joiners) the exercise is inferred
// from the on-chain title (see resolveExercise). There is no in-challenge
// toggle: everyone in a challenge does the same movement. Purely cosmetic
// on-chain: reps are reps either way.

export type StoredExercise = "squat" | "jumping_jack";

const keyFor = (challengeId: number) => `walkthewalk.exercise.${challengeId}`;

/** Stored choice for this challenge on this device, or null if none. */
export function peekExerciseChoice(
    challengeId: number
): StoredExercise | null {
    try {
        const v = localStorage.getItem(keyFor(challengeId));
        if (v === "squat" || v === "jumping_jack") return v;
    } catch {
        /* storage unavailable — fall through */
    }
    return null;
}

export function loadExerciseChoice(challengeId: number): StoredExercise {
    return peekExerciseChoice(challengeId) ?? "squat";
}

/**
 * Resolve the exercise for a kind-1 challenge:
 * 1. the choice stored on this device (the creator's wizard pick), else
 * 2. a title heuristic — jumping-jack names almost always say "jack",
 *    "jump" or "star" ("Jack Attack", "Star Jumpers"); anything else is
 *    treated as squats, the default sport. Keeps joiners on other devices
 *    (no localStorage entry) counting the same movement as the creator.
 */
export function resolveExercise(
    challengeId: number,
    title: string
): StoredExercise {
    const stored = peekExerciseChoice(challengeId);
    if (stored != null) return stored;
    return /jack|jump|star/i.test(title) ? "jumping_jack" : "squat";
}

export function saveExerciseChoice(
    challengeId: number,
    exercise: StoredExercise
): void {
    try {
        localStorage.setItem(keyFor(challengeId), exercise);
    } catch {
        /* storage unavailable — ignore */
    }
}
