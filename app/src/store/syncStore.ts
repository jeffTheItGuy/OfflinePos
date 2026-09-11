import { create } from "zustand";

interface SyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSync: number | null;
  setOnline: (b: boolean) => void;
  setSyncing: (b: boolean) => void;
  setPending: (n: number) => void;
  setLastSync: (t: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  online: true,
  syncing: false,
  pending: 0,
  lastSync: null,
  setOnline: (online) => set({ online }),
  setSyncing: (syncing) => set({ syncing }),
  setPending: (pending) => set({ pending }),
  setLastSync: (lastSync) => set({ lastSync }),
}));
