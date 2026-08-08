import { useRef, useState } from "react";
import { formatEther } from "viem";
import { useWalletContext, WALLET_KEY } from "../context/WalletContext";
import {
    isValidEmail,
    loadProfile,
    MAX_NAME_LENGTH,
    saveProfile,
    type Profile,
} from "../lib/profile";
import { deriveWallet, generatePassword, requestDrip } from "./deriveWallet";

// Onboarding modal — drop-in replacement for the old ProfileModal body,
// same public contract: onSaved(profile) continues the caller's pending
// action (join/create), onClose dismisses. Three paths:
//   1. Create account — derives an email+password wallet, auto-funds it,
//      and shows the generated password ONCE on screen (never emailed).
//   2. Log in — same derivation, so the same credentials on any device
//      land on the same wallet.
//   3. Skip — keeps today's anonymous random-key wallet, just saves the
//      name/email profile like before.

type Tab = "create" | "login";
type Step = "form" | "warn" | "reveal";
type DripStatus = "idle" | "pending" | "done";

const hasFaucet = Boolean(import.meta.env.VITE_FAUCET_URL);

function fmtMon(wei: bigint): string {
    const n = Number(formatEther(wei));
    return n >= 0.0001 ? n.toFixed(4).replace(/\.?0+$/, "") : "<0.0001";
}

