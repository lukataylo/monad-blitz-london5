import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useWalletContext } from "../context/WalletContext";

const AVATAR_COLORS = ["#D9E856", "#C8BDF4", "#F6C8D8", "#E8B84B"];

export function shortAddr(addr: string): string {
    return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

/** Deterministic color per address — hash into the palette. */
export function avatarColor(addr: string): string {
    let h = 0;
    for (let i = 0; i < addr.length; i++) {
        h = (h * 31 + addr.charCodeAt(i)) | 0;
    }
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function initialOf(name: string, addr: string): string {
    const src = name && name !== "You" ? name : addr.slice(2);
    return (src[0] ?? "?").toUpperCase();
}

export function Avatar({
    name,
    address,
    style,
}: {
    name: string;
    address: string;
    style?: React.CSSProperties;
}) {
    return (
        <div
            className="avatar"
            style={{ background: avatarColor(address), ...style }}
        >
            {initialOf(name, address)}
        </div>
    );
}

export function formatMon(wei: bigint, maxDecimals = 2): string {
    const n = Number(formatEther(wei));
    return n.toLocaleString(undefined, {
        maximumFractionDigits: maxDecimals,
    });
}

/** Wallet glyph — same stroke weight and shape as the tab-bar icon set. */
function WalletGlyph() {
    return (
        <svg
            className="wallet-glyph"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h9A2.5 2.5 0 0 1 18 7.5V8" />
            <path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19h11a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 17.5 8h-11A2.47 2.47 0 0 1 4 7.5z" />
            <path d="M15.75 13.5h.5" />
        </svg>
    );
}

/**
 * Wallet summary: icon + balance at a glance. The address is noise for the
 * common case (and shoulder-surfable), so it lives in a sheet that slides up
 * when the pill is tapped — where the code itself is the copy button.
 */
export function WalletPill() {
    const { address, balance } = useWalletContext();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = () => {
        if (!address) return;
        navigator.clipboard?.writeText(address).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    // Esc closes, matching the tap-outside affordance.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <>
            <button
                className="wallet-pill"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <WalletGlyph />
                <span>
                    {address
                        ? `${formatMon(balance, 3)} MON`
                        : "Creating wallet…"}
                </span>
            </button>

            {open && (
                <div className="wallet-scrim" onClick={() => setOpen(false)}>
                    <div
                        className="wallet-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Your wallet"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="wallet-grab" aria-hidden />
                        <div className="caption">Your wallet</div>
                        <div className="wallet-balance">
                            {formatMon(balance, 3)} MON
                        </div>
                        <div className="caption wallet-hint">
                            {copied
                                ? "Copied to clipboard ✓"
                                : "Tap the code to copy"}
                        </div>
                        <button
                            className={`wallet-code${
                                copied ? " wallet-code--copied" : ""
                            }`}
                            onClick={copy}
                            disabled={!address}
                        >
                            {address ?? "Creating wallet…"}
                        </button>
                        <button
                            className="pill-btn"
                            onClick={() => setOpen(false)}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
