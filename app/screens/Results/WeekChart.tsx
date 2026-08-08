import React from "react";
import { Text, View } from "react-native";
import { theme } from "@/lib/theme";

const MAX_BAR_HEIGHT = 110;

/** "Steps this week" white card with a Mon–Sun bar chart built from plain Views. */
export default function WeekChart({
  weekSteps,
}: {
  weekSteps: { day: string; steps: number }[];
}) {
  const max = Math.max(...weekSteps.map((d) => d.steps), 1);
  const tallestIndex = weekSteps.findIndex((d) => d.steps === max);
  const altColors = [theme.colors.lavender, theme.colors.pink];
  let alt = 0;

  return (
    <View
      style={{
        backgroundColor: theme.colors.white,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(17,17,17,0.06)",
        padding: 20,
      }}
    >
      <Text
        style={{
          fontFamily: theme.font.heavy,
          fontSize: 18,
          color: theme.colors.ink,
          marginBottom: 18,
        }}
      >
        Steps this week
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        {weekSteps.map((d, i) => {
          const isTallest = i === tallestIndex;
          const color = isTallest
            ? theme.colors.lime
            : altColors[alt++ % altColors.length];
          const height = Math.max(
            10,
            Math.round((d.steps / max) * MAX_BAR_HEIGHT),
          );
          return (
            <View key={d.day} style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontFamily: theme.font.semibold,
                  fontSize: 11,
                  color: theme.colors.muted,
                  marginBottom: 6,
                }}
                numberOfLines={1}
              >
                {d.steps.toLocaleString()}
              </Text>
              <View
                style={{
                  alignSelf: "stretch",
                  height,
                  backgroundColor: color,
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                }}
              />
              <Text
                style={{
                  fontFamily: theme.font.semibold,
                  fontSize: 11,
                  color: theme.colors.muted,
                  marginTop: 6,
                }}
              >
                {d.day}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
