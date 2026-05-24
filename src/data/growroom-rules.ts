export type MetricRule = {
  metric: string;
  target: number | null;
  min: number | null;
  max: number | null;
  gate: "ENV" | "ROOT" | "IRR" | null;
  units: string | null;
  notes: string | null;
};

export type Condition = {
  condition: string;
  gate: string;
  message: string;
};

export type StageProfile = {
  key: string;
  phase: string;
  photoperiod_h: number;
  lightcycle: string;
  co2_mode: string;
  co2_ppm: number;
  vpd_air_kpa: number;
  tair_c: number;
  rh_percent: number;
  ppfd_umol: number;
  dli_mol: number;
};

export type NutrientLine = {
  line_id: string;
  sop_profile: string;
  label?: string;
};

export type GrowRoomRules = {
  generatedAt: string;
  metrics: MetricRule[];
  conditions: Condition[];
  stageProfiles: StageProfile[];
  nutrientSchedule: any[];
  nutrientStageMapping: any[];
  nutrientLines: NutrientLine[];
};

let cachedRules: GrowRoomRules | null = null;
let loadError: string | null = null;

export function getLoadError(): string | null { return loadError; }

export async function loadRules(): Promise<GrowRoomRules> {
  if (cachedRules) return cachedRules;
  try {
    const resp = await fetch("/growroom-rules.json");
    if (resp.ok) {
      cachedRules = await resp.json();
      loadError = null;
      return cachedRules!;
    }
    loadError = `Failed to load rules: HTTP ${resp.status}`;
    console.warn("[growroom-rules]", loadError);
  } catch (e) {
    loadError = `Failed to load rules: ${(e as any)?.message || e}`;
    console.warn("[growroom-rules]", loadError);
  }
  return {
    generatedAt: "",
    metrics: [],
    conditions: [],
    stageProfiles: [],
    nutrientSchedule: [],
    nutrientStageMapping: [],
    nutrientLines: [],
  };
}

export function getMetricBounds(
  metrics: MetricRule[],
  metricName: string
): { target: number; min: number; max: number } | null {
  const m = metrics.find(
    (r) => r.metric.toLowerCase() === metricName.toLowerCase()
  );
  if (!m || m.target == null || m.min == null || m.max == null) return null;
  return { target: m.target, min: m.min, max: m.max };
}

export type ToleranceStatus = "in-target" | "in-tolerance" | "out-of-bounds";

export function checkTolerance(
  value: number,
  bounds: { target: number; min: number; max: number }
): ToleranceStatus {
  const lo = Math.min(bounds.min, bounds.max);
  const hi = Math.max(bounds.min, bounds.max);
  if (value >= lo && value <= hi) return "in-target";
  const range = hi - lo || 1;
  const toleranceExtra = range * 0.5;
  if (value >= lo - toleranceExtra && value <= hi + toleranceExtra) {
    return "in-tolerance";
  }
  return "out-of-bounds";
}

export function toleranceColor(status: ToleranceStatus): string {
  switch (status) {
    case "in-target":
      return "#10b981";
    case "in-tolerance":
      return "#f59e0b";
    case "out-of-bounds":
      return "#ef4444";
  }
}
