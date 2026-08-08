import { useCallback, useEffect, useRef, useState } from "react";

// Step counting from the phone's accelerometer via DeviceMotion.
// Magnitude of accelerationIncludingGravity is low-pass filtered (EMA) and
// steps are counted on upward threshold crossings with a refractory gap.

export type MotionState = "unsupported" | "prompt" | "granted" | "denied";

const EMA_ALPHA = 0.8; // low-pass smoothing: ema = a*prev + (1-a)*sample
const STEP_THRESHOLD = 11.5; // m/s² — gravity ~9.8, a step spikes above this
const MIN_STEP_GAP_MS = 300; // refractory period ≈ max 3.3 steps/sec

// iOS 13+ gates devicemotion behind a permission prompt that must be
// triggered from a user gesture.
type DMEWithPermission = typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
};

function initialState(): MotionState {
    if (
        typeof window === "undefined" ||
        typeof DeviceMotionEvent === "undefined"
    ) {
        return "unsupported";
    }
    const dme = DeviceMotionEvent as DMEWithPermission;
    // iOS: must ask. Everywhere else events just flow (or never fire on
    // sensor-less desktops, which is harmless).
    return typeof dme.requestPermission === "function" ? "prompt" : "granted";
}

export function useMotionSteps(): {
    state: MotionState;
    steps: number;
    requestPermission: () => Promise<void>;
} {
    const [state, setState] = useState<MotionState>(initialState);
    const [steps, setSteps] = useState(0);

    const emaRef = useRef(0);
    const aboveRef = useRef(false);
    const lastStepAtRef = useRef(0);

    useEffect(() => {
        if (state !== "granted") return;

        const onMotion = (e: DeviceMotionEvent) => {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;
            const { x, y, z } = acc;
            if (x == null || y == null || z == null) return;

            const magnitude = Math.sqrt(x * x + y * y + z * z);
            emaRef.current =
                EMA_ALPHA * emaRef.current + (1 - EMA_ALPHA) * magnitude;
            const filtered = emaRef.current;

            if (filtered > STEP_THRESHOLD) {
                const now = Date.now();
                if (
                    !aboveRef.current &&
                    now - lastStepAtRef.current >= MIN_STEP_GAP_MS
                ) {
                    lastStepAtRef.current = now;
                    setSteps((s) => s + 1);
                }
                aboveRef.current = true;
            } else {
                aboveRef.current = false;
            }
        };

        window.addEventListener("devicemotion", onMotion);
        return () => window.removeEventListener("devicemotion", onMotion);
    }, [state]);

    const requestPermission = useCallback(async () => {
        if (typeof DeviceMotionEvent === "undefined") {
            setState("unsupported");
            return;
        }
        const dme = DeviceMotionEvent as DMEWithPermission;
        if (typeof dme.requestPermission !== "function") {
            setState("granted");
            return;
        }
        try {
            const result = await dme.requestPermission();
            setState(result === "granted" ? "granted" : "denied");
        } catch {
            // Called without a user gesture, or the user dismissed the prompt.
            setState("denied");
        }
    }, []);

    return { state, steps, requestPermission };
}
