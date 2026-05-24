import { useEffect, useRef, useState } from "react";
import * as Sheet from "../api/sheet";

type PingResult = Awaited<ReturnType<typeof Sheet.ping>>;

const POLL_MS = 30_000;

export default function ConnectionPill() {
  const [result, setResult] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const tick = async () => {
      setPinging(true);
      try {
        const r = await Sheet.ping();
        if (aliveRef.current) setResult(r);
      } finally {
        if (aliveRef.current) setPinging(false);
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);

    return () => {
      aliveRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  const ok = result?.ok === true;
  const dotColor = pinging
    ? "#facc15"
    : ok
    ? "#22c55e"
    : result
    ? "#f97373"
    : "#6b7280";
  const glow = pinging
    ? "0 0 6px rgba(250,204,21,0.85)"
    : ok
    ? "0 0 6px rgba(34,197,94,0.85)"
    : result
    ? "0 0 6px rgba(248,113,113,0.85)"
    : "none";

  const label = !result
    ? "Connecting…"
    : ok
    ? `${(result as any).version} · ${(result as any).latencyMs}ms`
    : `Offline${(result as any).status ? ` (${(result as any).status})` : ""}`;

  const title = !result
    ? "Pinging Pulse API…"
    : ok
    ? `Pulse API connected\nVersion: ${(result as any).version}\nLatency: ${(result as any).latencyMs}ms`
    : `Pulse API unreachable\n${
        (result as any).status
          ? `HTTP ${(result as any).status}`
          : (result as any).error || "network error"
      }\nLatency: ${(result as any).latencyMs}ms`;

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid var(--border, #333)",
        background: "rgba(0,0,0,0.35)",
        color: "var(--ink, #e5e7eb)",
        fontSize: 11,
        letterSpacing: ".06em",
        whiteSpace: "nowrap",
        fontFamily: "Audiowide, Orbitron, system-ui",
        textTransform: "uppercase",
      }}
      aria-label={`Pulse API ${ok ? "connected" : "offline"}`}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: dotColor,
          boxShadow: glow,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span style={{ opacity: 0.85 }}>{label}</span>
    </span>
  );
}
