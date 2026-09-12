import { api, ApiError } from "../api/client";
import { getDb } from "../db/database";
import { getMeta, setMeta } from "../db/migrations";
import { nextDue, markSyncing, markDone, markFailed, pendingCount } from "../db/outbox";
import { backoffMs } from "./retry";
import { useSyncStore } from "../store/syncStore";
import { useMenuStore } from "../store/menuStore";
import { useAuthStore } from "../store/authStore";

let running = false;

export async function runSync(_reason = "auto"): Promise<void> {
  if (running) return;
  running = true;
  const sync = useSyncStore.getState();
  sync.setSyncing(true);
  try {
    await flushOutbox();
    await pullMenu();
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
      } else if (item.kind === "payment") {
        await api.createCashPayment(payload);
        await markOrderPaid(payload.order_id);
      }
      await markDone(item.id);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : (err as Error).message;
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
  await db.runAsync("UPDATE orders SET order_no = ?, synced = 1 WHERE id = ?", [orderNo, id]);
}

async function markOrderPaid(orderId: string): Promise<void> {
  const db = await getDb();
  // FIX: Update payment_status, NOT the kitchen status!
  await db.runAsync("UPDATE orders SET payment_status='paid' WHERE id = ?", [orderId]);
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

async function pullOrderStatuses(): Promise<void> {
  const deviceId = useAuthStore.getState().deviceId;
  if (!deviceId) return;

  const remote = await api.listOrders(deviceId, 100);
  if (remote.length === 0) return;

  const db = await getDb();
  for (const o of remote) {
    // Now safely updates both kitchen and payment statuses independently
    await db.runAsync(
      `UPDATE orders SET status = ?, payment_status = ? WHERE id = ?`,
      [o.status, o.payment_status ?? "unpaid", o.id],
    );
  }
}