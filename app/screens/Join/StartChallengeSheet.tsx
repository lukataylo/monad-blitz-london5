// 4-step creator wizard for starting a challenge:
// 1 name it, 2 pick the pace, 3 set the stakes, 4 review & launch.
// Rendered from the (main)/index route on top of JoinScreen.
import { useChallengeContext } from "@/context/ChallengeContext";
import { theme } from "@/lib/theme";
import React, { useEffect, useMemo, useState } from "react";
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
import { formatEther, parseEther } from "viem";

const TITLE_MAX = 64;
const TITLE_SUGGESTIONS = [
    "10K Club",
    "Step Wars",
    "Walk It Off",
    "Monday Miles",
] as const;

const PACES = [
    {
        key: "blitz",
        emoji: "⚡",
        label: "Blitz",
        duration: "15 min",
        sec: 15 * 60,
        blurb: "Quick fire — great for testing",
    },
    {
        key: "sprint",
        emoji: "☀️",
        label: "Sprint",
        duration: "1 day",
        sec: 24 * 60 * 60,
        blurb: "One sunny day of steps",
    },
    {
        key: "classic",
        emoji: "📅",
        label: "Classic",
        duration: "1 week",
        sec: 7 * 24 * 60 * 60,
        blurb: "The full seven-day showdown",
    },
    {
        key: "marathon",
        emoji: "🏔",
        label: "Marathon",
        duration: "30 days",
        sec: 30 * 24 * 60 * 60,
        blurb: "For the truly committed",
    },
] as const;

