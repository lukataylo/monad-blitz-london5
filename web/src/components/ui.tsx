import { useState } from "react";
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

export function WalletPill() {
    const { address, balance } = useWalletContext();
    const [copied, setCopied] = useState(false);

    const copy = () => {
        if (!address) return;
        navigator.clipboard?.writeText(address).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            className="wallet-pill"
            onClick={copy}
            title={address ?? undefined}
        >
            <span className="dot" />
            {address ? (
                copied ? (
                    <span>Copied!</span>
                ) : (
                    <span>
                        {shortAddr(address)} · {formatMon(balance, 3)} MON
                    </span>
                )
            ) : (
                <span>Creating wallet…</span>
            )}
        </button>
    );
}
