import { create } from "zustand";
import { getDb } from "../db/database";
import { getMeta, setMeta } from "../db/migrations";
import type { Order, OrderItem } from "../types";
import { enqueue } from "../db/outbox";
import { useCartStore } from "./cartStore";
import { useAuthStore } from "./authStore";
import { runSync } from "../sync/engine";

interface OrdersState {
  orders: Order[];
  reload: () => Promise<void>;
  submitCurrent: (localNo: string) => Promise<Order>;
  payCash: (orderId: string, amountCents: number) => Promise<void>;
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
      total_cents: number;
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
        total_cents: r.total_cents,
        created_at: r.created_at,
        items,
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
    const total = cart.totalCents();
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
           (id, order_no, local_no, table_name, status,
            total_cents, staff_id, created_at, synced, payload)
         VALUES (?, NULL, ?, ?, 'sent', ?, ?, ?, 0, ?)`,
        [
          id,
          localNo,
          cart.table,
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
    await db.runAsync("UPDATE orders SET status='paid' WHERE id = ?", [orderId]);
    await enqueue(id, "payment", payload);
    await get().reload();
    runSync("cash");
  },
}));

// Local provisional order number for offline-submitted orders.
export async function nextLocalNo(prefix: string): Promise<string> {
  const cur = Number((await getMeta("local_seq")) ?? "0");
  const next = cur + 1;
  await setMeta("local_seq", String(next));
  return `${prefix}-L${next}`;
}

// Tiny RFC4122-ish id; fine for idempotency keys on one device.
function uuid(): string {
  const h = () =>
    Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}
