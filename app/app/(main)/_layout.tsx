import { ChallengeProvider } from "@/context/ChallengeContext";
import { WalletProvider } from "@/context/WalletContext";
import { Slot } from "expo-router";
import React from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function AppLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <WalletProvider>
                <ChallengeProvider>
                    <View style={{ flex: 1 }}>
                        <Slot />
                    </View>
                </ChallengeProvider>
            </WalletProvider>
        </GestureHandlerRootView>
    );
}
