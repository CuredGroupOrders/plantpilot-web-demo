import {
  type MetricRule,
  type Condition,
  checkTolerance,
  type ToleranceStatus,
} from "../data/growroom-rules";

export type FlagSeverity = "ok" | "warn" | "bad";

export type Flag = {
  id: string;
  gate: "ENV" | "ROOT" | "IRR";
  label: string;
  resolution: string;
  severity: FlagSeverity;
  metric?: string;
  value?: number;
  target?: number;
  delta?: number;
  symptomCorrelated?: boolean;
};

export type IntakeValues = {
  tempC?: number;
  rh?: number;
  vpdKpa?: number;
  ppfd?: number;
  dliMol?: number;
  co2?: number;
  runoffPh?: number;
  runoffEc?: number;
  reservoirEc?: number;
  reservoirPh?: number;
  reservoirTempC?: number;
  pwec?: number;
  vwcPct?: number;
  vwcAtLastIrr?: number;
  drybackPct24h?: number;
  eventsPerDay?: number;
  rootTempC?: number;
};

const METRIC_TO_INTAKE: Record<string, keyof IntakeValues> = {
  "Canopy temp (°C)": "tempC",
  "RH (%)": "rh",
  "VPD (kPa)": "vpdKpa",
  "PPFD (µmol/m²/s)": "ppfd",
  "DLI (mol/m²/d)": "dliMol",
  "CO2 (ppm)": "co2",
  "Runoff pH": "runoffPh",
  "Runoff EC (mS/cm)": "runoffEc",
  "Reservoir EC (mS/cm)": "reservoirEc",
  "Reservoir pH": "reservoirPh",
  "Reservoir temp (°C)": "reservoirTempC",
  "PWEC (mS/cm)": "pwec",
  "PWEC / Runoff EC (mS/cm)": "pwec",
  "VWC (%)": "vwcPct",
  "VWC% at last irrigation": "vwcAtLastIrr",
  "Overnight dryback % target": "drybackPct24h",
  "Irrigations in last 24h": "eventsPerDay",
  "Root zone temp (°C)": "rootTempC",
};

function severityFromStatus(status: ToleranceStatus): FlagSeverity {
  switch (status) {
    case "in-target": return "ok";
    case "in-tolerance": return "warn";
    case "out-of-bounds": return "bad";
  }
}

export function computeFlags(
  intake: IntakeValues,
  metrics: MetricRule[],
  conditions: Condition[],
  symptoms: string[] = []
): Flag[] {
  const flags: Flag[] = [];
  let flagIdx = 0;

  for (const rule of metrics) {
    if (!rule.gate || rule.target == null || rule.min == null || rule.max == null) continue;

    const intakeKey = METRIC_TO_INTAKE[rule.metric];
    if (!intakeKey) continue;

    const value = intake[intakeKey];
    if (value == null || !Number.isFinite(value)) continue;

    const bounds = { target: rule.target, min: rule.min, max: rule.max };
    const status = checkTolerance(value, bounds);

    if (status === "in-target") continue;

    const delta = value - rule.target;
    const gate = rule.gate as "ENV" | "ROOT" | "IRR";

    let matchedCondition: Condition | undefined;
    const gateLower = gate.toLowerCase();
    const conditionsForGate = conditions.filter(c => c.gate.toLowerCase() === gateLower || c.gate === "helper");
    if (conditionsForGate.length > 0) {
      matchedCondition = conditionsForGate.find(c => {
        const label = c.condition.toLowerCase();
        const mName = rule.metric.toLowerCase();
        if (mName.includes("temp") && label.includes("thermal")) return true;
        if (mName.includes("vpd") && (label.includes("transpir") || label.includes("vpd"))) return true;
        if (mName.includes("ppfd") && (label.includes("photo") || label.includes("light"))) return true;
        if (mName.includes("co2") && label.includes("co₂")) return true;
        if (mName.includes("ph") && (label.includes("ph") || label.includes("acid") || label.includes("alkal"))) return true;
        if (mName.includes("ec") && (label.includes("salin") || label.includes("osmo") || label.includes("ec"))) return true;
        if (mName.includes("vwc") && (label.includes("water") || label.includes("deficit") || label.includes("hypox"))) return true;
        if (mName.includes("dryback") && (label.includes("deficit") || label.includes("water"))) return true;
        return false;
      });
    }

    let severity = severityFromStatus(status);
    let symptomCorrelated = false;

    if (symptoms.length > 0) {
      const symptomLower = symptoms.map(s => s.toLowerCase());
      const relevant = symptomLower.some(sym => {
        if (metricLower(rule.metric, "temp") && (sym.includes("taco") || sym.includes("canoe") || sym.includes("wilt"))) return true;
        if (metricLower(rule.metric, "vpd") && (sym.includes("wilt") || sym.includes("droop"))) return true;
        if (metricLower(rule.metric, "ph") && (sym.includes("chloro") || sym.includes("yellow"))) return true;
        if (metricLower(rule.metric, "ec") && (sym.includes("burn") || sym.includes("tip"))) return true;
        if (metricLower(rule.metric, "ppfd") && (sym.includes("bleach") || sym.includes("taco"))) return true;
        return false;
      });
      if (relevant) {
        symptomCorrelated = true;
        if (severity === "warn") severity = "bad";
      }
    }

    flags.push({
      id: `flag-${flagIdx++}`,
      gate,
      label: matchedCondition?.condition ?? `${rule.metric} off target`,
      resolution: matchedCondition?.message ?? `${rule.metric} is ${delta > 0 ? "above" : "below"} target by ${Math.abs(delta).toFixed(1)}. Target: ${rule.target} (range ${rule.min}–${rule.max}).`,
      severity,
      metric: rule.metric,
      value,
      target: rule.target,
      delta,
      symptomCorrelated,
    });
  }

  flags.sort((a, b) => {
    const sevOrder = { bad: 0, warn: 1, ok: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });

  return flags;
}

function metricLower(metric: string, keyword: string): boolean {
  return metric.toLowerCase().includes(keyword);
}

export function gateScoresFromFlags(flags: Flag[]): { env: number; root: number; irr: number } {
  const gates: Record<string, Flag[]> = { ENV: [], ROOT: [], IRR: [] };
  for (const f of flags) {
    if (gates[f.gate]) gates[f.gate].push(f);
  }

  function gateScore(gateFlags: Flag[]): number {
    if (gateFlags.length === 0) return 100;
    const badCount = gateFlags.filter(f => f.severity === "bad").length;
    const warnCount = gateFlags.filter(f => f.severity === "warn").length;
    const penalty = badCount * 25 + warnCount * 10;
    return Math.max(0, 100 - penalty);
  }

  return {
    env: gateScore(gates.ENV),
    root: gateScore(gates.ROOT),
    irr: gateScore(gates.IRR),
  };
}
