import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { listPending, pendingCount } from "../db/outbox";
import { runSync } from "../sync/engine";
import { useSyncStore } from "../store/syncStore";
import { useAuthStore } from "../store/authStore";
import type { OutboxItem } from "../types";

export function SettingsScreen() {
  const { staff, setStaff, deviceName, devicePrefix, deviceId } =
    useAuthStore();
  const { pending, setPending, lastSync, syncing, online } = useSyncStore();
  const [items, setItems] = useState<OutboxItem[]>([]);

  async function refresh() {
    setPending(await pendingCount());
    setItems(await listPending());
  }

  useEffect(() => {
    refresh();
  }, [pending, lastSync]);

  async function forceSync() {
    await runSync("manual");
    await refresh();
    Alert.alert("Sync finished", `${await pendingCount()} still pending`);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.k}>Device</Text>
        <Text style={styles.v}>
          {deviceName} · prefix {devicePrefix}
        </Text>
        <Text style={styles.k}>Device ID</Text>
        <Text style={styles.v} numberOfLines={1}>
          {deviceId}
        </Text>
        <Text style={styles.k}>Network</Text>
        <Text style={styles.v}>{online ? "Online" : "Offline"}</Text>
        <Text style={styles.k}>Last sync</Text>
        <Text style={styles.v}>
          {lastSync ? new Date(lastSync).toLocaleTimeString() : "never"}
        </Text>
        <Text style={styles.k}>Pending</Text>
        <Text style={styles.v}>{pending}</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={forceSync}
        disabled={syncing}
      >
        <Text style={styles.btnText}>
          {syncing ? "Syncing…" : "Force sync now"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.h2}>Unsynced queue</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.qRow}>
            <Text style={styles.qKind}>{item.kind}</Text>
            <Text style={styles.qMeta} numberOfLines={1}>
              {item.id.slice(0, 8)}… · attempts {item.attempts}
            </Text>
            {item.last_error ? (
              <Text style={styles.qErr} numberOfLines={1}>
                {item.last_error}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: "#64748b" }}>Queue is empty.</Text>
        }
      />

      <TouchableOpacity style={styles.logout} onPress={() => setStaff(null)}>
        <Text style={{ color: "#b91c1c", fontWeight: "700" }}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#f8fafc" },
  h1: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: "800", marginTop: 24, marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  k: { color: "#64748b", fontSize: 12, marginTop: 6 },
  v: { fontWeight: "700", fontSize: 15 },
  btn: {
    marginTop: 16,
    backgroundColor: "#0f172a",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800" },
  qRow: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 6,
  },
  qKind: {
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 11,
    color: "#0369a1",
  },
  qMeta: { color: "#475569", fontSize: 12 },
  qErr: { color: "#b91c1c", fontSize: 12, marginTop: 2 },
  logout: { marginTop: 16, alignItems: "center", padding: 12 },
});
