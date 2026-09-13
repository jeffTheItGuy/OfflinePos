import { create } from "zustand";
import { getDb } from "../db/database";
import { getMeta, setMeta } from "../db/migrations";
import { getTaxRates, computeTax } from "../db/settings";
import type { CartLine, Order, OrderItem } from "../types";
import { enqueue } from "../db/outbox";
import { useCartStore } from "./cartStore";
import { useAuthStore } from "./authStore";
import { runSync } from "../sync/engine";

interface OrdersState {
  orders: Order[];
  reload: () => Promise<void>;
  submitCurrent: (localNo: string) => Promise<Order>;
  payCash: (orderId: string, amountCents: number) => Promise<void>;
  addItems: (orderId: string, lines: CartLine[]) => Promise<void>;
  voidOrder: (
    orderId: string,
    reason: string,
    managerStaffId: string,
  ) => Promise<void>;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],

  reload: async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string;
      order_no: string | null;
      local_no: string;
      table_name: string;
      status: string;
      payment_status: string | null;
      subtotal_cents: number | null;
      tax_cents: number | null;
      total_cents: number;
      void_reason: string | null;
      created_at: string;
    }>("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");

    const orders: Order[] = [];
    for (const r of rows) {
      const items = await db.getAllAsync<OrderItem>(
        `SELECT menu_item_id, name, quantity, price_cents, notes
         FROM order_items WHERE order_id = ?`,
        [r.id],
      );
      orders.push({
        id: r.id,
        order_no: r.order_no ?? r.local_no,
        table_name: r.table_name,
        status: r.status as Order["status"],
        payment_status: (r.payment_status ??
          "unpaid") as Order["payment_status"],
        subtotal_cents: r.subtotal_cents ?? 0,
        tax_cents: r.tax_cents ?? 0,
        total_cents: r.total_cents,
        created_at: r.created_at,
        items,
        void_reason: r.void_reason ?? undefined,
      });
    }
    set({ orders });
  },

  submitCurrent: async (localNo) => {
    const cart = useCartStore.getState();
    const staff = useAuthStore.getState().staff;
    const deviceId = useAuthStore.getState().deviceId;

    if (!deviceId) throw new Error("Device not registered");
    if (!cart.table) throw new Error("No table set");
    if (cart.lines.length === 0) throw new Error("Cart is empty");

    const id = uuid();
    // Local optimistic totals. The server recomputes authoritatively and
    // the sync engine overwrites these with its answer.
    const subtotal = cart.totalCents();
    const rates = await getTaxRates();
    const tax = computeTax(subtotal, rates);
    const total = subtotal + tax;
    const createdAt = new Date().toISOString();

    const payload = {
      idempotency_key: id,
      device_id: deviceId,
      staff_id: staff?.id ?? null,
      table_name: cart.table,
      items: cart.lines.map((l) => ({
        menu_item_id: l.menu_item_id,
        name: l.name,
        quantity: l.quantity,
        price_cents: l.price_cents,
        notes: l.notes,
      })),
    };

    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO orders
         (id, order_no, local_no, table_name, status, payment_status,
          subtotal_cents, tax_cents, total_cents, staff_id, created_at, synced, payload)
         VALUES (?, NULL, ?, ?, 'sent', 'unpaid', ?, ?, ?, ?, ?, 0, ?)`,
        [
          id,
          localNo,
          cart.table,
          subtotal,
          tax,
          total,
          staff?.id ?? null,
          createdAt,
          JSON.stringify(payload),
        ],
      );
      for (const l of cart.lines) {
        await db.runAsync(
          `INSERT INTO order_items
           (order_id, menu_item_id, name, quantity, price_cents, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, l.menu_item_id, l.name, l.quantity, l.price_cents, l.notes],
        );
      }
    });

    await enqueue(id, "order", payload);
    cart.clear();
    await get().reload();
    runSync("submit");

    return {
      id,
      order_no: localNo,
      table_name: payload.table_name,
      status: "sent",
      payment_status: "unpaid",
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: total,
      created_at: createdAt,
      items: payload.items,
    };
  },

  payCash: async (orderId, amountCents) => {
    const staff = useAuthStore.getState().staff;
    const id = uuid();
    const payload = {
      idempotency_key: id,
      order_id: orderId,
      staff_id: staff?.id ?? null,
      amount_cents: amountCents,
    };
    const db = await getDb();
    await db.runAsync(
      "UPDATE orders SET payment_status='paid' WHERE id = ?",
      [orderId],
    );
    await enqueue(id, "payment", payload);
    await get().reload();
    runSync("cash");
  },

  addItems: async (orderId, lines) => {
    if (lines.length === 0) throw new Error("Nothing to add");
    const id = uuid();
    const payload = {
      idempotency_key: id,
      order_id: orderId,
      items: lines.map((l) => ({
        menu_item_id: l.menu_item_id,
        name: l.name,
        quantity: l.quantity,
        price_cents: l.price_cents,
        notes: l.notes,
      })),
    };

    const addedCents = lines.reduce(
      (s, l) => s + l.quantity * l.price_cents,
      0,
    );

    const db = await getDb();
    // Recompute over the full order, mirroring the server: read the stored
    // subtotal, add the new lines, then recompute tax on the new subtotal.
    const row = await db.getFirstAsync<{ subtotal_cents: number }>(
      "SELECT subtotal_cents FROM orders WHERE id = ?",
      [orderId],
    );
    const newSubtotal = (row?.subtotal_cents ?? 0) + addedCents;
    const rates = await getTaxRates();
    const newTax = computeTax(newSubtotal, rates);
    const newTotal = newSubtotal + newTax;

    await db.withTransactionAsync(async () => {
      for (const l of lines) {
        await db.runAsync(
          `INSERT INTO order_items
           (order_id, menu_item_id, name, quantity, price_cents, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, l.menu_item_id, l.name, l.quantity, l.price_cents, l.notes],
        );
      }
      await db.runAsync(
        `UPDATE orders
         SET subtotal_cents = ?, tax_cents = ?, total_cents = ?
         WHERE id = ?`,
        [newSubtotal, newTax, newTotal, orderId],
      );
    });

    await enqueue(id, "order_add_items", payload);
    await get().reload();
    runSync("add-items");
  },

  voidOrder: async (orderId, reason, managerStaffId) => {
    const id = uuid();
    const payload = {
      idempotency_key: id,
      order_id: orderId,
      staff_id: managerStaffId,
      reason,
    };
    const db = await getDb();
    await db.runAsync(
      "UPDATE orders SET status='void', void_reason=? WHERE id = ?",
      [reason, orderId],
    );
    await enqueue(id, "order_void", payload);
    await get().reload();
    runSync("void");
  },
}));

export async function nextLocalNo(prefix: string): Promise<string> {
  const cur = Number((await getMeta("local_seq")) ?? "0");
  const next = cur + 1;
  await setMeta("local_seq", String(next));
  return `${prefix}-L${next}`;
}

function uuid(): string {
  const h = () =>
    Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}