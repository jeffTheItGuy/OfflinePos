import type { MenuItem, Order, Staff } from "./types";

// Empty base = same-origin. Caddy in prod and the Vite proxy in dev both
// route the API paths correctly, so no env var is required.
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
  listOrders: (status?: "sent" | "paid" | "void", limit = 100) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    q.set("limit", String(limit));
    return request<Order[]>(`/orders?${q.toString()}`);
  },

  listMenu: () => request<MenuItem[]>("/menu"),

  login: (pin: string) =>
    request<Staff>("/staff/login", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  listStaff: () => request<Staff[]>("/staff"),

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
    payload: Partial<Pick<MenuItem, "name" | "price_cents" | "category" | "available">>,
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

  createStaff: (
    staffId: string,
    payload: { name: string; pin: string; role: "waiter" | "manager" },
  ) =>
    request<Staff>("/staff", {
      method: "POST",
      headers: { "X-Staff-Id": staffId },
      body: JSON.stringify(payload),
    }),
};
