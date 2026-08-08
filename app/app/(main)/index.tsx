import { useChallengeContext } from "@/context/ChallengeContext";
import { useWalletContext } from "@/context/WalletContext";
import { theme } from "@/lib/theme";
import JoinScreen from "@/screens/Join";
import StartChallengeSheet from "@/screens/Join/StartChallengeSheet";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function inviteMessage(id: number): string {
    return `Join my Walk The Walk challenge! Open walk-the-walk-production.up.railway.app?c=${id} or enter code ${id} in the app`;
}

type PendingAction = "join" | "create" | null;

/** One-time signup: name + email, saved to the local profile. */
function SignupModal({
    visible,
    onClose,
    onSubmit,
}: {
    visible: boolean;
    onClose: () => void;
    onSubmit: (name: string, email: string) => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        if (!trimmedName) {
            setError("Please enter your name");
            return;
        }
        if (trimmedName.length > 32) {
            setError("Name must be 32 characters or fewer");
            return;
        }
        if (!EMAIL_RE.test(trimmedEmail)) {
            setError("Please enter a valid email");
            return;
        }
        setError(null);
        onSubmit(trimmedName, trimmedEmail);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.signupBackdrop}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.signupCard}>
                    <Text style={styles.signupTitle}>Who's walking?</Text>
                    <Text style={styles.signupCaption}>
                        We'll use this to show you on the leaderboard
                    </Text>
                    <TextInput
                        style={styles.signupInput}
                        value={name}
                        onChangeText={(t) => {
                            setName(t);
                            setError(null);
                        }}
                        placeholder="Your name"
                        placeholderTextColor={theme.colors.muted}
                        maxLength={32}
                        autoCapitalize="words"
                        autoCorrect={false}
                    />
                    <TextInput
                        style={styles.signupInput}
                        value={email}
                        onChangeText={(t) => {
                            setEmail(t);
                            setError(null);
                        }}
                        placeholder="Email"
                        placeholderTextColor={theme.colors.muted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {error && <Text style={styles.signupError}>{error}</Text>}
                    <Pressable
                        onPress={handleSubmit}
                        style={({ pressed }) => [
                            styles.signupCta,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text style={styles.signupCtaText}>Let's walk →</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default function JoinRoute() {
    const router = useRouter();
    const {
        challenge,
        activeChallengeId,
        txPending,
        demoMode,
        profile,
        setProfile,
        join,
        createChallenge,
        setActiveChallengeId,
    } = useChallengeContext();
    const { address, balance } = useWalletContext();

    const [signupVisible, setSignupVisible] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);

    const onCopyAddress = useCallback(() => {
        if (address) Clipboard.setStringAsync(address);
    }, [address]);

    const hasJoined = challenge?.participants.some((p) => p.isYou) ?? false;

    const runAction = useCallback(
        async (action: Exclude<PendingAction, null>) => {
            if (action === "create") {
                setCreateVisible(true);
                return;
            }
            if (activeChallengeId === null) return;
            try {
                await join(activeChallengeId);
                router.push("/leaderboard");
            } catch (e) {
                Alert.alert(
                    "Transaction failed",
                    e instanceof Error ? e.message : "Unknown error"
                );
            }
        },
        [activeChallengeId, join, router]
    );

    const onJoin = useCallback(async () => {
        const action: PendingAction =
            activeChallengeId !== null && challenge && !hasJoined
                ? "join"
                : activeChallengeId === null
                  ? "create"
                  : null;
        if (action === null) {
            router.push("/leaderboard");
            return;
        }
        if (!profile) {
            setPendingAction(action);
            setSignupVisible(true);
            return;
        }
        await runAction(action);
    }, [
        activeChallengeId,
        challenge,
        hasJoined,
        profile,
        runAction,
        router,
    ]);

    const onSignupSubmit = useCallback(
        (name: string, email: string) => {
            setProfile({ name, email });
            setSignupVisible(false);
            const action = pendingAction;
            setPendingAction(null);
            if (action) runAction(action);
        },
        [setProfile, pendingAction, runAction]
    );

    const onCreate = useCallback(
        async (stakeWei: bigint, durationSec: number, title: string) => {
            const id = await createChallenge(stakeWei, durationSec, title);
            if (id === null) {
                Alert.alert(
                    "Create failed",
                    "The challenge could not be created. Check your balance and try again."
                );
                return;
            }
            setCreateVisible(false);
            try {
                await Share.share({ message: inviteMessage(id) });
            } catch {
                // user dismissed the share sheet — nothing to do
            }
            router.push("/leaderboard");
        },
        [createChallenge, router]
    );

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
            "number-pad"
        );
    }, [setActiveChallengeId]);

    return (
        <>
            <JoinScreen
                challenge={challenge}
                hasJoined={hasJoined}
                joining={txPending}
                onJoin={onJoin}
                inviteUrl={
                    activeChallengeId !== null
                        ? `walk-the-walk-production.up.railway.app?c=${activeChallengeId}`
                        : "walk-the-walk-production.up.railway.app"
                }
                walletAddress={address}
                walletBalance={balance}
                onCopyAddress={onCopyAddress}
            />
            {!demoMode && !hasJoined && (
                <Pressable style={styles.codePill} onPress={onEnterCode}>
                    <Text style={styles.codeText}>Have a code?</Text>
                </Pressable>
            )}
            <SignupModal
                visible={signupVisible}
                onClose={() => {
                    setSignupVisible(false);
                    setPendingAction(null);
                }}
                onSubmit={onSignupSubmit}
            />
            <StartChallengeSheet
                visible={createVisible}
                creating={txPending}
                onClose={() => {
                    if (!txPending) setCreateVisible(false);
                }}
                onCreate={onCreate}
            />
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
    pressed: {
        opacity: 0.7,
    },
    // Signup modal
    signupBackdrop: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: "rgba(17,17,17,0.45)",
    },
    signupCard: {
        backgroundColor: theme.colors.cream,
        borderRadius: theme.radius.card,
        padding: 24,
    },
    signupTitle: {
        fontFamily: theme.font.heavy,
        fontSize: 24,
        color: theme.colors.ink,
    },
    signupCaption: {
        fontFamily: theme.font.medium,
        fontSize: 14,
        color: theme.colors.muted,
        marginTop: 4,
        marginBottom: 16,
    },
    signupInput: {
        backgroundColor: theme.colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.08)",
        paddingHorizontal: 16,
        height: 52,
        fontFamily: theme.font.semibold,
        fontSize: 16,
        color: theme.colors.ink,
        marginBottom: 10,
    },
    signupError: {
        fontFamily: theme.font.medium,
        fontSize: 13,
        color: theme.colors.danger,
        marginBottom: 4,
    },
    signupCta: {
        backgroundColor: theme.colors.ink,
        borderRadius: theme.radius.pill,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    signupCtaText: {
        fontFamily: theme.font.bold,
        fontSize: 17,
        color: theme.colors.white,
    },
});
