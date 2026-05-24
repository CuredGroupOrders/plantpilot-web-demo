import { useSheetSnap } from "../state/sheetSnap";
import type { GateKey, Top3Row } from "../api/sheet";

const ORDER: GateKey[] = ["ENV", "ROOT", "IRR"];

function rowsFor(latest: any, gate: GateKey): Top3Row[] {
  const t3g = latest?.top3ByGate;
  const rows = (t3g && (t3g as any)[gate]) as unknown;
  return Array.isArray(rows) ? (rows as Top3Row[]) : [];
}

export default function Top3AdvicePanel() {
  const snap = useSheetSnap((s) => s.latestWrite ?? s.latest);
  if (!snap) return null;

  const anyRows =
    rowsFor(snap, "ENV").length || rowsFor(snap, "ROOT").length || rowsFor(snap, "IRR").length;
  if (!anyRows) return null;

  return (
    <section
      className="flag-card"
      style={{
        position: "relative",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 12,
        margin: "12px auto 16px",
        maxWidth: 1100,
      }}
      aria-label="Top 3 Advice by Gate"
    >
      <div
        className="hdr"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="hdr-label"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            border: "1px solid var(--border)",
            borderRadius: 999,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        >
          Gate Advice (Top 3)
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        {ORDER.map((g) => {
          const rows = rowsFor(snap, g).slice(0, 3);
          return (
            <div
              key={g}
              style={{
                border: "1px solid rgba(0,247,219,0.14)",
                borderRadius: 12,
                padding: 10,
                background: "rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  fontFamily: "Audiowide, Orbitron, system-ui",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--cy)",
                  marginBottom: 8,
                }}
              >
                {g} GATE
              </div>

              {rows.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {rows.map((r, i) => {
                    const label = String(r?.[0] ?? "").trim();
                    const why = String(r?.[1] ?? "").trim();
                    const score = Number(r?.[2] ?? 0);
                    return (
                      <div
                        key={`${g}-${i}`}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 10,
                          background: "rgba(0,0,0,0.22)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900, color: "var(--ink)" }}>{label || "(unnamed)"}</div>
                          <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>score {score || 0}</div>
                        </div>
                        {why ? (
                          <div style={{ marginTop: 6, fontSize: 12, color: "#9ca3af", lineHeight: 1.35 }}>
                            {why}
                          </div>
                        ) : (
                          <div style={{ marginTop: 6, fontSize: 12, color: "#9ca3af" }}>No advice.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "#9ca3af", fontSize: 12 }}>No flags.</div>
              )}
            </div>
          );
        })}
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(0,247,219,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(0,247,219,.22) 1px, transparent 1px)",
          backgroundSize: "26px 26px, 26px 26px",
          opacity: 0.18,
          zIndex: 0,
        }}
      />
    </section>
  );
}
