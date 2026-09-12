export type Role = "waiter" | "manager";

export interface Staff {
  id: string;
  name: string;
  role: Role;
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
  | "paid"
  | "void";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface Order {
  id: string;
  order_no: string;
  table_name: string;
  status: OrderStatus;
  payment_status?: PaymentStatus;
  total_cents: number;
  created_at: string;
  items: OrderItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  price_cents: number;
  category: string;
  available: boolean;
  version: number;
}