import { useEffect, useMemo, useState } from "react";
import { useIntake } from "../intake";

/** Pill shape */
export type Pill = {
  severity: "warn" | "bad";
  metric: string;              // e.g., "VPD"
  condition: "high" | "low";
  value: number;
  unit: string;                // e.g., "kPa"
};

/** label → unit for display */
const UNITS: Record<string,string> = {
  tempC: "°C", rh: "%", vpdKpa: "kPa", ppfd: "µmol·m⁻²·s⁻¹",
  reservoirPh: "", runoffPh: "", deltaEc: "mS/cm",
  drybackPct24h: "%", targetAtFirst: "%"
};
/** input key → human label */
const LABELS: Record<string,string> = {
  tempC: "Temp", rh: "RH", vpdKpa: "VPD", ppfd: "PPFD",
  reservoirPh: "pH (res)", runoffPh: "pH (runoff)", deltaEc: "ΔEC",
  drybackPct24h: "Dryback", targetAtFirst: "Target@first"
};
/** which keys we consider numeric intake (extends later) */
const NUM_KEYS = new Set(Object.keys(UNITS));

/** cache targets/bands */
let cachedTB: { targets: Record<string,number>, bands: Record<string,number> } | null = null;
async function getTargets(): Promise<{targets:Record<string,number>, bands:Record<string,number>}>{
  if (cachedTB) return cachedTB;
  const r = await fetch("/gas?mode=targets");  // via Vite proxy
  const j = await r.json();
  cachedTB = { targets: j.targets ?? {}, bands: j.bands ?? {} };
  return cachedTB!;
}

export function useOOBPills(){
  const intake = useIntake(s => s.saved);
  const [tb, setTB] = useState<{targets:Record<string,number>, bands:Record<string,number>}|null>(null);

  useEffect(() => { getTargets().then(setTB).catch(()=>setTB(null)); }, []);

  return useMemo<Pill[]>(() => {
    if (!tb) return [];
    const pills: Pill[] = [];
    for (const key of Object.keys(intake ?? {})){
      if (!NUM_KEYS.has(key)) continue;
      const raw = (intake as any)[key];
      const v = typeof raw === "number" ? raw : Number(raw);
      if (!isFinite(v)) continue;                 // ignore blanks/non-numeric
      const target = tb.targets[key]; if (!isFinite(target)) continue;
      const band   = tb.bands[key];   if (!isFinite(band)) continue;

      const delta = v - target;
      if (delta === 0) continue;
      const mag = Math.abs(delta);
      if (mag === 0) continue;

      const severity: "warn"|"bad" = mag <= band ? "warn" : "bad";
      const condition: "high"|"low" = delta > 0 ? "high" : "low";
      const metric = LABELS[key] ?? key;
      const unit   = UNITS[key] ?? "";

      pills.push({ severity, metric, condition, value: v, unit });
    }
    return pills;
  }, [intake, tb]);
}


