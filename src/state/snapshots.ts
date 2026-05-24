import { create } from "zustand";
import { useEnv } from "./env";
import { useFrontIntake } from "./intake";

export type Snap = {
  id: string;
  name: string;
  t: number;
  env?: Record<string, any>;
  intake?: Record<string, any>;
  // legacy field kept optional to avoid compile errors in old views
  chips?: any[];
};

type SnapStore = {
  list: Snap[];
  add: (name?: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  restore: (id: string) => void;
  // legacy alias so old callers don't explode
  apply: (id: string) => void;
};

const KEY = "cockpit:snaps:v1";

function load(): Snap[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(x => x && typeof x.id === "string" && typeof x.name === "string" && typeof x.t === "number")
      .map(x => ({
        id: x.id,
        name: x.name,
        t: x.t,
        env: x.env ?? undefined,
        intake: x.intake ?? undefined,
        chips: Array.isArray(x.chips) ? x.chips : undefined
      }));
  } catch {
    return [];
  }
}

function save(list: Snap[]) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export const useSnaps = create<SnapStore>((set, get) => ({
  list: load(),

  add: (name = "baseline") => {
    const env = { ...(useEnv.getState().saved ?? {}) };
    let intake = { ...(useFrontIntake.getState().saved ?? {}) };
    
    // Merge the live Intake draft (includes IRR fields) so Trends can graph it
    try {
      const extra = (window as any).__pp_latestIntakeDraft;
      if (extra && typeof extra === "object") {
        intake = { ...(intake || {}), ...(extra || {}) };
      }
    } catch {}
const id =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2);

    set(s => {
      const list = [...s.list, { id, name, t: Date.now(), env, intake }];
      save(list);
      return { list };
    });
  },

  remove: (id) => {
    set(s => {
      const list = s.list.filter(x => x.id !== id);
      save(list);
      return { list };
    });
  },

  clear: () => {
    const list: Snap[] = [];
    save(list);
    set({ list });
  },

  restore: (id) => {
    const snap = get().list.find(x => x.id === id);
    if (!snap) return;

    // ENV restore: prefer bulk(), else setSaved()
    const E: any = useEnv.getState();
    if (snap.env) {
      if (typeof E.bulk === "function") E.bulk(snap.env);
      else if (typeof E.setSaved === "function") {
        Object.entries(snap.env).forEach(([k, v]) => E.setSaved(k as any, v as any));
      }
    }

    // INTAKE restore: handle current + legacy APIs without typing errors
    if (snap.intake) {
      const I: any = useFrontIntake;
      const S: any = I.getState();

      if (typeof S.bulk === "function") {
        // modern bulk API
        S.bulk(snap.intake);
      } else if (typeof S.setSaved === "function") {
        // granular setter
        Object.entries(snap.intake).forEach(([k, v]) => S.setSaved(k as any, v as any));
      } else if (typeof I.setState === "function") {
        // last‑resort merge into saved
        I.setState((prev: any) => ({
          saved: { ...(prev?.saved ?? {}), ...snap.intake }
        }));
      }
    }
  },

  // legacy alias
  apply: (id) => get().restore(id),
}));


