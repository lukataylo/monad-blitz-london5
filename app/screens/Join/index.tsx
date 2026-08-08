// Screen 1 — Join: hero pot, chips, avatars, stake & join CTA, invite card.
// Presentational. Three modes: empty (no challenge), invitation (challenge
// exists but you haven't joined), and joined.
import Avatar from "@/components/ui/Avatar";
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
    challenge?: Challenge | null;
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

function formatTimeLeft(endTime: number): string {
    const s = endTime - Math.floor(Date.now() / 1000);
    if (s <= 0) return "Ended";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h left`;
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
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
    challenge = null,
    hasJoined = false,
    joining = false,
    onJoin = () => {},
    inviteUrl = "walk-the-walk-production.up.railway.app",
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

    const isInvite = challenge !== null && !hasJoined;
    const stakeMon = challenge ? formatMon(challenge.stake) : "—";
    const potMon = challenge ? formatMon(challenge.pot) : "—";
    const friendCount = challenge?.participants.length ?? 0;
    const insufficientBalance =
        isInvite &&
        challenge !== null &&
        walletBalance !== undefined &&
        walletBalance < challenge.stake;

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
                        {isInvite
                            ? "YOU'RE INVITED 🎉"
                            : challenge
                              ? challenge.title.toUpperCase()
                              : "WALK THE WALK"}
                    </Text>
                    {isInvite && challenge ? (
                        <Text style={styles.heroTitle}>{challenge.title}</Text>
                    ) : challenge ? (
                        <View style={styles.potRow}>
                            <Text style={styles.potNumber}>{potMon}</Text>
                            <Text style={styles.potUnit}> MON</Text>
                        </View>
                    ) : (
                        <View style={styles.potRow}>
                            <Text style={styles.potNumber}>—</Text>
                        </View>
                    )}
                    {!isInvite && (
                        <Text style={styles.heroTagline}>
                            Walk more.{"\n"}Win together.
                        </Text>
                    )}
                    <View style={styles.shoeSticker}>
                        <Text style={styles.shoeEmoji}>👟</Text>
                    </View>
                </View>

                {/* Chips row */}
                {challenge === null ? (
                    <View style={styles.chipsRow}>
                        <Chip
                            icon={<Ionicons name="trophy-outline" size={18} color={theme.colors.ink} />}
                            label="Winner takes 70%"
                        />
                        <Chip
                            icon={<Ionicons name="medal-outline" size={18} color={theme.colors.ink} />}
                            label="Runner-up 30%"
                        />
                        <Chip
                            icon={<Feather name="arrow-down" size={18} color={theme.colors.ink} />}
                            label="Bottom walker loses"
                        />
                    </View>
                ) : isInvite ? (
                    <View style={styles.chipsRow}>
                        <Chip
                            icon={<Ionicons name="cash-outline" size={18} color={theme.colors.ink} />}
                            label={`${stakeMon} MON to join`}
                        />
                        <Chip
                            icon={<Ionicons name="time-outline" size={18} color={theme.colors.ink} />}
                            label={formatTimeLeft(challenge.endTime)}
                        />
                        <Chip
                            icon={<Ionicons name="people-outline" size={18} color={theme.colors.ink} />}
                            label={`${friendCount} walking so far`}
                        />
                    </View>
                ) : (
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
                )}

                {/* Avatar row — only when there are real participants */}
                {challenge !== null && challenge.participants.length > 0 && (
                    <View>
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
                        {isInvite && (
                            <Text style={styles.avatarNames} numberOfLines={2}>
                                {challenge.participants.map((p) => p.name).join(", ")}
                            </Text>
                        )}
                    </View>
                )}

                {/* Stake card */}
                <View style={styles.stakeCard}>
                    {challenge !== null && (
                        <>
                            <Text style={styles.stakeLabel}>
                                {isInvite ? "STAKE TO JOIN" : "YOUR STAKE"}
                            </Text>
                            <View style={styles.stakeRow}>
                                <Text style={styles.stakeAmount}>{stakeMon}</Text>
                                <Text style={styles.stakeUnit}> MON</Text>
                            </View>
                        </>
                    )}
                    {insufficientBalance ? (
                        <View style={styles.notice}>
                            <Text style={styles.noticeTitle}>
                                You need {stakeMon} MON to join
                            </Text>
                            {walletAddress && (
                                <Pressable
                                    onPress={handleCopyAddress}
                                    style={({ pressed }) => [
                                        styles.noticeAddress,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={styles.noticeAddressText}
                                        numberOfLines={1}
                                        ellipsizeMode="middle"
                                    >
                                        {addressCopied ? "Copied ✓" : walletAddress}
                                    </Text>
                                    <Feather
                                        name={addressCopied ? "check" : "copy"}
                                        size={14}
                                        color={theme.colors.ink}
                                    />
                                </Pressable>
                            )}
                            <Text style={styles.noticeCaption}>
                                Get free testnet MON at testnet.monad.xyz
                            </Text>
                        </View>
                    ) : (
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
                                    {hasJoined
                                        ? "You're in ✓"
                                        : challenge === null
                                          ? "Start a challenge →"
                                          : `Stake ${stakeMon} MON & Join →`}
                                </Text>
                            )}
                        </Pressable>
                    )}
                    <Text style={styles.trustLine}>🔒 On-chain • Transparent • Fair</Text>
                </View>

                {/* Invite card */}
                {challenge !== null && (
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
                )}

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
    heroTitle: {
        fontFamily: theme.font.black,
        fontSize: 40,
        lineHeight: 44,
        color: theme.colors.ink,
        letterSpacing: -0.5,
        marginTop: 6,
        paddingRight: 56,
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
    avatarNames: {
        fontFamily: theme.font.medium,
        fontSize: 13,
        color: theme.colors.muted,
        marginTop: 8,
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
    // Insufficient-balance notice (sits on the lavender stake card)
    notice: {
        marginTop: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "rgba(17,17,17,0.14)",
        backgroundColor: theme.colors.lavender,
        padding: 16,
    },
    noticeTitle: {
        fontFamily: theme.font.bold,
        fontSize: 16,
        color: theme.colors.ink,
    },
    noticeAddress: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 14,
        height: 44,
        marginTop: 10,
    },
    noticeAddressText: {
        flex: 1,
        fontFamily: theme.font.semibold,
        fontSize: 13,
        color: theme.colors.ink,
    },
    noticeCaption: {
        fontFamily: theme.font.medium,
        fontSize: 12,
        color: theme.colors.ink,
        opacity: 0.65,
        marginTop: 10,
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
