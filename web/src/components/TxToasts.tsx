import { useEffect, useRef, useState } from "react";
import { subscribeTx, type TxEvent } from "../lib/txFeed";

const EXPLORER_TX = "https://testnet.monadexplorer.com/tx/";
const MAX_TOASTS = 3;
const DISMISS_MS = 5000;

interface Toast extends TxEvent {
    key: number;
}

function shortHash(hash: string): string {
    return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** 640 -> "0.6s", 1240 -> "1.2s" */
function formatMs(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * "Live on Monad" toast stack: every landed transaction flashes a pill
 * with how fast it confirmed and a link to the explorer. Sits just above
 * the bottom tab bar; each toast auto-dismisses after 5s or on tap.
 */
export function TxToasts() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextKey = useRef(0);
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const timerMap = timers.current;
        const dismiss = (key: number) => {
            const t = timerMap.get(key);
            if (t != null) clearTimeout(t);
            timerMap.delete(key);
            setToasts((prev) => prev.filter((x) => x.key !== key));
        };
        const unsubscribe = subscribeTx((e) => {
            const key = nextKey.current++;
            setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { ...e, key }]);
            timerMap.set(
                key,
                setTimeout(() => dismiss(key), DISMISS_MS)
            );
        });
        return () => {
            unsubscribe();
            for (const t of timerMap.values()) clearTimeout(t);
            timerMap.clear();
        };
    }, []);

    const dismissToast = (key: number) => {
        const t = timers.current.get(key);
        if (t != null) clearTimeout(t);
        timers.current.delete(key);
        setToasts((prev) => prev.filter((x) => x.key !== key));
    };

    if (toasts.length === 0) return null;

    return (
        <div className="tx-toasts" aria-live="polite">
            {toasts.map((toast) => (
                <div
                    key={toast.key}
                    className="tx-toast"
                    onClick={() => dismissToast(toast.key)}
                >
                    <span className="dot" aria-hidden="true" />
                    <span>
                        {toast.label}
                        {toast.ms != null && ` in ${formatMs(toast.ms)}`}
                        {" · Monad"}
                    </span>
                    <a
                        href={`${EXPLORER_TX}${toast.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {shortHash(toast.hash)}
                    </a>
                </div>
            ))}
        </div>
    );
}
