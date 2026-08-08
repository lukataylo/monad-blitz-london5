import { StyleSheet, View } from "react-native";

export default function CollapsibleContentContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.collapsibleContentContainer}>{children}</View>;
}

const styles = StyleSheet.create({
  collapsibleContentContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: 10,
  },
});
