// Local profile: name + email, stored in localStorage before the first
// join/create. Only the NAME ever goes on-chain (createChallenge/join);
// the email stays local-only for now — reserved for future notifications.
const PROFILE_KEY = "walkthewalk.profile";

export const MAX_NAME_LENGTH = 32;

export type Profile = {
    name: string;
    email: string;
};

export function loadProfile(): Profile | null {
    try {
        const raw = localStorage.getItem(PROFILE_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as Partial<Profile>;
        if (
            typeof p?.name === "string" &&
            p.name.trim() !== "" &&
            typeof p?.email === "string"
        ) {
            return { name: p.name, email: p.email };
        }
    } catch {
        /* storage unavailable or corrupt — treat as no profile */
    }
    return null;
}

export function saveProfile(profile: Profile): void {
    try {
        localStorage.setItem(
            PROFILE_KEY,
            JSON.stringify({
                name: profile.name.trim().slice(0, MAX_NAME_LENGTH),
                email: profile.email.trim(),
            })
        );
    } catch {
        /* storage unavailable — ignore */
    }
}

export function isValidEmail(email: string): boolean {
    return /^\S+@\S+\.\S+$/.test(email.trim());
}
