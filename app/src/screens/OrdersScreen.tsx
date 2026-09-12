import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useOrdersStore } from "../store/ordersStore";
import { useSyncStore } from "../store/syncStore";
import { SyncBanner } from "../components/SyncBanner";
import { OrderNumberBadge } from "../components/OrderNumberBadge";
import { runSync } from "../sync/engine";
import type { Order } from "../types";

const STATUS_CHIP: Record<string, { bg: string; label: string }> = {
  sent: { bg: "#64748b", label: "SENT" },
  preparing: { bg: "#d97706", label: "PREPARING" },
  ready: { bg: "#16a34a", label: "READY" },
  completed: { bg: "#0369a1", label: "COMPLETED" },
  void: { bg: "#b91c1c", label: "VOID" },
};

const PAYMENT_CHIP: Record<string, { bg: string; label: string }> = {
  unpaid: { bg: "#a16207", label: "UNPAID" },
  paid: { bg: "#0f172a", label: "PAID" },
  refunded: { bg: "#b91c1c", label: "REFUNDED" },
};

const OrderRow = React.memo(({ item }: { item: Order }) => {
  const synced = !item.order_no.includes("-L");
  const ready = item.status === "ready";
  const chip = STATUS_CHIP[item.status] ?? STATUS_CHIP.sent;
  const payChip =
    PAYMENT_CHIP[item.payment_status ?? "unpaid"] ?? PAYMENT_CHIP.unpaid;

  return (
    <View style={[styles.row, ready && styles.readyRow]}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <OrderNumberBadge orderNo={item.order_no} synced={synced} />
          <Text style={styles.table}>{item.table_name}</Text>
          <Text style={[styles.statusChip, { backgroundColor: chip.bg }]}>
            {chip.label}
          </Text>
          <Text style={[styles.statusChip, { backgroundColor: payChip.bg }]}>
            {payChip.label}
          </Text>
        </View>
        <Text style={styles.meta}>{item.items.length} item(s)</Text>
      </View>
      <Text style={styles.total}>
        ${(item.total_cents / 100).toFixed(2)}
      </Text>
    </View>
  );
});

export function OrdersScreen() {
  const { orders, reload } = useOrdersStore();
  const lastSync = useSyncStore((s) => s.lastSync);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    reload();
  }, [reload]);

  // Reload automatically whenever a background sync finishes.
  useEffect(() => {
    reload();
  }, [reload, lastSync]);

  // Pull-to-refresh: full manual sync, then reload from SQLite.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync("manual");
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <SyncBanner />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <Text style={styles.pullHint}>
            ↓ slide down to sync
            {lastSync
              ? ` · last ${new Date(lastSync).toLocaleTimeString()}`
              : ""}
          </Text>
        }
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => <OrderRow item={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pullHint: {
    textAlign: "center",
    color: "rgba(100, 116, 139, 0.5)", // soft, semi-transparent grey
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 6,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  readyRow: {
    borderColor: "#16a34a",
    borderWidth: 2,
    backgroundColor: "#f0fdf4",
  },
  statusChip: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  table: { fontWeight: "700", fontSize: 15 },
  meta: { color: "#64748b", marginTop: 4 },
  total: { fontWeight: "800", fontSize: 16 },
});