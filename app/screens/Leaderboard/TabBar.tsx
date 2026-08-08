import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/lib/theme";

export default function TabBar({
  onTabPress,
}: {
  onTabPress?: (tab: string) => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.tab} onPress={() => onTabPress?.("home")}>
        <Ionicons name="home-outline" size={24} color={theme.colors.white} />
      </Pressable>

      <Pressable style={styles.tab} onPress={() => onTabPress?.("stats")}>
        <Ionicons name="stats-chart" size={24} color={theme.colors.lime} />
      </Pressable>

      <Pressable style={styles.addButton} onPress={() => onTabPress?.("add")}>
        <Ionicons name="add" size={24} color={theme.colors.ink} />
      </Pressable>

      <Pressable style={styles.tab} onPress={() => onTabPress?.("people")}>
        <Ionicons name="people-outline" size={24} color={theme.colors.white} />
      </Pressable>

      <Pressable style={styles.tab} onPress={() => onTabPress?.("profile")}>
        <Ionicons name="person-outline" size={24} color={theme.colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
  },
  tab: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
});
