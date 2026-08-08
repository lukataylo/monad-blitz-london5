import React from "react";
import { StyleSheet, Text, View } from "react-native";

import Avatar from "@/components/ui/Avatar";
import { theme } from "@/lib/theme";
import { Participant } from "@/lib/types";

const OTHER_BAR_COLORS = [
  theme.colors.pink,
  theme.colors.green,
  theme.colors.ochre,
  theme.colors.lavender,
] as const;

export default function LeaderboardRow({
  participant,
  rank,
  maxSteps,
}: {
  participant: Participant;
  rank: number;
  maxSteps: number;
}) {
  const isFirst = rank === 1;
  const isYou = participant.isYou;

  const barColor = isFirst
    ? theme.colors.lime
    : OTHER_BAR_COLORS[(rank - 2) % OTHER_BAR_COLORS.length];
  const trackColor = isFirst
    ? "rgba(255,255,255,0.6)"
    : isYou
      ? "rgba(255,255,255,0.55)"
      : "rgba(17,17,17,0.08)";

  const ratio = maxSteps > 0 ? Math.max(0.04, participant.steps / maxSteps) : 0;

  const cardStyle = isFirst
    ? styles.firstCard
    : isYou
      ? styles.youCard
      : styles.plainRow;

  return (
    <View style={[styles.row, cardStyle]}>
      <Text style={styles.rank}>{rank}</Text>

      <Avatar seed={participant.address} size={44} style={styles.avatar} />

      <View style={styles.nameCol}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {isYou ? "You" : participant.name}
            {isFirst ? " 👑" : ""}
          </Text>
          {isYou ? (
            <View style={styles.deltaChip}>
              <Text style={styles.deltaText}>▲2</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: barColor, width: `${ratio * 100}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.stepsCol}>
        <Text style={styles.steps}>{participant.steps.toLocaleString()}</Text>
        <Text style={styles.stepsLabel}>steps</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  firstCard: {
    backgroundColor: theme.colors.lime,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  youCard: {
    backgroundColor: theme.colors.lavender,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  plainRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rank: {
    fontFamily: theme.font.bold,
    fontSize: 17,
    color: theme.colors.ink,
    width: 22,
  },
  avatar: {
    marginLeft: 4,
    marginRight: 12,
  },
  nameCol: {
    flex: 1,
    marginRight: 12,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },
  name: {
    fontFamily: theme.font.bold,
    fontSize: 17,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  deltaChip: {
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  deltaText: {
    fontFamily: theme.font.bold,
    fontSize: 12,
    color: theme.colors.white,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  stepsCol: {
    alignItems: "flex-end",
  },
  steps: {
    fontFamily: theme.font.bold,
    fontSize: 20,
    color: theme.colors.ink,
  },
  stepsLabel: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.muted,
  },
});
