import React from "react";
import { Text, View } from "react-native";
import { formatEther } from "viem";
import Avatar from "@/components/ui/Avatar";
import { theme } from "@/lib/theme";
import { Participant } from "@/lib/types";

function mon(p: Participant): string {
  const value = Number(formatEther(p.payout));
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} MON`;
}

function Column({
  participant,
  color,
  height,
  percent,
  amount,
  crowned,
}: {
  participant: Participant;
  color: string;
  height: number;
  percent: string;
  amount: string;
  crowned?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
      {crowned && <Text style={{ fontSize: 26, marginBottom: 2 }}>👑</Text>}
      <Avatar seed={participant.address} label={participant.name} size={48} />
      <Text
        style={{
          fontFamily: theme.font.semibold,
          fontSize: 13,
          color: theme.colors.ink,
          marginTop: 6,
          marginBottom: 8,
        }}
        numberOfLines={1}
      >
        {participant.name}
      </Text>
      <View
        style={{
          alignSelf: "stretch",
          height,
          backgroundColor: color,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          alignItems: "center",
          paddingTop: 16,
          paddingHorizontal: 6,
        }}
      >
        <Text
          style={{
            fontFamily: theme.font.black,
            fontSize: 26,
            color: theme.colors.ink,
          }}
        >
          {percent}
        </Text>
        <Text
          style={{
            fontFamily: theme.font.bold,
            fontSize: 15,
            color: theme.colors.ink,
            marginTop: 2,
          }}
          numberOfLines={1}
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
        gap: 10,
      }}
    >
      <Column
        participant={runnerUp}
        color={theme.colors.pink}
        height={150}
        percent="30%"
        amount={mon(runnerUp)}
      />
      <Column
        participant={winner}
        color={theme.colors.lime}
        height={190}
        percent="70%"
        amount={mon(winner)}
        crowned
      />
      <Column
        participant={third}
        color={theme.colors.lavender}
        height={120}
        percent="—"
        amount="Nice work!"
      />
    </View>
  );
}
