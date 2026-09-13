import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useOrdersStore } from "../store/ordersStore";

export function PaymentScreen({
  orderId,
  onDone,
}: {
  orderId: string;
  onDone: () => void;
}) {
  const { orders, payCash } = useOrdersStore();
  const [busy, setBusy] = useState(false);

  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <View style={styles.missing}>
        <Text>Order not found.</Text>
      </View>
    );
  }

  const currentOrder = order;
  // Legacy orders (pre-tax) have subtotal/tax of 0 — hide the breakdown
  // for those and just show the total.
  const hasBreakdown =
    currentOrder.subtotal_cents > 0 || currentOrder.tax_cents > 0;

  async function cash() {
    setBusy(true);
    try {
      await payCash(currentOrder.id, currentOrder.total_cents);
      onDone();
    } catch (e) {
      Alert.alert("Cash payment failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.h1}>Charge {currentOrder.order_no}</Text>
        <Text style={styles.amt}>
          ${(currentOrder.total_cents / 100).toFixed(2)}
        </Text>

        {hasBreakdown && (
          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Subtotal</Text>
              <Text style={styles.breakdownValue}>
                ${(currentOrder.subtotal_cents / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Tax</Text>
              <Text style={styles.breakdownValue}>
                ${(currentOrder.tax_cents / 100).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
              <Text style={styles.breakdownTotalLabel}>Total</Text>
              <Text style={styles.breakdownTotalValue}>
                ${(currentOrder.total_cents / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, styles.cashButton, busy && { opacity: 0.6 }]}
          onPress={cash}
          disabled={busy}
        >
          <Text style={styles.btnText}>
            {busy ? "Processing…" : "Confirm Cash Payment"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDone} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  wrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignItems: "stretch",
  },
  h1: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  amt: {
    fontSize: 52,
    fontWeight: "900",
    marginVertical: 24,
    textAlign: "center",
  },
  breakdown: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  breakdownLabel: { color: "#64748b", fontSize: 15, fontWeight: "600" },
  breakdownValue: { fontSize: 15, fontWeight: "700" },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 6,
    paddingTop: 12,
  },
  breakdownTotalLabel: { fontSize: 17, fontWeight: "800" },
  breakdownTotalValue: { fontSize: 17, fontWeight: "900" },
  btn: {
    width: "100%",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  cashButton: {
    backgroundColor: "#16a34a",
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  cancel: {
    marginTop: 24,
    alignItems: "center",
  },
  cancelText: {
    color: "#475569",
    fontSize: 16,
  },
});