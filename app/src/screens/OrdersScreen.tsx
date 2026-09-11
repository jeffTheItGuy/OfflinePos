import React, { useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useOrdersStore } from "../store/ordersStore";
import { SyncBanner } from "../components/SyncBanner";
import { OrderNumberBadge } from "../components/OrderNumberBadge";

export function OrdersScreen() {
  const { orders, reload } = useOrdersStore();

  useEffect(() => {
    reload();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <SyncBanner />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => {
          const synced = !item.order_no.includes("-L");
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                >
                  <OrderNumberBadge orderNo={item.order_no} synced={synced} />
                  <Text style={styles.table}>{item.table_name}</Text>
                </View>
                <Text style={styles.meta}>
                  {item.items.length} item(s) · {item.status}
                </Text>
              </View>
              <Text style={styles.total}>
                ${(item.total_cents / 100).toFixed(2)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  table: { fontWeight: "700", fontSize: 15 },
  meta: { color: "#64748b", marginTop: 4 },
  total: { fontWeight: "800", fontSize: 16 },
});
