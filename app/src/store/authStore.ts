import { create } from "zustand";
import type { Staff } from "../types";

interface AuthState {
  staff: Staff | null;
  deviceId: string | null;
  deviceName: string | null;
  devicePrefix: string | null;
  setStaff: (s: Staff | null) => void;
  setDevice: (d: { id: string; name: string; order_no_prefix: string }) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  staff: null,
  deviceId: null,
  deviceName: null,
  devicePrefix: null,
  setStaff: (staff) => set({ staff }),
  setDevice: ({ id, name, order_no_prefix }) =>
    set({ deviceId: id, deviceName: name, devicePrefix: order_no_prefix }),
}));
