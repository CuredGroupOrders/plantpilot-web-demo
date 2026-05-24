import { create } from "zustand";
import * as media from "./photos";
import { saveAudio, deleteAudio } from "./audio";
import { useSheetSnap } from "./sheetSnap";
import { selectChips } from "./selectors/chips";
import { selectOOB } from "./selectors/oob";
import type { Pill as OobPill } from "./selectors/oob";
import type { BaselineSnapshot } from "../types/baselineSnapshot";

export type HistChip = {
  id: string;
  gate: "ENV" | "ROOT" | "IRR";
  title: string;
  why?: string;
  sev: "ok" | "warn" | "bad";
};

export type HistOOB = {
  gate: "ENV" | "ROOT" | "IRR";
  metric: string;
  cond: "high" | "low";
  value: number;
  unit: string;
  sev: "warn" | "bad";
};

export type HistoryEntry = {
  id: string;
  name: string;
  t: number;
  env?: Record<string, any>;
  intake?: Record<string, any>;
  photos?: string[];
  chips?: HistChip[];
  oob?: HistOOB[];

  
  baselineSnapshot?: BaselineSnapshot;
// NEW: CENTCOM payload per snapshot
  centcom?: {
    text?: string;       // human-readable LLM output
    json?: any;          // optional structured JSON
    audioId?: string;    // IndexedDB "audio" id
    model?: string;
    ttsVoice?: string;
    ts?: number;         // capture timestamp for this payload
  };
};

type HistoryStore = {
  list: HistoryEntry[];
  isOpen: boolean;
  selectedId?: string;
  open: () => void;
  close: () => void;
  select: (id: string) => void;
  back: () => void;
  remove: (id: string) => Promise<void>;
  removePhoto: (entryId: string, photoId: string) => Promise<void>;
  exportOne: (id: string) => Promise<boolean>;
  exportAll: () => Promise<boolean>;
  add: (entry: Partial<HistoryEntry>) => void;
  attachPhotoToLatest: (blob: Blob, fallback?: { env?: any; intake?: any; name?: string }) => Promise<boolean>;

  // NEW: attach CENTCOM payload to latest snapshot
  attachCentcomToLatest: (args: {
    text?: string;
    json?: any;
    audioBlob?: Blob;
    model?: string;
    ttsVoice?: string;
  }) => Promise<boolean>;

  attachBaselineSnapshotToLatest: (snap: BaselineSnapshot) => boolean;
};

const KEY_V2 = "cockpit:history:v2";
const KEY_V1 = "cockpit:snaps:v1";

function loadJSON(key: string): any[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function sanitize(arr: any[]): HistoryEntry[] {
  return arr
    .filter(x => x && typeof x.id === "string" && typeof x.name === "string" && typeof x.t === "number")
    .map(x => ({
      id: x.id,
      name: x.name,
      t: x.t,
      env: x.env ?? undefined,
      intake: x.intake ?? undefined,
      photos: Array.isArray(x.photos) ? x.photos.filter((p: any) => typeof p === "string") : undefined,
      chips: Array.isArray(x.chips) ? x.chips : undefined,
      oob: Array.isArray(x.oob) ? x.oob : undefined,
      centcom: x.centcom ?? undefined,
      baselineSnapshot: (x as any).baselineSnapshot ?? undefined,
    }));
}

function save(list: HistoryEntry[]) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY_V2, JSON.stringify(list));
  } catch {}
}

function initialList(): HistoryEntry[] {
  const v2 = sanitize(loadJSON(KEY_V2));
  if (v2.length) return v2;
  const v1 = sanitize(loadJSON(KEY_V1));
  if (v1.length) { save(v1); return v1; }
  return [];
}

function uuid(): string {
  return typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);
}

function latestSnapObj(): any {
  try {
    const s: any = (useSheetSnap as any).getState?.();
    return s?.latestWrite ?? s?.latest;
  } catch { return undefined; }
}

function captureContext(): { chips?: HistChip[]; oob?: HistOOB[] } {
  const latest = latestSnapObj();
  if (!latest) return {};
  const chips = selectChips(latest, 9).map(c => ({
    id: c.id, gate: c.gate, title: c.title, why: c.why, sev: (c as any).severity ?? "warn"
  })) as HistChip[];
  const o = ((): { env: OobPill[]; root: OobPill[]; irr: OobPill[] } => selectOOB(latest))();
  const pack = (gate: "ENV"|"ROOT"|"IRR", arr: OobPill[]) =>
    arr.map(p => ({ gate, metric: p.metric, cond: p.cond, value: p.value, unit: p.unit, sev: p.sev })) as HistOOB[];
  const oob = [...pack("ENV", o.env), ...pack("ROOT", o.root), ...pack("IRR", o.irr)];
  return { chips, oob };
}

