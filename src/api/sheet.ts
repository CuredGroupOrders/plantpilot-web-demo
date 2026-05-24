// src/api/sheet.ts
import { apiUrl as sidecarUrl, gasUrl } from "../lib/apiUrl";
import { mergeSopProfileList } from "../lib/sopProfiles";

/* ===== Types ===== */
export type GateKey = "ENV" | "ROOT" | "IRR";
export type Top3Row = [string, string, number];
export type GatePct = { gate: GateKey; pct: number };
export type Top3ByGate = Record<GateKey, Top3Row[]>;
export type GateItem = { gate: GateKey; id: string; label: string; why: string; score: number };

export type EnginePayload = {
  ok?: boolean;
  version?: string;
  summary?: { applied?: Array<{ label: string; row: number; col: number; value: any }>; skipped?: any[] };
  gatePct?: Array<{ gate: string; pct: number }>;
  top3ByGate?: { ENV?: Top3Row[]; ROOT?: Top3Row[]; IRR?: Top3Row[] };
  top3?: GateItem[];
  gateStatus?: Array<{ gate: string; status: string }>;
  scores?: { env: number; root: number; irr: number };
  gates?: any;
};

/* ===== Nutrient recipe types ===== */
export type NutrientBottle = {
  bottle_id: string;
  bottle_label: string;
  ml_per_gal: number | "" | null;
  cleanse_min_ml_per_gal?: number | null;
  cleanse_max_ml_per_gal?: number | null;
};

export type NutrientRecipe = {
  enabled: boolean;
  line_id?: string;
  line_label?: string;
  brand?: string;
  sop_profile?: string;
  stage_id?: string;
  phase_block?: string;
  week_index?: number;
  week_index_start?: number | null;
  week_index_end?: number | null;
  ec_target?: number | null;
  ppm_500?: number | null;
  ppm_700?: number | null;
  ph_min?: number | null;
  ph_max?: number | null;
  bottles?: NutrientBottle[];
  notes?: string;
  reason?: string;
  version?: string;
};

/* ===== Label map =====
 * The single source of truth lives at src/labels.ts. Re-export under the legacy
 * name so existing call sites keep working. */
import { key2label as KEY_TO_LABEL } from "../labels";

function toLabels(obj: Record<string, any>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const k of Object.keys(obj || {})) {
    const v = obj[k];
    if (v === undefined || v === null) continue; // allow "" through
    const label = KEY_TO_LABEL[k] || k;
    out[label] = typeof v === "number" ? v : String(v);
  }
  return out;
}

/* ===== R&D types (photos, notes, runs) ===== */

export type RnDPhotoRecord = {
  log_id: string;
  experiment_id: string;
  group_id: string;
  captured_at: string;
  view: string;
  tag: string;
  note: string;
  photo_ref: string;
  env_gate_score: number | "" | null;
  root_gate_score: number | "" | null;
  irr_gate_score: number | "" | null;
  env_flags_keys: string;
  root_flags_keys: string;
  irr_flags_keys: string;
  // NEW metric metadata (optional on older rows)
  slot_index?: number | "" | null;
  metric_label?: string;
  metric_units?: string;
  metric_value?: number | "" | null;
};

export interface RnDPhotoAppendRequest {
  log_id: string;
  experiment_id: string;
  group_id: string;
  captured_at?: string;
  view?: string;
  tag?: string;
  note?: string;
  photo_ref: string;
  env_gate_score?: number;
  root_gate_score?: number;
  irr_gate_score?: number;
  env_flags_keys?: string;
  root_flags_keys?: string;
  irr_flags_keys?: string;
  // NEW metric metadata
  slot_index?: number;
  metric_label?: string;
  metric_units?: string;
  metric_value?: number;
}

export interface RnDPhotoDeleteRequest {
  log_id?: string;
  experiment_id: string;
  group_id: string;
  captured_at: string;
  photo_ref: string;
}

export type RnDPhotosResponse = {
  ok: boolean;
  experimentId: string;
  groupId: string;
  logId: string;
  photos: RnDPhotoRecord[];
  version?: string;
};

