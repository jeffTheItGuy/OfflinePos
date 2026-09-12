import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useMenuStore } from "../store/menuStore";
import { useCartStore } from "../store/cartStore";
import { useOrdersStore, nextLocalNo } from "../store/ordersStore";
import { useAuthStore } from "../store/authStore";
import { useSyncStore } from "../store/syncStore";
import { SyncBanner } from "../components/SyncBanner";
import { runSync } from "../sync/engine";

// ── Edit these lists to match your floor layout ────────────────────
const PRESET_TABLES = [
  "T1", "T2", "T3", "T4", "T5", "T6",
  "T7", "T8", "T9", "T10", "T11", "T12",
  "Bar", "Patio",
];

const QUICK_TABS = ["Takeout", "Delivery", "Staff Meal"];

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
  const lastSync = useSyncStore((s) => s.lastSync);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const { width } = useWindowDimensions();
  const numColumns = width < 500 ? 2 : width < 850 ? 3 : 4;

  useEffect(() => {
    reload();
  }, []);

  // Pull-to-refresh: full manual sync, then reload menu from SQLite.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync("manual");
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const hasTable = cart.table.trim().length > 0;
  const hasItems = cart.lines.length > 0;

  async function send() {
    // Guide, don't error: no table → open the picker.
    if (!hasTable) {
      setPickerVisible(true);
      return;
    }
    if (!hasItems) return;
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

      {/* ── Header: table selection + running total ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.tableBtn, !hasTable && styles.tableBtnEmpty]}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tableBtnLabel,
              !hasTable && styles.tableBtnLabelEmpty,
            ]}
          >
            {hasTable ? cart.table : "Select table"}
          </Text>
          <Text
            style={[
              styles.tableBtnHint,
              !hasTable && styles.tableBtnHintEmpty,
            ]}
          >
            {hasTable ? "tap to change" : "tap to choose"}
          </Text>
        </TouchableOpacity>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>
            ${(cart.totalCents() / 100).toFixed(2)}
          </Text>
        </View>
      </View>

      <FlatList
        key={`menu-${numColumns}`}
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={numColumns}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          !hasTable ? (
            <TouchableOpacity
              style={styles.nudge}
              onPress={() => setPickerVisible(true)}
            >
              <Text style={styles.nudgeText}>
                👆 First choose a table, then tap items to add them
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.pullHint}>
              Ordering for {cart.table} · slide down to sync
              {lastSync
                ? ` · last ${new Date(lastSync).toLocaleTimeString()}`
                : ""}
            </Text>
          )
        }
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 8, padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tile}
            onPress={() => cart.add(item)}
          >
            <Text style={styles.tileName}>{item.name}</Text>
            <Text style={styles.tilePrice}>
              ${(item.price_cents / 100).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Bottom bar: cart summary + contextual send button ── */}
      <View style={styles.cartBar}>
        <Text style={styles.cartCount}>
          {cart.lines.length} item(s)
        </Text>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            !hasTable && styles.sendBtnNeedsTable,
            (submitting || (hasTable && !hasItems)) && { opacity: 0.5 },
          ]}
          onPress={send}
          disabled={submitting || (hasTable && !hasItems)}
        >
          <Text style={styles.sendText}>
            {submitting
              ? "Sending…"
              : !hasTable
                ? "Select a table"
                : !hasItems
                  ? "Add items to order"
                  : `Send to kitchen — ${cart.table}`}
          </Text>
        </TouchableOpacity>
      </View>

      <TablePicker
        visible={pickerVisible}
        current={cart.table}
        onSelect={(t) => {
          cart.setTable(t);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

/* ── Bottom-sheet table / tab picker ── */
function TablePicker({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: string;
  onSelect: (table: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={pickerStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>Select Table or Tab</Text>

          {/* SECTION 1: Dine-In Tables */}
          <Text style={pickerStyles.sectionTitle}>DINE-IN</Text>
          <View style={pickerStyles.grid}>
            {PRESET_TABLES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  pickerStyles.cell,
                  t === current && pickerStyles.cellActive,
                ]}
                onPress={() => onSelect(t)}
              >
                <Text
                  style={[
                    pickerStyles.cellText,
                    t === current && pickerStyles.cellTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* SECTION 2: Quick Tabs / Takeout */}
          <Text style={pickerStyles.sectionTitle}>TAKEOUT & TABS</Text>
          <View style={pickerStyles.grid}>
            {QUICK_TABS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  pickerStyles.cell,
                  pickerStyles.cellAlt,
                  t === current && pickerStyles.cellActive,
                ]}
                onPress={() => onSelect(t)}
              >
                <Text
                  style={[
                    pickerStyles.cellText,
                    t === current && pickerStyles.cellTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* SECTION 3: Custom Customer Name */}
          <Text style={pickerStyles.sectionTitle}>CUSTOMER NAME</Text>
          <View style={pickerStyles.customRow}>
            <TextInput
              style={pickerStyles.customInput}
              placeholder="e.g. John's Tab, Sarah, Hotel Guest"
              placeholderTextColor="#94a3b8"
              value={custom}
              onChangeText={setCustom}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[
                pickerStyles.customBtn,
                !custom.trim() && { opacity: 0.4 },
              ]}
              disabled={!custom.trim()}
              onPress={() => {
                onSelect(custom.trim());
                setCustom("");
              }}
            >
              <Text style={pickerStyles.customBtnText}>Use</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={pickerStyles.cancel} onPress={onClose}>
            <Text style={pickerStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  tableBtn: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tableBtnEmpty: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#0f172a",
  },
  tableBtnLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  tableBtnLabelEmpty: {
    color: "#0f172a",
  },
  tableBtnHint: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  tableBtnHintEmpty: {
    color: "#64748b",
  },
  totalLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  total: {
    fontSize: 24,
    fontWeight: "800",
  },
  nudge: {
    backgroundColor: "#fef9c3",
    borderWidth: 1,
    borderColor: "#fde047",
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  nudgeText: {
    color: "#854d0e",
    fontWeight: "700",
    textAlign: "center",
  },
  pullHint: {
    textAlign: "center",
    color: "rgba(100, 116, 139, 0.5)",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 6,
  },
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
  tileName: {
    fontSize: 16,
    fontWeight: "700",
  },
  tilePrice: {
    color: "#475569",
  },
  cartBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    backgroundColor: "#0f172a",
  },
  cartCount: {
    color: "#fff",
    fontWeight: "700",
  },
  sendBtn: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 220,
    alignItems: "center",
  },
  sendBtnNeedsTable: {
    backgroundColor: "#f59e0b",
  },
  sendText: {
    color: "#fff",
    fontWeight: "800",
  },
});

const pickerStyles = StyleSheet.create({
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
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cell: {
    minWidth: 72,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  cellAlt: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  cellActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  cellText: {
    fontWeight: "800",
    fontSize: 15,
    color: "#0f172a",
  },
  cellTextActive: {
    color: "#fff",
  },
  customRow: {
    flexDirection: "row",
    gap: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  customBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  customBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  cancel: {
    alignItems: "center",
    marginTop: 20,
    padding: 8,
  },
  cancelText: {
    color: "#64748b",
    fontWeight: "700",
  },
});