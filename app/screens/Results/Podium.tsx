import React from "react";
import { Text, View } from "react-native";
import { formatEther } from "viem";
import Avatar from "@/components/ui/Avatar";
import { theme } from "@/lib/theme";
import { Participant } from "@/lib/types";

function mon(p: Participant): string {
  return `${formatEther(p.payout)} MON`;
}

function Column({
  participant,
  color,
  height,
  percent,
  amount,
  rank,
  crowned,
  avatarSize,
  tilt,
}: {
  participant: Participant;
  color: string;
  height: number;
  percent: string;
  amount: string;
  rank?: string;
  crowned?: boolean;
  avatarSize: number;
  tilt: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
      {crowned && (
        <Text
          style={{
            fontSize: 30,
            marginBottom: -6,
            zIndex: 2,
            transform: [{ rotate: "-12deg" }],
          }}
        >
          👑
        </Text>
      )}
      <View
        style={{
          alignSelf: "stretch",
          height,
          backgroundColor: color,
          borderRadius: 20,
          alignItems: "center",
          paddingTop: 16,
          paddingBottom: 14,
          transform: [{ rotate: tilt }],
        }}
      >
        <Avatar seed={participant.address} size={avatarSize} />
        {rank ? (
          <Text
            style={{
              fontFamily: theme.font.black,
              fontSize: 30,
              color: theme.colors.ink,
              marginTop: 6,
            }}
          >
            {rank}
          </Text>
        ) : (
          <View style={{ height: 8 }} />
        )}
        <Text
          style={{
            fontFamily: theme.font.bold,
            fontSize: 15,
            color: theme.colors.ink,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {participant.name}
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            fontFamily: theme.font.black,
            fontSize: 28,
            color: theme.colors.ink,
          }}
        >
          {percent}
        </Text>
        <Text
          style={{
            fontFamily: theme.font.bold,
            fontSize: 14,
            color: theme.colors.ink,
            marginTop: 2,
          }}
        >
          {amount}
        </Text>
      </View>
    </View>
  );
}

/** Winner podium: runner-up (pink) / winner (lime, tallest) / you-or-third (lavender). */
export default function Podium({
  winner,
  runnerUp,
  third,
}: {
  winner: Participant;
  runnerUp: Participant;
  third: Participant;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      <Column
        participant={runnerUp}
        color={theme.colors.pink}
        height={196}
        percent="30%"
        amount={mon(runnerUp)}
        rank="2"
        avatarSize={48}
        tilt="-1.5deg"
      />
      <Column
        participant={winner}
        color={theme.colors.lime}
        height={244}
        percent="70%"
        amount={mon(winner)}
        rank="1"
        crowned
        avatarSize={56}
        tilt="0deg"
      />
      <Column
        participant={third}
        color={theme.colors.lavender}
        height={156}
        percent="—"
        amount="Nice work!"
        avatarSize={48}
        tilt="1.5deg"
      />
    </View>
  );
}
