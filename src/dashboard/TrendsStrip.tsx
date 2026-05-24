import { useSheetSnap } from "../state/sheetSnap";

type Row = {
  demand?: number;
  p1Delta?: number;
  p2Delta?: number;
  runoffEst?: number;
  vpd?: number;
};

function Spark({ data, min, max }: { data: number[]; min: number; max: number }) {
  const w = 120,
    h = 28,
    pad = 2;
  if (!data.length) {
    return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block" }} />;
  }
  const xs = data.map((_, i) => pad + (i * (w - 2 * pad)) / Math.max(1, data.length - 1));
  const ys = data.map((v) => {
    const t = (v - min) / ((max - min) || 1);
    return h - pad - t * (h - 2 * pad);
  });
  const d = data.length > 1 ? xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join(" ") : "";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block" }} preserveAspectRatio="none">
      <polyline fill="none" stroke="#263043" strokeWidth={1} points={`0,${h - pad} ${w},${h - pad}`} />
      {d && <path d={d} stroke="#00F6FF" strokeWidth={2} fill="none" />}
    </svg>
  );
}

export default function TrendsStrip() {
  const snaps = useSheetSnap((s) => s.list) || [];

  const rows: Row[] = snaps.map((s: any) => {
    const rd = s?.realityDelta;
    const i = s?.intake || {};
    const du = rd?.delta?.user;
    return {
      demand: rd?.demand_index != null ? Number(rd.demand_index) : undefined,
      p1Delta: du?.p1_delta_day_ml != null ? Number(du.p1_delta_day_ml) : undefined,
      p2Delta: du?.p2_delta_day_ml != null ? Number(du.p2_delta_day_ml) : undefined,
      runoffEst: du?.estimated_runoff_frac != null ? Number(du.estimated_runoff_frac) : undefined,
      vpd: i.vpdKpa != null ? Number(i.vpdKpa) : undefined,
    };
  });

  const col = <K extends keyof Row>(
    k: K,
    label: string,
    unit = "",
    fmt?: (v: number) => string
  ) => {
    const vals = rows.map((r) => r[k]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (!vals.length) {
      return (
        <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)", padding: "8px 12px", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{label}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>No history</div>
        </div>
      );
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const last = vals[vals.length - 1];
    return (
      <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)", padding: "8px 12px", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{label}</div>
          <div style={{ fontWeight: 700 }}>{(fmt ? fmt(last) : String(last)) + unit}</div>
        </div>
        <Spark data={vals} min={min} max={max} />
      </div>
    );
  };

  const fmtSigned0 = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}`;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        {col("demand", "Demand index")}
        {col("p1Delta", "ΔP1 day", " ml", fmtSigned0)}
        {col("p2Delta", "ΔP2 day", " ml", fmtSigned0)}
        {col("runoffEst", "Est runoff", "", (v) => (v * 100).toFixed(0) + "%")}
        {col("vpd", "VPD", " kPa")}
      </div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
        Trends from submit snapshots (sheetSnap). Submit + Calculate to add points.
      </p>
    </div>
  );
}
