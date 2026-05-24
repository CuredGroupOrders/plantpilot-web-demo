import { useMemo, useEffect, useState, type ReactElement } from "react";
import { useHistory } from "../state/history";
import { urlForPhoto } from "../state/photos";
import CentcomBlock from "./CentcomBlock";

function Spark({ data }: { data: number[] }) {
  const w = 200, h = 40, pad = 4;
  if (!data.length) return <svg width={w} height={h} />;
  const min = Math.min(...data), max = Math.max(...data), span = (max - min) || 1;
  const xs = data.map((_, i) => pad + i * ((w - 2 * pad) / Math.max(1, data.length - 1)));
  const ys = data.map(v => h - pad - ((v - min) / span) * (h - 2 * pad));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline fill="none" stroke="rgba(43,47,58,.8)" strokeWidth={1} points={`0,${h - pad} ${w},${h - pad}`} />
      <path d={d} stroke="#00F6FF" strokeWidth={2} fill="none" />
    </svg>
  );
}

function num(v: any, d = 2) {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? Number(v.toFixed(d)) : undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : String(v);
}

const first = (...xs: any[]) => xs.find(v => v != null && v !== "" && !Number.isNaN(v));

function toSeries(list: { env?: any; intake?: any }[]) {
  const VPD = list.map(s => {
    const leafC = typeof s?.env?.leafC === "number" ? s.env.leafC : undefined;
    const rh = typeof s?.env?.rh === "number" ? s.env.rh : undefined;
    if (leafC == null || rh == null) return 0;
    const es = 0.6108 * Math.exp((17.27 * leafC) / (leafC + 237.3));
    return Number(((1 - (rh / 100)) * es).toFixed(2));
  });
  const PH = list.map(s => Number(s?.intake?.ph) || 0);
  const DEC = list.map(s => Number((s?.env?.runoffEc ?? 0) - (s?.intake?.ec ?? 0)) || 0);
  const VWC = list.map(s => Number(s?.intake?.vwc ?? s?.env?.vwcPct ?? 0) || 0);
  return { VPD, PH, DEC, VWC };
}

type Row = { k: string; v: string | number };
function rows(pairs: Array<[string, any, string?]>): Row[] {
  return pairs
    .map(([k, v, u]) => {
      const nv = typeof v === "number" ? num(v) : v;
      if (nv == null) return undefined;
      const val = typeof nv === "number" ? nv : nv;
      return { k, v: u ? `${val} ${u}` : val };
    })
    .filter(Boolean) as Row[];
}