export type RnDNoteRecord = {
  experiment_id: string;
  group_id: string;
  date_key: string; // "YYYY-MM-DD"
  run_key: string;
  note_text: string;
};

export type RnDRunRecord = {
  run_key: string;
  experiment_id: string;
  group_id: string;
  cfg_token: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type RnDSymActivePayload = {
  runKey: string;
  experimentId: string;
  groupId: string;
  symptoms: string[]; // SymKey[]
};

export type RnDSymLogPayload = {
  experimentId: string;
  groupId: string;
  runKey: string;
  dateKey: string;    // "YYYY-MM-DD"
  symptoms: string[]; // SymKey[]
};


/* ===== Restore list normalization (old version) ===== */
export async function fetchOptions(): Promise<Record<string, string[]>> {
  const r = await fetch(gasUrl("mode=options"), { cache: "no-store" });
  const j = await r.json().catch(() => ({} as any));
  const raw: Record<string, any[]> = j?.options ?? {};

  const norm = (s: string) =>
    s.toLowerCase().replace(/[\s_\-\(\)\[\]{}:+°%/\\\.]/g, "");

  const cols = Object.entries(raw).map(([k, v]) => ({
    nk: norm(k),
    vals: (Array.isArray(v) ? v : []).map(String).filter(Boolean),
  }));
  const by = new Map(cols.map((c) => [c.nk, c.vals]));
  const pick = (...names: string[]) => {
    for (const n of names) {
      const a = by.get(norm(n));
      if (a?.length) return a;
    }
    return [];
  };
  const has = (a: string[], ...re: RegExp[]) => a.some((s) => re.some((rx) => rx.test(s)));
  const looksStage = (a: string[]) => has(a, /\bveg\b/i, /\bbloom\b/i, /\bflush\b/i);
  const looksMedium = (a: string[]) => has(a, /\bcoco\b/i, /\brockwool\b/i, /\bsoil\b/i, /\bdwc\b/i);
  const looksLC = (a: string[]) => has(a, /\bday\b/i) && has(a, /\bnight\b/i);

  let stagePhase = pick("StagePhase", "Stage", "Growth Stage", "Phase");
  if (!stagePhase.length) stagePhase = cols.find((c) => looksStage(c.vals))?.vals ?? [];

  let medium = pick("Media", "Medium", "Substrate");
  if (!medium.length) medium = cols.find((c) => looksMedium(c.vals))?.vals ?? [];

  let containerSize = pick("Container_gal", "Container (gal)", "Container", "Pot Size", "Bed");

  let co2Mode = pick("CO2 mode", "CO2 Mode", "CO2mode");
  if (!co2Mode.length) co2Mode = ["ambient", "co2"];

  let lightcycle = pick("Lightcycle", "Light Cycle");
  if (!lightcycle.length) lightcycle = cols.find((c) => looksLC(c.vals))?.vals ?? ["Day", "Night"];
  lightcycle = lightcycle.map((v) => {
    const s = String(v).trim().toLowerCase();
    if (s === "day") return "Day";
    if (s === "night") return "Night";
    return String(v).trim();
  });

  let photoperiodH = pick("Photoperiod (h)", "Photoperiod");
  if (!photoperiodH.length) photoperiodH = ["12", "18"];

  // SOP profile list – prefer plural naming; fallback when GAS/options empty (v6 sidecar)
  let sopProfile = pick("sop_profiles", "SOP profiles", "SOP profile", "Profile", "Profiles", "sop_profile");
  sopProfile = mergeSopProfileList(sopProfile);

  const options = { stagePhase, medium, containerSize, co2Mode, lightcycle, photoperiodH, sopProfile };
  (window as any).__LIST_OPTIONS = options;
  return options;
}

/* ===== cfg + targets ===== */
export async function fetchCfg(): Promise<any> {
  const r = await fetch(gasUrl("mode=cfg"), { cache: "no-store" });
  return r.json().catch(() => ({} as any));
}

export async function fetchTargets(): Promise<Record<string, number>> {
  const r = await fetch(gasUrl("mode=targets"), { cache: "no-store" });
  const j = await r.json().catch(() => ({} as any));
  return (j?.targets ?? {}) as Record<string, number>;
}

export async function applyConfig(ctx: any, forceReset = false) {
  const res = await fetch(gasUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "applyConfig", ctx, forceReset }),
  });

  if (!res.ok) {
    throw new Error(`applyConfig ${res.status}`);
  }
  return res.json();
}
/* ===== Nutrient recipe lookup ===== */
export async function fetchNutrientRecipe(
  sopProfile: string,
  stageId: string
): Promise<NutrientRecipe> {
  const params = new URLSearchParams({
    mode: "nutrientRecipe",
    sop_profile: sopProfile,
    stage_id: stageId,
  });

  const r = await fetch(gasUrl(params.toString()), { cache: "no-store" });
  if (!r.ok) {
    return { enabled: false, reason: `http_${r.status}` };
  }
  const j = await r.json().catch(() => ({} as any));
  if (!j || typeof j !== "object") {
    return { enabled: false, reason: "bad_json" };
  }
  return j as NutrientRecipe;
}

