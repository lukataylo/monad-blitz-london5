// Which camera exercise a kind-1 ("reps") challenge uses.
//
// The contract only stores kind (0 steps / 1 reps) — NOT the specific
// exercise. The creator's pick is remembered locally per challenge id;
// joiners on other devices default to "squat" and can flip the toggle on
// the leaderboard. Purely cosmetic: reps are reps on-chain either way.

export type StoredExercise = "squat" | "jumping_jack";

const keyFor = (challengeId: number) => `walkthewalk.exercise.${challengeId}`;

export function loadExerciseChoice(challengeId: number): StoredExercise {
    try {
        const v = localStorage.getItem(keyFor(challengeId));
        if (v === "squat" || v === "jumping_jack") return v;
    } catch {
        /* storage unavailable — fall through */
    }
    return "squat";
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
