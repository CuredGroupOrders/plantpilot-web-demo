export type RunStatus = "draft" | "active" | "finished";

export type ExperimentRunSummary = {
  runKey: string;
  experimentId: string;
  groupId: string;
  cfgToken: string;
  status: RunStatus;
};

type Props = {
  experimentId: string;
  runs: ExperimentRunSummary[];
  currentRunKey: string;
  onSelectRun?: (run: ExperimentRunSummary) => void;
};

function statusChipColor(status: RunStatus): string {
  if (status === "active") return "rgba(34,197,163,0.95)";      // green/cyan
  if (status === "finished") return "rgba(148,163,184,0.95)";   // grey
  return "rgba(234,179,8,0.95)";                                // amber draft
}

export default function ExperimentRunsPanel({
  experimentId,
  runs,
  currentRunKey,
  onSelectRun,
}: Props) {
  if (!experimentId) return null;

      return (
    <section
      className="card"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        border: "1px solid var(--border)",
        background:
          "radial-gradient(circle at 0 0, rgba(0,247,219,.12), transparent 45%), #020508",
        marginBottom: 16,
      }}
    >
      {/* caution stripe layer, same as R&D test flight */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.07,
          backgroundImage:
            "repeating-linear-gradient(45deg, #000 0, #000 6px, #facc15 6px, #facc15 12px)",
          mixBlendMode: "screen",
        }}
      />

      {/* actual content sits above stripes */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "Audiowide, Orbitron, system-ui",
                fontSize: 11,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                opacity: 0.9,
              }}
            >
              Experiment Folder
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.75,
                marginTop: 2,
              }}
            >
              {experimentId} · {runs.length || 0} runs
            </div>
          </div>
        </div>

        {runs.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            No runs recorded yet for this experiment. Once the engine wiring is
            in place, finished and active runs will show here as cards.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 8,
              fontSize: 11,
            }}
          >
            {runs.map((r) => {
              const isCurrent = r.runKey === currentRunKey;
              const color = statusChipColor(r.status);

              return (
                              <div
                key={r.runKey}
                onClick={onSelectRun ? () => onSelectRun(r) : undefined}
                style={{
                  borderRadius: 12,
                  border: isCurrent
                    ? "1px solid rgba(0,247,219,0.7)"
                    : "1px solid rgba(31,41,55,0.9)",
                  background: isCurrent
                    ? "radial-gradient(circle at 0 0, rgba(0,247,219,0.14), rgba(15,23,42,0.98))"
                    : "rgba(15,23,42,0.96)",
                  padding: 8,
                  cursor: onSelectRun ? "pointer" : "default",
                }}
              >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                      gap: 6,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: ".12em",
                          opacity: 0.8,
                        }}
                      >
                        {r.groupId}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          opacity: 0.7,
                        }}
                      >
                        cfg: {r.cfgToken.slice(0, 24)}
                        {r.cfgToken.length > 24 ? "…" : ""}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        backgroundColor: color,
                        color: "#020617",
                        boxShadow: `0 0 8px ${color}`,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".12em",
                        fontSize: 9,
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                  {isCurrent && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        opacity: 0.8,
                      }}
                    >
                      Currently loaded in R&amp;D.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
