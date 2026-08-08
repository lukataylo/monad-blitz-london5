// Tiny theming engine. Themes are pure CSS: index.css defines override
// blocks scoped under [data-theme="…"] on <html>. "cream" is the default
// look and needs no attribute at all.

export type ThemeId = "cream" | "midnight" | "sorbet";

export interface ThemeOption {
    id: ThemeId;
    name: string;
    emoji: string;
    /** Tiny swatch dots shown in the picker. */
    swatch: string[];
}

export const THEMES: ThemeOption[] = [
    {
        id: "cream",
        name: "Cream",
        emoji: "🍦",
        swatch: ["#f7f2e5", "#d9e856", "#c8bdf4"],
    },
    {
        id: "midnight",
        name: "Midnight",
        emoji: "🌙",
        swatch: ["#141412", "#1e1e1b", "#d9e856"],
    },
    {
        id: "sorbet",
        name: "Sorbet",
        emoji: "🍧",
        swatch: ["#fdeee4", "#ffd166", "#ff9fb2"],
    },
];

const STORAGE_KEY = "walkthewalk.theme";

function isThemeId(value: unknown): value is ThemeId {
    return value === "cream" || value === "midnight" || value === "sorbet";
}

export function loadTheme(): ThemeId {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isThemeId(stored)) return stored;
    } catch {
        /* storage unavailable — fall back to default */
    }
    return "cream";
}

export function saveTheme(id: ThemeId): void {
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch {
        /* storage unavailable — theme just won't persist */
    }
}

export function applyTheme(id: ThemeId): void {
    if (id === "cream") {
        delete document.documentElement.dataset.theme;
    } else {
        document.documentElement.dataset.theme = id;
    }
}
