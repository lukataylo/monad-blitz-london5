import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import Avatar from "@/components/ui/Avatar";
import { theme } from "@/lib/theme";
import { Challenge } from "@/lib/types";
import Confetti from "./Confetti";
import Podium from "./Podium";
import WeekChart from "./WeekChart";

function CircleButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.white,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={20} color={theme.colors.ink} />
    </Pressable>
  );
}

export default function ResultsScreen({
  challenge = null,
  weekSteps,
  onClaim = () => {},
  claiming = false,
  claimed = false,
  onRunItBack = () => {},
}: {
  challenge?: Challenge | null;
  weekSteps?: { day: string; steps: number }[];
  onClaim?: () => void;
  claiming?: boolean;
  claimed?: boolean;
  onRunItBack?: () => void;
}) {
  if (!challenge || !challenge.settled) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.cream }}>
        <View style={{ padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <CircleButton icon="chevron-back" onPress={() => router.back()} />
            <View style={{ width: 44 }} />
          </View>
          <View
            style={{
              marginTop: 40,
              backgroundColor: theme.colors.white,
              borderRadius: theme.radius.card,
              borderWidth: 1,
              borderColor: "rgba(17,17,17,0.06)",
              padding: 32,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: theme.font.heavy,
                fontSize: 22,
                color: theme.colors.ink,
                textAlign: "center",
              }}
            >
              Nothing to celebrate yet 👟
            </Text>
            <Text
              style={{
                fontFamily: theme.font.medium,
                fontSize: 15,
                color: theme.colors.muted,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Results show up here once a challenge settles
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const ranked = [...challenge.participants].sort((a, b) => b.steps - a.steps);
  const winner = ranked[0];
  const runnerUp = ranked[1];
  const last = ranked[ranked.length - 1];
  const you = challenge.participants.find((p) => p.isYou);
  const youInTopTwo =
    you !== undefined &&
    (you.address === winner?.address || you.address === runnerUp?.address);
  const thirdColumn = you !== undefined && !youInTopTwo ? you : ranked[2];
  const youWon = you !== undefined && you.payout > 0n;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.cream }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Confetti />

        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <CircleButton icon="chevron-back" onPress={() => router.back()} />
          <CircleButton icon="ellipsis-horizontal" />
        </View>

        {/* Title + party sticker */}
        <View style={{ marginTop: 20 }}>
          <View
            style={{
              position: "absolute",
              right: 0,
              top: -8,
              width: 62,
              height: 62,
              borderRadius: 24,
              backgroundColor: theme.colors.ochre,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 28 }}>🎉</Text>
          </View>
          <Text
            style={{
              fontFamily: theme.font.heavy,
              fontSize: 40,
              lineHeight: 42,
              color: theme.colors.ink,
            }}
          >
            You walked.
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                fontFamily: theme.font.heavy,
                fontSize: 40,
                lineHeight: 42,
                color: theme.colors.ink,
              }}
            >
              {youWon ? "You " : "They "}
            </Text>
            <View>
              <Text
                style={{
                  fontFamily: theme.font.heavy,
                  fontSize: 40,
                  lineHeight: 42,
                  color: theme.colors.ink,
                }}
              >
                won.
              </Text>
              {/* lime ellipse hugging "won." — the screen's single rotated element */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: -10,
                  right: -12,
                  top: -3,
                  bottom: -3,
                  borderWidth: 3,
                  borderColor: theme.colors.lime,
                  borderRadius: 999,
                  transform: [{ rotate: "-3deg" }],
                }}
              />
            </View>
          </View>
        </View>

        {/* Podium */}
        {winner && runnerUp && thirdColumn ? (
          <View style={{ marginTop: 20 }}>
            <Podium winner={winner} runnerUp={runnerUp} third={thirdColumn} />
          </View>
        ) : null}

        {/* Last place row */}
        {last ? (
        <View
          style={{
            marginTop: 20,
            backgroundColor: "#EDE4CF",
            borderRadius: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: theme.font.black,
              fontSize: 18,
              color: theme.colors.ink,
              marginRight: 12,
            }}
          >
            {ranked.length}
          </Text>
          <Avatar seed={last.address} label={last.name} size={36} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text
              style={{
                fontFamily: theme.font.bold,
                fontSize: 15,
                color: theme.colors.ink,
              }}
              numberOfLines={1}
            >
              {last.name}
            </Text>
            <Text
              style={{
                fontFamily: theme.font.semibold,
                fontSize: 12,
                color: theme.colors.muted,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              Walked the least
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
            <Text
              style={{
                fontFamily: theme.font.semibold,
                fontSize: 12,
                color: theme.colors.muted,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                textAlign: "right",
                maxWidth: 120,
              }}
            >
              Stake added to the pot
            </Text>
            <Text style={{ fontSize: 18, marginTop: 2 }}>🍯</Text>
          </View>
        </View>
        ) : null}

        {/* Weekly bar chart — only when real step history exists */}
        {weekSteps && weekSteps.length > 0 ? (
          <View style={{ marginTop: 20 }}>
            <WeekChart weekSteps={weekSteps} />
          </View>
        ) : null}

        {/* CTAs */}
        <View style={{ marginTop: 20, gap: 12 }}>
          {youWon ? (
            <Pressable
              onPress={onClaim}
              disabled={claiming || claimed}
              style={{
                backgroundColor: theme.colors.ink,
                borderRadius: theme.radius.pill,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                opacity: claimed ? 0.6 : 1,
              }}
            >
              {claiming ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text
                  style={{
                    fontFamily: theme.font.bold,
                    fontSize: 17,
                    color: theme.colors.white,
                  }}
                >
                  {claimed ? "Claimed ✓" : "🎉 Claim winnings →"}
                </Text>
              )}
            </Pressable>
          ) : (
            <View
              style={{
                backgroundColor: theme.colors.ink,
                borderRadius: theme.radius.pill,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.45,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.font.bold,
                  fontSize: 17,
                  color: theme.colors.white,
                }}
              >
                See final standings
              </Text>
            </View>
          )}

          <Pressable
            onPress={onRunItBack}
            style={{
              borderWidth: 1.5,
              borderColor: theme.colors.ink,
              borderRadius: theme.radius.pill,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: theme.font.bold,
                fontSize: 17,
                color: theme.colors.ink,
              }}
            >
              ↻ Run it back
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Text
          style={{
            fontFamily: theme.font.semibold,
            fontSize: 12,
            color: theme.colors.muted,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          Thanks for walking with us 💛
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
