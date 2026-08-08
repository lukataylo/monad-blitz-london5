import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ChallengeProvider } from "./context/ChallengeContext";
import { WalletProvider } from "./context/WalletContext";
import "./index.css";

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
