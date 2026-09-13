import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useOrdersStore } from "../store/ordersStore";
import { useSyncStore } from "../store/syncStore";
import { SyncBanner } from "../components/SyncBanner";
import { OrderNumberBadge } from "../components/OrderNumberBadge";
import { runSync } from "../sync/engine";
import { offlineLogin } from "../db/staff";
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

// ── Step 2 rules, mirrored from the backend ─────────────────────────
function canAddItems(o: Order): boolean {
  return (
    ["sent", "preparing", "ready"].includes(o.status) &&
    o.payment_status !== "paid"
  );
}
function canVoid(o: Order): boolean {
  return o.status !== "void" && o.payment_status !== "paid";
}

const OrderRow = React.memo(
  ({ item, onPress }: { item: Order; onPress: () => void }) => {
    const synced = !item.order_no.includes("-L");
    const ready = item.status === "ready";
    const voided = item.status === "void";
    const actionable = canAddItems(item) || canVoid(item);
    const chip = STATUS_CHIP[item.status] ?? STATUS_CHIP.sent;
    const payChip =
      PAYMENT_CHIP[item.payment_status ?? "unpaid"] ?? PAYMENT_CHIP.unpaid;

    return (
      <TouchableOpacity
        style={[styles.row, ready && styles.readyRow, voided && styles.voidRow]}
        onPress={onPress}
        disabled={!actionable}
        activeOpacity={actionable ? 0.7 : 1}
      >
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
          <Text style={styles.meta}>
            {item.items.length} item(s)
            {actionable ? " · tap for actions" : ""}
          </Text>
          {item.void_reason ? (
            <Text style={styles.voidReason}>✕ {item.void_reason}</Text>
          ) : null}
        </View>
        <Text style={styles.total}>
          ${(item.total_cents / 100).toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  },
);

export function OrdersScreen({
  onModify,
}: {
  onModify: (orderId: string) => void;
}) {
  const { orders, reload } = useOrdersStore();
  const lastSync = useSyncStore((s) => s.lastSync);
  const [refreshing, setRefreshing] = useState(false);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [voidOrder, setVoidOrder] = useState<Order | null>(null);

  useEffect(() => {
    reload();
  }, [reload]);

  // Reload automatically whenever a background sync finishes.
  useEffect(() => {
    reload();
  }, [reload, lastSync]);

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
        renderItem={({ item }) => (
          <OrderRow item={item} onPress={() => setActionOrder(item)} />
        )}
      />

      {actionOrder && (
        <OrderActionSheet
          order={actionOrder}
          onClose={() => setActionOrder(null)}
          onAddItems={() => {
            setActionOrder(null);
            onModify(actionOrder.id);
          }}
          onVoid={() => {
            setActionOrder(null);
            setVoidOrder(actionOrder);
          }}
        />
      )}

      {voidOrder && (
        <VoidSheet order={voidOrder} onClose={() => setVoidOrder(null)} />
      )}
    </View>
  );
}

/* ── Bottom sheet: pick an action for this order ── */
function OrderActionSheet({
  order,
  onClose,
  onAddItems,
  onVoid,
}: {
  order: Order;
  onClose: () => void;
  onAddItems: () => void;
  onVoid: () => void;
}) {
  const addable = canAddItems(order);
  const voidable = canVoid(order);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={sheetStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={sheetStyles.sheet}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>
            {order.order_no} · {order.table_name}
          </Text>
          <Text style={sheetStyles.subtitle}>
            {order.items.length} item(s) · $
            {(order.total_cents / 100).toFixed(2)}
          </Text>

          {addable && (
            <TouchableOpacity style={sheetStyles.addBtn} onPress={onAddItems}>
              <Text style={sheetStyles.addBtnText}>＋ Add items</Text>
            </TouchableOpacity>
          )}
          {!addable && (
            <Text style={sheetStyles.disabledHint}>
              Adding items is unavailable once the order is paid, completed
              or voided.
            </Text>
          )}

          {voidable && (
            <TouchableOpacity style={sheetStyles.voidBtn} onPress={onVoid}>
              <Text style={sheetStyles.voidBtnText}>Void order…</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={sheetStyles.cancel} onPress={onClose}>
            <Text style={sheetStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/* ── Bottom sheet: reason + manager PIN → void ── */
const VOID_REASONS = [
  "Wrong order",
  "Customer left",
  "Item unavailable",
  "Kitchen error",
];

function VoidSheet({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const voidOrderAction = useOrdersStore((s) => s.voidOrder);
  const [preset, setPreset] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const reason = custom.trim() || preset || "";

  async function confirm() {
    if (!reason || pin.length < 4) return;
    setBusy(true);
    try {
      // PIN verified ON-DEVICE against the cached verifier — the PIN
      // never leaves the tablet. Works fully offline.
      const manager = await offlineLogin(pin);
      if (!manager) {
        Alert.alert(
          "Invalid PIN",
          "PIN not recognized on this device. Managers must log in online once to enable offline verification.",
        );
        return;
      }
      if (manager.role !== "manager") {
        Alert.alert("Manager required", `${manager.name} is not a manager.`);
        return;
      }
      await voidOrderAction(order.id, reason, manager.id);
      onClose();
    } catch (e) {
      Alert.alert("Void failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={sheetStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={sheetStyles.sheet}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>Void {order.order_no}</Text>
          <Text style={sheetStyles.subtitle}>
            {order.table_name} · ${(order.total_cents / 100).toFixed(2)} —
            this cannot be charged later.
          </Text>

          <Text style={sheetStyles.sectionTitle}>REASON</Text>
          <View style={sheetStyles.reasonRow}>
            {VOID_REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  sheetStyles.reasonChip,
                  preset === r && !custom.trim() && sheetStyles.reasonChipActive,
                ]}
                onPress={() => setPreset(r)}
              >
                <Text
                  style={[
                    sheetStyles.reasonChipText,
                    preset === r && !custom.trim() && { color: "#fff" },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={sheetStyles.input}
            placeholder="…or type a custom reason"
            placeholderTextColor="#94a3b8"
            value={custom}
            onChangeText={setCustom}
          />

          <Text style={sheetStyles.sectionTitle}>MANAGER PIN</Text>
          <TextInput
            style={[sheetStyles.input, sheetStyles.pinInput]}
            placeholder="PIN"
            placeholderTextColor="#94a3b8"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
          />

          <TouchableOpacity
            style={[
              sheetStyles.voidConfirmBtn,
              (busy || !reason || pin.length < 4) && { opacity: 0.5 },
            ]}
            disabled={busy || !reason || pin.length < 4}
            onPress={confirm}
          >
            <Text style={sheetStyles.voidConfirmText}>
              {busy ? "Voiding…" : "Confirm void"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={sheetStyles.cancel} onPress={onClose}>
            <Text style={sheetStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pullHint: {
    textAlign: "center",
    color: "rgba(100, 116, 139, 0.5)",
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
  voidRow: {
    opacity: 0.75,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
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
  voidReason: { color: "#b91c1c", marginTop: 4, fontSize: 12 },
  total: { fontWeight: "800", fontSize: 16 },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  subtitle: {
    textAlign: "center",
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  voidBtn: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#b91c1c",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  voidBtnText: { color: "#b91c1c", fontWeight: "800", fontSize: 16 },
  disabledHint: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10,
  },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reasonChipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  reasonChipText: { fontWeight: "700", fontSize: 13, color: "#0f172a" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
    marginTop: 8,
  },
  pinInput: { letterSpacing: 6, textAlign: "center", fontSize: 20 },
  voidConfirmBtn: {
    backgroundColor: "#b91c1c",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  voidConfirmText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancel: { alignItems: "center", marginTop: 16, padding: 8 },
  cancelText: { color: "#64748b", fontWeight: "700" },
});