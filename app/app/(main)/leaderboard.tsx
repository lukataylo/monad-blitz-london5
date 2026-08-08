import { useChallengeContext } from "@/context/ChallengeContext";
import { useSteps } from "@/hooks/useSteps";
import LeaderboardScreen from "@/screens/Leaderboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";

const SUBMIT_INTERVAL_MS = 15_000;

export default function LeaderboardRoute() {
    const router = useRouter();
    const { challenge, activeChallengeId, txPending, demoMode, settle, submitSteps } =
        useChallengeContext();

    // Count steps from the moment this device first saw the challenge (persisted).
    const [startSec, setStartSec] = useState<number | null>(null);
    useEffect(() => {
        if (activeChallengeId === null) return;
        const key = `challengeStart:${activeChallengeId}`;
        AsyncStorage.getItem(key).then((v) => {
            if (v) {
                setStartSec(Number(v));
            } else {
                const now = Math.floor(Date.now() / 1000);
                AsyncStorage.setItem(key, String(now));
                setStartSec(now);
            }
        });
    }, [activeChallengeId]);

    const { steps, addSimulatedSteps } = useSteps(startSec);

    // Auto-submit changed step counts every 15s.
    const lastSubmitted = useRef(0);
    useEffect(() => {
        if (demoMode || activeChallengeId === null) return;
        const t = setInterval(() => {
            if (steps > lastSubmitted.current) {
                lastSubmitted.current = steps;
                submitSteps(steps).catch(() => {
                    lastSubmitted.current = 0; // retry next tick
                });
            }
        }, SUBMIT_INTERVAL_MS);
        return () => clearInterval(t);
    }, [demoMode, activeChallengeId, steps, submitSteps]);

    // When the challenge settles, show the payoff screen.
    useEffect(() => {
        if (challenge?.settled) router.push("/results");
    }, [challenge?.settled, router]);

    const onTabPress = useCallback(
        (tab: string) => {
            if (tab === "home") router.replace("/");
            else if (tab === "person") router.push("/results");
            else if (tab === "plus") addSimulatedSteps(500); // demo safety net
        },
        [router, addSimulatedSteps],
    );

    return (
        <LeaderboardScreen
            challenge={challenge}
            onSettle={() => settle()}
            settling={txPending}
            onTabPress={onTabPress}
        />
    );
}
