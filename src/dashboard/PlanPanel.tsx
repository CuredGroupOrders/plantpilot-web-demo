// src/dashboard/PlanPanel.tsx
import { useState } from "react";
import { useChips } from "../state/selectors/chips";
import { useActions } from "../state/actions";

const ORDER: Array<"ENV" | "ROOT" | "IRR"> = ["ENV", "ROOT", "IRR"];
const BULLET = "\u2022";
const ARROW = "\u2192";

const normGate = (g?: string) => {
  const k = (g || "").trim().toUpperCase();
  if (k.startsWith("ENV")) return "ENV";
  if (k.startsWith("ROOT")) return "ROOT";
  if (k.startsWith("IRR")) return "IRR";
  return "UNKNOWN";
};

export default function PlanPanel() {
  const { all } = useChips(12); // room so IRR isn’t trimmed
  const acts = useActions((s) => s.list);

  const [toast, setToast] = useState("");
  const [expanded, setExpanded] = useState(false);

  const status = new Map(acts.map((a) => [a.chipId, a.status]));
  const mark = (id: string) => (status.get(id) === "done" ? "[x]" : "[ ]");

  // group by normalized gate
  const byGate: Record<string, NonNullable<typeof all>> = {};
  for (const c of all || []) (byGate[normGate(c.gate)] ||= []).push(c);

  // compose text
  const lines: string[] = [];
  for (const g of ORDER) {
    const list = byGate[g];
    if (!list?.length) continue;
    lines.push(`== ${g} ==`);
    for (const c of list) {
      const why = c.why?.trim() ? `: ${c.why.trim()}` : "";
      const next = c.next?.trim() ? ` ${ARROW} ${c.next.trim()}` : "";
      lines.push(`${BULLET} ${mark(c.id)} ${c.title}${why}${next}`);
    }
    lines.push("");
  }
  const text = lines.join("\n") || "No issues. Stay the course.";

  async function copyShare() {
    try {
      if (navigator.share) await navigator.share({ title: "Plan", text });
      else await navigator.clipboard.writeText(text);
      setToast("Copied");
      setTimeout(() => setToast(""), 1200);
    } catch {}
  }

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          position: "relative",
          background: "var(--panel,#000)",
          border: "1px solid var(--border,#00f7db)",
          borderRadius: 12,
          padding: 12,
          overflow: "hidden",
          boxShadow:
            "0 0 0 1px rgba(0,247,219,.25) inset, 0 0 24px rgba(0,247,219,.15)",
        }}
      >
        {/* HEADER (no CRT grid here) */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 800, letterSpacing: ".06em" }}>
            <span
              style={{
                display: "inline-block",
                padding: "6px 10px",
                border: "1px solid var(--border,#00f7db)",
                borderRadius: 10,
                color: "var(--ink,#00f7db)",
              }}
            >
              Possible Conditions — Address Immediately
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              style={{
                background: "var(--chip,#000)",
                color: "var(--ink,#00f7db)",
                border: "1px solid var(--border,#00f7db)",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
            <button
              onClick={copyShare}
              style={{
                background: "var(--chip,#000)",
                color: "var(--ink,#00f7db)",
                border: "1px solid var(--border,#00f7db)",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Copy/Share
            </button>
          </div>
        </div>

        {/* BODY: CRT grid only under content; collapses to 50vh with scroll */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxHeight: expanded ? "none" : "50vh",
            overflowY: expanded ? "visible" : "auto",
            padding: "8px 4px 4px",
            borderRadius: 10,
          }}
        >
          {/* grid overlay inside body only */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 0,
              borderRadius: "inherit",
              backgroundImage:
                "linear-gradient(rgba(0,247,219,.50) 1px, transparent 1px),linear-gradient(90deg, rgba(0,247,219,.50) 1px, transparent 1px)",
              backgroundSize: "26px 26px, 26px 26px",
              opacity: 0.5,
            }}
          />
          <pre
            style={{
              position: "relative",
              zIndex: 1,
              margin: 0,
              whiteSpace: "pre-wrap",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 14,
              lineHeight: 1.4,
              color: "var(--ink,#00f7db)",
              textShadow: "0 0 8px rgba(0,247,219,.2)",
            }}
          >
            {text}
          </pre>
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 64,
            background: "var(--chip,#000)",
            color: "var(--ink,#00f7db)",
            border: "1px solid var(--border,#00f7db)",
            borderRadius: 8,
            padding: "8px 12px",
            zIndex: 60,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
