import { create } from "zustand";
import { getDb } from "../db/database";
import type { MenuItem } from "../types";

interface MenuState {
  items: MenuItem[];
  loading: boolean;
  reload: () => Promise<void>;
  upsertLocal: (item: MenuItem) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  loading: false,
  reload: async () => {
    set({ loading: true });
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      price_cents: number;
      category: string;
      available: number;
      version: number;
    }>("SELECT * FROM menu_items WHERE available = 1 ORDER BY category, name");
    set({
      items: rows.map((r) => ({ ...r, available: !!r.available })),
      loading: false,
    });
  },
  upsertLocal: async (item) => {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO menu_items
         (id, name, price_cents, category, available, version)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         price_cents=excluded.price_cents,
         category=excluded.category,
         available=excluded.available,
         version=excluded.version`,
      [
        item.id,
        item.name,
        item.price_cents,
        item.category,
        item.available ? 1 : 0,
        item.version,
      ],
    );
    await get().reload();
  },
}));
