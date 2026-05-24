import React from "react";

export type OdometerProps = {
  label: string;
  sub?: string;
  value: number;          // 0..100
  color?: string;         // optional override (css var or hex)
  icon?: React.ReactNode;
};

const pickColor = (v: number) => {
  if (v === 0) return "var(--rd)";        // critical red
  if (v <= 60) return "var(--am)";        // orange/amber
  if (v <= 85) return "var(--yl)";        // yellow
  return "var(--cy)";                     // cyan
};

const GaugeRing = ({ value, color }: { value: number; color: string }) => {
  const v = Math.max(0, Math.min(100, value));
  const deg = `${v * 3.6}deg`;
  const arc = color || pickColor(v);
  return (
    <div className="gauge cockpit-gauge">
      <div
        className="gauge-ring"
        style={{ background: `conic-gradient(${arc} ${deg}, rgba(255,255,255,.06) 0)` }}
      />
      <div className="gauge-core" />
      <div className="gauge-val" style={{ color: arc }}>
        <span>{v}</span>
      </div>
    </div>
  );
};

export default function Odometer({ label, sub, value, color, icon }: OdometerProps) {
  const arc = color || pickColor(value);
  return (
    <div className="odo cockpit-odo">
      <GaugeRing value={value} color={arc} />
      <div className="odo-meta">
        <div className="odo-title" style={{ color: arc }}>
          {icon && <span className="odo-icon">{icon}</span>}
          <span>{label.toUpperCase()}</span>
        </div>
        {sub && <div className="odo-sub">{sub}</div>}
      </div>
    </div>
  );
}
