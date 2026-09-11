import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { useMenuStore } from "../store/menuStore";
import { useCartStore } from "../store/cartStore";
import { useOrdersStore, nextLocalNo } from "../store/ordersStore";
import { useAuthStore } from "../store/authStore";
import { SyncBanner } from "../components/SyncBanner";

export function MenuScreen({
  onCheckout,
}: {
  onCheckout: (orderId: string) => void;
}) {
  const items = useMenuStore((s) => s.items);
  const reload = useMenuStore((s) => s.reload);
  const cart = useCartStore();
  const submit = useOrdersStore((s) => s.submitCurrent);
  const prefix = useAuthStore((s) => s.devicePrefix) ?? "T?";
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    reload();
  }, []);

  async function send() {
    if (!cart.table.trim()) {
      Alert.alert("Set a table first");
      return;
    }
    if (cart.lines.length === 0) {
      Alert.alert("Cart is empty");
      return;
    }
    setSubmitting(true);
    try {
      const localNo = await nextLocalNo(prefix);
      const order = await submit(localNo);
      onCheckout(order.id);
    } catch (e) {
      Alert.alert("Could not submit", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <SyncBanner />

      <View style={styles.headerRow}>
        <TextInput
          style={styles.tableInput}
          value={cart.table}
          onChangeText={cart.setTable}
          placeholder="Table / Tab"
        />
        <Text style={styles.total}>
          ${(cart.totalCents() / 100).toFixed(2)}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 8, padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.tile} onPress={() => cart.add(item)}>
            <Text style={styles.tileName}>{item.name}</Text>
            <Text style={styles.tilePrice}>
              ${(item.price_cents / 100).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.cartBar}>
        <Text style={styles.cartCount}>
          {cart.lines.length} item(s)
        </Text>
        <TouchableOpacity
          style={[styles.sendBtn, submitting && { opacity: 0.5 }]}
          onPress={send}
          disabled={submitting}
        >
          <Text style={styles.sendText}>
            {submitting ? "Sending…" : "Send to kitchen"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f8fafc" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  tableInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  total: { fontSize: 22, fontWeight: "800" },
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    minHeight: 80,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tileName: { fontSize: 16, fontWeight: "700" },
  tilePrice: { color: "#475569" },
  cartBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#0f172a",
  },
  cartCount: { color: "#fff", fontWeight: "700" },
  sendBtn: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendText: { color: "#fff", fontWeight: "800" },
});
