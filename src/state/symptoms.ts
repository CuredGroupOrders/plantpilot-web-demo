// src/state/symptoms.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type SymMap = Record<string, boolean>;

export interface SymptomsState {
  checked: SymMap;                  // key -> ticked
  set: (key: string, on: boolean) => void;
  setMany: (m: SymMap) => void;     // replace current map
  clearAll: () => void;             // set all current keys to false
}

export const useSymptoms = create<SymptomsState>()(
  persist(
    (set, get) => ({
      checked: {},
      set: (key, on) =>
        set({ checked: { ...get().checked, [key]: !!on } }),
      setMany: (m) =>
        set({ checked: { ...m } }),
      clearAll: () => {
        const cur = { ...get().checked };
        Object.keys(cur).forEach(k => (cur[k] = false));
        set({ checked: cur });
      },
    }),
    { name: "fs-symptoms-v1", storage: createJSONStorage(() => localStorage) }
  )
);
