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

export interface Order {
  id: string;
  order_no: string;
  table_name: string;
  status: "sent" | "paid" | "void";
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
