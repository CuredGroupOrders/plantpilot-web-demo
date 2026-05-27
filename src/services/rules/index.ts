import growroomRules from "../../../public/growroom-rules.json";

/** Metric bag for gate scoring (subset of intake fields). */
export type IntakeMetric = {
  tempC?: number;
  rh?: number;
  vpdKpa?: number;
  rootTempC?: number;
  vwcPct?: number;
  pwec?: number;
  inputEc?: number;
  inputPh?: number;
  drybackPct24h?: number;
  feedEc?: number;
  feedPh?: number;
  rhPercent?: number;
  canopyTempC?: number;
  lux?: number;
};

type ImportedRule = {
  metric: string;
  min: number | null;
  max: number | null;
  target: number | null;
  gate: string | null;
};

type StageProfile = {
  key: string;
  phase: string;
  photoperiod_h: number;
  lightcycle: string;
  co2_mode: string;
  co2_ppm: number | null;
  vpd_air_kpa: number | null;
  tair_c: number | null;
  rh_percent: number | null;
  ppfd_umol: number | null;
  dli_mol: number | null;
};

export type GrowContext = {
  stage?: string;
  medium?: string;
  sopProfile?: string;
  lightcycle?: string;
  photoperiodH?: number;
  co2Mode?: string;
};

const metrics = growroomRules.metrics as ImportedRule[];
const stageProfiles = (growroomRules.stageProfiles ?? []) as StageProfile[];

function normalizeMetricLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findRule(metricNames: string[]): ImportedRule | null {
  const normalizedCandidates = metricNames.map((name) => normalizeMetricLabel(name));

  for (const row of metrics) {
    const normalizedRow = normalizeMetricLabel(row.metric);
    if (normalizedCandidates.includes(normalizedRow)) return row;
  }
  for (const row of metrics) {
    const normalizedRow = normalizeMetricLabel(row.metric);
    if (normalizedCandidates.some((c) => normalizedRow.includes(c))) return row;
  }
  return null;
}

/**
 * Look up a stage-specific target from stageProfiles if available.
 * Key format: "phase|photoperiod_h|lightcycle|co2_mode|sop_profile"
 */
function findStageProfile(ctx: GrowContext): StageProfile | null {
  if (!ctx.stage) return null;
  const phase = ctx.stage.toLowerCase();
  const sop = (ctx.sopProfile || "sharkmousefarms").toLowerCase();
  const lc = (ctx.lightcycle || "day").toLowerCase();

  for (const p of stageProfiles) {
    if (
      p.phase.toLowerCase() === phase &&
      p.key.toLowerCase().includes(sop) &&
      p.lightcycle.toLowerCase() === lc
    ) {
      return p;
    }
  }
  // Fallback: match just phase + sop
  for (const p of stageProfiles) {
    if (p.phase.toLowerCase() === phase && p.key.toLowerCase().includes(sop)) {
      return p;
    }
  }
  return null;
}

/**
 * Get min/max range for a metric. Prefers stage-profile data for ENV metrics,
 * falls back to the global metrics table, and finally to hardcoded defaults.
 */
function resolvedRange(
  metricKey: string,
  metricNames: string[],
  ctx: GrowContext,
  hardcodedMin: number,
  hardcodedMax: number
): { min: number; max: number; target?: number } {
  const profile = findStageProfile(ctx);

  if (profile) {
    const TOLERANCE = 0.10; // +/- 10% of target for stage-profile targets
    const profileMap: Record<string, number | null | undefined> = {
      tempC: profile.tair_c,
      rh: profile.rh_percent,
      vpdKpa: profile.vpd_air_kpa,
      ppfd: profile.ppfd_umol,
      co2: profile.co2_ppm,
    };
    const target = profileMap[metricKey];
    if (target != null && target > 0) {
      return {
        min: target * (1 - TOLERANCE),
        max: target * (1 + TOLERANCE),
        target,
      };
    }
  }

  const rule = findRule(metricNames);
  if (rule && rule.min != null && rule.max != null) {
    return { min: rule.min, max: rule.max, target: rule.target ?? undefined };
  }

  return { min: hardcodedMin, max: hardcodedMax };
}

function bandScore(value: number | undefined, min?: number | null, max?: number | null) {
  if (value === undefined || min == null || max == null) return 70;
  if (value >= min && value <= max) return 100;
  const range = max - min || 1;
  const edgeDelta = value < min ? min - value : value - max;
  const penaltyPerUnit = Math.max(8, Math.min(25, 100 / range));
  return Math.max(0, Math.round(100 - edgeDelta * penaltyPerUnit));
}

