import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatEther } from "viem";

import { theme } from "@/lib/theme";
import { Challenge, Participant } from "@/lib/types";
import LeaderboardRow from "./LeaderboardRow";
import TabBar from "./TabBar";

const CHALLENGE_DAYS = 7;
const DAY_SECONDS = 86400;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Time's up!";
  if (secondsLeft < 3600) {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${pad2(m)}:${pad2(s)} left`;
  }
  const d = Math.floor(secondsLeft / DAY_SECONDS);
  const h = Math.floor((secondsLeft % DAY_SECONDS) / 3600);
  if (d === 0) {
    const m = Math.floor((secondsLeft % 3600) / 60);
    return `${h}h ${pad2(m)}m left`;
  }
  return `${d}d ${pad2(h)}h left`;
}

type SafetyInfo = {
  steps: number;
  label: string;
};

function computeSafety(sorted: Participant[]): SafetyInfo | null {
  const you = sorted.find((p) => p.isYou);
  if (!you || sorted.length < 2) return null;
  const yourIndex = sorted.indexOf(you);
  const isLast = yourIndex === sorted.length - 1;
  if (isLast) {
    const nextAbove = sorted[yourIndex - 1];
    return {
      steps: nextAbove.steps - you.steps + 1,
      label: "to get off the bottom",
    };
  }
  const lastPlace = sorted[sorted.length - 1];
  return {
    steps: you.steps - lastPlace.steps,
    label: "to stay out of last place",
  };
}

export default function LeaderboardScreen({
  challenge = null,
  onSettle = () => {},
  settling = false,
  onTabPress,
}: {
  challenge?: Challenge | null;
  onSettle?: () => void;
  settling?: boolean;
  onTabPress?: (tab: string) => void;
}) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const participants = challenge?.participants;
  const sorted = useMemo(
    () => (participants ? [...participants].sort((a, b) => b.steps - a.steps) : []),
    [participants],
  );
  const safety = useMemo(() => computeSafety(sorted), [sorted]);

  if (!challenge) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            <Pressable style={styles.circleButton} onPress={() => onTabPress?.("back")}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
            </Pressable>
            <View />
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👟</Text>
            <Text style={styles.emptyTitle}>No challenge yet</Text>
            <Text style={styles.emptyCaption}>Start one from Home</Text>
          </View>
        </View>
        <TabBar onTabPress={onTabPress} />
      </SafeAreaView>
    );
  }

  const secondsLeft = Math.max(0, challenge.endTime - nowSec);
  const startTime = challenge.endTime - CHALLENGE_DAYS * DAY_SECONDS;
  const dayNumber = clamp(
    Math.floor((nowSec - startTime) / DAY_SECONDS) + 1,
    1,
    CHALLENGE_DAYS,
  );
  const showSettle = secondsLeft === 0 && !challenge.settled;
  const maxSteps = sorted.length > 0 ? sorted[0].steps : 0;

  const potLabel = Number(formatEther(challenge.pot)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.circleButton} onPress={() => onTabPress?.("back")}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.dayText}>
              Day {dayNumber} of {CHALLENGE_DAYS}
            </Text>
            <Text style={styles.countdownText}>{formatCountdown(secondsLeft)}</Text>
          </View>
          <Pressable style={styles.circleButton} onPress={() => onTabPress?.("menu")}>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.ink} />
          </Pressable>
        </View>

        {showSettle ? (
          <Pressable
            style={[styles.settlePill, settling && styles.settlePillBusy]}
            onPress={onSettle}
            disabled={settling}
          >
            {settling ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.settleText}>Settle challenge →</Text>
            )}
          </Pressable>
        ) : null}

        {/* Big title with lime highlight + sneaker sticker */}
        <View style={styles.titleBlock}>
          <View style={styles.sneakerBlob}>
            <Text style={styles.sneakerEmoji}>👟</Text>
          </View>
          <Text style={styles.titleLine}>Who's</Text>
          <Text style={styles.titleLine}>walking</Text>
          <View style={styles.titleLastLine}>
            <Text style={styles.titleLine}>the </Text>
            <View style={styles.highlightWrap}>
              <View style={styles.highlightBar} />
              <Text style={styles.titleLine}>walk?</Text>
            </View>
          </View>
        </View>

        {/* Shared pot chip */}
        <View style={styles.potChip}>
          <Text style={styles.potText}>
            Shared pot · <Text style={styles.potAmount}>{potLabel} MON</Text>
          </Text>
        </View>

        {/* Ranked list */}
        <View style={styles.list}>
          {sorted.map((participant, i) => (
            <LeaderboardRow
              key={participant.address}
              participant={participant}
              rank={i + 1}
              maxSteps={maxSteps}
            />
          ))}
        </View>

        {/* Waiting-for-crew card (solo so far) */}
        {challenge.participants.length === 1 ? (
          <View style={styles.waitingCard}>
            <View style={styles.safetyBadge}>
              <Ionicons name="people-outline" size={24} color={theme.colors.ink} />
            </View>
            <View style={styles.safetyBody}>
              <Text style={styles.safetyTitle}>Waiting for your crew</Text>
              <Text style={styles.waitingCaption}>Share the invite link</Text>
            </View>
          </View>
        ) : null}

        {/* Safety card */}
        {safety ? (
          <View style={styles.safetyCard}>
            <View style={styles.safetyBadge}>
              <Ionicons
                name="shield-checkmark"
                size={24}
                color={theme.colors.ink}
              />
            </View>
            <View style={styles.safetyBody}>
              <Text style={styles.safetyTitle}>You're safe for now!</Text>
              <Text style={styles.safetySteps}>
                {safety.steps.toLocaleString()} steps
              </Text>
              <Text style={styles.safetyLabel}>{safety.label}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <TabBar onTabPress={onTabPress} />
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
    paddingTop: 8,
    paddingBottom: 140,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    alignItems: "center",
  },
  dayText: {
    fontFamily: theme.font.bold,
    fontSize: 17,
    color: theme.colors.ink,
  },
  countdownText: {
    fontFamily: theme.font.semibold,
    fontSize: 12,
    color: theme.colors.muted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  settlePill: {
    marginTop: 20,
    alignSelf: "stretch",
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.pill,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  settlePillBusy: {
    opacity: 0.8,
  },
  settleText: {
    fontFamily: theme.font.bold,
    fontSize: 17,
    color: theme.colors.white,
  },
  titleBlock: {
    marginTop: 20,
    marginBottom: 20,
  },
  titleLine: {
    fontFamily: theme.font.heavy,
    fontSize: 40,
    lineHeight: 42,
    color: theme.colors.ink,
  },
  titleLastLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  highlightWrap: {
    justifyContent: "center",
  },
  highlightBar: {
    position: "absolute",
    left: -4,
    right: -4,
    top: 6,
    bottom: 2,
    backgroundColor: theme.colors.lime,
    borderRadius: 12,
  },
  sneakerBlob: {
    position: "absolute",
    top: -4,
    right: 4,
    width: 72,
    height: 72,
    borderRadius: theme.radius.blob,
    backgroundColor: theme.colors.pink,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-3deg" }],
    zIndex: 1,
  },
  sneakerEmoji: {
    fontSize: 32,
  },
  potChip: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 20,
  },
  potText: {
    fontFamily: theme.font.medium,
    fontSize: 15,
    color: theme.colors.white,
  },
  potAmount: {
    fontFamily: theme.font.bold,
  },
  list: {
    marginBottom: 20,
  },
  emptyCard: {
    marginTop: 40,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    padding: 32,
    alignItems: "center",
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: theme.font.heavy,
    fontSize: 22,
    color: theme.colors.ink,
  },
  emptyCaption: {
    fontFamily: theme.font.medium,
    fontSize: 15,
    color: theme.colors.muted,
    marginTop: 4,
  },
  waitingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.lavender,
    borderRadius: theme.radius.card,
    padding: 20,
    marginBottom: 20,
  },
  waitingCaption: {
    fontFamily: theme.font.medium,
    fontSize: 15,
    color: theme.colors.ink,
    opacity: 0.7,
    marginTop: 2,
  },
  safetyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.lime,
    borderRadius: theme.radius.card,
    padding: 20,
  },
  safetyBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  safetyBody: {
    flex: 1,
  },
  safetyTitle: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.ink,
    marginBottom: 2,
  },
  safetySteps: {
    fontFamily: theme.font.black,
    fontSize: 28,
    color: theme.colors.ink,
  },
  safetyLabel: {
    fontFamily: theme.font.semibold,
    fontSize: 12,
    color: theme.colors.ink,
    opacity: 0.6,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
});