function normalizeEvaluatePayload(raw: EnginePayload): EnginePayload {

  const gatePct: GatePct[] = (raw.gatePct || []).map((x: any) => ({
    gate: String(x.gate).toUpperCase() as GateKey,
    pct: Number(x.pct) || 0,
  }));
  const t3g: Top3ByGate = {
    ENV: (raw.top3ByGate?.ENV || []) as Top3Row[],
    ROOT: (raw.top3ByGate?.ROOT || []) as Top3Row[],
    IRR: (raw.top3ByGate?.IRR || []) as Top3Row[],
  };
  const flat: GateItem[] = (["ENV", "ROOT", "IRR"] as const).flatMap((g) =>
    (t3g[g] || []).map((r, i) => ({
      gate: g,
      id: `${g}-${i + 1}`,
      label: String(r?.[0] ?? ""),
      why: String(r?.[1] ?? ""),
      score: Number(r?.[2] ?? 0),
    }))
  );

  return { ...raw, gatePct, top3ByGate: t3g, top3: flat, version: raw.version ?? "growroom-engine" };
}

/* ===== Evaluate (local growroom-engine via sidecar; GAS optional) ===== */
export async function evaluate(
  ui: Record<string, string | number>,
  apply: 0 | 1 = 1
): Promise<EnginePayload> {
  const intake = toLabels(ui);
  try {
    const r = await fetch(sidecarUrl("/v1/evaluate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake, apply }),
      cache: "no-store",
    });
    if (r.ok) {
      const raw = (await r.json()) as EnginePayload;
      return normalizeEvaluatePayload(raw);
    }
  } catch {
    /* fall through to /gas when sidecar unreachable */
  }
  const labels = encodeURIComponent(JSON.stringify(intake));
  const res = await fetch(
    gasUrl(`mode=evaluate&apply=${apply}&labels=${labels}`),
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`engine ${res.status}`);
  const raw = (await res.json()) as EnginePayload;
  return normalizeEvaluatePayload(raw);
}

/* ===== Utilities ===== */
export async function evaluateRO(ui: Record<string, string | number>) {
  return evaluate(ui, 0);
}

export async function ping(): Promise<
  | { ok: true; version: string; latencyMs: number }
  | { ok: false; status?: number; error?: string; latencyMs: number }
> {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  try {
    const r = await fetch(gasUrl("mode=ping"), { cache: "no-store" });
    const latencyMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0));
    if (!r.ok) {
      return { ok: false as const, status: r.status, latencyMs };
    }
    const j = await r.json().catch(() => ({} as any));
    return { ok: true as const, version: String(j?.version ?? "GSHEETS"), latencyMs };
  } catch (e: any) {
    const latencyMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0));
    return { ok: false as const, error: String(e?.message || e), latencyMs };
  }
}

export function pctOf(g: GateKey, list: GatePct[]) {
  const n = list.find((x) => x.gate === g)?.pct ?? 0;
  const v = typeof n === "number" ? n : Number(n);
  const pct = Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(100, Math.round(pct * 100)));
}

/* ===== Legacy shims ===== */
export type EvaluateResult = EnginePayload;

