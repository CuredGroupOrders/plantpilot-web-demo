import { useMemo } from "react";
import { useSheetSnap } from "../sheetSnap";

export type Pill = {
  key?: string;
  sev: "warn" | "bad";
  metric: string;
  cond: "high" | "low";
  value: number;
  unit: string;
  text: string;
};

type AppliedRow = {
  label: string;
  value: any;
  key?: string;
  gate?: "ENV" | "ROOT" | "IRR" | string;
  min?: number;
  max?: number;
  note?: string;
};

// config / selector keys that should NEVER produce OOB pills
const CONFIG_KEYS = new Set<string>([
  "stage",
  "stagePhase",
  "medium",
  "container",
  "containerSize",
  "container_gal",
  "lightcycle",
  "photoperiodH",
  "co2Mode",
  "mode",
]);

function unitFor(key?: string) {
  switch (key) {
    case "tempC":
      return "°C";
    case "rh":
      return "%";
    case "vpdKpa":
      return "kPa";
    case "ppfd":
      return "µmol·m⁻²·s⁻¹";
    case "dliMol":
      return "mol·m⁻²·d⁻¹";
    case "reservoirEc":
    case "runoffEc":
    case "pwec":
    case "deltaEc":
      return "mS/cm";
    case "drybackPct24h":
    case "targetAtFirst":
    case "vwcPct":
    case "runoffPct":
      return "%";
    default:
      return "";
  }
}

function fmtPillVal(key: string | undefined, v: number): string {
  const k = String(key || "").toLowerCase();

  // Whole numbers
  if (k.includes("ppfd") || k.includes("co2") || k.includes("events") || k.includes("interval") || k.includes("min")) {
    return String(Math.round(v));
  }
  if (k.includes("pct") || k.includes("percent") || k.includes("runoffpct") || k.includes("dryback") || k.includes("targetatfirst")) {
    return String(Math.round(v));
  }

  // pH / EC: 2 decimals
  if (k.includes("ph")) return v.toFixed(2);
  if (k.includes("ec")) return v.toFixed(2);

  return v.toFixed(2);
}

function pillFrom(row: AppliedRow): Pill | null {
  const v = Number(row.value);
  if (!Number.isFinite(v)) return null;

  const hasMin = Number.isFinite(Number(row.min));
  const hasMax = Number.isFinite(Number(row.max));
  if (!hasMin && !hasMax) return null;

  const lo = hasMin ? Number(row.min) : -Infinity;
  const hi = hasMax ? Number(row.max) : +Infinity;

  const outOfBandLow = v < lo;
  const outOfBandHigh = v > hi;
  const outOfBand = outOfBandLow || outOfBandHigh;

  // In band => no pill at all
  if (!outOfBand) return null;

  const cond: "high" | "low" = outOfBandHigh ? "high" : "low";
  const sev: "warn" | "bad" = "bad"; // everything truly OOB is "bad" for now

  const metric = row.label || row.key || "";
  const unit = unitFor(row.key);
  const prettyVal = fmtPillVal(row.key, v);
  const pretty = unit ? `${prettyVal}${unit}` : prettyVal;
  const text = `${metric} ${cond} ${pretty}`;

  return { key: row.key, sev, metric, cond, value: v, unit, text };
}

export function selectOOB(latest: any): { env: Pill[]; root: Pill[]; irr: Pill[] } {
  const applied = (latest?.summary?.applied ?? []) as AppliedRow[];
  if (!Array.isArray(applied) || !applied.length) return { env: [], root: [], irr: [] };

  const env: Pill[] = [];
  const root: Pill[] = [];
  const irr: Pill[] = [];

  for (const r of applied) {
    const key = (r.key || "").toString();
    // hard-skip config/selectors like Photoperiod, Container_gal, Media, etc.
    if (CONFIG_KEYS.has(key)) continue;

    const p = pillFrom(r);
    if (!p) continue;

    const g = String(r.gate || "").toUpperCase();
    if (g === "ROOT") root.push(p);
    else if (g === "IRR") irr.push(p);
    else env.push(p);
  }

  return { env, root, irr };
}

export function useOOB(): { env: Pill[]; root: Pill[]; irr: Pill[] } {
  const snap = useSheetSnap((s) => s.latestWrite ?? s.latest);
  return useMemo(() => selectOOB(snap), [snap]);
}






