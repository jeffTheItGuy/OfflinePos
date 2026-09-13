import type {
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  RestaurantSettings,
  Staff,
  TableItem,
} from "./types";

const BASE = "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.detail ?? res.statusText);
  }
  return body as T;
}

export const api = {
  // ── Orders ────────────────────────────────────────────────────────
  listOrders: (status?: string, limit = 100) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    q.set("limit", String(limit));
    return request<Order[]>(`/orders?${q.toString()}`);
  },

  getOrder: (id: string) => request<Order>(`/orders/${id}`),

  listKitchenOrders: (limit = 50) => {
    return request<Order[]>(`/orders/kitchen?limit=${limit}`);
  },

  updateOrderStatus: (id: string, status: OrderStatus) =>
    request<Order>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  addOrderItems: (
    staffId: string,
    orderId: string,
    payload: { idempotency_key: string; items: OrderItem[] },
  ) =>
    request<Order>(`/orders/${orderId}/items`, {
      method: "POST",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(payload),
    }),

  voidOrder: (
    staffId: string,
    orderId: string,
    payload: { idempotency_key: string; reason: string },
  ) =>
    request<Order>(`/orders/${orderId}/void`, {
      method: "POST",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify({ ...payload, staff_id: staffId }),
    }),

  // ── Menu ──────────────────────────────────────────────────────────
  listMenu: () => request<MenuItem[]>("/menu"),

  createMenuItem: (
    staffId: string,
    payload: { name: string; price_cents: number; category: string },
  ) =>
    request<MenuItem>("/menu", {
      method: "POST",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(payload),
    }),

  updateMenuItem: (
    staffId: string,
    id: string,
    payload: Partial<
      Pick<MenuItem, "name" | "price_cents" | "category" | "available">
    >,
  ) =>
    request<MenuItem>(`/menu/${id}`, {
      method: "PATCH",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(payload),
    }),

  deleteMenuItem: async (staffId: string, id: string): Promise<void> => {
    const res = await fetch(`${BASE}/menu/${id}`, {
      method: "DELETE",
      headers: { "X-Staff-Id": staffId },
    });
    if (!res.ok && res.status !== 204) {
      throw new ApiError(res.status, res.statusText);
    }
  },

  // ── Tables (Step 4) ───────────────────────────────────────────────
  listTables: () => request<TableItem[]>("/tables"),

  createTable: (
    staffId: string,
    payload: { name: string; section: string },
  ) =>
    request<TableItem>("/tables", {
      method: "POST",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(payload),
    }),

  updateTable: (
    staffId: string,
    id: string,
    payload: Partial<Pick<TableItem, "name" | "section" | "available">>,
  ) =>
    request<TableItem>(`/tables/${id}`, {
      method: "PATCH",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(payload),
    }),

  deleteTable: async (staffId: string, id: string): Promise<void> => {
    const res = await fetch(`${BASE}/tables/${id}`, {
      method: "DELETE",
      headers: { "X-Staff-Id": staffId },
    });
    if (!res.ok && res.status !== 204) {
      throw new ApiError(res.status, res.statusText);
    }
  },

  // ── Staff ─────────────────────────────────────────────────────────
  login: (pin: string) =>
    request<Staff>("/staff/login", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  listStaff: () => request<Staff[]>("/staff"),

  createStaff: (
    staffId: string,
    payload: { name: string; pin: string; role: "waiter" | "manager" },
  ) =>
    request<Staff>("/staff", {
      method: "POST",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(payload),
    }),

  // ── Restaurant settings ───────────────────────────────────────────
  getSettings: () => request<RestaurantSettings>("/settings"),

  updateSettings: (staffId: string, patch: Partial<RestaurantSettings>) =>
    request<RestaurantSettings>("/settings", {
      method: "PATCH",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(patch),
    }),
};