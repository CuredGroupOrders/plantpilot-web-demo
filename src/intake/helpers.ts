/* ================= helpers ================= */
export const DEBOUNCE_MS = 350;
export const LS_KEY = "smf.last.intake.v1";
export const LS_KEY_SUBMITTED = "smf.last.intake.submitted.v1";

export const computeDLI = (ppfd: number, hours: number) =>
  +(ppfd * hours * 3.6e-3).toFixed(2);
export function computeVPD(tempC: number, rh: number) {
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  return +(svp * (1 - rh / 100)).toFixed(2);
}
export function clamp100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const v = x <= 1 ? x * 100 : x;
  return Math.max(0, Math.min(100, Math.round(v)));
}
export function mapScoresFromPayload(res: any) {
  const a = Array.isArray(res?.gatePct) ? res.gatePct : [];
  const env = clamp100(a[0]?.pct);
  const root = clamp100(a[1]?.pct);
  const irr = clamp100(a[2]?.pct);
  return env + root + irr ? { env, root, irr } : null;
}
export type Scores = { env: number; root: number; irr: number };
export function overallStatusLabel(s: Scores) {
  const m = Math.min(s.env, s.root, s.irr);
  if (m < 50) return "System Critical";
  if (m < 80) return "Needs Attention";
  return "System Stable";
}
export function computePhysicsIrrGate(args: {
  irrPlan: any | null;
  p1Events?: number;
  p1MlPerEvent?: number;
  p2Events?: number;
  p2MlPerEvent?: number;
  tolP1DayMl?: number; // default 100
  tolP2DayMl?: number; // default 100
}): number {
  const n = (x: any) => {
    const v = Number(x);
    return Number.isFinite(v) ? v : null;
  };

  const irr = args.irrPlan;
  if (!irr) return 0;

  // Physics daily budgets (P1 = refill + dryback during P1; P2 = maintenance + runoff)
  const refill =
    n(irr.p1_required_day_ml) ??
    n(irr.p1?.required_day_ml) ??
    n(irr.w_refill_ml);
  const p2NeedDay = n(irr.p2_required_day_ml) ?? n(irr.p2?.required_day_ml);

  // User daily totals
  const p1e = n(args.p1Events);
  const p1m = n(args.p1MlPerEvent);
  const p2e = n(args.p2Events);
  const p2m = n(args.p2MlPerEvent);

  if (p1e == null || p1m == null || p2e == null || p2m == null) return 0;
  if (refill == null || p2NeedDay == null) return 0;

  const p1UserDay = p1e * p1m;
  const p2UserDay = p2e * p2m;

  const dP1 = p1UserDay - refill;
  const dP2 = p2UserDay - p2NeedDay;

  const tolP1 = n(args.tolP1DayMl) ?? 100;
  const tolP2 = n(args.tolP2DayMl) ?? 100;

  return (Math.abs(dP1) <= tolP1 && Math.abs(dP2) <= tolP2) ? 1 : 0;
}

/* ================= types ================= */
export type Intake = {
  // context
  stage: string;
  medium: string;
  container?: string;
  co2Mode?: string;
  lightcycle?: string;
  photoperiodH: number;
  mode?: string;
  profile?: string;

  // ENV
  tempC: number | undefined;
  rh: number | undefined;
  vpdKpa?: number;
  ppfd: number | undefined;
  dliMol?: number;
  co2?: number;

  // ROOT
  rootTempC?: number;
  vwcPct?: number;
  hasVwc?: boolean;
  runoffPh?: number;
  runoffPct?: number;
  reservoirEc?: number;
  reservoirPh?: number;
  reservoirTempC?: number;
  pwec?: number;
  vwcAtLastIrr?: number;
  runoffEc?: number;

  // IRR targets/meta
  drybackPct24h: number | undefined;
  targetAtFirst?: number;
  eventsPerDay?: number;
  mlPerEvent?: number;

  // P1
  p1Events?: number;
  p1IntervalMin?: number;
  p1Pct?: number;
  p1MlPerEvent?: number;
  p1SecPerEvent?: number;
  // P2
  p2Events?: number;
  p2IntervalMin?: number;
  p2Pct?: number;
  p2MlPerEvent?: number;
  p2SecPerEvent?: number;
};

export type ConfigContext = {
  stage: string;
  medium: string;
  container: string;
  co2Mode: string;
  lightcycle: string;
  photoperiodH: number;
  profile: string;
};

type SlotId = 1 | 2 | 3 | 4;
type MetricPoint = { date: string; value: number };
type RunStatus = "draft" | "active" | "finished";
/* ================= effective payload helper ================= */

