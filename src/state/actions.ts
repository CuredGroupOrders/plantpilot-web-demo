// src/state/actions.ts
import { create } from "zustand";

export type ActionItem = {
  id: string;
  chipId: string;
  title: string;
  gate: "ENV"|"ROOT"|"IRR";
  severity: "RED"|"AMBER"|"GREEN"|"INFO";
  why: string;
  next: string;
  t: number;
  status: "queued" | "done" | "skipped";
};

const KEY = "cockpit:actions";
const load = (): ActionItem[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const save = (list: ActionItem[]) => localStorage.setItem(KEY, JSON.stringify(list));

type Store = {
  list: ActionItem[];
  queue: (c: {id:string; gate:any; severity:any; title:string; why:string; next:string}) => void;
  mark: (id: string, s: ActionItem["status"]) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useActions = create<Store>((set, get) => ({
  list: load(),
  queue: (c) => {
    const exists = get().list.find(x => x.chipId === c.id && x.status === "queued");
    if (exists) return;
    const item: ActionItem = {
      id: (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      chipId: c.id, gate: c.gate, severity: c.severity,
      title: c.title, why: c.why, next: c.next, t: Date.now(), status: "queued"
    };
    const list = [item, ...get().list].slice(0, 50);
    save(list); set({ list });
  },
  mark: (id, s) => { const list = get().list.map(x => x.id===id?{...x,status:s}:x); save(list); set({ list }); },
  remove: (id) => { const list = get().list.filter(x => x.id!==id); save(list); set({ list }); },
  clear: () => { save([]); set({ list: [] }); },
}));

