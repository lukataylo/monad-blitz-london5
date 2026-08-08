import { AuthProvider } from "@/context/AuthContext";
import { Slot } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function SignInLayout() {
    return (
        <AuthProvider>
            <View style={styles.container}>
                <Slot />
            </View>
        </AuthProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 40,
        paddingVertical: 20,
    },
});
