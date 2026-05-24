// src/dashboard/ChipRail.tsx
import { useChips } from "../state/selectors/chips";
import { useActions } from "../state/actions";

const ORDER: Array<"ENV" | "ROOT" | "IRR"> = ["ENV", "ROOT", "IRR"];

const pillClass = (sev: string) =>
  `chip ${
    sev === "bad"
      ? "chip-bad"
      : sev === "warn"
      ? "chip-warn"
      : sev === "ok"
      ? "chip-ok"
      : "chip-ok"
  } sm`;

export default function ChipRail() {
  // The "primary" chip is rendered by PrimaryConstraintCard; this rail shows everything else.
  const { rest } = useChips(12);
  const { list: acts, queue } = useActions();

  if (!rest.length) {
    return null;
  }

  const status = new Map(acts.map((a) => [a.chipId, a.status]));

  // group remaining chips by gate
  const byGate: Record<string, typeof rest> = {};
  for (const c of rest) (byGate[c.gate] ||= []).push(c);

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 12,
        }}
      >
        {ORDER.map((g) => {
          const list = byGate[g] || [];
          return (
            <div
              key={g}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div
                style={{
                  fontFamily: "Audiowide, Orbitron, system-ui",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#00f7db",
                  marginBottom: 8,
                }}
              >
                {g} GATE
              </div>

              {list.length === 0 && (
                <div style={{ color: "#9ca3af", fontSize: 12 }}>
                  No additional chips.
                </div>
              )}

              {list.map((c) => {
                const st = status.get(c.id);
                const isQueued = st === "queued";
                const isDone = st === "done";
                const label = isDone ? "Done" : isQueued ? "Queued" : "Apply";

                return (
                  <div key={c.id} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      {/* neon pill with clamped text */}
                      <span className={pillClass(c.severity)} title={c.title}>
                        <span className="chip-label">{c.title}</span>
                      </span>

                      <button
                        type="button"
                        disabled={isQueued || isDone}
                        aria-disabled={isQueued || isDone}
                        onClick={() => queue(c)}
                        style={{
                          background: "var(--chip)",
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          padding: "4px 8px",
                          cursor: isQueued || isDone ? "not-allowed" : "pointer",
                          opacity: isQueued || isDone ? 0.6 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </button>
                    </div>

                    {c.why && (
                      <div
                        style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}
                      >
                        {c.why}
                      </div>
                    )}
                    {c.next && (
                      <div
                        style={{ color: "#34d399", fontSize: 12, marginTop: 2 }}
                      >
                        Do this: {c.next}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