export const useHistory = create<HistoryStore>((set, get) => ({
  list: initialList(),
  isOpen: false,
  selectedId: undefined,

  open: () => {
    const v2 = sanitize(loadJSON(KEY_V2));
    const v1 = sanitize(loadJSON(KEY_V1));
    let merged = v2.slice();
    if (v1.length) {
      const seen = new Set(merged.map(x => x.id));
      for (const e of v1) if (!seen.has(e.id)) merged.push(e);
      if (merged.length !== v2.length) save(merged);
    }
    set({ list: merged, isOpen: true });
  },

  close: () => set({ isOpen: false, selectedId: undefined }),
  select: (id) => set({ selectedId: id }),
  back: () => set({ selectedId: undefined }),

  // UPDATED: async to allow audio cleanup
  remove: async (id) => {
    const s = get();
    const victim = s.list.find(x => x.id === id);

    // cleanup audio if present
    if (victim?.centcom?.audioId) {
      try { await deleteAudio(victim.centcom.audioId); } catch {}
    }

    const list = s.list.filter(x => x.id !== id);
    save(list);
    set({ list, selectedId: s.selectedId === id ? undefined : s.selectedId });
  },

  removePhoto: async (entryId, photoId) => {
    const s = get();
    const list = s.list.map(e =>
      e.id !== entryId ? e : { ...e, photos: (e.photos || []).filter(pid => pid !== photoId) }
    );
    save(list);
    set({ list });
    try { await media.deletePhoto(photoId); } catch {}
  },

  exportOne: async (id) => {
    const snap = get().list.find(x => x.id === id);
    if (!snap) return false;
    const text = JSON.stringify(snap, null, 2);
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `snapshot-${id}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      return true;
    } catch { return false; }
  },

  exportAll: async () => {
    const text = JSON.stringify(get().list, null, 2);
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "snapshots.json";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      return true;
    } catch { return false; }
  },

  add: (entry) =>
    set(s => {
      const id = uuid();
      const ctx = captureContext();

      const next: HistoryEntry = {
id,
        name: entry.name || "baseline",
        t: typeof entry.t === "number" ? entry.t : Date.now(),
        env: entry.env,
        intake: entry.intake,
        photos: Array.isArray(entry.photos) ? entry.photos.slice() : undefined,
        // If caller provided chips/oob, trust them (snapshot-time facts). Otherwise fall back to ctx.
        chips: (entry.chips && Array.isArray(entry.chips)) ? entry.chips : ctx.chips,
        oob:   (entry.oob && Array.isArray(entry.oob)) ? entry.oob : ctx.oob,

        // Allow caller to provide a BaselineSnapshot
        baselineSnapshot: (entry as any).baselineSnapshot ?? undefined,
      };
      const list = [...s.list, next];
      save(list);
      return { list };
    }),

  attachPhotoToLatest: async (blob, fallback) => {
    const photoId = await media.savePhoto(blob);
    const s = get();
    let list = s.list.slice();

    let idx = -1;
    if (list.length) {
      let best = 0;
      for (let i = 1; i < list.length; i++) if (list[i].t > list[best].t) best = i;
      idx = best;
    } else {
      const ctx = captureContext();
      list.push({
        id: uuid(),
        name: fallback?.name || "trend",
        t: Date.now(),
        env: fallback?.env,
        intake: fallback?.intake,
        photos: [],
        chips: ctx.chips,
        oob: ctx.oob,
      });
      idx = list.length - 1;
    }

    const entry = list[idx];
    entry.photos = Array.isArray(entry.photos) ? [...entry.photos, photoId] : [photoId];

    if (!entry.chips || !entry.oob) {
      const ctx = captureContext();
      entry.chips = entry.chips ?? ctx.chips;
      entry.oob = entry.oob ?? ctx.oob;
    }

    save(list);
    set({ list });
    return true;
  },

  // NEW: attach CENTCOM payload to the latest entry, creating one if list is empty
  attachCentcomToLatest: async (args) => {
    const s = get();
    let list = s.list.slice();

    // find latest by timestamp
    let idx = -1;
    if (list.length) {
      let best = 0;
      for (let i = 1; i < list.length; i++) if (list[i].t > list[best].t) best = i;
      idx = best;
    } else {
      const ctx = captureContext();
      list.push({
        id: uuid(),
        name: "baseline",
        t: Date.now(),
        env: undefined,
        intake: undefined,
        photos: [],
        chips: ctx.chips,
        oob: ctx.oob,
      });
      idx = list.length - 1;
    }

    // store audio if provided
    let audioId: string | undefined;
    if (args.audioBlob) {
      try {
        audioId = await saveAudio(args.audioBlob, args.audioBlob.type || "audio/mpeg");
      } catch {
        audioId = undefined; // do not fail the snapshot
      }
    }

    const entry = list[idx];
    entry.centcom = {
      text: args.text,
      json: args.json,
      audioId,
      model: args.model,
      ttsVoice: args.ttsVoice,
      ts: Date.now(),
    };

    save(list);
    set({ list });
    return true;
  },

  // Attach BaselineSnapshot to the latest entry, creating one if list is empty.
  attachBaselineSnapshotToLatest: (snap) => {
    const s = get();
    let list = s.list.slice();

    // find latest by timestamp
    let idx = -1;
    if (list.length) {
      let best = 0;
      for (let i = 1; i < list.length; i++) if (list[i].t > list[best].t) best = i;
      idx = best;
    } else {
      const ctx = captureContext();
      list.push({
        id: uuid(),
        name: "baseline",
        t: Date.now(),
        env: undefined,
        intake: undefined,
        photos: [],
        chips: ctx.chips,
        oob: ctx.oob,
      });
      idx = list.length - 1;
    }

    list[idx].baselineSnapshot = snap;

    save(list);
    set({ list });
    return true;
  },
}));




