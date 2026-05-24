import { create } from "zustand";
import { useEnv } from "./env";
import { useFrontIntake } from "./intake";

type Sample = { t: number; vpd?: number; ppfd?: number; vwc?: number };
type TrendsStore = {
  started: boolean;
  samples: Sample[];
  start: () => void;
  stop: () => void;
  clear: () => void;
};

const MAX_MS = 10 * 60 * 1000;   // last 10 min
const INTERVAL_MS = 5000;        // 5s

function computeSample(): Sample {
  const env = useEnv.getState().saved;
  const intake = useFrontIntake.getState().saved;
  let vpd: number | undefined;
  if (env.leafC != null && env.rh != null) {
    const es = 0.6108 * Math.exp((17.27 * env.leafC) / (env.leafC + 237.3));
    vpd = Math.round((es * (1 - Math.max(0, Math.min(100, env.rh)) / 100)) * 100) / 100;
  }
  const ppfd = env.ppfd;
  const vwc = typeof (intake as any).vwc === "number" ? Number((intake as any).vwc) : undefined;
  return { t: Date.now(), vpd, ppfd, vwc };
}

let timer: any;

export const useTrends = create<TrendsStore>((set, get) => ({
  started: false,
  samples: [],
  start: () => {
    if (get().started) return;
    set({ started: true, samples: [computeSample()] });
    timer = setInterval(() => {
      set(s => {
        const next = [...s.samples, computeSample()];
        const cutoff = Date.now() - MAX_MS;
        return { samples: next.filter(p => p.t >= cutoff) };
      });
    }, INTERVAL_MS);
  },
  stop: () => { if (timer) { clearInterval(timer); timer = undefined; } set({ started: false }); },
  clear: () => set({ samples: [] }),
}));

