import ErrorScreen from "@/components/ui/ErrorScreen";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import { ChallengeProvider } from "@/context/ChallengeContext";
import { WalletProvider } from "@/context/WalletContext";
import { AuthBoundary } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import { Redirect, Slot } from "expo-router";
import React from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function AppLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthBoundary
                loading={<FullScreenLoader />}
                error={(error) => <ErrorScreen error={error} />}
                unauthenticated={<Redirect href="/sign-in" />}
            >
                <WalletProvider>
                    <ChallengeProvider>
                        <View style={{ flex: 1 }}>
                            <Slot />
                        </View>
                    </ChallengeProvider>
                </WalletProvider>
                <PrivyElements />
            </AuthBoundary>
        </GestureHandlerRootView>
    );
}