function KVList({ items }: { items: Row[] }) {
  if (!items.length) return null;
  return (
    <div className="hist-kvs">
      {items.map((r, i) => (
        <div key={i} className="hist-kv">
          <span className="k">{r.k}</span>
          <span className="v">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

export default function BaselineHistory() {
  const { list, selectedId, select, back, remove, exportOne, exportAll, open, removePhoto } = useHistory();
  const [photos, setPhotos] = useState<Array<{ id: string; url: string }>>([]);

  useEffect(() => { open(); }, [open]);

  const ordered = useMemo(() => list.slice().sort((a, b) => b.t - a.t), [list]);
  const selected = useMemo(() => (selectedId ? list.find(x => x.id === selectedId) : undefined), [list, selectedId]);

  const detailSeries = useMemo(() => {
    if (!selected) return { VPD: [], PH: [], DEC: [], VWC: [] };
    const upTo = list.slice().filter(x => x.t <= selected.t).sort((a, b) => a.t - b.t);
    return toSeries(upTo);
  }, [list, selected]);
  const selVals = useMemo(() => {
    if (!selected) return { vpd: 0, ph: 0, dec: 0, vwc: 0 };

    // Prefer authoritative BaselineSnapshot intake if present
    const snapIntake: any = (selected as any)?.baselineSnapshot?.intakeEffective;

    const computeVPD = (tempC: number, rh: number) => {
      const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
      return Number(((1 - (rh / 100)) * es).toFixed(2));
    };

    if (snapIntake && typeof snapIntake === "object") {
      const tempC = Number(snapIntake.tempC);
      const rh = Number(snapIntake.rh);

      const vpd =
        Number.isFinite(Number(snapIntake.vpdKpa)) ? Number(snapIntake.vpdKpa) :
        (Number.isFinite(tempC) && Number.isFinite(rh)) ? computeVPD(tempC, rh) :
        0;

      // pH: prefer reservoirPh, then runoffPh, then any legacy "ph"
      const ph =
        Number.isFinite(Number(snapIntake.reservoirPh)) ? Number(snapIntake.reservoirPh) :
        Number.isFinite(Number(snapIntake.runoffPh)) ? Number(snapIntake.runoffPh) :
        Number.isFinite(Number(snapIntake.ph)) ? Number(snapIntake.ph) :
        0;

      // ΔEC: prefer explicit deltaEc if present; else runoffEc - reservoirEc
      const dec =
        Number.isFinite(Number(snapIntake.deltaEc)) ? Number(snapIntake.deltaEc) :
        (Number.isFinite(Number(snapIntake.runoffEc)) && Number.isFinite(Number(snapIntake.reservoirEc)))
          ? Number((Number(snapIntake.runoffEc) - Number(snapIntake.reservoirEc)).toFixed(2))
          : 0;

      // VWC: prefer vwcAtLastIrr, then vwcPct
      const vwc =
        Number.isFinite(Number(snapIntake.vwcAtLastIrr)) ? Number(snapIntake.vwcAtLastIrr) :
        Number.isFinite(Number(snapIntake.vwcPct)) ? Number(snapIntake.vwcPct) :
        0;

      return { vpd, ph, dec, vwc };
    }

    // Fallback legacy behavior (older entries)
    const { env, intake } = selected as any;
    const leafC = typeof env?.leafC === "number" ? env.leafC : undefined;
    const rh2 = typeof env?.rh === "number" ? env.rh : undefined;
    const vpd2 = leafC == null || rh2 == null ? 0 : computeVPD(leafC, rh2);

    const ph2 = Number(intake?.ph) || 0;
    const dec2 = Number((env?.runoffEc ?? 0) - (intake?.ec ?? 0)) || 0;
    const vwc2 = Number(intake?.vwc ?? env?.vwcPct ?? 0) || 0;

    return { vpd: vpd2, ph: ph2, dec: dec2, vwc: vwc2 };
  }, [selected]);
useEffect(() => {
    let alive = true;
    let urls: Array<{ id: string; url: string }> = [];
    (async () => {
      if (!selected?.photos?.length) { if (alive) setPhotos([]); return; }
      for (const id of selected.photos) {
        const u = await urlForPhoto(id);
        if (u) urls.push({ id, url: u });
      }
      if (alive) setPhotos(urls);
    })();
    return () => { alive = false; urls.forEach(x => URL.revokeObjectURL(x.url)); };
  }, [selected?.id, selected?.photos?.length]);

  // Live snapshot for fallback chips/OOB when entry lacks them
  // Snapshot-only replay: no selectors, no live recompute.
  const chipsByGate = useMemo(() => {
    // Prefer BaselineSnapshot top-3 rows when present
    const snapFlags: any = (selected as any)?.baselineSnapshot?.flags;
    const snapChips: any[] = snapFlags
      ? ([
          ...(snapFlags.ENV || []).map((r: any, i: number) => ({ id: `ENV-${i}`, gate: "ENV", title: r.label, why: r.why, sev: "warn" })),
          ...(snapFlags.ROOT || []).map((r: any, i: number) => ({ id: `ROOT-${i}`, gate: "ROOT", title: r.label, why: r.why, sev: "warn" })),
          ...(snapFlags.IRR || []).map((r: any, i: number) => ({ id: `IRR-${i}`, gate: "IRR", title: r.label, why: r.why, sev: "warn" })),
        ] as any[])
      : [];

    const source = snapChips.length ? snapChips : ((selected?.chips || []) as any[]);
    const g: Record<"ENV" | "ROOT" | "IRR", any[]> = { ENV: [], ROOT: [], IRR: [] };
    source.forEach((c: any) => {
      const gk = c?.gate as "ENV" | "ROOT" | "IRR" | undefined;
      if (c && gk && g[gk]) g[gk].push(c);
    });
    return g;
  }, [selected?.id, (selected as any)?.chips, (selected as any)?.baselineSnapshot]);
  const oobByGate = useMemo(() => {
    const source = (selected?.oob && selected.oob.length) ? selected.oob : [];
    const g: Record<"ENV" | "ROOT" | "IRR", any[]> = { ENV: [], ROOT: [], IRR: [] };
    source.forEach((p: any) => {
      const gk = p?.gate as "ENV" | "ROOT" | "IRR" | undefined;
      if (p && gk && g[gk]) g[gk].push(p);
    });
    return g;
  }, [selected?.oob]);
async function onDeletePhoto(pid: string) {
    if (!selected) return;
    await removePhoto(selected.id, pid);
  }

  // Build KV sections once per selection
  // Build KV sections once per selection (snapshot-first)
  const inputGroups = useMemo(() => {
    if (!selected) {
      return { summary: [] as Row[], feed: [] as Row[], irrig: [] as Row[], env: [] as Row[], crop: [] as Row[] };
    }

    const snapIntake: any = (selected as any)?.baselineSnapshot?.intakeEffective;

    // If we have a BaselineSnapshot, render from that (truth).
    if (snapIntake && typeof snapIntake === "object") {
      const irrig = rows([
        ["P1 events", snapIntake.p1Events, ""],
        ["P1 interval", snapIntake.p1IntervalMin, "min"],
        ["P1 %", snapIntake.p1Pct, "%"],
        ["P1 mL/event", snapIntake.p1MlPerEvent, "mL"],
        ["P2 events", snapIntake.p2Events, ""],
        ["P2 interval", snapIntake.p2IntervalMin, "min"],
        ["P2 %", snapIntake.p2Pct, "%"],
        ["P2 mL/event", snapIntake.p2MlPerEvent, "mL"],
        ["Dryback target", snapIntake.drybackPct24h, "%"],
        ["Target@first", snapIntake.targetAtFirst, "%"],
      ]);

      const feed = rows([
        ["Reservoir EC", snapIntake.reservoirEc, "mS/cm"],
        ["Reservoir pH", snapIntake.reservoirPh, ""],
        ["Reservoir temp", snapIntake.reservoirTempC, "°C"],
        ["Runoff pH", snapIntake.runoffPh, ""],
        ["Runoff %", snapIntake.runoffPct, "%"],
        ["Runoff EC", snapIntake.runoffEc, "mS/cm"],
        ["PWEC", snapIntake.pwec, "mS/cm"],
      ]);

      const envRows = rows([
        ["Canopy temp", snapIntake.tempC, "°C"],
        ["RH", snapIntake.rh, "%"],
        ["VPD", snapIntake.vpdKpa, "kPa"],
        ["PPFD", snapIntake.ppfd, "µmol·m⁻²·s⁻¹"],
        ["DLI", snapIntake.dliMol, "mol·m⁻²·d⁻¹"],
        ["CO₂", snapIntake.co2, "ppm"],
      ]);

      const crop = rows([
        ["Stage", snapIntake.stage],
        ["Medium", snapIntake.medium],
        ["Container", snapIntake.container],
        ["Light cycle", snapIntake.photoperiodH, "h"],
        ["CO₂ mode", snapIntake.co2Mode],
        ["SOP profile", snapIntake.profile],
        ["Mode", snapIntake.mode],
      ]);

      const summary = rows([
        ["VPD", selVals.vpd, "kPa"],
        ["pH", selVals.ph, ""],
        ["ΔEC", selVals.dec, "mS/cm"],
        ["VWC", selVals.vwc, "%"],
      ]);

      return { summary, feed, irrig, env: envRows, crop };
    }

    // Legacy fallback for older history entries
    const { env = {}, intake = {} } = selected as any;

    const irrig = rows([
      ["P1 interval", first(intake.p1Interval, intake.p1IntervalMin, intake.phase1Interval, intake.p1Minutes), "min"],
      ["P1 volume", first(intake.p1VolumePct, intake.p1VolPct, intake.phase1VolumePct), "%"],
      ["P2 interval", first(intake.p2Interval, intake.p2IntervalMin, intake.phase2Interval, intake.p2Minutes), "min"],
      ["P2 volume", first(intake.p2VolumePct, intake.p2VolPct, intake.phase2VolumePct), "%"],
      ["Shot size", first(intake.shotSize, intake.pulseSize, intake.shotMl), "mL"],
      ["Shots last 24h", intake.irrigationsLast24h, ""],
      ["Target VWC", first(intake.vwc, intake.targetVwc), "%"],
      ["Dryback", first(intake.drybackPct, intake.targetDrybackPct), "%"],
    ]);

    const feed = rows([
      ["Feed EC", intake.ec, "mS/cm"],
      ["Feed pH", intake.ph, ""],
      ["Feed temp", first(intake.temp, intake.feedTemp), "°C"],
    ]);

    const envRows = rows([
      ["Leaf temp", env.leafC, "°C"],
      ["RH", env.rh, "%"],
      ["PPFD", env.ppfd, "µmol·m⁻²·s⁻¹"],
      ["CO₂", env.co2, "ppm"],
      ["Runoff EC", env.runoffEc, "mS/cm"],
    ]);

    const crop = rows([
      ["Stage", first(intake.stage, intake.growthStage, intake.stagePhase)],
      ["Medium", first(intake.medium, intake.media)],
      ["Container", first(intake.containerSizeL, intake.containerSize), "L"],
      ["Light cycle", first(intake.lightCycle, intake.lightHours, intake.photoperiodH), "h"],
    ]);

    const summary = rows([
      ["VPD", selVals.vpd, "kPa"],
      ["pH", selVals.ph, ""],
      ["ΔEC", selVals.dec, "mS/cm"],
      ["VWC", selVals.vwc, "%"],
    ]);

    return { summary, feed, irrig, env: envRows, crop };
  }, [selected, selVals]);
const GateRow = ({ gate, items, render }: { gate: "ENV" | "ROOT" | "IRR"; items: any[]; render: (x: any, i: number) => ReactElement }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
      <span style={{ fontSize: 12, padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 999 }}>{gate}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.length ? items.map(render) : <span style={{ color: "#9ca3af", fontSize: 12 }}>None</span>}
      </div>
    </div>
  );

  return (
    <div>
      {!selected && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button className="btn" onClick={() => exportAll()}>Share All</button>
          </div>
          <div className="hist-list">
            {ordered.map(s => {
              const when = new Date(s.t).toLocaleString();
              return (
                <div key={s.id} className="hist-row">
                  <div className="hist-meta">
                    <b>{s.name || "baseline"}</b>
                    <span className="hist-when">{when}</span>
                  </div>
                  <div className="hist-actions">
                    <button className="btn" onClick={() => select(s.id)}>View</button>
                    <button className="btn" onClick={() => { if (window.confirm("Delete this snapshot?")) remove(s.id); }}>Delete</button>
                  </div>
                </div>
              );
            })}
            {!ordered.length && <div className="hist-empty">No snapshots yet.</div>}
          </div>
        </>
      )}

      {selected && (
        <>
          <div className="hist-header" style={{ marginTop: 4 }}>
            <div className="hist-title">
              <button className="btn ghost" onClick={back}>Back</button>
              <span className="hist-title-text">{selected.name || "baseline"} · {new Date(selected.t).toLocaleString()}</span>
            </div>
            <div className="hist-actions">
              <button className="btn" onClick={() => exportOne(selected.id)}>Share</button>
              <button className="btn" onClick={() => { if (window.confirm("Delete this snapshot?")) remove(selected.id); }}>Delete</button>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="hist-photos">
              {photos.map(p => (
                <div key={p.id} className="hist-photo-wrap">
                  <img className="hist-photo" src={p.url} alt="photo" />
                  <button className="hist-photo-del" title="Delete photo" onClick={() => onDeletePhoto(p.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* CENTCOM snapshot block */}
          <CentcomBlock entry={selected} />

          
<div className="hist-grid">
            <div className="hist-card">
              <div className="hist-label">VPD (kPa)</div>
              <div className="hist-value">{selVals.vpd}</div>
              <Spark data={detailSeries.VPD} />
            </div>
            <div className="hist-card">
              <div className="hist-label">pH</div>
              <div className="hist-value">{selVals.ph}</div>
              <Spark data={detailSeries.PH} />
            </div>
            <div className="hist-card">
              <div className="hist-label">ΔEC</div>
              <div className="hist-value">{selVals.dec}</div>
              <Spark data={detailSeries.DEC} />
            </div>
            <div className="hist-card">
              <div className="hist-label">VWC %</div>
              <div className="hist-value">{selVals.vwc}</div>
              <Spark data={detailSeries.VWC} />
            </div>
          </div>

          <div className="hist-section">
            <div className="hist-section-title">Insights</div>
            <GateRow
              gate="ENV"
              items={chipsByGate.ENV}
              render={(c:any) => <span key={c.id} className={`pill stat ${c.sev}`} title={c.why || ""}>{c.title}</span>}
            />
            <GateRow
              gate="ROOT"
              items={chipsByGate.ROOT}
              render={(c:any) => <span key={c.id} className={`pill stat ${c.sev}`} title={c.why || ""}>{c.title}</span>}
            />
            <GateRow
              gate="IRR"
              items={chipsByGate.IRR}
              render={(c:any) => <span key={c.id} className={`pill stat ${c.sev}`} title={c.why || ""}>{c.title}</span>}
            />
          </div>

          <div className="hist-section">
            <div className="hist-section-title">Out of Band</div>
            <GateRow
              gate="ENV"
              items={oobByGate.ENV}
              render={(p:any, i:number) => (
                <span key={`ENV-${i}`} className={`pill stat ${p.sev}`}>{`${p.metric} ${p.cond} ${p.value}${p.unit?` ${p.unit}`:""}`}</span>
              )}
            />
            <GateRow
              gate="ROOT"
              items={oobByGate.ROOT}
              render={(p:any, i:number) => (
                <span key={`ROOT-${i}`} className={`pill stat ${p.sev}`}>{`${p.metric} ${p.cond} ${p.value}${p.unit?` ${p.unit}`:""}`}</span>
              )}
            />
            <GateRow
              gate="IRR"
              items={oobByGate.IRR}
              render={(p:any, i:number) => (
                <span key={`IRR-${i}`} className={`pill stat ${p.sev}`}>{`${p.metric} ${p.cond} ${p.value}${p.unit?` ${p.unit}`:""}`}</span>
              )}
            />
          </div>

          <div className="hist-sections">
            <div className="hist-section">
              <div className="hist-section-title">Snapshot</div>
              <KVList items={inputGroups.summary} />
            </div>

            <div className="hist-section">
              <div className="hist-section-title">Irrigation</div>
              <KVList items={inputGroups.irrig} />
            </div>

            <div className="hist-section">
              <div className="hist-section-title">Feed Targets</div>
              <KVList items={inputGroups.feed} />
            </div>

            <div className="hist-section">
              <div className="hist-section-title">Crop/Setup</div>
              <KVList items={inputGroups.crop} />
            </div>

            <div className="hist-section">
              <div className="hist-section-title">Environment</div>
              <KVList items={inputGroups.env} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}






