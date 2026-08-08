import { useRef, useState } from "react";
import { formatEther } from "viem";
import { useWalletContext, WALLET_KEY } from "../context/WalletContext";
import { loadProfile } from "../lib/profile";
import { requestDrip } from "../onboarding/deriveWallet";

// Mirrors PROFILE_KEY in src/lib/profile.ts (not exported there).
const PROFILE_STORAGE_KEY = "walkthewalk.profile";

const hasFaucet = Boolean(import.meta.env.VITE_FAUCET_URL);

// MON with at most 4 decimals, trailing zeros trimmed.
function formatMon(wei: bigint): string {
    const [int, frac = ""] = formatEther(wei).split(".");
    const trimmed = frac.slice(0, 4).replace(/0+$/, "");
    return trimmed ? `${int}.${trimmed}` : int;
}

type DripStatus = "idle" | "pending" | "ok" | "already";

export function WalletView() {
    const { address, balance, refreshBalance } = useWalletContext();
    const profile = loadProfile();

    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [dripStatus, setDripStatus] = useState<DripStatus>("idle");
    const [confirmLogout, setConfirmLogout] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshBalance();
        } finally {
            // Keep the spin visible long enough to read as feedback.
            setTimeout(() => setRefreshing(false), 400);
        }
    };

    const handleCopy = async () => {
        if (!address) return;
        try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            if (copyTimer.current) clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable — ignore */
        }
    };

    const handleDrip = async () => {
        if (!address || dripStatus === "pending") return;
        setDripStatus("pending");
        const ok = await requestDrip(address);
        setDripStatus(ok ? "ok" : "already");
        if (ok) {
            // Balance lands within a block or two; poll a refresh soon.
            setTimeout(() => refreshBalance(), 4000);
        }
    };

    const handleLogout = () => {
        try {
            localStorage.removeItem(WALLET_KEY);
            localStorage.removeItem(PROFILE_STORAGE_KEY);
        } catch {
            /* storage unavailable — reload anyway */
        }
        location.reload();
    };

    return (
        <>
            <div className="card card--lavender">
                <div className="caption caption--ink">Your wallet</div>
                <div className="wallet-balance-row">
                    <div className="wallet-balance">
                        {formatMon(balance)}
                        <span className="mon-unit">MON</span>
                    </div>
                    <button
                        type="button"
                        className={`icon-btn${refreshing ? " icon-btn--spin" : ""}`}
                        onClick={handleRefresh}
                        disabled={refreshing}
                        aria-label="Refresh balance"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                            <path d="M20 3.5V8h-4.5" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="caption">Address</div>
                <div className="wallet-address">{address ?? "—"}</div>
                <button
                    className="pill-btn"
                    style={{ marginTop: 14 }}
                    onClick={handleCopy}
                    disabled={!address}
                >
                    {copied ? "Copied ✓" : "Copy address"}
                </button>
                {address && (
                    <a
                        className="explorer-link"
                        href={`https://testnet.monadexplorer.com/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View on MonadVision explorer
                    </a>
                )}
            </div>

            <div className="card">
                <div className="caption">Top up</div>
                {balance === 0n ? (
                    <>
                        <button
                            className="pill-btn"
                            style={{ marginTop: 12 }}
                            onClick={handleDrip}
                            disabled={
                                !address || !hasFaucet || dripStatus === "pending"
                            }
                        >
                            {dripStatus === "pending" && (
                                <span className="spinner" />
                            )}
                            {dripStatus === "pending"
                                ? "Requesting…"
                                : "Get free test MON"}
                        </button>
                        {dripStatus === "ok" && (
                            <div className="drip-status" style={{ marginTop: 10 }}>
                                0.5 MON incoming ✓
                            </div>
                        )}
                        {dripStatus === "already" && (
                            <div className="drip-status" style={{ marginTop: 10 }}>
                                This wallet was already funded
                            </div>
                        )}
                        {!hasFaucet && (
                            <div className="drip-status" style={{ marginTop: 10 }}>
                                Faucet not configured — ask the organizer
                            </div>
                        )}
                    </>
                ) : (
                    <div className="wallet-note">
                        Need more? The faucet drips only to empty wallets — ask
                        the organizer.
                    </div>
                )}
            </div>

            <div className="card">
                <div className="caption">Account</div>
                {profile ? (
                    <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                            {profile.name}
                        </div>
                        {profile.email && (
                            <div className="wallet-email">{profile.email}</div>
                        )}
                    </div>
                ) : (
                    <div className="wallet-note">No profile saved yet.</div>
                )}
                <div className="wallet-note" style={{ marginTop: 10 }}>
                    Signed in with email — same email + password opens this
                    wallet on any device.
                </div>
                {confirmLogout ? (
                    <div className="logout-confirm">
                        <span>
                            Log out? Your password is the only way back in.
                        </span>
                        <div className="logout-confirm-actions">
                            <button
                                className="chip-btn chip-btn--danger"
                                onClick={handleLogout}
                            >
                                Log out
                            </button>
                            <button
                                className="chip-btn"
                                onClick={() => setConfirmLogout(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="text-btn"
                        style={{ marginTop: 8 }}
                        onClick={() => setConfirmLogout(true)}
                    >
                        Log out
                    </button>
                )}
            </div>
        </>
    );
}
