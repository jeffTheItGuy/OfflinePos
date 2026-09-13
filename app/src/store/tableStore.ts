import { create } from "zustand";
import { getDb } from "../db/database";
import type { TableItem } from "../types";

interface TablesState {
  tables: TableItem[];
  loading: boolean;
  reload: () => Promise<void>;
}

export const useTablesStore = create<TablesState>((set, get) => ({
  tables: [],
  loading: false,

  reload: async () => {
    // Only show a loading state on the very first load; background syncs
    // update silently without flashing the UI.
    if (get().tables.length === 0) {
      set({ loading: true });
    }
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      section: string;
      available: number;
      version: number;
    }>("SELECT * FROM tables ORDER BY section, name");
    set({
      tables: rows.map((r) => ({ ...r, available: !!r.available })),
      loading: false,
    });
  },
}));