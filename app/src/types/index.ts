export type Role = "waiter" | "manager";

export interface Staff {
  id: string;
  name: string;
  role: Role;
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
  section: string; // "DINE-IN", "TAKEOUT & TABS", ...
  available: boolean;
  version: number;
}

export interface CartLine {
  line_id: string; // local-only row key, never synced
  menu_item_id: string;
  name: string;
  price_cents: number;
  quantity: number;
  notes: string;
}

export interface OrderItem {
  menu_item_id: string | null;
  name: string;
  quantity: number;
  price_cents: number;
  notes: string;
}

export interface Order {
  id: string;
  order_no: string;
  table_name: string;
  status: "sent" | "preparing" | "ready" | "completed" | "void";
  payment_status: "unpaid" | "paid" | "refunded";
  // ── Step 3: tax breakdown (server is authoritative) ──────────
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: string;
  items: OrderItem[];
  void_reason?: string;
}

export type OutboxKind =
  | "order"
  | "payment"
  | "order_add_items"
  | "order_void";

export type OutboxStatus = "pending" | "syncing" | "done" | "failed";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  payload: string;
  status: OutboxStatus;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  created_at: number;
}