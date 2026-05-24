// src/state/selectors/chips.ts
import { useSheetSnap } from "../sheetSnap";
import { selectOOB, type Pill } from "./oob";

export type Chip = {
  id: string;
  gate: "ENV" | "ROOT" | "IRR";
  severity: "ok" | "warn" | "bad";  // rank-based neon
  title: string;
  why: string;
  next: string;
};

function make(g: "ENV"|"ROOT"|"IRR", row: unknown, i: number): Chip {
  let label = "", why = "";
  if (Array.isArray(row)) {
    label = String((row as any)[0] ?? "");
    why   = String((row as any)[1] ?? "");
  } else if (row && typeof row === "object") {
    const r = row as Record<string, unknown>;
    label = String((r.label ?? r.name) ?? "");
    why   = String((r.why   ?? r.reason) ?? "");
  }
  return { id:`${g}-${i+1}`, gate:g, severity:"warn", title:label.trim(), why, next:"" };
}

function chipFromOOB(g: "ENV"|"ROOT"|"IRR", p: Pill, i: number): Chip {
  return {
    id: `${g}-oob-${i+1}`,
    gate: g,
    severity: p.sev === "bad" ? "bad" : "warn",
    title: p.text,
    why: `${p.metric} reading ${p.cond === "high" ? "above" : "below"} target band`,
    next: "",
  };
}

export function selectChips(latest: any, limit = 9): Chip[] {
  if (!latest) return [];
  const gates: Array<"ENV"|"ROOT"|"IRR"> = ["ENV","ROOT","IRR"];
  const perGate: Record<"ENV"|"ROOT"|"IRR", Chip[]> = { ENV:[], ROOT:[], IRR:[] };

  // OOB fallback source so we never end up with empty-titled chips
  const oob = selectOOB(latest);
  const oobByGate: Record<"ENV"|"ROOT"|"IRR", Pill[]> = {
    ENV: oob.env || [],
    ROOT: oob.root || [],
    IRR: oob.irr || [],
  };

  if (latest?.top3ByGate?.ENV || latest?.top3ByGate?.ROOT || latest?.top3ByGate?.IRR) {
    for (const G of gates) {
      const rows = latest.top3ByGate?.[G] as unknown[] | undefined;
      (rows ?? []).slice(0,3).forEach((r, i) => {
        const c = make(G, r, i);
        if (!c.title) {
          // Fall back to OOB pill at same position
          const p = oobByGate[G][i];
          if (p) {
            perGate[G].push(chipFromOOB(G, p, i));
          }
          return;
        }
        perGate[G].push(c);
      });
    }
  } else if (Array.isArray(latest?.top3) && latest.top3.length) {
    gates.forEach((G, gi) => {
      latest.top3.slice(gi*3, gi*3+3).forEach((r:any, i:number) => {
        const c = make(G, r, i);
        if (!c.title) {
          const p = oobByGate[G][i];
          if (p) perGate[G].push(chipFromOOB(G, p, i));
          return;
        }
        perGate[G].push(c);
      });
    });
  }

  // If still empty for a gate, hydrate from OOB directly so the rail
  // never silently disappears when the engine omits top3 rows.
  for (const G of gates) {
    if (perGate[G].length) continue;
    oobByGate[G].slice(0, 3).forEach((p, i) => {
      perGate[G].push(chipFromOOB(G, p, i));
    });
  }

  // rank → severity (0 ok / 1 warn / 2 bad), but preserve OOB-derived severity if already "bad"
  for (const G of gates) {
    perGate[G] = perGate[G].map((c, i) => {
      if (c.severity === "bad") return c; // OOB-derived
      const sev: "ok" | "warn" | "bad" = i === 0 ? "ok" : i === 1 ? "warn" : "bad";
      return { ...c, severity: sev };
    });
  }

  // Drop any chips that still have no title (defensive)
  const merged: Chip[] = [...perGate.ENV, ...perGate.ROOT, ...perGate.IRR].filter(
    (c) => !!c.title
  );
  return limit ? merged.slice(0, limit) : merged;
}

export function useChips(limit?: number){
  const latestWrite = useSheetSnap((s) => s.latestWrite);
  const latestRO    = useSheetSnap((s) => s.latest);
  const source = latestWrite ?? latestRO;               // use WRITE snapshot first
  const all = selectChips(source, limit ?? 9);

  // top1 = single highest-severity chip across gates, used by Cockpit "See all" toggle
  const sevRank = (s: Chip["severity"]) => (s === "bad" ? 0 : s === "warn" ? 1 : 2);
  const sorted = [...all].sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
  const top1 = sorted.length ? [sorted[0]] : [];
  const topIds = new Set(top1.map((c) => c.id));
  const rest = all.filter((c) => !topIds.has(c.id));

  // Backward compat: `top3` historically aliased to `all` (despite the name) and several
  // panels (InsightsTop3, ActionBar) consume it that way. Keep the alias.
  return { top1, rest, top3: all, all };
}
