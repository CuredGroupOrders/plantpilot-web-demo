import { create } from "zustand";

export type EnvNow = {
  leafC?: number;   // canopy leaf ---f---?s---,- degC
  rh?: number;      // %
  ppfd?: number;    // ---f-----,--mol---f---?s---,--m---f-----,-----,-----f---?s---,-----f---?s---,--s---f-----,-----,-----f---?s---,--
  runoffEc?: number;
};

type EnvStore = {
  saved: EnvNow;
  set: <K extends keyof EnvNow>(k: K, v: EnvNow[K]) => void;
  bulk: (p: Partial<EnvNow>) => void;
};

export const useEnv = create<EnvStore>((set) => ({
  saved: { leafC: 26, rh: 55, ppfd: 600, runoffEc: undefined },
  set: (k, v) => set(s => ({ saved: { ...s.saved, [k]: v } })),
  bulk: (p) => set(s => ({ saved: { ...s.saved, ...p } })),
}));

