import { useChallengeContext } from "@/context/ChallengeContext";
import ResultsScreen from "@/screens/Results";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert } from "react-native";

export default function ResultsRoute() {
    const router = useRouter();
    const { challenge, setActiveChallengeId, txPending, claim } = useChallengeContext();
    const [claimed, setClaimed] = useState(false);

    const onClaim = useCallback(async () => {
        try {
            await claim();
            setClaimed(true);
        } catch (e) {
            Alert.alert("Claim failed", e instanceof Error ? e.message : "Unknown error");
        }
    }, [claim]);

    const onRunItBack = useCallback(() => {
        setActiveChallengeId(null);
        router.replace("/");
    }, [setActiveChallengeId, router]);

    return (
        <ResultsScreen
            challenge={challenge?.settled ? challenge : undefined}
            onClaim={onClaim}
            claiming={txPending}
            claimed={claimed}
            onRunItBack={onRunItBack}
        />
    );
}
