import { useState } from "react";
import {
    isValidEmail,
    MAX_NAME_LENGTH,
    saveProfile,
    type Profile,
} from "../lib/profile";

// "Join the club" — collected once before the first join/create.
// Name goes on-chain with join/createChallenge; email stays in localStorage
// (future notifications).
export function ProfileModal({
    onSaved,
    onClose,
}: {
    onSaved: (profile: Profile) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [touched, setTouched] = useState(false);

    const nameOk = name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
    const emailOk = isValidEmail(email);
    const canSave = nameOk && emailOk;

    const save = () => {
        setTouched(true);
        if (!canSave) return;
        const profile: Profile = { name: name.trim(), email: email.trim() };
        saveProfile(profile);
        onSaved(profile);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">Join the club</div>

                <div>
                    <div className="caption" style={{ marginBottom: 6 }}>
                        Your name
                    </div>
                    <input
                        className="field-input"
                        placeholder="e.g. Maya"
                        value={name}
                        maxLength={MAX_NAME_LENGTH}
                        autoFocus
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") save();
                        }}
                    />
                    {touched && !nameOk && (
                        <div className="field-error">
                            Name is required (max {MAX_NAME_LENGTH} chars)
                        </div>
                    )}
                </div>

                <div>
                    <div className="caption" style={{ marginBottom: 6 }}>
                        Email
                    </div>
                    <input
                        className="field-input"
                        type="email"
                        inputMode="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") save();
                        }}
                    />
                    {touched && !emailOk && (
                        <div className="field-error">
                            Enter a valid email address
                        </div>
                    )}
                </div>

                <div className="caption">
                    We'll use this to show you on the leaderboard
                </div>

                <button className="pill-btn" onClick={save}>
                    Save & continue →
                </button>
                <button className="text-btn" onClick={onClose}>
                    Not now
                </button>
            </div>
        </div>
    );
}
