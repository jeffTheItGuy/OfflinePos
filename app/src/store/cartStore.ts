import { create } from "zustand";
import type { CartLine, MenuItem } from "../types";

function lineId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

interface CartState {
  table: string;
  lines: CartLine[];
  add: (item: MenuItem, quantity?: number, notes?: string) => void;
  inc: (lineId: string) => void;
  dec: (lineId: string) => void;
  remove: (lineId: string) => void;
  setTable: (t: string) => void;
  clear: () => void;
  totalCents: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  table: "",
  lines: [],

  add: (item, quantity = 1, notes = "") => {
    const cleanNotes = notes.trim();

    // Quick-tap lines (no notes) merge with an existing no-notes line
    // for the same item. Lines WITH notes always stay separate so the
    // kitchen sees each instruction on its own row.
    if (!cleanNotes) {
      const existing = get().lines.find(
        (l) => l.menu_item_id === item.id && l.notes === "",
      );
      if (existing) {
        set({
          lines: get().lines.map((l) =>
            l.line_id === existing.line_id
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          ),
        });
        return;
      }
    }

    set({
      lines: [
        ...get().lines,
        {
          line_id: lineId(),
          menu_item_id: item.id,
          name: item.name,
          price_cents: item.price_cents,
          quantity,
          notes: cleanNotes,
        },
      ],
    });
  },

  inc: (id) =>
    set({
      lines: get().lines.map((l) =>
        l.line_id === id ? { ...l, quantity: l.quantity + 1 } : l,
      ),
    }),

  dec: (id) =>
    set({
      lines: get()
        .lines.map((l) =>
          l.line_id === id ? { ...l, quantity: l.quantity - 1 } : l,
        )
        .filter((l) => l.quantity > 0),
    }),

  remove: (id) =>
    set({ lines: get().lines.filter((l) => l.line_id !== id) }),

  setTable: (table) => set({ table }),
  clear: () => set({ lines: [], table: "" }),
  totalCents: () =>
    get().lines.reduce((s, l) => s + l.quantity * l.price_cents, 0),
}));