// src/components/GateOdometersPanel.tsx
import OdometerRow from "./OdometerRow";

type Meter = { value: number; sub: string };
type Props = { env: Meter; root: Meter; irr: Meter; statusText?: string };

export default function GateOdometersPanel({ env, root, irr, statusText }: Props) {
  const nv = (n: number | undefined) => (Number.isFinite(Number(n)) ? Number(n) : 0);
  const minScore = Math.min(nv(env?.value), nv(root?.value), nv(irr?.value));

  // 4-tier panel status derived from worst gate
  const tier = minScore <= 0 ? "crit" : minScore <= 60 ? "amber" : minScore <= 85 ? "yellow" : "cyan";
  const tierColor =
    tier === "cyan" ? "var(--cy)" : tier === "yellow" ? "var(--yl)" : tier === "amber" ? "var(--am)" : "var(--rd)";
  const derivedLabel =
    tier === "cyan" ? "System Stable" : tier === "yellow" ? "Check Soon" : tier === "amber" ? "Needs Attention" : "System Critical";
  const label = statusText ?? derivedLabel;

  return (
    <section className="card odo-card" aria-label="System Integrity">
      {/* Header with cyan-bordered label and severity chip */}
      <div className="odo-hdr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div
          className="odo-hdr-label"
          style={{
            padding: "6px 12px",
            border: "1px solid var(--cy)",
            borderRadius: 10,
            fontWeight: 800,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "var(--cy)",
          }}
        >
          SYSTEM INTEGRITY
        </div>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: 10,
            border: `1px solid ${tierColor}`,
            color: tierColor,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            fontSize: 12,
            background: "transparent",
          }}
        >
          {label}
        </span>
      </div>

      {/* Cyan rule with extra gap before odometers */}
      <div
        style={{
          height: 1,
          margin: "10px 12px 14px",
          background:
            "linear-gradient(90deg, transparent, rgba(0,247,219,.35) 12%, rgba(0,247,219,.35) 88%, transparent)",
        }}
      />

      {/* Odometers with top padding so the line does not touch them */}
      <div className="card-body" style={{ paddingTop: 16 }}>
        <div className="odo-grid odo-grid-pad">
          <OdometerRow env={env} root={root} irr={irr} />
        </div>
      </div>
    </section>
  );
}
