import { Pedometer } from "expo-sensors";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

const REFRESH_INTERVAL_MS = 30_000;

export interface UseStepsResult {
    /** total steps since `sinceUnixSec`: pedometer + simulated */
    steps: number;
    source: "pedometer" | "simulated";
    /** true when a hardware pedometer is present and permitted */
    available: boolean;
    /** demo safety net — adds steps that count toward the total everywhere */
    addSimulatedSteps: (n: number) => void;
}

/**
 * Tracks steps taken since `sinceUnixSec` (unix seconds).
 *
 * iOS: queries CoreMotion history (7-day window) on mount, on foreground,
 * and every 30s while active; a live watchStepCount subscription fills the
 * gap between historical re-queries (the re-query result wins, so live
 * deltas are reset whenever a historical result lands — no double counting).
 *
 * Anywhere the pedometer is unavailable (Android history, simulators, web)
 * the hook degrades to the simulated counter only. Never throws.
 */
export function useSteps(sinceUnixSec: number | null): UseStepsResult {
    const [available, setAvailable] = useState(false);
    const [historical, setHistorical] = useState(0);
    const [liveDelta, setLiveDelta] = useState(0);
    const [simulated, setSimulated] = useState(0);

    // Cumulative count reported by watchStepCount since subscription start.
    const watchCountRef = useRef(0);
    // watchStepCount reading at the time of the last historical query result.
    const watchBaseRef = useRef(0);
    const sinceRef = useRef(sinceUnixSec);
    sinceRef.current = sinceUnixSec;

    // ---- availability + permissions ----
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await Pedometer.requestPermissionsAsync();
            } catch {
                // permission API may be missing on some platforms — ignore
            }
            try {
                const ok = await Pedometer.isAvailableAsync();
                if (!cancelled) setAvailable(ok);
            } catch {
                if (!cancelled) setAvailable(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // ---- historical query (iOS keeps ~7 days of history) ----
    const queryHistorical = useCallback(async () => {
        const since = sinceRef.current;
        if (!available || since == null || Platform.OS !== "ios") return;
        try {
            const result = await Pedometer.getStepCountAsync(
                new Date(since * 1000),
                new Date()
            );
            setHistorical(result.steps);
            // Historical result wins; live deltas restart from here.
            watchBaseRef.current = watchCountRef.current;
            setLiveDelta(0);
        } catch {
            // getStepCountAsync throws where unsupported — keep last value
        }
    }, [available]);

    useEffect(() => {
        if (!available || sinceUnixSec == null) {
            setHistorical(0);
            setLiveDelta(0);
            return;
        }
        queryHistorical();

        let interval: ReturnType<typeof setInterval> | null = null;
        const startInterval = () => {
            if (interval == null) {
                interval = setInterval(queryHistorical, REFRESH_INTERVAL_MS);
            }
        };
        const stopInterval = () => {
            if (interval != null) {
                clearInterval(interval);
                interval = null;
            }
        };
        if (AppState.currentState === "active") startInterval();

        const appStateSub = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                queryHistorical();
                startInterval();
            } else {
                stopInterval();
            }
        });

        // Live foreground deltas between historical re-queries.
        let watchSub: { remove: () => void } | null = null;
        try {
            watchCountRef.current = 0;
            watchBaseRef.current = 0;
            watchSub = Pedometer.watchStepCount((result) => {
                watchCountRef.current = result.steps;
                setLiveDelta(
                    Math.max(result.steps - watchBaseRef.current, 0)
                );
            });
        } catch {
            watchSub = null;
        }

        return () => {
            stopInterval();
            appStateSub.remove();
            watchSub?.remove();
        };
    }, [available, sinceUnixSec, queryHistorical]);

    const addSimulatedSteps = useCallback((n: number) => {
        if (!Number.isFinite(n)) return;
        setSimulated((prev) => Math.max(prev + Math.floor(n), 0));
    }, []);

    const pedometerSteps = Math.max(historical + liveDelta, 0);
    return {
        steps: pedometerSteps + simulated,
        source:
            available && sinceUnixSec != null ? "pedometer" : "simulated",
        available,
        addSimulatedSteps,
    };
}
