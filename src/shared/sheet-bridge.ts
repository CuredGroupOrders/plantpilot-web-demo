// src/sheetBridge.ts
import * as XLSX from "xlsx";
import { key2label } from "../labels";

const URL = "/plant-pilot-v2.xlsx";

async function loadWB() {
  const r = await fetch(URL);
  if (!r.ok) throw new Error("failed to fetch workbook");
  const ab = await r.arrayBuffer();
  return XLSX.read(ab, { type: "array" });
}

export async function ping() {
  // Tighten parity with src/api/sheet.ts ping(): actually try to fetch the workbook
  // so the ConnectionPill reflects local-XLSX availability instead of always green.
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  try {
    const r = await fetch(URL, { method: "HEAD", cache: "no-store" });
    const latencyMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0));
    if (!r.ok) {
      return { ok: false as const, status: r.status, latencyMs, ts: Date.now(), version: "LOCAL-XLSX" };
    }
    return { ok: true as const, ts: Date.now(), version: "LOCAL-XLSX", latencyMs };
  } catch (e: any) {
    const latencyMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0));
    return { ok: false as const, error: String(e?.message || e), latencyMs, ts: Date.now(), version: "LOCAL-XLSX" };
  }
}

export async function fetchOptions() {
  const wb = await loadWB();
  const ws = wb.Sheets["LISTS"];
  if (!ws) return {};
  const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  const headers = (json[0] || []).map((x: any) => String(x || "").trim());
  const out: Record<string, string[]> = {};
  for (let c = 0; c < headers.length; c++) {
    const name = headers[c];
    if (!name) continue;
    const col: string[] = [];
    for (let r = 1; r < json.length; r++) {
      const v = json[r]?.[c];
      if (v !== "" && v != null) col.push(String(v));
    }
    out[name] = col;
  }
  return out;
}

export type EvaluatePayload = Record<string, string | number>;

export function buildSheetPayload(intake: any, opts?: { includeLabels?: boolean }) {
  const p: Record<string, any> = {};
  const set = (k: string, v: any) => {
    if (v !== undefined && v !== null && v !== "") p[k] = v;
  };

  // context
  set("stage", intake?.stage);
  set("stagePhase", intake?.stagePhase);
  set("medium", intake?.medium);
  set("container", intake?.containerSize ?? intake?.container);
  set("co2Mode", intake?.co2Mode);
  set("lightcycle", intake?.lightcycle);
  set("photoperiodH", intake?.photoperiodH);

  // ENV
  set("tempC", intake?.tempC ?? intake?.canopyTempC);
  set("rh", intake?.rh);
  set("vpdKpa", intake?.vpdKpa);
  set("ppfd", intake?.ppfd);
  set("dliMol", intake?.dliMol);
  set("co2", intake?.co2);

  // ROOT
  set("runoffPh", intake?.runoffPh);
  set("runoffPct", intake?.runoffPct);
  set("reservoirEc", intake?.reservoirEc);
  set("reservoirPh", intake?.reservoirPh);
  set("reservoirTempC", intake?.reservoirTempC);
  set("pwec", intake?.pwec ?? intake?.runoffEc);
  set("vwcAtLastIrr", intake?.vwcAtLastIrr);
  set("runoffEc", intake?.runoffEc);

  // IRR
  set("drybackPct24h", intake?.drybackPct24h);
  set("targetAtFirst", intake?.targetAtFirst);
  set("p1Events", intake?.p1Events);
  set("p1IntervalMin", intake?.p1IntervalMin);
  set("p1Pct", intake?.p1Pct);
  set("p1MlPerEvent", intake?.p1MlPerEvent);
  set("p2Events", intake?.p2Events);
  set("p2IntervalMin", intake?.p2IntervalMin);
  set("p2Pct", intake?.p2Pct);
  set("p2MlPerEvent", intake?.p2MlPerEvent);

  if (opts?.includeLabels) {
    // Use the shared key2label so the local XLSX path emits the same column labels
    // as the GAS endpoint instead of raw camelCase keys.
    const labels: Record<string, string | number> = {};
    for (const k of Object.keys(p)) {
      const label = key2label[k] || k;
      const v = p[k];
      if (v == null || v === "") continue;
      labels[label] = typeof v === "number" ? v : String(v);
    }
    if (intake?.labels && typeof intake.labels === "object") {
      Object.assign(labels, intake.labels);
    }
    p["labels"] = labels;
  }
  return p;
}

export async function evaluate(_payload: EvaluatePayload = {}) {
  // stub keeps UI responsive in local XLSX mode
  return {
    version: "LOCAL-XLSX",
    gatePct: [{ gate: "ENV", pct: 0 }, { gate: "ROOT", pct: 0 }, { gate: "IRR", pct: 0 }],
    top3ByGate: { ENV: [], ROOT: [], IRR: [] },
    gateStatus: [
      { gate: "ENV", status: "OK" },
      { gate: "ROOT", status: "OK" },
      { gate: "IRR", status: "OK" },
    ],
  };
}

export async function postIntake(intake: any) {
  const payload = buildSheetPayload(intake, { includeLabels: true });
  const res = await evaluate(payload);
  return { ...res, summary: { applied: [], skipped: [] } };
}


export async function writeOnce(){
  console.warn("writeOnce() stub: wire your real submit if needed");
  return null;
}