const STAKE_PRESETS = ["0.1", "0.5", "1"] as const;
const MIN_STAKE_WEI = parseEther("0.001");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatEnd(durationSec: number): string {
    const d = new Date(Date.now() + durationSec * 1000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `Ends ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${hh}:${mm}`;
}

/** parseEther-validated stake; null when invalid or below the 0.001 floor. */
function parseStake(text: string): bigint | null {
    try {
        const wei = parseEther(text.trim().replace(",", "."));
        return wei >= MIN_STAKE_WEI ? wei : null;
    } catch {
        return null;
    }
}

type Props = {
    visible: boolean;
    creating?: boolean;
    onClose: () => void;
    onCreate: (stakeWei: bigint, durationSec: number, title: string) => void;
};

const TOTAL_STEPS = 4;

export default function StartChallengeSheet({
    visible,
    creating = false,
    onClose,
    onCreate,
}: Props) {
    const { profile } = useChallengeContext();

    const [step, setStep] = useState(1);
    const [title, setTitle] = useState("");
    const [paceKey, setPaceKey] = useState<(typeof PACES)[number]["key"]>(
        "classic"
    );
    const [stakeText, setStakeText] = useState("0.1");
    const [stakeError, setStakeError] = useState<string | null>(null);

    // Fresh wizard each time the sheet opens.
    useEffect(() => {
        if (visible) setStep(1);
    }, [visible]);

    const pace = PACES.find((p) => p.key === paceKey) ?? PACES[2];
    const stakeWei = useMemo(() => parseStake(stakeText), [stakeText]);
    const trimmedTitle = title.trim();

    const canNext =
        step === 1
            ? trimmedTitle.length > 0
            : step === 3
              ? stakeWei !== null
              : true;

    const goNext = () => {
        if (step === 3 && stakeWei === null) {
            setStakeError("Enter at least 0.001 MON");
            return;
        }
        setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    };

    const handleCreate = () => {
        if (stakeWei === null) {
            setStep(3);
            setStakeError("Enter at least 0.001 MON");
            return;
        }
        onCreate(stakeWei, pace.sec, trimmedTitle.slice(0, TITLE_MAX));
    };

    const stakeDisplay = stakeWei !== null ? formatEther(stakeWei) : stakeText;

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
                    {/* step indicator */}
                    <View style={styles.stepHeader}>
                        {step > 1 ? (
                            <Pressable
                                onPress={() => setStep((s) => Math.max(s - 1, 1))}
                                disabled={creating}
                                hitSlop={8}
                            >
                                <Text style={styles.backText}>← Back</Text>
                            </Pressable>
                        ) : (
                            <View style={styles.backSpacer} />
                        )}
                        <View style={styles.dots}>
                            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i + 1 === step && styles.dotActive,
                                    ]}
                                />
                            ))}
                        </View>
                        <Text style={styles.stepCount}>
                            {step} of {TOTAL_STEPS}
                        </Text>
                    </View>

                    {step === 1 && (
                        <>
                            <Text style={styles.title}>Name your challenge</Text>
                            <Text style={styles.subtitle}>
                                Give it something worth bragging about
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={(t) =>
                                    setTitle(t.slice(0, TITLE_MAX))
                                }
                                maxLength={TITLE_MAX}
                                placeholder="Office Step War"
                                placeholderTextColor={theme.colors.muted}
                                autoCapitalize="words"
                                editable={!creating}
                            />
                            <View style={styles.chipRow}>
                                {TITLE_SUGGESTIONS.map((s) => (
                                    <Pressable
                                        key={s}
                                        onPress={() => setTitle(s)}
                                        style={[
                                            styles.chip,
                                            title === s && styles.chipActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                title === s &&
                                                    styles.chipTextActive,
                                            ]}
                                        >
                                            {s}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <Text style={styles.title}>Pick the pace</Text>
                            <Text style={styles.subtitle}>
                                How long does the war last?
                            </Text>
                            <View style={styles.paceGrid}>
                                {PACES.map((p) => {
                                    const selected = p.key === paceKey;
                                    return (
                                        <Pressable
                                            key={p.key}
                                            onPress={() => setPaceKey(p.key)}
                                            disabled={creating}
                                            style={[
                                                styles.paceCard,
                                                selected &&
                                                    styles.paceCardActive,
                                            ]}
                                        >
                                            <Text style={styles.paceEmoji}>
                                                {p.emoji}
                                            </Text>
                                            <Text style={styles.paceLabel}>
                                                {p.label}
                                            </Text>
                                            <Text style={styles.paceDuration}>
                                                {p.duration}
                                            </Text>
                                            <Text
                                                style={styles.paceBlurb}
                                                numberOfLines={2}
                                            >
                                                {p.blurb}
                                            </Text>
                                            <Text style={styles.paceEnds}>
                                                {formatEnd(p.sec)}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <Text style={styles.title}>Set the stakes</Text>
                            <Text style={styles.subtitle}>
                                Everyone stakes the same to get in
                            </Text>
                            <View style={styles.chipRow}>
                                {STAKE_PRESETS.map((s) => {
                                    const selected =
                                        stakeText.trim() === s;
                                    return (
                                        <Pressable
                                            key={s}
                                            onPress={() => {
                                                setStakeText(s);
                                                setStakeError(null);
                                            }}
                                            style={[
                                                styles.chip,
                                                selected && styles.chipActive,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    selected &&
                                                        styles.chipTextActive,
                                                ]}
                                            >
                                                {s} MON
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <Text style={styles.fieldLabel}>
                                OR A CUSTOM AMOUNT
                            </Text>
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
                                <Text style={styles.errorText}>
                                    {stakeError}
                                </Text>
                            )}
                            <View style={styles.explainer}>
                                <Text style={styles.explainerText}>
                                    🥇 70% · 🥈 30% · 🐢 bottom walker's stake
                                    stays in the pot
                                </Text>
                            </View>
                        </>
                    )}

                    {step === 4 && (
                        <>
                            <Text style={styles.title}>Review & launch</Text>
                            <Text style={styles.subtitle}>
                                One tap and the pot is live
                            </Text>
                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryKey}>
                                        Challenge
                                    </Text>
                                    <Text
                                        style={styles.summaryValue}
                                        numberOfLines={1}
                                    >
                                        {trimmedTitle}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryKey}>Pace</Text>
                                    <Text style={styles.summaryValue}>
                                        {pace.emoji} {pace.label} ·{" "}
                                        {pace.duration}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryKey}>Ends</Text>
                                    <Text style={styles.summaryValue}>
                                        {formatEnd(pace.sec).replace(
                                            "Ends ",
                                            ""
                                        )}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryKey}>Stake</Text>
                                    <Text style={styles.summaryValue}>
                                        {stakeDisplay} MON
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.summaryRow,
                                        styles.summaryRowLast,
                                    ]}
                                >
                                    <Text style={styles.summaryKey}>
                                        Creator
                                    </Text>
                                    <Text style={styles.summaryValue}>
                                        {profile?.name || "You"}
                                    </Text>
                                </View>
                            </View>
                        </>
                    )}

                    {step < TOTAL_STEPS ? (
                        <Pressable
                            onPress={goNext}
                            disabled={creating || !canNext}
                            style={({ pressed }) => [
                                styles.cta,
                                !canNext && styles.ctaDisabled,
                                pressed && canNext && styles.pressed,
                            ]}
                        >
                            <Text style={styles.ctaText}>Next →</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={handleCreate}
                            disabled={creating}
                            style={({ pressed }) => [
                                styles.cta,
                                pressed && !creating && styles.pressed,
                            ]}
                        >
                            {creating ? (
                                <ActivityIndicator
                                    color={theme.colors.white}
                                />
                            ) : (
                                <Text style={styles.ctaText}>
                                    Create & stake {stakeDisplay} MON →
                                </Text>
                            )}
                        </Pressable>
                    )}
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
    // step header
    stepHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    backText: {
        fontFamily: theme.font.semibold,
        fontSize: 14,
        color: theme.colors.ink,
    },
    backSpacer: {
        width: 48,
    },
    dots: {
        flexDirection: "row",
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(17,17,17,0.15)",
    },
    dotActive: {
        backgroundColor: theme.colors.ink,
        width: 20,
    },
    stepCount: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.muted,
        width: 48,
        textAlign: "right",
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
        marginBottom: 16,
    },
    fieldLabel: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.ink,
        opacity: 0.55,
        letterSpacing: 0.4,
        marginTop: 16,
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
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 12,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.white,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.08)",
    },
    chipActive: {
        backgroundColor: theme.colors.ink,
        borderColor: theme.colors.ink,
    },
    chipText: {
        fontFamily: theme.font.semibold,
        fontSize: 14,
        color: theme.colors.ink,
    },
    chipTextActive: {
        color: theme.colors.white,
    },
    // pace grid
    paceGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    paceCard: {
        width: "48%",
        flexGrow: 1,
        backgroundColor: theme.colors.white,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "rgba(17,17,17,0.08)",
        padding: 14,
    },
    paceCardActive: {
        backgroundColor: theme.colors.lime,
        borderColor: theme.colors.ink,
    },
    paceEmoji: {
        fontSize: 22,
    },
    paceLabel: {
        fontFamily: theme.font.heavy,
        fontSize: 17,
        color: theme.colors.ink,
        marginTop: 6,
    },
    paceDuration: {
        fontFamily: theme.font.semibold,
        fontSize: 13,
        color: theme.colors.ink,
        opacity: 0.65,
    },
    paceBlurb: {
        fontFamily: theme.font.medium,
        fontSize: 11,
        color: theme.colors.muted,
        marginTop: 4,
    },
    paceEnds: {
        fontFamily: theme.font.semibold,
        fontSize: 11,
        color: theme.colors.ink,
        opacity: 0.7,
        marginTop: 8,
    },
    // stake explainer
    explainer: {
        backgroundColor: theme.colors.lavender,
        borderRadius: 16,
        padding: 14,
        marginTop: 16,
    },
    explainerText: {
        fontFamily: theme.font.semibold,
        fontSize: 13,
        color: theme.colors.ink,
        lineHeight: 19,
    },
    // review summary
    summaryCard: {
        backgroundColor: theme.colors.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.08)",
        paddingHorizontal: 16,
    },
    summaryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(17,17,17,0.06)",
        gap: 12,
    },
    summaryRowLast: {
        borderBottomWidth: 0,
    },
    summaryKey: {
        fontFamily: theme.font.medium,
        fontSize: 14,
        color: theme.colors.muted,
    },
    summaryValue: {
        fontFamily: theme.font.bold,
        fontSize: 15,
        color: theme.colors.ink,
        flexShrink: 1,
        textAlign: "right",
    },
    cta: {
        backgroundColor: theme.colors.ink,
        borderRadius: theme.radius.pill,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 24,
    },
    ctaDisabled: {
        opacity: 0.35,
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
