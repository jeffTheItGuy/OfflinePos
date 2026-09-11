import React from "react";
import { Text, StyleSheet, View } from "react-native";

export function OrderNumberBadge({
  orderNo,
  synced,
}: {
  orderNo: string;
  synced: boolean;
}) {
  return (
    <View style={[styles.badge, !synced && styles.pending]}>
      <Text style={styles.text}>{synced ? orderNo : `${orderNo} •`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#0f172a",
  },
  pending: { backgroundColor: "#a16207" },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
