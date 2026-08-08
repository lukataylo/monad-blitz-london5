// Screen 1 — Join: hero pot, chips, avatars, stake & join CTA, invite card.
// Presentational: all props optional, renders standalone off MOCK_CHALLENGE.
import Avatar from "@/components/ui/Avatar";
import { MOCK_CHALLENGE } from "@/lib/mock";
import { theme } from "@/lib/theme";
import { Challenge } from "@/lib/types";
import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { formatEther } from "viem";

const MOCK_MON_USD = 16.84; // mock rate for the ≈ $ line

type JoinScreenProps = {
    challenge?: Challenge;
    hasJoined?: boolean;
    joining?: boolean;
    onJoin?: () => void;
    inviteUrl?: string;
};

function CircleButton({ children }: { children: React.ReactNode }) {
    return (
        <Pressable style={({ pressed }) => [styles.circleBtn, pressed && styles.pressed]}>
            {children}
        </Pressable>
    );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <View style={styles.chip}>
            {icon}
            <Text style={styles.chipText}>{label}</Text>
        </View>
    );
}

export default function JoinScreen({
    challenge = MOCK_CHALLENGE,
    hasJoined = false,
    joining = false,
    onJoin = () => {},
    inviteUrl = "walkthewalk.mon/10k",
}: JoinScreenProps) {
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (copyTimer.current) clearTimeout(copyTimer.current);
        };
    }, []);

    const stakeMon = formatEther(challenge.stake);
    const potMon = formatEther(challenge.pot);
    const stakeUsd = (Number(stakeMon) * MOCK_MON_USD).toFixed(2);
    const friendCount = challenge.participants.length;

    const handleCopy = async () => {
        await Clipboard.setStringAsync(inviteUrl);
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1500);
    };

    const handleShare = async () => {
        try {
            await Share.share({ message: inviteUrl });
        } catch {
            // user dismissed share sheet — nothing to do
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Top bar */}
                <View style={styles.topBar}>
                    <CircleButton>
                        <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
                    </CircleButton>
                    <CircleButton>
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.ink} />
                    </CircleButton>
                </View>

                {/* Hero blob */}
                <View style={styles.heroWrap}>
                    <View style={styles.hero}>
                        <Text style={styles.heroLabel}>10K Club</Text>
                        <View style={styles.potRow}>
                            <Text style={styles.potNumber}>{potMon}</Text>
                            <Text style={styles.potUnit}> MON</Text>
                        </View>
                        <Text style={styles.heroTagline}>Walk more.{"\n"}Win together.</Text>
                        <View style={styles.shoeSticker}>
                            <Text style={styles.shoeEmoji}>👟</Text>
                        </View>
                    </View>
                </View>

                {/* Chips row */}
                <View style={styles.chipsRow}>
                    <Chip
                        icon={<Ionicons name="calendar-outline" size={15} color={theme.colors.ink} />}
                        label="7 days"
                    />
                    <Chip
                        icon={<Ionicons name="people-outline" size={15} color={theme.colors.ink} />}
                        label={`${friendCount} friends`}
                    />
                    <Chip
                        icon={<Feather name="arrow-down" size={15} color={theme.colors.ink} />}
                        label="Bottom walker loses"
                    />
                </View>

                {/* Avatar row */}
                <View style={styles.avatarRow}>
                    {challenge.participants.map((p, i) => (
                        <Avatar
                            key={p.address}
                            seed={p.address}
                            size={48}
                            style={{
                                ...styles.avatar,
                                marginLeft: i === 0 ? 0 : -12,
                                zIndex: challenge.participants.length - i,
                            }}
                        />
                    ))}
                    <View style={styles.addCircle}>
                        <Text style={styles.addPlus}>+</Text>
                    </View>
                </View>

                {/* Stake card */}
                <View style={styles.stakeCard}>
                    <View style={styles.coinSticker}>
                        <Text style={styles.coinDiamond}>◆</Text>
                    </View>
                    <Text style={styles.stakeLabel}>Your stake</Text>
                    <Text style={styles.stakeAmount}>{stakeMon} MON</Text>
                    <Text style={styles.stakeUsd}>≈ ${stakeUsd}</Text>
                    <Pressable
                        onPress={onJoin}
                        disabled={joining || hasJoined}
                        style={({ pressed }) => [
                            styles.joinBtn,
                            hasJoined && styles.joinBtnDone,
                            pressed && !hasJoined && !joining && styles.pressed,
                        ]}
                    >
                        {joining ? (
                            <ActivityIndicator color={theme.colors.white} />
                        ) : (
                            <Text style={styles.joinBtnText}>
                                {hasJoined ? "You're in ✓" : "Stake & Join →"}
                            </Text>
                        )}
                    </Pressable>
                    <Text style={styles.trustLine}>🔒 On-chain • Transparent • Fair</Text>
                </View>

                {/* Invite card */}
                <View style={styles.inviteCard}>
                    <Text style={styles.inviteTitle}>Invite friends</Text>
                    <Text style={styles.inviteSub}>Copy link and share</Text>
                    <View style={styles.inviteRow}>
                        <Pressable
                            onPress={handleCopy}
                            style={({ pressed }) => [styles.linkPill, pressed && styles.pressed]}
                        >
                            <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
                                {copied ? "Copied!" : inviteUrl}
                            </Text>
                            <Feather
                                name={copied ? "check" : "copy"}
                                size={16}
                                color={theme.colors.ink}
                            />
                        </Pressable>
                        <Pressable
                            onPress={handleShare}
                            style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]}
                        >
                            <Text style={styles.inviteBtnEmoji}>👥</Text>
                            <Text style={styles.inviteBtnText}>Invite</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    Built on <Text style={styles.footerBrand}>◆ MONAD</Text>
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: theme.colors.cream,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    pressed: {
        opacity: 0.7,
    },
    // Top bar
    topBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 8,
    },
    circleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.white,
        alignItems: "center",
        justifyContent: "center",
    },
    // Hero
    heroWrap: {
        marginTop: 20,
        paddingHorizontal: 4,
    },
    hero: {
        backgroundColor: theme.colors.lime,
        borderRadius: theme.radius.blob,
        padding: 24,
        paddingVertical: 28,
        transform: [{ rotate: "-2deg" }],
    },
    heroLabel: {
        fontFamily: theme.font.semibold,
        fontSize: 14,
        color: theme.colors.ink,
        opacity: 0.75,
    },
    potRow: {
        flexDirection: "row",
        alignItems: "baseline",
        marginTop: 4,
    },
    potNumber: {
        fontFamily: theme.font.black,
        fontSize: 56,
        color: theme.colors.ink,
        letterSpacing: -1,
    },
    potUnit: {
        fontFamily: theme.font.black,
        fontSize: 24,
        color: theme.colors.ink,
    },
    heroTagline: {
        fontFamily: theme.font.bold,
        fontSize: 28,
        lineHeight: 32,
        color: theme.colors.ink,
        marginTop: 8,
    },
    shoeSticker: {
        position: "absolute",
        right: -10,
        top: -14,
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: theme.colors.lavender,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "8deg" }],
    },
    shoeEmoji: {
        fontSize: 30,
    },
    // Chips
    chipsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 24,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius.pill,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    chipText: {
        fontFamily: theme.font.semibold,
        fontSize: 13,
        color: theme.colors.ink,
    },
    // Avatars
    avatarRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 20,
    },
    avatar: {
        borderWidth: 3,
        borderColor: theme.colors.white,
    },
    addCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginLeft: -12,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: theme.colors.muted,
        backgroundColor: theme.colors.cream,
        alignItems: "center",
        justifyContent: "center",
    },
    addPlus: {
        fontFamily: theme.font.bold,
        fontSize: 20,
        color: theme.colors.muted,
        marginTop: -2,
    },
    // Stake card
    stakeCard: {
        backgroundColor: theme.colors.lavender,
        borderRadius: theme.radius.card,
        padding: 20,
        marginTop: 20,
    },
    coinSticker: {
        position: "absolute",
        right: 16,
        top: 16,
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: theme.colors.white,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "6deg" }],
    },
    coinDiamond: {
        fontFamily: theme.font.black,
        fontSize: 20,
        color: "#7B5FD9",
    },
    stakeLabel: {
        fontFamily: theme.font.medium,
        fontSize: 14,
        color: theme.colors.ink,
        opacity: 0.75,
    },
    stakeAmount: {
        fontFamily: theme.font.black,
        fontSize: 40,
        color: theme.colors.ink,
        marginTop: 2,
    },
    stakeUsd: {
        fontFamily: theme.font.medium,
        fontSize: 14,
        color: theme.colors.ink,
        opacity: 0.55,
        marginTop: 2,
    },
    joinBtn: {
        backgroundColor: theme.colors.ink,
        borderRadius: theme.radius.pill,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
    },
    joinBtnDone: {
        opacity: 0.75,
    },
    joinBtnText: {
        fontFamily: theme.font.bold,
        fontSize: 18,
        color: theme.colors.white,
    },
    trustLine: {
        fontFamily: theme.font.medium,
        fontSize: 12,
        color: theme.colors.ink,
        opacity: 0.65,
        textAlign: "center",
        marginTop: 12,
    },
    // Invite card
    inviteCard: {
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius.card,
        padding: 20,
        marginTop: 16,
    },
    inviteTitle: {
        fontFamily: theme.font.bold,
        fontSize: 18,
        color: theme.colors.ink,
    },
    inviteSub: {
        fontFamily: theme.font.medium,
        fontSize: 13,
        color: theme.colors.muted,
        marginTop: 2,
    },
    inviteRow: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: 10,
        marginTop: 14,
    },
    linkPill: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        borderWidth: 1.5,
        borderColor: "#E4DFD2",
        borderRadius: theme.radius.pill,
        paddingHorizontal: 16,
        height: 52,
    },
    linkText: {
        flex: 1,
        fontFamily: theme.font.medium,
        fontSize: 14,
        color: theme.colors.ink,
    },
    inviteBtn: {
        backgroundColor: theme.colors.pink,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
    },
    inviteBtnEmoji: {
        fontSize: 16,
        lineHeight: 18,
    },
    inviteBtnText: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.ink,
        marginTop: 1,
    },
    // Footer
    footer: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.muted,
        textAlign: "center",
        marginTop: 24,
    },
    footerBrand: {
        color: theme.colors.ink,
    },
});
