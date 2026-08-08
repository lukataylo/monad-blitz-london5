import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ErrorScreen({ error = 'Something went wrong.' }: { error?: string | Error }) {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Something went wrong.';
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{errorMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  text: {
    color: '#d32f2f',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
