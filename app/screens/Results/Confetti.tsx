import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, View } from "react-native";
import { theme } from "@/lib/theme";

type Piece = {
  left?: number;
  right?: number;
  top: number;
  size: number;
  color: string;
  rotate: string;
  round?: boolean;
  delay: number;
};

// All pieces stay small (max dimension ≤ 10px) and sit above the title.
const PIECES: Piece[] = [
  { left: 18, top: 8, size: 6, color: theme.colors.lime, rotate: "18deg", delay: 0 },
  { left: 64, top: 42, size: 8, color: theme.colors.pink, rotate: "-24deg", round: true, delay: 120 },
  { left: 110, top: 14, size: 6, color: theme.colors.lavender, rotate: "40deg", delay: 60 },
  { left: 150, top: 58, size: 5, color: theme.colors.ochre, rotate: "-10deg", delay: 200 },
  { left: 196, top: 26, size: 6, color: theme.colors.pink, rotate: "12deg", delay: 90 },
  { left: 238, top: 70, size: 9, color: theme.colors.lime, rotate: "-32deg", round: true, delay: 260 },
  { right: 96, top: 10, size: 6, color: theme.colors.lavender, rotate: "26deg", delay: 40 },
  { right: 52, top: 52, size: 5, color: theme.colors.ochre, rotate: "-18deg", delay: 180 },
  { right: 20, top: 96, size: 6, color: theme.colors.pink, rotate: "8deg", delay: 140 },
  { left: 34, top: 120, size: 9, color: theme.colors.ochre, rotate: "-40deg", round: true, delay: 300 },
  { left: 132, top: 132, size: 5, color: theme.colors.lime, rotate: "22deg", delay: 220 },
  { right: 130, top: 128, size: 6, color: theme.colors.lavender, rotate: "-14deg", delay: 100 },
  { right: 70, top: 150, size: 5, color: theme.colors.lime, rotate: "34deg", delay: 340 },
  { left: 80, top: 160, size: 8, color: theme.colors.pink, rotate: "-26deg", round: true, delay: 160 },
];

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      delay: piece.delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [piece.delay, progress]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: piece.left,
        right: piece.right,
        top: piece.top,
        width: piece.size,
        height: piece.round ? piece.size : Math.min(piece.size * 1.6, 10),
        borderRadius: piece.round ? piece.size / 2 : 2,
        backgroundColor: piece.color,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-36, 0],
            }),
          },
          { rotate: piece.rotate },
        ],
      }}
    />
  );
}

/** Decorative confetti confined to the top quarter of the screen, behind content. */
export default function Confetti() {
  const topQuarter = Math.round(Dimensions.get("window").height * 0.25);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: topQuarter,
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {PIECES.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} />
      ))}
    </View>
  );
}
