import { apiUrl } from "../lib/apiUrl";
import { normalizeContainerGal } from "../lib/containerGal";

export type IrrSolvePlan = {
  ok: boolean;
  error?: string;
  solver_version?: string;
  sop_bundle_version?: string;
  w_refill_ml?: number;
  p1_required_day_ml?: number;
  p2_required_day_ml?: number;
  applied_req_ml_day?: number;
  demand_index?: number;
  dbPct_interval?: number;
  w_maint_event_ml?: number;
  p2_runoff_frac?: number;
  fc_vwc?: number;
  vwc_start?: number;
  v_media_ml?: number;
  warnings?: string[];
  coherence?: string[];
  actions?: {
    resetToSop?: Record<string, unknown>;
    keepUser?: Record<string, unknown>;
    applyReconciled?: Record<string, unknown>;
  };
  p1?: {
    events?: number;
    events_user?: number;
    ml_event_ideal?: number;
    ml_event_reconciled?: number;
    required_day_ml?: number;
    user_day_ml?: number;
  };
  p2?: {
    events?: number;
    events_user?: number;
    ml_event_ideal?: number;
    required_day_ml?: number;
    user_day_ml?: number;
  };
  media?: { media_ml?: number; fc_vwc?: number; vwc_start?: number };
  demand?: { demand_index?: number; demand_label?: string; dbPct_interval?: number };
};

export type RealityDeltaPayload = {
  ok: boolean;
  delta?: {
    user?: {
      p1_user_day_ml?: number;
      p1_required_day_ml?: number;
      p1_delta_day_ml?: number;
      p1_status?: string;
      p2_user_day_ml?: number;
      p2_required_day_ml?: number;
      p2_delta_day_ml?: number;
      p2_status?: string;
      estimated_runoff_frac?: number;
      runoff_target_frac?: number;
    };
  };
  demand_index?: number;
  w_refill_ml?: number;
};

export async function solveIrrDraft(
  intake: Record<string, unknown>,
  dirty?: string[]
): Promise<IrrSolvePlan> {
  const normalized = {
    ...intake,
    container: normalizeContainerGal(
      String(intake.container ?? intake.containerSize ?? "1"),
    ),
  };
  const r = await fetch(apiUrl("/sheet/irr/solveDraft"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intake: normalized, dirty }),
    cache: "no-store",
  });
  return (await r.json()) as IrrSolvePlan;
}

export async function fetchRealityDelta(intake?: Record<string, unknown>): Promise<RealityDeltaPayload> {
  const opts: RequestInit = { cache: "no-store" };
  if (intake && Object.keys(intake).length) {
    opts.method = "POST";
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify({ intake });
  }
  const r = await fetch(apiUrl("/sheet/reality-delta"), opts);
  if (!r.ok) throw new Error(`reality-delta ${r.status}`);
  return r.json();
}

export async function applyIrrPlan(body: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(apiUrl("/sheet/irr/apply"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function postRun(payload: {
  intake: Record<string, unknown>;
  evaluate?: unknown;
  irrPlan?: unknown;
  realityDelta?: unknown;
}): Promise<{ ok: boolean; id?: string }> {
  const r = await fetch(apiUrl("/v1/runs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}