export function OnboardingModal({
    onSaved,
    onClose,
}: {
    onSaved: (profile: Profile) => void;
    onClose: () => void;
}) {
    const { balance, refreshBalance, reloadWallet } = useWalletContext();

    const [tab, setTab] = useState<Tab>("create");
    const [step, setStep] = useState<Step>("form");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [touched, setTouched] = useState(false);
    const [copied, setCopied] = useState(false);
    const [dripStatus, setDripStatus] = useState<DripStatus>("idle");
    // The one-time generated password, shown on the reveal screen.
    const generatedPw = useRef<string>("");
    const savedProfile = useRef<Profile | null>(null);

    const nameOk =
        name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
    const emailOk = isValidEmail(email);
    const canCreate = nameOk && emailOk;
    const canLogin = emailOk && loginPassword.trim().length > 0;

    // Path 3: anonymous — exactly the old ProfileModal behavior.
    const skipAnonymous = () => {
        setTouched(true);
        if (!canCreate) return;
        const profile: Profile = { name: name.trim(), email: email.trim() };
        saveProfile(profile);
        onSaved(profile);
    };

    // Path 1, step 2: actually switch wallets (after the balance warning,
    // if any). Generates the password, derives the key, swaps localStorage,
    // hot-reloads the wallet context, fires the faucet, shows the reveal.
    const createAccount = () => {
        const pw = generatePassword();
        const { privateKey, address } = deriveWallet(email, pw);
        generatedPw.current = pw;
        localStorage.setItem(WALLET_KEY, privateKey);
        const profile: Profile = { name: name.trim(), email: email.trim() };
        saveProfile(profile);
        savedProfile.current = profile;
        // Cheap hot-swap: WalletContext re-reads localStorage and rebuilds
        // clients — no page reload, so the caller's pending action survives.
        reloadWallet();
        if (hasFaucet) {
            setDripStatus("pending");
            requestDrip(address).then((ok) => {
                setDripStatus(ok ? "done" : "idle");
                if (ok) refreshBalance();
            });
        }
        setStep("reveal");
    };

    const submitCreate = () => {
        setTouched(true);
        if (!canCreate) return;
        // The anonymous wallet may hold MON (faucet drips, refunded stakes).
        // Deriving a new key abandons it — warn before switching.
        if (balance > 0n) {
            setStep("warn");
            return;
        }
        createAccount();
    };

    // Path 2: log in with existing credentials. After swapping the key we do
    // a full location.reload(): challenge membership, leaderboard rows and
    // "isYou" flags all hang off the wallet address across other contexts,
    // and a hard reload is the one-liner that rebuilds every one of them
    // consistently (vs. threading a reset through each context).
    const submitLogin = () => {
        setTouched(true);
        if (!canLogin) return;
        const { privateKey } = deriveWallet(email, loginPassword.trim());
        localStorage.setItem(WALLET_KEY, privateKey);
        const existing = loadProfile();
        saveProfile({
            name: existing?.name ?? email.trim().split("@")[0],
            email: email.trim(),
        });
        location.reload();
    };

    const copyPassword = async () => {
        try {
            await navigator.clipboard.writeText(generatedPw.current);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard unavailable — the password is on screen anyway */
        }
    };

    const finishReveal = () => {
        if (savedProfile.current) onSaved(savedProfile.current);
    };

    return (
        <div
            className="modal-overlay"
            onClick={step === "reveal" ? undefined : onClose}
        >
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                {step === "form" && (
                    <>
                        <div className="modal-title">Join the club</div>

                        <div className="onb-tabs">
                            <button
                                className={`onb-tab${tab === "create" ? " onb-tab--active" : ""}`}
                                onClick={() => {
                                    setTab("create");
                                    setTouched(false);
                                }}
                            >
                                Create account
                            </button>
                            <button
                                className={`onb-tab${tab === "login" ? " onb-tab--active" : ""}`}
                                onClick={() => {
                                    setTab("login");
                                    setTouched(false);
                                }}
                            >
                                Log in
                            </button>
                        </div>

                        {tab === "create" && (
                            <>
                                <div>
                                    <div
                                        className="caption"
                                        style={{ marginBottom: 6 }}
                                    >
                                        Your name
                                    </div>
                                    <input
                                        className="field-input"
                                        placeholder="e.g. Maya"
                                        value={name}
                                        maxLength={MAX_NAME_LENGTH}
                                        autoFocus
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                submitCreate();
                                        }}
                                    />
                                    {touched && !nameOk && (
                                        <div className="field-error">
                                            Name is required (max{" "}
                                            {MAX_NAME_LENGTH} chars)
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div
                                        className="caption"
                                        style={{ marginBottom: 6 }}
                                    >
                                        Email
                                    </div>
                                    <input
                                        className="field-input"
                                        type="email"
                                        inputMode="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                submitCreate();
                                        }}
                                    />
                                    {touched && !emailOk && (
                                        <div className="field-error">
                                            Enter a valid email address
                                        </div>
                                    )}
                                </div>

                                <div className="caption">
                                    We'll generate a password so you can log
                                    in from any device
                                </div>

                                <button
                                    className="pill-btn"
                                    onClick={submitCreate}
                                >
                                    Create account →
                                </button>
                                <button
                                    className="text-btn"
                                    onClick={skipAnonymous}
                                >
                                    Skip — stay anonymous
                                </button>
                            </>
                        )}

                        {tab === "login" && (
                            <>
                                <div>
                                    <div
                                        className="caption"
                                        style={{ marginBottom: 6 }}
                                    >
                                        Email
                                    </div>
                                    <input
                                        className="field-input"
                                        type="email"
                                        inputMode="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        autoFocus
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                submitLogin();
                                        }}
                                    />
                                    {touched && !emailOk && (
                                        <div className="field-error">
                                            Enter a valid email address
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div
                                        className="caption"
                                        style={{ marginBottom: 6 }}
                                    >
                                        Password
                                    </div>
                                    <input
                                        className="field-input field-input--mono"
                                        placeholder="lime-walrus-otter-42"
                                        value={loginPassword}
                                        onChange={(e) =>
                                            setLoginPassword(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                submitLogin();
                                        }}
                                    />
                                    {touched &&
                                        loginPassword.trim() === "" && (
                                            <div className="field-error">
                                                Enter the password you were
                                                shown at signup
                                            </div>
                                        )}
                                </div>

                                <div className="caption">
                                    Same email + password = same wallet, on
                                    any device
                                </div>

                                <button
                                    className="pill-btn"
                                    onClick={submitLogin}
                                >
                                    Log in →
                                </button>
                            </>
                        )}

                        <button className="text-btn" onClick={onClose}>
                            Not now
                        </button>
                    </>
                )}

                {step === "warn" && (
                    <>
                        <div className="modal-title">Hold on —</div>
                        <div className="onb-warn">
                            Your current wallet holds{" "}
                            <strong>{fmtMon(balance)} MON</strong>. Creating
                            an account switches to a brand-new wallet and
                            abandons those funds.
                        </div>
                        <button className="pill-btn" onClick={createAccount}>
                            Switch anyway →
                        </button>
                        <button
                            className="pill-btn pill-btn--outline"
                            onClick={skipAnonymous}
                        >
                            Keep current wallet
                        </button>
                        <button
                            className="text-btn"
                            onClick={() => setStep("form")}
                        >
                            Back
                        </button>
                    </>
                )}

                {step === "reveal" && (
                    <>
                        <div className="modal-title">Your password</div>
                        <div className="pw-box">{generatedPw.current}</div>
                        <button className="copy-btn" onClick={copyPassword}>
                            {copied ? "Copied ✓" : "Copy password"}
                        </button>
                        <div className="onb-warn">
                            <strong>Save this</strong> — it's your login on
                            other devices. It's shown only here and never
                            emailed.
                        </div>
                        {dripStatus !== "idle" && (
                            <div className="drip-status">
                                {dripStatus === "pending"
                                    ? "Topping up your wallet…"
                                    : "Topping up your wallet… ✓ 0.15 MON incoming"}
                            </div>
                        )}
                        <button className="pill-btn" onClick={finishReveal}>
                            I saved it →
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
