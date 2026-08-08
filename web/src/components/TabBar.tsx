type View = "join" | "board" | "results" | "wallet";

interface TabBarProps {
    view: View;
    onSelect: (view: View) => void;
}

const ICON_PROPS = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
};

function HouseIcon() {
    return (
        <svg {...ICON_PROPS}>
            <path d="M3.5 10.5 12 3.5l8.5 7" />
            <path d="M5.5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9" />
            <path d="M9.75 20v-5.25a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1V20" />
        </svg>
    );
}

function PodiumIcon() {
    return (
        <svg {...ICON_PROPS}>
            <path d="M9 20v-9.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75V20" />
            <path d="M15 20v-5.75a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75V19a1 1 0 0 1-1 1" />
            <path d="M9 20v-3.75a.75.75 0 0 0-.75-.75h-4a.75.75 0 0 0-.75.75V19a1 1 0 0 0 1 1h15" />
            <path d="M12 3.25 12.9 5l1.85.3-1.35 1.35.3 1.85L12 7.6l-1.7.9.3-1.85L9.25 5.3 11.1 5z" />
        </svg>
    );
}

function TrophyIcon() {
    return (
        <svg {...ICON_PROPS}>
            <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M7 5.5H4.5v1a3.5 3.5 0 0 0 3 3.46" />
            <path d="M17 5.5h2.5v1a3.5 3.5 0 0 1-3 3.46" />
            <path d="M12 14v3.5" />
            <path d="M8.5 20.5h7" />
            <path d="M9.5 20.5c0-1.66 1.1-3 2.5-3s2.5 1.34 2.5 3" />
        </svg>
    );
}

function WalletIcon() {
    return (
        <svg {...ICON_PROPS}>
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h9A2.5 2.5 0 0 1 18 7.5V8" />
            <path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19h11a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 17.5 8h-11A2.47 2.47 0 0 1 4 7.5z" />
            <path d="M15.75 13.5h.5" />
        </svg>
    );
}

const TABS = [
    { id: "join", label: "Join", icon: HouseIcon },
    { id: "board", label: "Leaderboard", icon: PodiumIcon },
    { id: "results", label: "Results", icon: TrophyIcon },
    { id: "wallet", label: "Wallet", icon: WalletIcon },
] as const satisfies readonly { id: View; label: string; icon: unknown }[];

export function TabBar({ view, onSelect }: TabBarProps) {
    return (
        <nav className="tab-bar" aria-label="Main">
            <div className="tab-bar-inner">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        className={`tab-item${view === id ? " tab-item--active" : ""}`}
                        aria-current={view === id ? "page" : undefined}
                        onClick={() => onSelect(id)}
                    >
                        <Icon />
                        <span className="tab-label">{label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}