export function computeGateScores(m: IntakeMetric, ctx: GrowContext = {}) {
  const tempR = resolvedRange("tempC", ["Canopy temp"], ctx, 23, 29);
  const rhR = resolvedRange("rh", ["RH"], ctx, 45, 70);
  const vpdR = resolvedRange("vpdKpa", ["VPD"], ctx, 0.8, 1.7);
  const env = Math.round(
    (bandScore(m.tempC, tempR.min, tempR.max) +
      bandScore(m.rh, rhR.min, rhR.max) +
      bandScore(m.vpdKpa, vpdR.min, vpdR.max)) /
      3
  );

  const rootTempR = resolvedRange("rootTempC", ["Reservoir temp"], ctx, 18, 24);
  const vwcR = resolvedRange("vwcPct", ["VWC"], ctx, 20, 60);
  const pwecR = resolvedRange("pwec", ["PWEC"], ctx, 1.2, 6.2);
  const root = Math.round(
    (bandScore(m.rootTempC, rootTempR.min, rootTempR.max) +
      bandScore(m.vwcPct, vwcR.min, vwcR.max) +
      bandScore(m.pwec, pwecR.min, pwecR.max)) /
      3
  );

  const inputEcR = resolvedRange("inputEc", ["Reservoir EC", "Feed EC"], ctx, 1.2, 3.5);
  const inputPhR = resolvedRange("inputPh", ["Reservoir pH", "Feed pH"], ctx, 5.2, 6.8);
  const drybackR = resolvedRange("drybackPct24h", ["Overnight dryback"], ctx, 8, 30);
  const irr = Math.round(
    (bandScore(m.inputEc, inputEcR.min, inputEcR.max) +
      bandScore(m.inputPh, inputPhR.min, inputPhR.max) +
      bandScore(m.drybackPct24h, drybackR.min, drybackR.max)) /
      3
  );

  const min = Math.min(env, root, irr);
  const statusText =
    min >= 86
      ? "System Stable"
      : min >= 61
        ? "Check Soon"
        : min >= 35
          ? "Needs Attention"
          : "System Critical";
  return { env, root, irr, statusText };
}

function pushBoundedFlag(
  flags: string[],
  metricNames: string[],
  value: number | undefined,
  recommendation: string,
  ctx: GrowContext = {}
) {
  if (value === undefined || !Number.isFinite(value)) return;
  const metricKey = metricNames[0].toLowerCase().replace(/\s+/g, "");
  const profileKeyMap: Record<string, string> = {
    feedec: "inputEc",
    runoffec: "inputEc",
    bulkec: "inputEc",
    pwec: "pwec",
    feedph: "inputPh",
    runoffph: "inputPh",
    reservoirph: "inputPh",
    humidity: "rh",
    rh: "rh",
    canopytemp: "tempC",
    airtemp: "tempC",
    tair: "tempC",
    lux: "ppfd",
    ppfd: "ppfd",
    dli: "ppfd",
  };
  const resolvedKey = profileKeyMap[metricKey] || metricKey;
  const r = resolvedRange(resolvedKey, metricNames, ctx, -Infinity, Infinity);
  if (r.min === -Infinity && r.max === Infinity) {
    const rule = findRule(metricNames);
    if (!rule || rule.min === null || rule.max === null) return;
    if (value < rule.min || value > rule.max) flags.push(recommendation);
    return;
  }
  if (value < r.min || value > r.max) {
    flags.push(recommendation);
  }
}

export function scoreSummaryFlags(
  m: IntakeMetric,
  existingFlags: string[] = [],
  ctx: GrowContext = {}
) {
  const flags = [...existingFlags];
  pushBoundedFlag(
    flags,
    ["Feed EC", "Runoff EC", "Bulk EC", "PWEC", "PWEC / Runoff EC"],
    m.feedEc,
    "Lower feed EC slightly and verify runoff EC to reduce osmotic stress.",
    ctx
  );
  pushBoundedFlag(
    flags,
    ["Feed pH", "Runoff pH", "Reservoir pH"],
    m.feedPh,
    "Bring feed pH back into target range to improve nutrient availability.",
    ctx
  );
  pushBoundedFlag(
    flags,
    ["Humidity", "RH"],
    m.rhPercent,
    "Adjust humidity to improve transpiration stability.",
    ctx
  );
  pushBoundedFlag(
    flags,
    ["Canopy Temp", "Canopy temp", "Air temp", "Tair"],
    m.canopyTempC,
    "Adjust canopy temperature to reduce stress.",
    ctx
  );
  pushBoundedFlag(
    flags,
    ["Lux", "PPFD", "DLI"],
    m.lux,
    "Adjust light intensity to match stage targets.",
    ctx
  );
  if (!flags.length) {
    flags.push("No critical flags detected; keep monitoring trends daily.");
  }
  return flags.slice(0, 3);
}

export function rangeForMetric(metricNames: string[], ctx: GrowContext = {}) {
  const rule = findRule(metricNames);
  if (!rule || rule.min === null || rule.max === null) return null;
  return { min: Number(rule.min), max: Number(rule.max), target: rule.target };
}

/**
 * Get the full target set for a given grow context from stageProfiles.
 * Returns null if no matching profile found.
 */
export function getStageTargets(ctx: GrowContext) {
  const profile = findStageProfile(ctx);
  if (!profile) return null;
  return {
    tempC: profile.tair_c,
    rh: profile.rh_percent,
    vpdKpa: profile.vpd_air_kpa,
    ppfd: profile.ppfd_umol,
    co2: profile.co2_ppm,
    dli: profile.dli_mol,
  };
}
