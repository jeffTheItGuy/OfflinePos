// The ONE place the server URL lives.
export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const detail = body?.detail ?? res.statusText;
      throw new ApiError(res.status, detail);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  registerDevice: (name: string, order_no_prefix: string) =>
    request<{ id: string; name: string; order_no_prefix: string }>(
      "/devices/register",
      { method: "POST", body: JSON.stringify({ name, order_no_prefix }) },
    ),

  login: (pin: string) =>
    request<{ id: string; name: string; role: "waiter" | "manager" }>(
      "/staff/login",
      { method: "POST", body: JSON.stringify({ pin }) },
    ),

  listStaff: () =>
    request<{ id: string; name: string; role: "waiter" | "manager" }[]>(
      "/staff",
    ),

  menuSince: (since_version: number) =>
    request<import("../types").MenuItem[]>(
      `/menu?since_version=${since_version}`,
    ),

  // ── Step 4: table sync (same version-bump pattern as menu) ─────
  tablesSince: (since_version: number) =>
    request<import("../types").TableItem[]>(
      `/tables?since_version=${since_version}`,
    ),

  // ── Step 3: tax rates so the tablet can compute offline totals ─
  getSettings: () =>
    request<{
      restaurant_timezone: string;
      business_day_cutover_hour: number;
      currency: string;
      tax_rates: Record<string, number>;
    }>("/settings"),

  createOrder: (payload: unknown) =>
    request<import("../types").Order>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  addOrderItems: (orderId: string, payload: unknown) =>
    request<import("../types").Order>(`/orders/${orderId}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  voidOrder: (orderId: string, payload: unknown) =>
    request<import("../types").Order>(`/orders/${orderId}/void`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listOrders: (deviceId?: string, limit = 100) => {
    const q = new URLSearchParams();
    if (deviceId) q.set("device_id", deviceId);
    q.set("limit", String(limit));
    return request<import("../types").Order[]>(`/orders?${q.toString()}`);
  },

  createCashPayment: (payload: unknown) =>
    request<{
      id: string;
      order_id: string;
      method: string;
      amount_cents: number;
      status: string;
      created_at: string;
    }>("/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};