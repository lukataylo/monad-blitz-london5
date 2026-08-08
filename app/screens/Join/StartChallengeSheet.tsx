// Bottom sheet for starting a challenge: stake (MON) + duration pills.
// Rendered from the (main)/index route on top of JoinScreen.
import { theme } from "@/lib/theme";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { parseEther } from "viem";

const DURATIONS = [
    { label: "15 min", sec: 15 * 60 },
    { label: "1 hour", sec: 60 * 60 },
    { label: "1 day", sec: 24 * 60 * 60 },
    { label: "7 days", sec: 7 * 24 * 60 * 60 },
] as const;

type Props = {
    visible: boolean;
    creating?: boolean;
    onClose: () => void;
    onCreate: (stakeWei: bigint, durationSec: number) => void;
};

export default function StartChallengeSheet({
    visible,
    creating = false,
    onClose,
    onCreate,
}: Props) {
    const [stakeText, setStakeText] = useState("0.1");
    const [durationSec, setDurationSec] = useState<number>(60 * 60);
    const [stakeError, setStakeError] = useState<string | null>(null);

    const handleCreate = () => {
        let stakeWei: bigint;
        try {
            stakeWei = parseEther(stakeText.trim().replace(",", "."));
        } catch {
            setStakeError("Enter a valid MON amount");
            return;
        }
        if (stakeWei <= 0n) {
            setStakeError("Stake must be more than 0");
            return;
        }
        setStakeError(null);
        onCreate(stakeWei, durationSec);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <Pressable style={styles.backdropTouch} onPress={onClose} />
                <View style={styles.sheet}>
                    <Text style={styles.title}>Start a challenge</Text>
                    <Text style={styles.subtitle}>
                        Everyone stakes the same. Bottom walker loses.
                    </Text>

                    <Text style={styles.fieldLabel}>STAKE (MON)</Text>
                    <TextInput
                        style={styles.input}
                        value={stakeText}
                        onChangeText={(t) => {
                            setStakeText(t);
                            setStakeError(null);
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0.1"
                        placeholderTextColor={theme.colors.muted}
                        editable={!creating}
                    />
                    {stakeError && (
                        <Text style={styles.errorText}>{stakeError}</Text>
                    )}

                    <Text style={styles.fieldLabel}>DURATION</Text>
                    <View style={styles.pillRow}>
                        {DURATIONS.map((d) => {
                            const selected = d.sec === durationSec;
                            return (
                                <Pressable
                                    key={d.sec}
                                    onPress={() => setDurationSec(d.sec)}
                                    disabled={creating}
                                    style={[
                                        styles.durationPill,
                                        selected && styles.durationPillActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.durationText,
                                            selected &&
                                                styles.durationTextActive,
                                        ]}
                                    >
                                        {d.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <Pressable
                        onPress={handleCreate}
                        disabled={creating}
                        style={({ pressed }) => [
                            styles.cta,
                            pressed && !creating && styles.pressed,
                        ]}
                    >
                        {creating ? (
                            <ActivityIndicator color={theme.colors.white} />
                        ) : (
                            <Text style={styles.ctaText}>Create & stake →</Text>
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(17,17,17,0.45)",
    },
    backdropTouch: {
        flex: 1,
    },
    sheet: {
        backgroundColor: theme.colors.cream,
        borderTopLeftRadius: theme.radius.card,
        borderTopRightRadius: theme.radius.card,
        padding: 24,
        paddingBottom: 40,
    },
    title: {
        fontFamily: theme.font.heavy,
        fontSize: 24,
        color: theme.colors.ink,
    },
    subtitle: {
        fontFamily: theme.font.medium,
        fontSize: 14,
        color: theme.colors.muted,
        marginTop: 4,
    },
    fieldLabel: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.ink,
        opacity: 0.55,
        letterSpacing: 0.4,
        marginTop: 20,
        marginBottom: 8,
    },
    input: {
        backgroundColor: theme.colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.08)",
        paddingHorizontal: 16,
        height: 52,
        fontFamily: theme.font.bold,
        fontSize: 18,
        color: theme.colors.ink,
    },
    errorText: {
        fontFamily: theme.font.medium,
        fontSize: 13,
        color: theme.colors.danger,
        marginTop: 6,
    },
    pillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    durationPill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.white,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.08)",
    },
    durationPillActive: {
        backgroundColor: theme.colors.ink,
        borderColor: theme.colors.ink,
    },
    durationText: {
        fontFamily: theme.font.semibold,
        fontSize: 14,
        color: theme.colors.ink,
    },
    durationTextActive: {
        color: theme.colors.white,
    },
    cta: {
        backgroundColor: theme.colors.ink,
        borderRadius: theme.radius.pill,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 24,
    },
    ctaText: {
        fontFamily: theme.font.bold,
        fontSize: 17,
        color: theme.colors.white,
    },
    pressed: {
        opacity: 0.7,
    },
});
