import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useOrdersStore } from "../store/ordersStore";
import { useSyncStore } from "../store/syncStore";
import { api, ApiError } from "../api/client";

export function PaymentScreen({
  orderId,
  onDone,
}: {
  orderId: string;
  onDone: () => void;
}) {
  const { orders, payCash } = useOrdersStore();
  const order = orders.find((o) => o.id === orderId);
  const online = useSyncStore((s) => s.online);
  const [busy, setBusy] = useState(false);

  if (!order) {
    return (
      <View style={styles.wrap}>
        <Text>Order not found.</Text>
      </View>
    );
  }

  async function cash() {
    setBusy(true);
    try {
      await payCash(order!.id, order!.total_cents);
      onDone();
    } catch (e) {
      Alert.alert("Cash payment failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function card() {
    setBusy(true);
    try {
      // Card only works online — server is the source of truth.
      await api.createStripeIntent(order!.id);
      Alert.alert(
        "Stripe intent created",
        "Finish the flow in Stripe Terminal / PaymentSheet. " +
          "The webhook is what marks the order paid.",
      );
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 501) {
        Alert.alert(
          "Card payments not enabled",
          "Stripe keys are not configured on the server.",
        );
      } else {
        Alert.alert("Card payment failed", (e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Charge {order.order_no}</Text>
      <Text style={styles.amt}>
        ${(order.total_cents / 100).toFixed(2)}
      </Text>

      <TouchableOpacity
        style={[styles.btn, styles.cash]}
        onPress={cash}
        disabled={busy}
      >
        <Text style={styles.btnText}>Cash (works offline)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.btn,
          styles.card,
          (!online || busy) && { opacity: 0.4 },
        ]}
        onPress={card}
        disabled={!online || busy}
      >
        <Text style={styles.btnText}>Card (Stripe, online only)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDone} style={styles.cancel}>
        <Text style={{ color: "#475569" }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  h1: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  amt: { fontSize: 48, fontWeight: "900", marginVertical: 24 },
  btn: {
    width: "100%",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  cash: { backgroundColor: "#16a34a" },
  card: { backgroundColor: "#0f172a" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancel: { marginTop: 24 },
});
