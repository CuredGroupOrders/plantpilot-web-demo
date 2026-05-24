// src/dashboard/InsightsTop3.tsx
import { useChips } from "../state/selectors/chips";

const ORDER = ["ENV", "ROOT", "IRR"] as const;

export default function InsightsTop3() {
  const { top3 } = useChips(9); // 3 per gate
  if (!top3?.length) return null;

  const cls = (sev: string) =>
    `chip ${sev === "bad" ? "chip-bad" : sev === "warn" ? "chip-warn" : "chip-ok"}`;

  // group by gate
  const byGate = top3.reduce<Record<string, typeof top3>>((acc, c) => {
    (acc[c.gate] ||= []).push(c);
    return acc;
  }, {});

  return (
    <section
      className="flag-card"
      style={{
        position: "relative",
        background: "var(--panel)",
        border: "1px solid var(--border)",     // cyan outline
        borderRadius: 16,
        padding: 12,
        margin: "12px auto 16px",              // space above footer
        maxWidth: 1100,                         // keeps off cockpit edges
      }}
    >
      {/* header like Plan bar */}
      <div className="hdr" style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom: 10, position:"relative", zIndex:1
      }}>
        <div className="hdr-label" style={{
          display:"inline-flex", alignItems:"center",
          padding:"6px 12px",
          border:"1px solid var(--border)", borderRadius:999,
          fontWeight:800, letterSpacing:".12em", textTransform:"uppercase",
          color:"var(--ink)"
        }}>
          Input Flags
        </div>
      </div>

      {/* three lists, centered */}
      <div className="content" style={{
        display:"grid",
        gridTemplateColumns:"repeat(3,minmax(0,1fr))",
        gap:12,
        justifyItems:"center",
        position:"relative", zIndex:1
      }}>
        {ORDER.map((g) => (
          <div key={g} style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <div style={{
              fontFamily:"Audiowide, Orbitron, system-ui",
              fontWeight:700, fontSize:12, letterSpacing:"0.14em",
              textTransform:"uppercase", color:"var(--cy)", marginBottom:4
            }}>
              {g} GATE
            </div>
            <div className="chips" style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center" }}>
              {(byGate[g] || []).map(c => (
                <span key={c.id} className={cls(c.severity)} title={c.title}>
                  <span className="chip-label">{c.title}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CRT grid under content */}
      <div aria-hidden="true" style={{
        position:"absolute", inset:0, borderRadius:16, pointerEvents:"none",
        backgroundImage:
          "linear-gradient(rgba(0,247,219,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(0,247,219,.35) 1px, transparent 1px)",
        backgroundSize:"26px 26px, 26px 26px",
        opacity:.30, zIndex:0
      }} />
    </section>
  );
}
