export type Role = "waiter" | "manager";

export interface Staff {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  price_cents: number;
  category: string;
  available: boolean;
  version: number;
}

// ── Step 4: configurable tables ──────────────────────────────────
export interface TableItem {
  id: string;
  name: string;
  section: string;
  available: boolean;
  version: number;
}

export interface OrderItem {
  menu_item_id: string | null;
  name: string;
  quantity: number;
  price_cents: number;
  notes: string;
}

export type OrderStatus =
  | "sent"
  | "preparing"
  | "ready"
  | "completed"
  | "void";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface Order {
  id: string;
  order_no: string;
  table_name: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  // ── Step 3: tax breakdown ──────────────────────────────────────
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: string;
  items: OrderItem[];
  // Step 2: void audit trail (only set when status === "void")
  void_reason?: string;
  voided_by?: string;
}

export interface RestaurantSettings {
  restaurant_timezone: string;
  business_day_cutover_hour: number;
  currency: string;
  // ── Step 3: named tax rates, e.g. { "vat": 0.15, "service": 0.10 }
  tax_rates: Record<string, number>;
}