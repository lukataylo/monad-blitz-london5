import React from "react";
import { StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from "react-native";

interface ThemedButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export default function ThemedButton({ title, children, onPress, style, textStyle, disabled }: ThemedButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, style, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text style={[styles.text, textStyle]}>
        {title || children}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    backgroundColor: '#7C3AED', // purple-600
    paddingVertical: 14,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  disabled: {
    opacity: 0.5,
  },
}); 