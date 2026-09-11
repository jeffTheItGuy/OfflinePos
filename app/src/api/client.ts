// The ONE place the server URL lives.
export const BASE_URL = "https://pos.nimbusurf.com";

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
    request<{ id: string; name: string; role: "waiter" | "manager" }[]>("/staff"),

  menuSince: (since_version: number) =>
    request<import("../types").MenuItem[]>(
      `/menu?since_version=${since_version}`,
    ),

  createOrder: (payload: unknown) =>
    request<import("../types").Order>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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

  createStripeIntent: (order_id: string) =>
    request<{ client_secret: string; amount_cents: number }>(
      "/payments/stripe/intent",
      { method: "POST", body: JSON.stringify({ order_id }) },
    ),
};
