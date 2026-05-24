// src/cockpit/ConditionsPills.tsx
import { useSheetSnap } from "../state/sheetSnap";

type Gate = "ENV" | "ROOT" | "IRR";
type Pill = { sev: "bad" | "warn"; text: string };

/** Exclude dropdown/context fields */
const DROP = new Set([
  // keys
  "stage","stagePhase","medium","lightcycle","photoperiodH","co2Mode",
  "container","containerSize","mode","cycle",
  // labels
  "Stage","Media","Lightcycle","Photoperiod (h)","CO2 mode","Container_gal","Mode","Cycle",
]);

/** Whitelist of valid numeric metrics per gate */
const ONLY: Record<Gate, Set<string>> = {
  ENV: new Set(["tempC","rh","vpdKpa","ppfd","dliMol","co2"]),
  ROOT: new Set(["runoffPh","reservoirEc","reservoirPh","reservoirTempC","pwec","vwcAtLastIrr","runoffEc"]),
  IRR: new Set(["drybackPct24h","targetAtFirst","p1Events","p1IntervalMin","p1Pct","p1MlPerEvent","p2Events","p2IntervalMin","p2Pct","p2MlPerEvent"]),
};

/** Gate-scoped pills. Mount one instance inside each gate card: <ConditionsPills gate="ENV" /> */
export default function ConditionsPills({ gate = "ENV" as Gate }: { gate?: Gate }) {
  const w = useSheetSnap((s) => s.latestWrite);
  const rows: any[] = Array.isArray(w?.summary?.applied) ? w!.summary!.applied : [];

  const list: Pill[] = [];
  for (const r of rows) {
    const key = String(r?.key ?? "");
    const label = String(r?.label ?? "");
    if (DROP.has(key) || DROP.has(label)) continue;

    const g = String(r?.gate || "").toUpperCase() as Gate;
    if (g !== gate) continue;
    if (!ONLY[g]?.has(key)) continue;

    const v = Number(r?.value);
    const min = Number(r?.min);
    const max = Number(r?.max);
    if (!Number.isFinite(v) || !Number.isFinite(min) || !Number.isFinite(max)) continue;
    if (min === 0 && max === 0) continue;

    if (v < min || v > max) {
      const span = Math.max(1e-9, max - min);
      const sev: "bad" | "warn" =
        Math.abs(v < min ? min - v : v - max) > 0.15 * span ? "bad" : "warn";
      const tag = key || label || "metric";
      list.push({ sev, text: `${tag} ▸ ${v.toFixed(2)} ▸ ${min}–${max}` });
    }
  }

  return (
    <div
      className="pills"
      style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 12px" }}
    >
      {list.map((p, i) => (
        <span
          key={i}
          className={`pill ${p.sev}`}
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            fontSize: 12,
            border: "1px solid var(--border)",
          }}
        >
          {p.text}
        </span>
      ))}
    </div>
  );
}
