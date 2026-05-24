import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SheetSnapEntry = {
  t: number;
  cfg_key?: string | null;
  intake: any;
  latestWrite?: any;
  irrPlan?: any;
  realityDelta?: any;
};

export type SheetSnap = {
  latest?: any;        // read-only evals (apply=0) – for odometers etc.
  latestWrite?: any;   // last write eval (apply=1) – for pills/chips

  list: SheetSnapEntry[];
  append: (e: SheetSnapEntry) => void;
  clear: () => void;

  setLatest: (v: any) => void;
  setLatestWrite: (v: any) => void;
};

export const useSheetSnap = create<SheetSnap>()(
  persist(
        (set) => ({
      latest: undefined,
      latestWrite: undefined,

      list: [],
      append: (e) =>
        set((s) => {
          const next = [...(s.list || []), e];
          const capped = next.length > 60 ? next.slice(next.length - 60) : next;
          return { list: capped };
        }),
      clear: () => set({ list: [] }),

      setLatest: (v) => set({ latest: v }),
      setLatestWrite: (v) => set({ latestWrite: v }),
    }),

    {
      name: "sheetSnap",
      partialize: (s) => ({ latest: s.latest, latestWrite: s.latestWrite, list: s.list }),
    }
  )
);

// handy global for console
try { (window as any).__sheetSnap = useSheetSnap; } catch {}
