import React, { useEffect } from "react";
import { View, Text, StyleSheet, LayoutAnimation } from "react-native";
import { useSyncStore } from "../store/syncStore";

export function SyncBanner() {
  const { online, syncing, pending } = useSyncStore();
  const offline = !online;

  // Only show when something actually needs attention.
  // Healthy background syncs stay completely invisible.
  const show = offline || pending > 0;

  // Smoothly animate the banner in/out instead of snapping the layout.
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [show]);

  if (!show) return null;

  const bg = offline ? "#b91c1c" : syncing ? "#0369a1" : "#a16207";
  const label = offline
    ? `Offline${pending ? ` — ${pending} pending` : ""}`
    : syncing
      ? `Syncing ${pending} pending…`
      : `${pending} order${pending === 1 ? "" : "s"} pending`;

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});