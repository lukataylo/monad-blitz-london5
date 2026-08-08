import { useChallengeContext } from "@/context/ChallengeContext";
import { theme } from "@/lib/theme";
import JoinScreen from "@/screens/Join";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { parseEther } from "viem";

// Demo defaults: 0.1 MON stake, 1-hour challenge (short enough to settle live).
const DEFAULT_STAKE = parseEther("0.1");
const DEFAULT_DURATION_SEC = 60 * 60;

export default function JoinRoute() {
    const router = useRouter();
    const {
        challenge,
        activeChallengeId,
        txPending,
        demoMode,
        join,
        createChallenge,
        setActiveChallengeId,
    } = useChallengeContext();

    const hasJoined = challenge?.participants.some((p) => p.isYou) ?? false;

    const onJoin = useCallback(async () => {
        if (demoMode) {
            router.push("/leaderboard");
            return;
        }
        try {
            if (activeChallengeId !== null && challenge && !hasJoined) {
                await join(activeChallengeId);
            } else if (activeChallengeId === null) {
                await createChallenge(DEFAULT_STAKE, DEFAULT_DURATION_SEC);
            }
            router.push("/leaderboard");
        } catch (e) {
            Alert.alert("Transaction failed", e instanceof Error ? e.message : "Unknown error");
        }
    }, [demoMode, activeChallengeId, challenge, hasJoined, join, createChallenge, router]);

    const onEnterCode = useCallback(() => {
        Alert.prompt(
            "Join a friend's challenge",
            "Enter the challenge number from their invite",
            (text) => {
                const id = Number.parseInt(text, 10);
                if (Number.isFinite(id) && id >= 0) {
                    setActiveChallengeId(id);
                }
            },
            "plain-text",
            "",
            "number-pad",
        );
    }, [setActiveChallengeId]);

    return (
        <>
            <JoinScreen
                challenge={challenge ?? undefined}
                hasJoined={hasJoined}
                joining={txPending}
                onJoin={onJoin}
                inviteUrl={
                    activeChallengeId !== null
                        ? `walkthewalk.mon/${activeChallengeId}`
                        : "walkthewalk.mon/10k"
                }
            />
            {!demoMode && !hasJoined && (
                <Pressable style={styles.codePill} onPress={onEnterCode}>
                    <Text style={styles.codeText}>Have a code?</Text>
                </Pressable>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    codePill: {
        position: "absolute",
        top: 64,
        alignSelf: "center",
        backgroundColor: theme.colors.ink,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    codeText: {
        color: theme.colors.white,
        fontFamily: theme.font.semibold,
        fontSize: 13,
    },
});
