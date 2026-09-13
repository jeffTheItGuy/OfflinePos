import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useMenuStore } from "../store/menuStore";
import { useTablesStore } from "../store/tablesStore";
import { useCartStore } from "../store/cartStore";
import { useOrdersStore, nextLocalNo } from "../store/ordersStore";
import { useAuthStore } from "../store/authStore";
import { useSyncStore } from "../store/syncStore";
import { SyncBanner } from "../components/SyncBanner";
import { runSync } from "../sync/engine";
import type { MenuItem, TableItem } from "../types";

export function MenuScreen({
  onCheckout,
  modifyOrderId,
  onModifyDone,
}: {
  onCheckout: (orderId: string) => void;
  modifyOrderId?: string;
  onModifyDone?: () => void;
}) {
  const items = useMenuStore((s) => s.items);
  const reload = useMenuStore((s) => s.reload);
  // Step 4: tables come from the backend, not a hardcoded list.
  const tables = useTablesStore((s) => s.tables);
  const reloadTables = useTablesStore((s) => s.reload);
  const cart = useCartStore();
  const submit = useOrdersStore((s) => s.submitCurrent);
  const addItemsToOrder = useOrdersStore((s) => s.addItems);
  const orders = useOrdersStore((s) => s.orders);
  const reloadOrders = useOrdersStore((s) => s.reload);
  const prefix = useAuthStore((s) => s.devicePrefix) ?? "T?";
  const lastSync = useSyncStore((s) => s.lastSync);

  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [notesItem, setNotesItem] = useState<MenuItem | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const { width } = useWindowDimensions();
  const numColumns = width < 500 ? 2 : width < 850 ? 3 : 4;

  const modifyMode = modifyOrderId != null;
  const modifyOrder = useMemo(
    () =>
      modifyOrderId
        ? orders.find((o) => o.id === modifyOrderId) ?? null
        : null,
    [orders, modifyOrderId],
  );

  useEffect(() => {
    reload();
    reloadTables();
    // Orders are always loaded so we can derive occupied/free table status.
    reloadOrders();
  }, []);

  useEffect(() => {
    if (modifyOrder) cart.setTable(modifyOrder.table_name);
  }, [modifyOrder?.id]);

  // Step 4: a table is "occupied" if it has an open, unpaid order.
  // Derived directly from orders — no extra state needed.
  const occupiedTables = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      const open =
        ["sent", "preparing", "ready"].includes(o.status) &&
        o.payment_status !== "paid";
      if (open) set.add(o.table_name);
    }
    return set;
  }, [orders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync("manual");
      await reload();
      await reloadTables();
      await reloadOrders();
    } finally {
      setRefreshing(false);
    }
  }, [reload, reloadTables, reloadOrders]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((i) => i.category))).sort()],
    [items],
  );
  const activeCategory = categories.includes(category) ? category : "All";
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (activeCategory === "All" || i.category === activeCategory) &&
        (q === "" || i.name.toLowerCase().includes(q)),
    );
  }, [items, activeCategory, search]);

  const hasTable = cart.table.trim().length > 0;
  const hasItems = cart.lines.length > 0;

  function openReview() {
    if (!hasTable && !modifyMode) {
      setPickerVisible(true);
      return;
    }
    if (!hasItems) return;
    setCartOpen(true);
  }

  async function confirmSend() {
    setSubmitting(true);
    try {
      if (modifyMode && modifyOrder) {
        await addItemsToOrder(modifyOrder.id, cart.lines);
        setCartOpen(false);
        cart.clear();
        onModifyDone?.();
      } else {
        const localNo = await nextLocalNo(prefix);
        const order = await submit(localNo);
        setCartOpen(false);
        onCheckout(order.id);
      }
    } catch (e) {
      Alert.alert("Could not submit", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (modifyMode && !modifyOrder) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <Text style={{ color: "#64748b" }}>Loading order…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <SyncBanner />

      {/* ── Header ── */}
      <View style={styles.headerRow}>
        {modifyMode && modifyOrder ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.modifyTitle}>
              Adding to {modifyOrder.table_name} · {modifyOrder.order_no}
            </Text>
            <Text style={styles.modifySub}>
              Current total ${(modifyOrder.total_cents / 100).toFixed(2)} ·{" "}
              <Text style={styles.modifyCancel} onPress={onModifyDone}>
                ✕ cancel
              </Text>
            </Text>
          </View>
        ) : (
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
        )}

        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.totalLabel}>
            {modifyMode ? "Adding" : "Total"}
          </Text>
          <Text style={styles.total}>
            ${(cart.totalCents() / 100).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search menu…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search !== "" && (
          <TouchableOpacity
            style={styles.searchClear}
            onPress={() => setSearch("")}
          >
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.tab, activeCategory === c && styles.tabActive]}
            onPress={() => setCategory(c)}
          >
            <Text
              style={[
                styles.tabText,
                activeCategory === c && styles.tabTextActive,
              ]}
            >
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        key={`menu-${numColumns}`}
        data={visibleItems}
        keyExtractor={(i) => i.id}
        numColumns={numColumns}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          !hasTable && !modifyMode ? (
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
              {modifyMode
                ? `Adding to ${modifyOrder?.order_no}`
                : `Ordering for ${cart.table}`}{" "}
              · tap to add, hold for notes · slide down to sync
              {lastSync
                ? ` · last ${new Date(lastSync).toLocaleTimeString()}`
                : ""}
            </Text>
          )
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {items.length === 0
              ? "Menu is empty — slide down to sync."
              : "No items match."}
          </Text>
        }
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 8, padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tile}
            onPress={() => cart.add(item)}
            onLongPress={() => setNotesItem(item)}
          >
            <Text style={styles.tileName}>{item.name}</Text>
            <Text style={styles.tilePrice}>
              ${(item.price_cents / 100).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Bottom bar ── */}
      <View style={styles.cartBar}>
        <TouchableOpacity
          style={styles.cartCountBtn}
          onPress={() => setCartOpen(true)}
          disabled={!hasItems}
        >
          <Text style={styles.cartCount}>{cart.lines.length} item(s)</Text>
          {hasItems ? (
            <Text style={styles.cartReviewHint}>Review ▸</Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            !hasTable && !modifyMode && styles.sendBtnNeedsTable,
            (submitting || ((hasTable || modifyMode) && !hasItems)) && {
              opacity: 0.5,
            },
          ]}
          onPress={openReview}
          disabled={submitting || ((hasTable || modifyMode) && !hasItems)}
        >
          <Text style={styles.sendText}>
            {submitting
              ? "Sending…"
              : !hasTable && !modifyMode
                ? "Select a table"
                : !hasItems
                  ? "Add items"
                  : modifyMode
                    ? `Add to ${modifyOrder?.order_no ?? "order"}`
                    : `Review & send — ${cart.table}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom sheets ── */}
      {notesItem && (
        <NotesSheet
          item={notesItem}
          onAdd={(item, quantity, notes) => {
            cart.add(item, quantity, notes);
            setNotesItem(null);
          }}
          onClose={() => setNotesItem(null)}
        />
      )}

      <CartSheet
        visible={cartOpen}
        submitting={submitting}
        confirmLabel={
          modifyMode
            ? `Add to order ${modifyOrder?.order_no ?? ""}`
            : `Send to kitchen — ${cart.table}`
        }
        onConfirm={confirmSend}
        onClose={() => setCartOpen(false)}
      />

      <TablePicker
        visible={pickerVisible}
        current={cart.table}
        tables={tables}
        occupied={occupiedTables}
        onSelect={(t) => {
          cart.setTable(t);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

/* ── Bottom sheet: add one item with quantity + notes ── */
function NotesSheet({
  item,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem, quantity: number, notes: string) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={notesStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity activeOpacity={1} style={notesStyles.sheet}>
            <View style={notesStyles.handle} />
            <Text style={notesStyles.title}>{item.name}</Text>
            <Text style={notesStyles.price}>
              ${(item.price_cents / 100).toFixed(2)} each
            </Text>

            <View style={notesStyles.qtyRow}>
              <Text style={notesStyles.qtyLabel}>Quantity</Text>
              <View style={notesStyles.stepper}>
                <TouchableOpacity
                  style={[
                    notesStyles.stepBtn,
                    quantity <= 1 && { opacity: 0.4 },
                  ]}
                  disabled={quantity <= 1}
                  onPress={() => setQuantity((q) => q - 1)}
                >
                  <Text style={notesStyles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={notesStyles.stepQty}>{quantity}</Text>
                <TouchableOpacity
                  style={notesStyles.stepBtn}
                  onPress={() => setQuantity((q) => q + 1)}
                >
                  <Text style={notesStyles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={notesStyles.input}
              placeholder="Notes for the kitchen — e.g. no onions, sauce on the side"
              placeholderTextColor="#94a3b8"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <TouchableOpacity
              style={notesStyles.addBtn}
              onPress={() => onAdd(item, quantity, notes)}
            >
              <Text style={notesStyles.addBtnText}>
                Add {quantity} × {item.name} — $
                {((quantity * item.price_cents) / 100).toFixed(2)}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Bottom sheet: review/edit cart, then confirm ── */
function CartSheet({
  visible,
  submitting,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  submitting: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cart = useCartStore();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={cartStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={cartStyles.sheet}>
          <View style={cartStyles.handle} />
          <Text style={cartStyles.title}>Review order</Text>
          <Text style={cartStyles.subtitle}>
            {cart.table} · {cart.lines.length} line
            {cart.lines.length === 1 ? "" : "s"}
          </Text>

          <ScrollView style={cartStyles.lines}>
            {cart.lines.map((l) => (
              <View key={l.line_id} style={cartStyles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={cartStyles.lineName}>{l.name}</Text>
                  {l.notes !== "" ? (
                    <Text style={cartStyles.lineNotes}>✎ {l.notes}</Text>
                  ) : null}
                  <Text style={cartStyles.linePrice}>
                    ${(l.price_cents / 100).toFixed(2)} each
                  </Text>
                </View>
                <View style={cartStyles.stepper}>
                  <TouchableOpacity
                    style={cartStyles.stepBtn}
                    onPress={() => cart.dec(l.line_id)}
                  >
                    <Text style={cartStyles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={cartStyles.stepQty}>{l.quantity}</Text>
                  <TouchableOpacity
                    style={cartStyles.stepBtn}
                    onPress={() => cart.inc(l.line_id)}
                  >
                    <Text style={cartStyles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={cartStyles.lineTotal}>
                  ${((l.quantity * l.price_cents) / 100).toFixed(2)}
                </Text>
                <TouchableOpacity
                  onPress={() => cart.remove(l.line_id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={cartStyles.remove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {cart.lines.length === 0 ? (
              <Text style={cartStyles.empty}>Cart is empty.</Text>
            ) : null}
          </ScrollView>

          <View style={cartStyles.totalRow}>
            <Text style={cartStyles.totalLabel}>Total</Text>
            <Text style={cartStyles.totalValue}>
              ${(cart.totalCents() / 100).toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              cartStyles.confirmBtn,
              (submitting || cart.lines.length === 0) && { opacity: 0.5 },
            ]}
            disabled={submitting || cart.lines.length === 0}
            onPress={onConfirm}
          >
            <Text style={cartStyles.confirmText}>
              {submitting ? "Sending…" : confirmLabel}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/* ── Bottom-sheet table picker (Step 4: dynamic + occupied status) ── */
function TablePicker({
  visible,
  current,
  tables,
  occupied,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: string;
  tables: TableItem[];
  occupied: Set<string>;
  onSelect: (table: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");

  // Group available tables by section, preserving backend ordering.
  const sections = useMemo(() => {
    const map = new Map<string, TableItem[]>();
    for (const t of tables) {
      if (!t.available) continue;
      const arr = map.get(t.section) ?? [];
      arr.push(t);
      map.set(t.section, arr);
    }
    return Array.from(map.entries());
  }, [tables]);

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

          <ScrollView style={{ maxHeight: 340 }}>
            {sections.map(([section, sectionTables]) => (
              <View key={section}>
                <Text style={pickerStyles.sectionTitle}>
                  {section.toUpperCase()}
                </Text>
                <View style={pickerStyles.grid}>
                  {sectionTables.map((t) => {
                    const isOccupied = occupied.has(t.name);
                    const isActive = t.name === current;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          pickerStyles.cell,
                          isOccupied && pickerStyles.cellOccupied,
                          isActive && pickerStyles.cellActive,
                        ]}
                        onPress={() => onSelect(t.name)}
                      >
                        <Text
                          style={[
                            pickerStyles.cellText,
                            isActive && pickerStyles.cellTextActive,
                          ]}
                        >
                          {t.name}
                        </Text>
                        {isOccupied && !isActive ? (
                          <Text style={pickerStyles.occupiedLabel}>
                            ● occupied
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {sections.length === 0 ? (
              <Text style={pickerStyles.emptyTables}>
                No tables configured yet — slide down on the menu to sync, or
                type a name below.
              </Text>
            ) : null}

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
          </ScrollView>

          <TouchableOpacity style={pickerStyles.cancel} onPress={onClose}>
            <Text style={pickerStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f8fafc" },
  center: { alignItems: "center", justifyContent: "center" },
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
  modifyTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  modifySub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modifyCancel: { color: "#b91c1c", fontWeight: "700" },
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
  tableBtnLabel: { fontSize: 18, fontWeight: "800", color: "#fff" },
  tableBtnLabelEmpty: { color: "#0f172a" },
  tableBtnHint: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  tableBtnHintEmpty: { color: "#64748b" },
  totalLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  total: { fontSize: 24, fontWeight: "800" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  searchClear: { padding: 6 },
  searchClearText: { color: "#64748b", fontWeight: "700" },
  tabsRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  tabText: { fontWeight: "700", fontSize: 13, color: "#0f172a" },
  tabTextActive: { color: "#fff" },
  nudge: {
    backgroundColor: "#fef9c3",
    borderWidth: 1,
    borderColor: "#fde047",
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  nudgeText: { color: "#854d0e", fontWeight: "700", textAlign: "center" },
  pullHint: {
    textAlign: "center",
    color: "rgba(100, 116, 139, 0.5)",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 6,
  },
  emptyText: { textAlign: "center", color: "#64748b", padding: 24 },
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
    gap: 12,
    padding: 12,
    backgroundColor: "#0f172a",
  },
  cartCountBtn: { alignItems: "flex-start" },
  cartCount: { color: "#fff", fontWeight: "700" },
  cartReviewHint: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  sendBtn: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 220,
    alignItems: "center",
  },
  sendBtnNeedsTable: { backgroundColor: "#f59e0b" },
  sendText: { color: "#fff", fontWeight: "800" },
});

const notesStyles = StyleSheet.create({
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
  price: {
    textAlign: "center",
    color: "#475569",
    marginTop: 4,
    marginBottom: 16,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  qtyLabel: { fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  stepQty: {
    fontSize: 18,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: "top",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  addBtn: {
    backgroundColor: "#22c55e",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "800" },
});

const cartStyles = StyleSheet.create({
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
    marginBottom: 12,
  },
  lines: { maxHeight: 320 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  lineName: { fontWeight: "700", fontSize: 15 },
  lineNotes: { color: "#854d0e", fontSize: 12, fontStyle: "italic" },
  linePrice: { color: "#64748b", fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontWeight: "800", fontSize: 16, color: "#0f172a" },
  stepQty: { minWidth: 20, textAlign: "center", fontWeight: "800" },
  lineTotal: { fontWeight: "800", minWidth: 64, textAlign: "right" },
  remove: { color: "#b91c1c", fontWeight: "800", fontSize: 16, padding: 4 },
  empty: { color: "#64748b", textAlign: "center", paddingVertical: 16 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 12,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 20, fontWeight: "900" },
  confirmBtn: {
    backgroundColor: "#22c55e",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  confirmText: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  cellOccupied: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  cellActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  cellText: { fontWeight: "800", fontSize: 15, color: "#0f172a" },
  cellTextActive: { color: "#fff" },
  occupiedLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#b45309",
    marginTop: 2,
  },
  emptyTables: {
    color: "#64748b",
    textAlign: "center",
    paddingVertical: 16,
  },
  customRow: { flexDirection: "row", gap: 8 },
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
  customBtnText: { color: "#fff", fontWeight: "800" },
  cancel: { alignItems: "center", marginTop: 20, padding: 8 },
  cancelText: { color: "#64748b", fontWeight: "700" },
});