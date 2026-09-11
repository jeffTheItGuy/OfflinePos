import { create } from "zustand";
import type { CartLine, MenuItem } from "../types";

interface CartState {
  table: string;
  lines: CartLine[];
  add: (item: MenuItem) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  setTable: (t: string) => void;
  clear: () => void;
  totalCents: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  table: "",
  lines: [],
  add: (item) => {
    const existing = get().lines.find((l) => l.menu_item_id === item.id);
    if (existing) {
      set({
        lines: get().lines.map((l) =>
          l.menu_item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      });
    } else {
      set({
        lines: [
          ...get().lines,
          {
            menu_item_id: item.id,
            name: item.name,
            price_cents: item.price_cents,
            quantity: 1,
            notes: "",
          },
        ],
      });
    }
  },
  inc: (id) =>
    set({
      lines: get().lines.map((l) =>
        l.menu_item_id === id ? { ...l, quantity: l.quantity + 1 } : l,
      ),
    }),
  dec: (id) =>
    set({
      lines: get()
        .lines.map((l) =>
          l.menu_item_id === id ? { ...l, quantity: l.quantity - 1 } : l,
        )
        .filter((l) => l.quantity > 0),
    }),
  remove: (id) =>
    set({ lines: get().lines.filter((l) => l.menu_item_id !== id) }),
  setTable: (table) => set({ table }),
  clear: () => set({ lines: [], table: "" }),
  totalCents: () =>
    get().lines.reduce((s, l) => s + l.quantity * l.price_cents, 0),
}));
