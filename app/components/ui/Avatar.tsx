import { theme } from "@/lib/theme";
import React from "react";
import { Text, View, ViewStyle } from "react-native";

interface AvatarProps {
  seed: string;
  /** Display name — first letter becomes the avatar initial. Falls back to seed. */
  label?: string;
  size?: number;
  style?: ViewStyle;
}

// Deterministic, offline, clean: a colored circle with a bold initial.
// Color is picked from the app palette by hashing the seed.
const PALETTE = [
  theme.colors.lime,
  theme.colors.lavender,
  theme.colors.pink,
  theme.colors.ochre,
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default function Avatar({ seed, label, size = 80, style }: AvatarProps) {
  const bg = PALETTE[hashCode(seed) % PALETTE.length];
  const source = label && label.length > 0 ? label : seed.replace(/^0x/, "");
  const initial = source.charAt(0).toUpperCase();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: theme.font.heavy,
          fontSize: size * 0.42,
          color: theme.colors.ink,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
