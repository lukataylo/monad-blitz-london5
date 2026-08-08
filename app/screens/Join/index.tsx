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

type JoinScreenProps = {
    challenge?: Challenge;
    hasJoined?: boolean;
    joining?: boolean;
    onJoin?: () => void;
    inviteUrl?: string;
    walletAddress?: string | null;
    walletBalance?: bigint;
    onCopyAddress?: () => void;
};

/** Wei -> "1.5" (≤2 decimals, thousands separators, no trailing zeros). */
function formatMon(wei: bigint): string {
    return Number(formatEther(wei)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });
}

function shortAddress(addr: string): string {
    return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

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
    walletAddress = null,
    walletBalance,
    onCopyAddress = () => {},
}: JoinScreenProps) {
    const [linkCopied, setLinkCopied] = useState(false);
    const [addressCopied, setAddressCopied] = useState(false);
    const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const addressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (linkTimer.current) clearTimeout(linkTimer.current);
            if (addressTimer.current) clearTimeout(addressTimer.current);
        };
    }, []);

    const stakeMon = formatMon(challenge.stake);
    const potMon = formatMon(challenge.pot);
    const friendCount = challenge.participants.length;

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(inviteUrl);
        setLinkCopied(true);
        if (linkTimer.current) clearTimeout(linkTimer.current);
        linkTimer.current = setTimeout(() => setLinkCopied(false), 1500);
    };

    const handleCopyAddress = () => {
        onCopyAddress();
        setAddressCopied(true);
        if (addressTimer.current) clearTimeout(addressTimer.current);
        addressTimer.current = setTimeout(() => setAddressCopied(false), 1500);
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
                {/* Top bar: wallet pill (left) + menu (right) */}
                <View style={styles.topBar}>
                    {walletAddress ? (
                        <Pressable
                            onPress={handleCopyAddress}
                            style={({ pressed }) => [styles.walletPill, pressed && styles.pressed]}
                        >
                            <Text style={styles.walletText} numberOfLines={1}>
                                {addressCopied
                                    ? "Copied ✓"
                                    : `${shortAddress(walletAddress)}${
                                          walletBalance !== undefined
                                              ? ` · ${formatMon(walletBalance)} MON`
                                              : ""
                                      }`}
                            </Text>
                            <Feather
                                name={addressCopied ? "check" : "copy"}
                                size={14}
                                color={theme.colors.muted}
                            />
                        </Pressable>
                    ) : (
                        <View />
                    )}
                    <CircleButton>
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.ink} />
                    </CircleButton>
                </View>

                {/* Hero card */}
                <View style={styles.hero}>
                    <Text style={styles.heroLabel}>
                        {(challenge.title || "10K Club").toUpperCase()}
                    </Text>
                    <View style={styles.potRow}>
                        <Text style={styles.potNumber}>{potMon}</Text>
                        <Text style={styles.potUnit}> MON</Text>
                    </View>
                    <Text style={styles.heroTagline}>Walk more.{"\n"}Win together.</Text>
                    <View style={styles.shoeSticker}>
                        <Text style={styles.shoeEmoji}>👟</Text>
                    </View>
                </View>

                {/* Chips row */}
                <View style={styles.chipsRow}>
                    <Chip
                        icon={<Ionicons name="calendar-outline" size={18} color={theme.colors.ink} />}
                        label="7 days"
                    />
                    <Chip
                        icon={<Ionicons name="people-outline" size={18} color={theme.colors.ink} />}
                        label={`${friendCount} friends`}
                    />
                    <Chip
                        icon={<Feather name="arrow-down" size={18} color={theme.colors.ink} />}
                        label="Bottom walker loses"
                    />
                </View>

                {/* Avatar row */}
                <View style={styles.avatarRow}>
                    {challenge.participants.map((p, i) => (
                        <Avatar
                            key={p.address}
                            seed={p.address}
                            label={p.name}
                            size={44}
                            style={{
                                ...styles.avatar,
                                marginLeft: i === 0 ? 0 : -10,
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
                    <Text style={styles.stakeLabel}>YOUR STAKE</Text>
                    <View style={styles.stakeRow}>
                        <Text style={styles.stakeAmount}>{stakeMon}</Text>
                        <Text style={styles.stakeUnit}> MON</Text>
                    </View>
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
                            onPress={handleCopyLink}
                            style={({ pressed }) => [styles.linkPill, pressed && styles.pressed]}
                        >
                            <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
                                {linkCopied ? "Copied ✓" : inviteUrl}
                            </Text>
                            <Feather
                                name={linkCopied ? "check" : "copy"}
                                size={18}
                                color={theme.colors.ink}
                            />
                        </Pressable>
                        <Pressable
                            onPress={handleShare}
                            style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]}
                        >
                            <Ionicons name="share-outline" size={22} color={theme.colors.ink} />
                            <Text style={styles.inviteBtnText}>Invite</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    BUILT ON <Text style={styles.footerBrand}>◆ MONAD</Text>
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
        gap: 20,
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
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.white,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.06)",
        alignItems: "center",
        justifyContent: "center",
    },
    walletPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 44,
        paddingHorizontal: 16,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.white,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.06)",
        maxWidth: "70%",
    },
    walletText: {
        fontFamily: theme.font.semibold,
        fontSize: 13,
        color: theme.colors.ink,
        flexShrink: 1,
    },
    // Hero
    hero: {
        backgroundColor: theme.colors.lime,
        borderRadius: theme.radius.card,
        padding: 20,
    },
    heroLabel: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.ink,
        opacity: 0.6,
        letterSpacing: 0.4,
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
        fontFamily: theme.font.heavy,
        fontSize: 28,
        lineHeight: 32,
        color: theme.colors.ink,
        marginTop: 8,
    },
    shoeSticker: {
        position: "absolute",
        right: -8,
        top: -12,
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: theme.colors.lavender,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "3deg" }],
    },
    shoeEmoji: {
        fontSize: 30,
    },
    // Chips
    chipsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.06)",
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
    },
    avatar: {
        borderWidth: 2,
        borderColor: theme.colors.cream,
    },
    addCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginLeft: -10,
        borderWidth: 1.5,
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
    },
    stakeLabel: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.ink,
        opacity: 0.55,
        letterSpacing: 0.4,
    },
    stakeRow: {
        flexDirection: "row",
        alignItems: "baseline",
        marginTop: 2,
    },
    stakeAmount: {
        fontFamily: theme.font.black,
        fontSize: 40,
        color: theme.colors.ink,
    },
    stakeUnit: {
        fontFamily: theme.font.black,
        fontSize: 20,
        color: theme.colors.ink,
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
        fontSize: 17,
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
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.06)",
        padding: 20,
    },
    inviteTitle: {
        fontFamily: theme.font.heavy,
        fontSize: 18,
        color: theme.colors.ink,
    },
    inviteSub: {
        fontFamily: theme.font.medium,
        fontSize: 15,
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
        borderColor: "rgba(17,17,17,0.12)",
        borderRadius: theme.radius.pill,
        paddingHorizontal: 16,
        height: 52,
    },
    linkText: {
        flex: 1,
        fontFamily: theme.font.medium,
        fontSize: 15,
        color: theme.colors.ink,
    },
    inviteBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: theme.colors.ink,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 16,
        height: 52,
    },
    inviteBtnText: {
        fontFamily: theme.font.bold,
        fontSize: 15,
        color: theme.colors.ink,
    },
    // Footer
    footer: {
        fontFamily: theme.font.semibold,
        fontSize: 12,
        color: theme.colors.muted,
        textAlign: "center",
        letterSpacing: 0.4,
        marginTop: 4,
    },
    footerBrand: {
        color: theme.colors.ink,
    },
});
