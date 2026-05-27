import growroomRules from "../../public/growroom-rules.json";
import { mergeSopProfileList } from "./sopProfiles";
import { getStageTargets, type GrowContext } from "../services/rules";
import type { ConfigContext, Intake } from "../intake/helpers";

type ImportedRule = {
  metric: string;
  min: number | null;
  max: number | null;
  target: number | null;
  gate: string | null;
};

const metrics = (growroomRules.metrics ?? []) as ImportedRule[];

const CONTAINER_OPTIONS = [
  "0.5 gal",
  "1 gal",
  "2 gal",
  "3 gal",
  "5 gal",
  "7 gal",
  "Bed",
  "Custom",
];

function normalizeMetricLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findRuleByMetricName(metricName: string): ImportedRule | null {
  const want = normalizeMetricLabel(metricName);
  for (const row of metrics) {
    if (normalizeMetricLabel(row.metric) === want) return row;
  }
  let best: ImportedRule | null = null;
  let bestLen = 0;
  for (const row of metrics) {
    const norm = normalizeMetricLabel(row.metric);
    const matches = norm.includes(want) || want.includes(norm);
    if (!matches) continue;
    if (row.target == null) continue;
    if (norm.length > bestLen) {
      best = row;
      bestLen = norm.length;
    }
  }
  return best;
}

export function growContextFromIntake(
  intake: Intake | ConfigContext,
): GrowContext {
  return {
    stage: intake.stage,
    medium: intake.medium,
    sopProfile: intake.profile,
    lightcycle: intake.lightcycle,
    photoperiodH: intake.photoperiodH,
    co2Mode: intake.co2Mode,
  };
}

/** Static dropdown options (no Google Sheets). */
export function getLocalOptions(): Record<string, string[]> {
  return {
    stagePhase: [
      "early veg",
      "late veg",
      "early bloom",
      "mid bloom",
      "late bloom",
      "flush",
    ],
    medium: ["coco", "rockwool", "soil", "dwc"],
    containerSize: CONTAINER_OPTIONS,
    co2Mode: ["ambient", "co2"],
    lightcycle: ["Day", "Night"],
    photoperiodH: ["12", "18"],
    sopProfile: mergeSopProfileList(undefined),
  };
}

/** Target values from bundled growroom-rules (mobile parity). */
export function getLocalTargets(
  intake: Intake | ConfigContext,
): Record<string, number> {
  const ctx = growContextFromIntake(intake);
  const stageTargets = getStageTargets(ctx);
  const result: Record<string, number> = {};

  if (stageTargets) {
    if (stageTargets.tempC != null) result.tempC = stageTargets.tempC;
    if (stageTargets.rh != null) result.rh = stageTargets.rh;
    if (stageTargets.vpdKpa != null) result.vpdKpa = stageTargets.vpdKpa;
    if (stageTargets.ppfd != null) result.ppfd = stageTargets.ppfd;
    if (stageTargets.co2 != null) result.co2 = stageTargets.co2;
    if (stageTargets.dli != null) result.dliMol = stageTargets.dli;
  }

  const metricToField: Record<string, string> = {
    "Reservoir EC": "reservoirEc",
    "Feed EC": "reservoirEc",
    "Reservoir pH": "reservoirPh",
    "Feed pH": "reservoirPh",
    "Runoff pH": "runoffPh",
    "Runoff %": "runoffPct",
    PWEC: "pwec",
    "VWC% at last irrigation": "vwcAtLastIrr",
    "Runoff EC": "runoffEc",
    "Overnight dryback": "drybackPct24h",
    "Reservoir temp": "reservoirTempC",
    "Target at first event": "targetAtFirst",
    "P1 events": "p1Events",
    "P1 interval (min)": "p1IntervalMin",
    "P1 %": "p1Pct",
    "ml per P1 event": "p1MlPerEvent",
    "P2 events": "p2Events",
    "P2 interval (min)": "p2IntervalMin",
    "P2 %": "p2Pct",
    "ml per P2 event": "p2MlPerEvent",
  };

  for (const [metricName, fieldName] of Object.entries(metricToField)) {
    if (result[fieldName] != null) continue;
    const rule = findRuleByMetricName(metricName);
    if (rule?.target != null) result[fieldName] = rule.target;
  }

  if (
    result.p1Events != null &&
    result.p2Events != null &&
    result.eventsPerDay == null
  ) {
    result.eventsPerDay = result.p1Events + result.p2Events;
  }

  return result;
}
