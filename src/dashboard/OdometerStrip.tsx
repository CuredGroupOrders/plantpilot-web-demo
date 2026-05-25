import { useEnv } from "../state/env";
import { useOOB } from "../state/selectors/oob";
import type { Pill as OobPill } from "../state/selectors/oob";
import { useFrontIntake } from "../state/intake";
import { useDerivedNow } from "../state/selectors/derived";
import { useState, useEffect } from "react";
import { loadRules, type MetricRule, getMetricBounds, checkTolerance, toleranceColor } from "../data/growroom-rules";

type Gate = "ENV" | "ROOT" | "IRR";

type EnvSlice = { leafC?: number; rh?: number; ppfd?: number; runoffEc?: number; };
type IntakeSaved = {
  stage?: "veg" | "flower";
  stagePhase?: string;
  medium?: "coco" | "rockwool" | "soil" | "dwc" | string;
  ph?: number; vwc?: number; irrigationsLast24h?: number;
};

const VPD_MIN_FALLBACK: Record<"veg" | "flower", number> = { veg: 0.8, flower: 1.0 };
const VPD_MAX_FALLBACK: Record<"veg" | "flower", number> = { veg: 1.2, flower: 1.7 };
const PPFD_MIN_FALLBACK: Record<"veg" | "flower", number> = { veg: 350, flower: 600 };
const PPFD_MAX_FALLBACK: Record<"veg" | "flower", number> = { veg: 700, flower: 900 };
const PH_MIN_FALLBACK = { coco: 5.7, rockwool: 5.5, soil: 6.2, dwc: 5.5 } as const;
const PH_MAX_FALLBACK = { coco: 6.2, rockwool: 6.0, soil: 7.0, dwc: 6.2 } as const;

function bandFromTolerance(
  v: number | undefined,
  bounds: { target: number; min: number; max: number } | null,
  fallbackLo: number,
  fallbackHi: number,
) {
  if (v == null || Number.isNaN(v)) return { txt: "-", color: "#6b7280", bg: "var(--chip)" };
  if (bounds) {
    const status = checkTolerance(v, bounds);
    const color = toleranceColor(status);
    const bg = status === "in-target" ? "#13231d" : status === "in-tolerance" ? "#26291d" : "#2a1a1a";
    return { txt: String(v), color, bg };
  }
  if (v < fallbackLo) return { txt: String(v), color: "#f59e0b", bg: "#263043" };
  if (v > fallbackHi) return { txt: String(v), color: "#ef4444", bg: "#263043" };
  return { txt: String(v), color: "#10b981", bg: "#13231d" };
}

function pill(
  label: string,
  value: number | undefined,
  bounds: { target: number; min: number; max: number } | null,
  fallbackLo: number,
  fallbackHi: number,
  suf = ""
) {
  const b = bandFromTolerance(value, bounds, fallbackLo, fallbackHi);
  return (
    <div style={{ background: b.bg, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>
        {label}
        {bounds && (
          <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>
            ({bounds.min}–{bounds.max})
          </span>
        )}
      </div>
      <div style={{ fontWeight: 800, fontSize: 20, color: b.color }}>{b.txt}{value != null && suf}</div>
    </div>
  );
}

export default function OdometerStrip({ mode = "metrics" }: { mode?: "metrics" | "oob" }) {
  const OOB_MODE = mode === "oob";
  const { env: oobEnv, root: oobRoot, irr: oobIrr } = useOOB();

  const env = useEnv((s) => s.saved);
  const intake = useFrontIntake((s) => s.saved as IntakeSaved);
  const d = useDerivedNow() as { vpdKpa?: number; deltaEc?: number; };

  const [metrics, setMetrics] = useState<MetricRule[]>([]);
  useEffect(() => {
    loadRules().then((r) => setMetrics(r.metrics));
  }, []);

  const stage: "veg" | "flower" = (intake?.stage === "flower" ? "flower" : "veg");
  const medium = ((intake?.medium as keyof typeof PH_MIN_FALLBACK) in PH_MIN_FALLBACK ? intake?.medium : "coco") as keyof typeof PH_MIN_FALLBACK;

  const vpdBounds = getMetricBounds(metrics, "VPD (kPa)");
  const ppfdBounds = getMetricBounds(metrics, "PPFD (µmol/m²/s)");
  const phBounds = getMetricBounds(metrics, "Runoff pH");
  const vwcBounds = getMetricBounds(metrics, "VWC (%)");
  const irrBounds = getMetricBounds(metrics, "Irrigations in last 24h");

  const vpd = d?.vpdKpa;
  const ppfd_val = Number.isFinite(Number(env?.ppfd)) ? Math.round(Number(env?.ppfd)) : undefined;
  const ph = Number.isFinite(Number(intake?.ph)) ? Number(intake?.ph) : undefined;
  const dec = d?.deltaEc;
  const vwc = Number.isFinite(Number(intake?.vwc)) ? Number(intake?.vwc) : undefined;
  const irr = Number.isFinite(Number(intake?.irrigationsLast24h)) ? Number(intake?.irrigationsLast24h) : undefined;

  const group = (title: Gate | string, children: React.ReactNode) => (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        {title} {OOB_MODE && title === "ENV" && <span style={{ marginLeft: 8, fontSize: 10, opacity: .7 }}>OOB</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
        {children}
      </div>
    </div>
  );

  const renderPills = (pills: OobPill[]) => pills.map((m, i) => (
    <div key={i} className={`pill stat ${m.sev}`}>{m.text}</div>
  ));

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        {group("ENV", OOB_MODE ? renderPills(oobEnv) : (
          <>
            {pill("VPD", vpd, vpdBounds, VPD_MIN_FALLBACK[stage], VPD_MAX_FALLBACK[stage], " kPa")}
            {pill("PPFD", ppfd_val, ppfdBounds, PPFD_MIN_FALLBACK[stage], PPFD_MAX_FALLBACK[stage])}
          </>
        ))}

        {group("ROOT", OOB_MODE ? renderPills(oobRoot) : (
          <>
            {pill("pH", ph, phBounds, PH_MIN_FALLBACK[medium], PH_MAX_FALLBACK[medium])}
            {pill("ΔEC", dec, null, -0.2, 0.6)}
          </>
        ))}

        {group("IRR", OOB_MODE ? renderPills(oobIrr) : (
          <>
            {pill("VWC %", vwc, vwcBounds, stage === "veg" ? 30 : 25, stage === "veg" ? 55 : 50)}
            {pill("Irrigs 24h", irr, irrBounds, 1, 12)}
          </>
        ))}
      </div>
    </div>
  );
}
