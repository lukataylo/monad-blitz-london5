import { ThemedText } from "@/components/ThemedText";
import ThemedButton from "@/components/ui/ThemedButton";
import { useAuth } from "@/context/AuthContext";
import { useLoginWithEmail } from "@privy-io/expo";
import { router } from "expo-router";
import React from "react";
import { Button, StyleSheet, View } from "react-native";
import { OtpInput } from "react-native-otp-entry";

function OTPInput({ onTextChange }: { onTextChange: (code: string) => void }) {
  return (
    <OtpInput
      numberOfDigits={6}
      autoFocus={true}
      type="numeric"
      onTextChange={onTextChange}
      theme={{
        containerStyle: styles.otpContainer,
        pinCodeContainerStyle: styles.pinCodeContainer,
        focusStickStyle: styles.focusStick,
        focusedPinCodeContainerStyle: styles.activePinCodeContainer,
      }}
    />
  );
}

export default function OTP() {
  const { email, code, setCode } = useAuth();
  const { loginWithCode } = useLoginWithEmail();

  async function onLogin() {
    await loginWithCode({ code, email });
    router.push("/(main)");
  }

  return (
    <View style={styles.container}>
      <View style={{ gap: 8, alignItems: "center" }}>
        <ThemedText type="title" style={{ marginBottom: 8 }}>
          Enter the code
        </ThemedText>
        <ThemedText style={{ textAlign: "center" }} type="subtitle">
          A code was sent to {email}
        </ThemedText>
      </View>

      {/* OTP Input for the code in email */}
      <OTPInput onTextChange={setCode} />

      <ThemedButton
        title="Login"
        onPress={onLogin}
        disabled={code.length !== 6}
      />

      <Button title="Back" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  otpContainer: {
    marginVertical: 20,
  },
  pinCodeContainer: {
    backgroundColor: "#f0f0f0",
  },
  focusStick: {
    backgroundColor: "#7C3AED",
  },
  activePinCodeContainer: {
    borderColor: "#7C3AED",
  },
});
