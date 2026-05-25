import { useMemo, useState } from "react";
import { usePrimaryConstraint } from "../state/selectors/primaryConstraint";
import { useSheetSnap } from "../state/sheetSnap";
import { selectOOB } from "../state/selectors/oob";
import { useChips } from "../state/selectors/chips";

type Gate = "ENV" | "ROOT" | "IRR";

type AppliedRow = {
  key?: string;
  label?: string;
  gate?: string;
  value?: any;
  min?: number;
  max?: number;
};

function gateColor(g: Gate) {
  return g === "ENV" ? "var(--cy)" : g === "ROOT" ? "var(--am)" : "var(--yl)";
}

function fmt(n: any, d = 2) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(d) : String(n ?? "");
}

export default function PrimaryConstraintCard(props: {
  defaultExpanded?: boolean;
  children?: React.ReactNode;
}) {
  const pc = usePrimaryConstraint();
  const snap = useSheetSnap((s) => (s.latestWrite ?? s.latest) as any);
  const { rest: restChips } = useChips(12);
  const restCount = restChips.length;

  const [openEvidence, setOpenEvidence] = useState(!!props.defaultExpanded);
  const [openOverview, setOpenOverview] = useState(false);

  const evidenceKeys = (pc as any)?.evidenceKeys as string[] | undefined;

  const oob = useMemo(() => {
    if (!snap) return { env: [], root: [], irr: [] };
    return selectOOB(snap);
  }, [snap]);

  const gateList = useMemo(() => {
    if (!pc) return [];
    return pc.gate === "ENV" ? (oob.env || []) : pc.gate === "ROOT" ? (oob.root || []) : (oob.irr || []);
  }, [pc, oob]);

  const contextualEvidence = useMemo(() => {
    if (!Array.isArray(gateList)) return [];
    if (!Array.isArray(evidenceKeys) || !evidenceKeys.length) return gateList.slice(0, 3);
    const filtered = gateList.filter((p: any) => !p?.key || evidenceKeys.includes(String(p.key)));
    return (filtered.length ? filtered : gateList).slice(0, 3);
  }, [gateList, evidenceKeys]);

  const metricReadout = useMemo(() => {
    if (!pc) return null;
    const applied: AppliedRow[] = Array.isArray(snap?.summary?.applied) ? (snap.summary.applied as any) : [];
    if (!applied.length) return null;
    const keys = Array.isArray(evidenceKeys) ? evidenceKeys : [];
    const wantGate = pc.gate;

    for (const k of keys) {
      const r = applied.find(x => String(x?.key||"") === k && String(x?.gate||"").toUpperCase() === wantGate);
      if (r) return r;
    }
    return applied.find(x => String(x?.gate||"").toUpperCase() === wantGate) ?? null;
  }, [snap, evidenceKeys, pc]);

  // If no engine snapshot yet, still render the shell (so UI proves it exists)
  if (!pc) {
    return (
      <section
        className="flag-card"
        style={{
          position: "relative",
          background: "linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.75))",
          border: "1px solid rgba(248,113,113,0.55)",
          borderRadius: 16,
          padding: 12,
          margin: "10px auto 12px",
          maxWidth: 1100,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div
            style={{
              fontFamily: "Audiowide, Orbitron, system-ui",
              fontWeight: 900,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "#fca5a5",
            }}
          >
            PRIMARY CONSTRAINT
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Awaiting engine snapshot…</div>
        </div>
      </section>
    );
  }

  // Bind advice to the exact Top-3 row that matches the displayed primary label.
  const t3g = (snap as any)?.top3ByGate as any;
  const rows = t3g ? (t3g as any)[pc.gate] : null;
  const match = Array.isArray(rows)
    ? rows.find((r: any) => String(r?.[0] ?? "").trim() === String(pc.label || "").trim())
    : null;
  const primaryWhy = String(match?.[1] ?? pc.why ?? "").trim() || undefined;
  const confPct = Math.round((pc.confidence || 0) * 100);
  const gcol = gateColor(pc.gate);

  const alarmBorder = "rgba(248,113,113,0.75)";
  const alarmGlow = "0 0 18px rgba(248,113,113,0.25)";

  return (
    <section
      className="flag-card"
      style={{
        position: "relative",
        background: "linear-gradient(180deg, rgba(0,0,0,0.92), rgba(0,0,0,0.72))",
        border: `1px solid ${alarmBorder}`,
        borderRadius: 16,
        padding: 12,
        margin: "10px auto 12px",
        maxWidth: 1100,
        boxShadow: alarmGlow,
      }}
      aria-label="Primary Constraint"
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "6px 12px",
                border: `1px solid ${alarmBorder}`,
                borderRadius: 999,
                fontWeight: 900,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "#fca5a5",
                background: "rgba(0,0,0,0.25)",
                fontFamily: "Audiowide, Orbitron, system-ui",
                whiteSpace: "nowrap",
              }}
            >
              PRIMARY CONSTRAINT
            </span>

            <span
              style={{
                padding: "6px 10px",
                border: `1px solid ${gcol}`,
                borderRadius: 999,
                fontWeight: 900,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: gcol,
                background: "rgba(0,0,0,0.25)",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              {pc.gate} GATE
            </span>

            <span
              style={{
                padding: "6px 10px",
                border: "1px solid var(--border)",
                borderRadius: 999,
                fontWeight: 800,
                letterSpacing: ".08em",
                color: "var(--ink)",
                background: "rgba(0,0,0,0.25)",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              CONF {confPct}%
            </span>
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "var(--ink)",
              letterSpacing: ".02em",
              textShadow: "0 0 2px rgba(255,255,255,0.15)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={pc.label}
          >
            {pc.label}
          </div>

          {primaryWhy ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "#9ca3af", lineHeight: 1.35 }}>
              {primaryWhy}
            </div>
          ) : null}
        </div>

        {/* Primary toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setOpenEvidence(v => {
                const next = !v;
                if (!next) setOpenOverview(false);
                return next;
              });
            }}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "rgba(0,0,0,0.25)",
              color: "var(--ink)",
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            aria-expanded={openEvidence}
          >
            {openEvidence ? "Hide evidence" : "Show evidence"}
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setOpenOverview(v => !v)}
            disabled={restCount === 0}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "rgba(0,0,0,0.25)",
              color: "var(--ink)",
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              fontSize: 12,
              whiteSpace: "nowrap",
              marginLeft: 8,
              opacity: restCount === 0 ? 0.5 : 1,
              cursor: restCount === 0 ? "not-allowed" : "pointer",
            }}
            aria-expanded={openOverview}
            title={restCount === 0 ? "No additional flags" : `${restCount} more flag${restCount === 1 ? "" : "s"}`}
          >
            {openOverview ? "Hide all flags" : `Show all flags (${restCount})`}
          </button>
        </div>
      </div>

      {/* Level 1: Evidence */}
      {openEvidence && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,247,219,0.25)" }}>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, letterSpacing: ".08em", textTransform: "uppercase" }}>
            Evidence for this constraint
          </div>

          {/* Contextual evidence pills ONLY */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {contextualEvidence.length ? contextualEvidence.map((p: any, i: number) => (
              <span
                key={i}
                className={`pill stat ${p.sev}`}
                title={p.text}
                style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 12 }}
              >
                {p.text}
              </span>
            )) : (
              <span style={{ color: "#9ca3af", fontSize: 12 }}>No matching evidence.</span>
            )}
          </div>

          {/* Primary metric: current -> target */}
          {metricReadout && (
            <div style={{
              marginTop: 10,
              border: "1px solid rgba(0,247,219,0.18)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(0,0,0,0.25)"
            }}>
              <div style={{ fontSize: 12, color: "#9ca3af", letterSpacing: ".08em", textTransform: "uppercase" }}>
                Current → Target
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"baseline", marginTop: 6 }}>
                {(() => {
                  const v = Number(metricReadout.value);
                  const lo = Number(metricReadout.min);
                  const hi = Number(metricReadout.max);
                  const oob = Number.isFinite(v) && Number.isFinite(lo) && Number.isFinite(hi) ? (v < lo || v > hi) : true;
                  const currColor = oob ? "var(--rd)" : "var(--cy)";
                  return (
                    <>
                      <span style={{ fontWeight: 900, color: currColor }}>
                        {String(metricReadout.label || metricReadout.key || "Metric")}: {fmt(metricReadout.value, 2)}
                      </span>
                      <span style={{ color: "var(--cy)", fontSize: 12, fontWeight: 800 }}>
                        Target band: {fmt(metricReadout.min,2)} – {fmt(metricReadout.max,2)}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

                    {/* Resolution message */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,247,219,0.18)" }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Resolution
            </div>

            <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.35 }}>
              {primaryWhy ? primaryWhy : "Correct the constraint, then re-log to confirm it clears."}
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af", lineHeight: 1.35 }}>
              {metricReadout
                ? `Clear when ${String(metricReadout.label || metricReadout.key || "metric")} is within ${fmt(metricReadout.min,2)}–${fmt(metricReadout.max,2)} for 1 re-log.`
                : "Clear when the evidence metrics return in-band for 1 re-log."}
            </div>
          </div>

        </div>
      )}

      {/* Level 2: All flags panel — toggled by the single header button */}
      {openOverview && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,247,219,0.18)" }}>
          {props.children}
        </div>
      )}

      {/* subtle grid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(248,113,113,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(0,247,219,.16) 1px, transparent 1px)",
          backgroundSize: "30px 30px, 30px 30px",
          opacity: 0.22,
        }}
      />
    </section>
  );
}