export async function postIntake(payload: any) {
  if (payload?.intake && typeof payload.intake === "object")
    return evaluate(payload.intake as Record<string, string | number>, 1);
  if (payload && typeof payload === "object")
    return evaluate(payload as Record<string, string | number>, 1);
  return evaluate({}, 1);
}

export function buildSheetPayload(intake: Record<string, any>) {
  return intake || {};
}
export async function getIntakeContext() {
  return { mode: "automation" };
}
export async function getModeOptions() {
  return ["automation", "handwater"];
}

/* ===== Symptoms + SYM_* named ranges (read-only UI) ===== */
export type Symptom = { key: string; checked: boolean };

async function getJSON(u: string) {
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Mirrors Intake!D:E. Prefers ?mode=symptoms, falls back to INTAKE_SYM_* named ranges. */
export async function fetchSymptoms(): Promise<Symptom[]> {
  try {
    const r = await getJSON(gasUrl("mode=symptoms"));
    if (r?.items && Array.isArray(r.items)) return r.items as Symptom[];
  } catch {}
  const names = encodeURIComponent("INTAKE_SYM_KEYS,INTAKE_SYM_FLAGS");
  const r = await getJSON(gasUrl(`mode=nrs&names=${names}`)).catch(() => ({} as any));
  const keys: string[] = (r?.ranges?.INTAKE_SYM_KEYS ?? [])
    .flat()
    .map((x: any) => String(x || ""))
    .filter(Boolean);
  const flags: any[] = (r?.ranges?.INTAKE_SYM_FLAGS ?? []).flat();
  return keys.map((k, i) => ({ key: k, checked: !!flags[i] }));
}

/** Toggle a single symptom checkbox in Intake!E for the given key from Intake!D. */
export async function setSymptom(key: string, checked: boolean): Promise<void> {
  const res = await fetch(gasUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptoms: { map: { [key]: checked } } }),
  });
  if (!res.ok) throw new Error(await res.text());
}

/** Read the 9 named ranges into simple arrays for the UI. Falls back to evaluate() if needed. */
export type SymTop3Payload = {
  envTop3: Top3Row[];
  rootTop3: Top3Row[];
  irrTop3: Top3Row[];
  envChips: string[];
  rootChips: string[];
  irrChips: string[];
  envScores: number[];
  rootScores: number[];
  irrScores: number[];
};

export async function fetchSymTop3(): Promise<SymTop3Payload> {
  const names = [
    "SYM_ENV_TOP3",
    "SYM_ROOT_TOP3",
    "SYM_IRR_TOP3",
    "SYM_ENV_CHIPS_TOP3",
    "SYM_ROOT_CHIPS_TOP3",
    "SYM_IRR_CHIPS_TOP3",
    "SYM_ENV_SCORES_TOP3",
    "SYM_ROOT_SCORES_TOP3",
    "SYM_IRR_SCORES_TOP3",
  ].join(",");
  try {
    const r = await getJSON(gasUrl(`mode=nrs&names=${encodeURIComponent(names)}`));
    const R = (n: string) => (r?.ranges?.[n] || []) as any[][];
    const takeTop3 = (m: any[][]): Top3Row[] =>
      m.slice(0, 3).map((row) => [String(row?.[0] ?? ""), String(row?.[1] ?? ""), Number(row?.[2] ?? 0)]);
    const col1 = (m: any[][]) => m.flat().map((x) => String(x || "")).filter(Boolean);
    const colNum = (m: any[][]) => m.flat().map((x) => Number(x)).filter((n) => Number.isFinite(n));

    return {
      envTop3: takeTop3(R("SYM_ENV_TOP3")),
      rootTop3: takeTop3(R("SYM_ROOT_TOP3")),
      irrTop3: takeTop3(R("SYM_IRR_TOP3")),
      envChips: col1(R("SYM_ENV_CHIPS_TOP3")),
      rootChips: col1(R("SYM_ROOT_CHIPS_TOP3")),
      irrChips: col1(R("SYM_IRR_CHIPS_TOP3")),
      envScores: colNum(R("SYM_ENV_SCORES_TOP3")),
      rootScores: colNum(R("SYM_ROOT_SCORES_TOP3")),
      irrScores: colNum(R("SYM_IRR_SCORES_TOP3")),
    };
  } catch {
    const raw = await evaluate({}, 0);
    const pull = (g: GateKey) => (raw.top3ByGate?.[g] ?? []) as Top3Row[];
    return {
      envTop3: pull("ENV"),
      rootTop3: pull("ROOT"),
      irrTop3: pull("IRR"),
      envChips: [],
      rootChips: [],
      irrChips: [],
      envScores: pull("ENV").map((r) => r?.[2] ?? 0),
      rootScores: pull("ROOT").map((r) => r?.[2] ?? 0),
      irrScores: pull("IRR").map((r) => r?.[2] ?? 0),
    };
  }
}

