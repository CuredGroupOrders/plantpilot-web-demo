import { useMemo } from "react";
import { useSheetSnap } from "../sheetSnap";
import { selectOOB } from "./oob";
import type { GateKey, EnginePayload, Top3Row } from "../../api/sheet";

export type PrimaryConstraint = {
  gate: GateKey;
  label: string;
  why?: string;
  confidence: number; // 0..1
  evidence: string[];
  evidenceKeys?: string[]; // short strings
};

const ORDER: GateKey[] = ["ENV", "ROOT", "IRR"];

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function gatePctMap(latest: any): Record<GateKey, number> {
  const out: Record<GateKey, number> = { ENV: 0, ROOT: 0, IRR: 0 };

  // normalized form from api/sheet.evaluate(): raw.gatePct => [{gate,pct}] where pct is likely 0..1
  const list = (latest?.gatePct ?? []) as Array<{ gate: any; pct: any }>;
  if (Array.isArray(list) && list.length) {
    for (const x of list) {
      const g = String(x?.gate || "").toUpperCase() as GateKey;
      if (!out[g]) continue;
      const raw = Number(x?.pct);
      // accept either 0..1 or 0..100
      const pct = raw > 1.01 ? raw / 100 : raw;
      out[g] = clamp01(pct);
    }
    return out;
  }

  // fallback: sometimes engines expose scores 0..100
  const s = latest?.scores;
  if (s && typeof s === "object") {
    const env = Number((s as any).env);
    const root = Number((s as any).root);
    const irr = Number((s as any).irr);
    out.ENV = clamp01(env > 1.01 ? env / 100 : env);
    out.ROOT = clamp01(root > 1.01 ? root / 100 : root);
    out.IRR = clamp01(irr > 1.01 ? irr / 100 : irr);
  }

  return out;
}

function top3Rows(latest: any, gate: GateKey): Top3Row[] {
  const t3g = latest?.top3ByGate;
  const rows = (t3g && (t3g as any)[gate]) as unknown;
  return Array.isArray(rows) ? (rows as Top3Row[]) : [];
}

function summarizeLabel(rows: Top3Row[], gate: GateKey): string {
  const top = rows[0];
  const label = String(top?.[0] ?? "").trim();
  if (label) return label;
  return gate === "ENV"
    ? "Environmental instability"
    : gate === "ROOT"
    ? "Root-zone instability"
    : "Irrigation instability";
}

function inferEvidenceKeys(gate: GateKey, label: string, why?: string): string[] {
  const t = `${label || ""} ${why || ""}`.toLowerCase();

  // ENV
  if (gate === "ENV") {
    if (t.includes("vpd") || t.includes("humidity") || t.includes("rh") || t.includes("temp")) return ["vpdKpa","rh","tempC"];
    if (t.includes("ppfd") || t.includes("dli") || t.includes("light")) return ["ppfd","dliMol"];
    if (t.includes("co2")) return ["co2"];
    return ["vpdKpa","rh","tempC","ppfd","dliMol","co2"];
  }

  // ROOT
  if (gate === "ROOT") {
    if (t.includes("runoff ph") || (t.includes("ph") && t.includes("runoff"))) return ["runoffPh","reservoirPh"];
    if (t.includes("ph")) return ["reservoirPh","runoffPh"];
    if (t.includes("ec") || t.includes("salt") || t.includes("pwec")) return ["reservoirEc","pwec","runoffEc","deltaEc"];
    return ["runoffPh","reservoirPh","reservoirEc","pwec","runoffEc","deltaEc","runoffPct","vwcAtLastIrr"];
  }

  // IRR
  if (gate === "IRR") {
    if (t.includes("interval") || t.includes("events")) return ["p1IntervalMin","p1Events","p2IntervalMin","p2Events"];
    if (t.includes("dryback")) return ["drybackPct24h","targetAtFirst"];
    if (t.includes("vwc")) return ["vwcPct","vwcAtLastIrr"];
    return ["p1IntervalMin","p1Events","p2IntervalMin","p2Events","drybackPct24h","targetAtFirst","vwcPct"];
  }

  return [];
}
export function computePrimaryConstraint(latest: EnginePayload | any): PrimaryConstraint | null {
  if (!latest) return null;

  const pct = gatePctMap(latest);

  // OOB as "hard reality" signal (used for gate tie-break + proof)
  const o = selectOOB(latest);
  const oobCount: Record<GateKey, number> = {
    ENV: (o.env || []).length,
    ROOT: (o.root || []).length,
    IRR: (o.irr || []).length,
  };

  // Choose the worst gate by pct (lower = worse). Tie-breaker: more OOB.
  const ranked = ORDER
    .map((g) => ({ g, pct: pct[g] ?? 0, oob: oobCount[g] ?? 0 }))
    .sort((a, b) => (a.pct - b.pct) || (b.oob - a.oob));

  const worst = ranked[0];
  const second = ranked[1] ?? { pct: worst.pct, oob: 0 };

  const rows = top3Rows(latest, worst.g);

  // Primary MUST be a Top-3 flag (Top-1 in the winning gate)
  const top = rows[0];
  const topLabel = String(top?.[0] ?? "").trim();
  const topWhy   = String(top?.[1] ?? "").trim();

  const label = topLabel || summarizeLabel(rows, worst.g);
  const why = topWhy || undefined;

  // Evidence keys drive contextual OOB filtering in the UI
  const evidenceKeys = inferEvidenceKeys(worst.g, label, why);

  // Evidence: use already-formatted OOB pill texts (avoid ugly decimals)
  const oobList = worst.g === "ENV" ? (o.env || []) : worst.g === "ROOT" ? (o.root || []) : (o.irr || []);
  const evidence = oobList.slice(0, 3).map((p: any) => String(p?.text ?? "").trim()).filter(Boolean);

  // Confidence: separation + absolute badness + OOB load
  const sep = Math.max(0, (second.pct - worst.pct));
  const bad = Math.max(0, (0.85 - worst.pct));
  const oobBoost = Math.min(0.35, (worst.oob || 0) * 0.08);
  const confidence = clamp01((sep * 1.2) + (bad * 0.8) + oobBoost);

  return { gate: worst.g, label, why, confidence, evidence, evidenceKeys };
}

export function usePrimaryConstraint(): PrimaryConstraint | null {
  const snap = useSheetSnap((s) => (s.latestWrite ?? s.latest) as any);
  return useMemo(() => computePrimaryConstraint(snap), [snap]);
}







