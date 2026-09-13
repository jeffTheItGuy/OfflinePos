import { api, ApiError } from "../api/client";
import { getDb } from "../db/database";
import { getMeta, setMeta } from "../db/migrations";
import { cacheTaxRates } from "../db/settings";
import { nextDue, markSyncing, markDone, markFailed, pendingCount } from "../db/outbox";
import { backoffMs } from "./retry";
import { useSyncStore } from "../store/syncStore";
import { useMenuStore } from "../store/menuStore";
import { useTablesStore } from "../store/tablesStore";
import { useAuthStore } from "../store/authStore";
import type { Order } from "../types";

let running = false;

export async function runSync(_reason = "auto"): Promise<void> {
  if (running) return;
  running = true;
  const sync = useSyncStore.getState();
  sync.setSyncing(true);
  try {
    await flushOutbox();
    await pullMenu();
    await pullTables();
    await pullSettings();
    await pullOrderStatuses();
    sync.setLastSync(Date.now());
    sync.setPending(await pendingCount());
  } catch {
    // Offline or server down
  } finally {
    sync.setSyncing(false);
    running = false;
    sync.setPending(await pendingCount());
  }
}

async function flushOutbox(): Promise<void> {
  const items = await nextDue(20);
  for (const item of items) {
    await markSyncing(item.id);
    try {
      const payload = JSON.parse(item.payload);
      if (item.kind === "order") {
        const order = await api.createOrder(payload);
        await recordServerOrderNo(item.id, order.order_no);
        // Server recomputed the totals — overwrite our optimistic numbers.
        await applyServerOrderState(item.id, order);
      } else if (item.kind === "payment") {
        await api.createCashPayment(payload);
        await markOrderPaid(payload.order_id);
      } else if (item.kind === "order_add_items") {
        const order = await api.addOrderItems(payload.order_id, payload);
        await applyServerOrderState(payload.order_id, order);
      } else if (item.kind === "order_void") {
        const order = await api.voidOrder(payload.order_id, payload);
        await applyServerOrderState(payload.order_id, order);
      }
      await markDone(item.id);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : (err as Error).message;
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        await markFailed(item.id, msg, 24 * 60 * 60 * 1000);
      } else {
        await markFailed(item.id, msg, backoffMs(item.attempts));
      }
    }
  }
}

async function recordServerOrderNo(id: string, orderNo: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE orders SET order_no = ?, synced = 1 WHERE id = ?",
    [orderNo, id],
  );
}

async function markOrderPaid(orderId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE orders SET payment_status='paid' WHERE id = ?",
    [orderId],
  );
}

// Overwrite optimistic local state with the server's authoritative answer
// (status, payment, full tax breakdown, and void reason).
async function applyServerOrderState(
  orderId: string,
  order: Order,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE orders
     SET status = ?, payment_status = ?,
         subtotal_cents = ?, tax_cents = ?, total_cents = ?,
         void_reason = ?
     WHERE id = ?`,
    [
      order.status,
      order.payment_status ?? "unpaid",
      order.subtotal_cents ?? 0,
      order.tax_cents ?? 0,
      order.total_cents,
      order.void_reason ?? null,
      orderId,
    ],
  );
}

async function pullMenu(): Promise<void> {
  const since = Number((await getMeta("menu_version")) ?? "0");
  const changed = await api.menuSince(since);
  if (changed.length === 0) return;
  const db = await getDb();
  let maxVersion = since;
  for (const item of changed) {
    await db.runAsync(
      `INSERT INTO menu_items (id, name, price_cents, category, available, version)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, price_cents=excluded.price_cents,
         category=excluded.category, available=excluded.available, version=excluded.version`,
      [item.id, item.name, item.price_cents, item.category, item.available ? 1 : 0, item.version],
    );
    if (item.version > maxVersion) maxVersion = item.version;
  }
  await setMeta("menu_version", String(maxVersion));
  await useMenuStore.getState().reload();
}

// Step 4: tables sync — identical version-bump pattern to the menu.
async function pullTables(): Promise<void> {
  const since = Number((await getMeta("tables_version")) ?? "0");
  const changed = await api.tablesSince(since);
  if (changed.length === 0) return;
  const db = await getDb();
  let maxVersion = since;
  for (const t of changed) {
    await db.runAsync(
      `INSERT INTO tables (id, name, section, available, version)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, section=excluded.section,
         available=excluded.available, version=excluded.version`,
      [t.id, t.name, t.section, t.available ? 1 : 0, t.version],
    );
    if (t.version > maxVersion) maxVersion = t.version;
  }
  await setMeta("tables_version", String(maxVersion));
  await useTablesStore.getState().reload();
}

// Step 3: refresh the cached tax rates so offline orders total correctly.
async function pullSettings(): Promise<void> {
  const settings = await api.getSettings();
  await cacheTaxRates(settings.tax_rates ?? {});
}

async function pullOrderStatuses(): Promise<void> {
  const deviceId = useAuthStore.getState().deviceId;
  if (!deviceId) return;
  const remote = await api.listOrders(deviceId, 100);
  if (remote.length === 0) return;
  const db = await getDb();
  for (const o of remote) {
    // Kitchen + payment statuses, the full tax breakdown, and void_reason
    // so changes made on ANOTHER tablet land here too.
    await db.runAsync(
      `UPDATE orders
       SET status = ?, payment_status = ?,
           subtotal_cents = ?, tax_cents = ?, total_cents = ?,
           void_reason = ?
       WHERE id = ?`,
      [
        o.status,
        o.payment_status ?? "unpaid",
        o.subtotal_cents ?? 0,
        o.tax_cents ?? 0,
        o.total_cents,
        o.void_reason ?? null,
        o.id,
      ],
    );
  }
}