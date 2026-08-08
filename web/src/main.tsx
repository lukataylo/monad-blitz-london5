import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ChallengeProvider } from "./context/ChallengeContext";
import { WalletProvider } from "./context/WalletContext";
import { applyTheme, loadTheme } from "./lib/theme";
import "./index.css";

// Apply the saved theme before the first paint so there's no flash of cream.
applyTheme(loadTheme());

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <WalletProvider>
            <ChallengeProvider>
                <App />
            </ChallengeProvider>
        </WalletProvider>
    </StrictMode>
);

// PWA: offline shell + cached MediaPipe models. Prod only — the dev server
// must never be shadowed by a stale cache.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((e) => {
            console.warn("SW registration failed", e);
        });
    });
}
