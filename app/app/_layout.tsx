import { useColorScheme } from "@/hooks/useColorScheme";
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
} from "@expo-google-fonts/inter";

import { PrivyProvider } from "@privy-io/expo";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import "react-native-reanimated";
import { monadTestnet } from "viem/chains";

export default function RootLayout() {
    const colorScheme = useColorScheme();

    const [loaded] = useFonts({
        "SF-Pro-Rounded-Black": require("../assets/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Black.otf"),
        "SF-Pro-Rounded-Bold": require("../assets/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Bold.otf"),
        "SF-Pro-Rounded-Heavy": require("../assets/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Heavy.otf"),
        "SF-Pro-Rounded-Medium": require("../assets/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Medium.otf"),
        "SF-Pro-Rounded-Regular": require("../assets/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Regular.otf"),
        "SF-Pro-Rounded-Semibold": require("../assets/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Semibold.otf"),
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
    });

    if (!loaded) {
        // Async font loading only occurs in development.
        return null;
    }

    if (
        !process.env.EXPO_PUBLIC_PRIVY_APP_ID ||
        !process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID
    ) {
        return (
            <View style={styles.container}>
                <Text>PRIVY_APP_ID / PRIVY_CLIENT_ID is not set</Text>
            </View>
        );
    }

    return (
        <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
            <PrivyProvider
                clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID as string}
                appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID as string}
                supportedChains={[monadTestnet]}
                config={{
                    embedded: {
                        ethereum: {
                            createOnLogin: "users-without-wallets",
                        },
                    },
                }}
            >
                <Slot />
            </PrivyProvider>
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