const FIELD_TARGET_LABEL: { [K in keyof Intake]?: string } = {
  tempC: "Canopy temp (°C)",
  rh: "RH (%)",
  vpdKpa: "VPD (kPa)",
  ppfd: "PPFD (µmol/m²/s)",
  dliMol: "DLI (mol/m²/d)",
  co2: "CO2 (ppm)",

  runoffPh: "Runoff pH",
  runoffPct: "Runoff %",
  reservoirEc: "Reservoir EC (mS/cm)",
  reservoirPh: "Reservoir pH",
  reservoirTempC: "Reservoir temp (°C)",
  pwec: "PWEC (mS/cm)",
  vwcAtLastIrr: "VWC% at last irrigation",
  runoffEc: "Runoff EC (mS/cm)",

  drybackPct24h: "Overnight dryback % target",
  targetAtFirst: "Target at first event",

  p1Events: "P1 events",
  p1IntervalMin: "P1 interval (min)",
  p1Pct: "P1 %",
  p1MlPerEvent: "ml per P1 event",
  p2Events: "P2 events",
  p2IntervalMin: "P2 interval (min)",
  p2Pct: "P2 %",
  p2MlPerEvent: "ml per P2 event",
};

export function buildEffectivePayload(
  intake: Intake,
  targets: Record<string, number>
): Record<string, any> {
  const out: any = {};

  // context
  out.stage = intake.stage || "";
  out.medium = intake.medium || "";
  out.container = intake.container ?? "";
  out.co2Mode = intake.co2Mode ?? "";
  out.lightcycle = intake.lightcycle ?? "";
  out.photoperiodH = Number.isFinite(intake.photoperiodH)
    ? intake.photoperiodH
    : 12;
  if (intake.mode) out.mode = intake.mode;
  if (intake.profile) out.profile = intake.profile;

  const numericKeys: (keyof Intake)[] = [
    "tempC",
    "rh",
    "vpdKpa",
    "ppfd",
    "dliMol",
    "co2",
    "rootTempC",
    "vwcPct",
    "runoffPh",
    "runoffPct",
    "reservoirEc",
    "reservoirPh",
    "reservoirTempC",
    "pwec",
    "vwcAtLastIrr",
    "runoffEc",
    "drybackPct24h",
    "targetAtFirst",
    "eventsPerDay",
    "mlPerEvent",
    "p1Events",
    "p1IntervalMin",
    "p1Pct",
    "p1MlPerEvent",
    "p1SecPerEvent",
    "p2Events",
    "p2IntervalMin",
    "p2Pct",
    "p2MlPerEvent",
    "p2SecPerEvent",
  ];

    for (const key of numericKeys) {
    const raw = intake[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
      continue;
    }

    // Prefer explicit target mapping by label
    const label = FIELD_TARGET_LABEL[key];
    let t: number | undefined;

    if (label) {
      const fromLabel = targets[label];
      if (typeof fromLabel === "number" && Number.isFinite(fromLabel)) {
        t = fromLabel;
      }
    }

    // Fallback: use API key (e.g. targets["tempC"]) if label-based lookup fails
    if (t === undefined) {
      const fromApi = targets[key as string];
      if (typeof fromApi === "number" && Number.isFinite(fromApi)) {
        t = fromApi;
      }
    }

    if (typeof t === "number" && Number.isFinite(t)) {
      out[key] = t;
    }
  }


  return out;
}

/* ============ R&D metric lists for CONTROL / VARIANT UI ============ */

const RND_ENV_KEYS: (keyof Intake)[] = [
  "tempC",
  "rh",
  "vpdKpa",
  "ppfd",
  "dliMol",
  "co2",
];

const RND_ROOT_KEYS: (keyof Intake)[] = [
  "reservoirEc",
  "reservoirPh",
  "runoffPh",
  "reservoirTempC",
  "pwec",
  "vwcAtLastIrr",
  "runoffEc",
];

const RND_IRR_KEYS: (keyof Intake)[] = [
  "drybackPct24h",
  "targetAtFirst",
  "p1Events",
  "p1IntervalMin",
  "p1Pct",
  "p1MlPerEvent",
  "p2Events",
  "p2IntervalMin",
  "p2Pct",
  "p2MlPerEvent",
];

/* ================= storage helpers ================= */
export function getLastIntake(): Intake | null {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch {
    return null;
  }
}
export function setLastIntake(i: Intake | null) {
  try {
    i
      ? localStorage.setItem(LS_KEY, JSON.stringify(i))
      : localStorage.removeItem(LS_KEY);
  } catch {}
}

export function getLastSubmittedIntake(): Intake | null {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_SUBMITTED) || "null");
  } catch {
    return null;
  }
}
