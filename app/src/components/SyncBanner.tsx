import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSyncStore } from "../store/syncStore";

export function SyncBanner() {
  const { online, syncing, pending } = useSyncStore();

  const offline = !online;
  const show = offline || pending > 0 || syncing;
  if (!show) return null;

  const bg = offline ? "#b91c1c" : syncing ? "#0369a1" : "#a16207";
  const label = offline
    ? `Offline${pending ? ` — ${pending} pending` : ""}`
    : syncing
      ? "Syncing…"
      : `${pending} order${pending === 1 ? "" : "s"} pending`;

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingVertical: 6, paddingHorizontal: 12 },
  text: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
