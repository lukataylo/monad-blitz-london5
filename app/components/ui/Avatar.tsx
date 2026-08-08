import React from "react";
import { Image, View, ViewStyle } from "react-native";

interface AvatarProps {
  seed: string;
  size?: number;
  style?: ViewStyle;
}

export default function Avatar({ seed, size = 80, style }: AvatarProps) {
  const uri = `https://api.dicebear.com/9.x/adventurer-neutral/png?seed=${encodeURIComponent(seed)}`;

  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#f0f0f0' }, style]}>
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    </View>
  );
} 