/* ===== R&D summary + snapshot ===== */

export type RDSummaryFlag = {
  name: string;
  gate: string;
  count: number;
  soft_warning?: string;
};

export type RDSummaryGroup = {
  envScoreAvg: number | null;
  rootScoreAvg: number | null;
  irrScoreAvg: number | null;
  snapshots: number;
  flags: RDSummaryFlag[];
};

export type RDSummary = {
  ok: boolean;
  experimentId: string;
  groups: Record<string, RDSummaryGroup>;
  version?: string;
};

export async function fetchRDSummary(experimentId: string): Promise<RDSummary> {
  const params = new URLSearchParams({ mode: "rdSummary", experimentId });
  const res = await fetch(gasUrl(params.toString()), { cache: "no-store" });
  const json = await res.json().catch(() => ({} as any));
  return json as RDSummary;
}

export type RDSnapshotOverrides = Record<string, string | number | boolean | null>;

export async function postRDSnapshot(args: {
  experimentId: string;
  groupId: string;
  overrides: RDSnapshotOverrides;
}): Promise<any> {
  const params = new URLSearchParams({ mode: "rdSnapshot" });
  const res = await fetch(gasUrl(params.toString()), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rdSnapshot ${res.status}`);
  return res.json();
}

/* ===== R&D photos (external RND_PHOTOS sheet) ===== */

export async function fetchRnDPhotos(params: {
  experimentId: string;
  groupId?: string;
  logId?: string;
}): Promise<RnDPhotosResponse> {
  const search = new URLSearchParams({ mode: "rdPhotos", experimentId: params.experimentId });
  if (params.groupId) search.set("groupId", params.groupId);
  if (params.logId) search.set("logId", params.logId);

  const res = await fetch(gasUrl(search.toString()), { cache: "no-store" });
  const json = await res.json().catch(() => ({} as any));

  const photosRaw = Array.isArray(json.photos) ? json.photos : [];

  return {
    ok: !!json.ok,
    experimentId: String(json.experimentId || params.experimentId),
    groupId: String(json.groupId || params.groupId || ""),
    logId: String(json.logId || params.logId || ""),
    photos: photosRaw as RnDPhotoRecord[],
    version: json.version,
  };
}

export async function appendRnDPhoto(
  record: RnDPhotoAppendRequest
): Promise<{ ok: boolean; log_id?: string; experiment_id?: string; group_id?: string; row?: number; version?: string }> {
  const res = await fetch(gasUrl("mode=rdPhoto"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`rdPhoto ${res.status}`);
  const json = await res.json().catch(() => ({} as any));
  return json;
}

export async function deleteRnDPhoto(
  req: RnDPhotoDeleteRequest
): Promise<{ ok: boolean; deletedRow?: number; reason?: string; version?: string }> {
  const res = await fetch(gasUrl("mode=rdPhotoDelete"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`rdPhotoDelete ${res.status}`);
  const json = await res.json().catch(() => ({} as any));
  return json;
}

/* ===== R&D notes (external RND_NOTES sheet) ===== */

export async function fetchRNDNotes(params: {
  experimentId: string;
  groupId?: string;
}): Promise<RnDNoteRecord[]> {
  const qs = new URLSearchParams({
    mode: "rdNotes",
    experimentId: params.experimentId,
  });
  if (params.groupId) {
    qs.set("groupId", params.groupId);
  }
  const res = await fetch(gasUrl(qs.toString()), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch R&D notes");
  const json = await res.json().catch(() => ({} as any));
  const list = Array.isArray(json?.notes) ? json.notes : [];
  return list as RnDNoteRecord[];
}

export async function postRNDNote(payload: {
  experimentId: string;
  groupId: string;
  dateKey: string; // "YYYY-MM-DD"
  runKey: string;
  noteText: string;
}): Promise<void> {
  const body = {
    mode: "rdNote",
    experimentId: payload.experimentId,
    groupId: payload.groupId,
    dateKey: payload.dateKey,
    runKey: payload.runKey,
    noteText: payload.noteText,
  };
  const res = await fetch(gasUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn("postRNDNote failed", await res.text().catch(() => ""));
  }
}

/* ===== R&D runs (external RND_RUNS sheet) ===== */

export async function fetchRDRuns(experimentId: string): Promise<RnDRunRecord[]> {
  const qs = new URLSearchParams({
    mode: "rdRuns",
    experimentId,
  });
  const res = await fetch(gasUrl(qs.toString()), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch R&D runs");
  const json = await res.json().catch(() => ({} as any));
  const list = Array.isArray(json?.runs) ? json.runs : [];
  return list as RnDRunRecord[];
}

export async function fetchAllRDRuns(): Promise<RnDRunRecord[]> {
  const qs = new URLSearchParams({
    mode: "rdRunsAll",
  });
  const res = await fetch(gasUrl(qs.toString()), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch all R&D runs");
  const json = await res.json().catch(() => ({} as any));
  const list = Array.isArray(json?.runs) ? json.runs : [];
  return list as RnDRunRecord[];
}

export async function updateRDRunStatus(params: {
  experimentId: string;
  groupId: string;
  cfgToken: string;
  status: "draft" | "active" | "finished";
}): Promise<void> {
  const res = await fetch(gasUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      mode: "rdRunStatus",
      experimentId: params.experimentId,
      groupId: params.groupId,
      cfgToken: params.cfgToken,
      status: params.status,
    }),
  });
  if (!res.ok) {
    console.warn("updateRDRunStatus failed", await res.text().catch(() => ""));
  }
}

/* ===== R&D symptoms ===== */

export async function postRDSymActive(payload: RnDSymActivePayload): Promise<void> {
  const res = await fetch(gasUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      mode: "rdSymActive",
      runKey: payload.runKey,
      experimentId: payload.experimentId,
      groupId: payload.groupId,
      symptoms: payload.symptoms,
    }),
  });
  if (!res.ok) {
    console.warn("postRDSymActive failed", await res.text().catch(() => ""));
  }
}

export async function postRDSymLog(payload: RnDSymLogPayload): Promise<void> {
  const res = await fetch(gasUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      mode: "rdSymLog",
      experimentId: payload.experimentId,
      groupId: payload.groupId,
      runKey: payload.runKey,
      dateKey: payload.dateKey,
      symptoms: payload.symptoms,
    }),
  });
  if (!res.ok) {
    console.warn("postRDSymLog failed", await res.text().catch(() => ""));
  }
}


/* ===== Default export ===== */
export default {
  evaluate,
  evaluateRO,
  postIntake,
  fetchOptions,
  buildSheetPayload,
  getIntakeContext,
  getModeOptions,
  ping,
  pctOf,
  fetchSymptoms,
  setSymptom,
  fetchSymTop3,
  fetchCfg,
  fetchTargets,
  applyConfig,
  fetchNutrientRecipe,
  fetchRDSummary,
  postRDSnapshot,
  fetchRnDPhotos,
  appendRnDPhoto,
  deleteRnDPhoto,
};

/** WRITE eval: guarantees apply=1 and exposes window.__lastEval for debugging */
export async function evaluateWrite(payload: any) {
  const body = { ...(payload || {}), apply: 1 };
  const r = await fetch((import.meta as any).env.VITE_SHEET_EXEC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "follow",
    mode: "cors",
    keepalive: false,
  });
  if (!r.ok) throw new Error("evaluateWrite " + r.status);
  const j = await r.json();
  try {
    (window as any).__lastEval = j;
  } catch {}
  return j;
}
