import * as Sheet from "../api/sheet";
import type { BaselineSnapshot, Top3FlagRow } from "../types/baselineSnapshot";
import { computePrimaryConstraint } from "../state/selectors/primaryConstraint";
import { selectOOB } from "../state/selectors/oob";
import { useHistory } from "../state/history";
import { useSheetSnap } from "../state/sheetSnap";
import {
  fetchRealityDelta,
  postRun,
  solveIrrDraft as fetchIrrSolve,
} from "../api/irr";
import { publishWire } from "../shared/wire";
import {
  buildEffectivePayload,
  clamp100,
  setLastIntake,
  type ConfigContext,
  type Intake,
} from "./helpers";

export async function submitIntakeDraft(
  draft: Intake,
  opts: {
    targets: Record<string, number>;
    cfgKey: string | null;
    report: { progress: (n: number, msg?: string) => void };
    signal: AbortSignal;
  },
): Promise<void> {
  const { targets, cfgKey, report, signal } = opts;

  report.progress(0.15, "Applying configuration");
  const ctx: ConfigContext = {
    stage: draft.stage || "",
    medium: draft.medium || "",
    container: draft.container ?? "",
    co2Mode: draft.co2Mode ?? "",
    lightcycle: draft.lightcycle ?? "",
    photoperiodH: draft.photoperiodH,
    profile: draft.profile ?? "SharkmouseFarms",
  };

  const freshTargets = (await Sheet.applyConfig(ctx)) ?? targets;
  if (signal.aborted) return;

  report.progress(0.45, "Building payload");
  const eff = buildEffectivePayload(draft, freshTargets);
  if (signal.aborted) return;

  report.progress(0.65, "Writing + recalculating engine");
  const writeRes = await Sheet.evaluate(eff as any, 1);

  const __bs_pc = computePrimaryConstraint(writeRes as any);
  if (!__bs_pc) throw new Error("BaselineSnapshot: primaryConstraint missing");

  const __bs_intakeSubmitted = draft as any;
  const __bs_intakeEffective = buildEffectivePayload(
    draft as any,
    freshTargets as any,
  ) as any;

  if (!Number.isFinite(Number(__bs_intakeEffective.tempC)))
    __bs_intakeEffective.tempC = 24;
  if (!Number.isFinite(Number(__bs_intakeEffective.rh)))
    __bs_intakeEffective.rh = 55;
  if (
    !Number.isFinite(Number(__bs_intakeEffective.vpdKpa)) &&
    Number.isFinite(Number(__bs_intakeEffective.tempC)) &&
    Number.isFinite(Number(__bs_intakeEffective.rh))
  ) {
    const svp =
      0.6108 *
      Math.exp(
        (17.27 * Number(__bs_intakeEffective.tempC)) /
          (Number(__bs_intakeEffective.tempC) + 237.3),
      );
    __bs_intakeEffective.vpdKpa = Number(
      ((1 - Number(__bs_intakeEffective.rh) / 100) * svp).toFixed(2),
    );
  }

  const __bs_oob = selectOOB(writeRes as any);
  const __bs_gateList =
    __bs_pc.gate === "ENV"
      ? __bs_oob.env || []
      : __bs_pc.gate === "ROOT"
        ? __bs_oob.root || []
        : __bs_oob.irr || [];

  const __bs_evidenceKeys = Array.isArray((__bs_pc as any).evidenceKeys)
    ? ((__bs_pc as any).evidenceKeys as string[])
    : [];

  const __bs_evidence = __bs_evidenceKeys.length
    ? __bs_gateList
        .filter((p) => !p?.key || __bs_evidenceKeys.includes(String(p.key)))
        .slice(0, 6)
        .map((p) => String(p.text || "").trim())
        .filter(Boolean)
    : __bs_gateList
        .slice(0, 6)
        .map((p) => String(p.text || "").trim())
        .filter(Boolean);

  const toTop3 = (rows: any): Top3FlagRow[] => {
    if (!Array.isArray(rows)) return [];
    return rows
      .slice(0, 3)
      .map((r: any) => ({
        label: String(r?.[0] ?? r?.label ?? ""),
        why: String(r?.[1] ?? r?.why ?? ""),
        score: (r?.[2] ?? r?.score ?? null) as number | null,
        next: (r?.[3] ?? r?.next ?? undefined) as string | undefined,
      }))
      .filter((x: Top3FlagRow) => x.label.trim().length > 0);
  };

  const t3g: any = (writeRes as any)?.top3ByGate ?? {};
  const a = Array.isArray((writeRes as any)?.gatePct)
    ? (writeRes as any).gatePct
    : [];

  const __bs_snap: BaselineSnapshot = {
    snapshotId: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    capturedAt: Date.now(),
    cfgKey: String(cfgKey ?? JSON.stringify(ctx) ?? ""),
    intakeSubmitted: __bs_intakeSubmitted,
    intakeEffective: __bs_intakeEffective,
    targets: freshTargets as any,
    gates: {
      ENV: clamp100(a[0]?.pct),
      ROOT: clamp100(a[1]?.pct),
      IRR: clamp100(a[2]?.pct),
    },
    primaryConstraint: {
      gate: __bs_pc.gate,
      label: String(__bs_pc.label || ""),
      why: String((__bs_pc as any).why || ""),
      confidence: Number(__bs_pc.confidence || 0),
      evidenceKeys: __bs_evidenceKeys,
      evidence: __bs_evidence,
    },
    flags: {
      ENV: toTop3(t3g.ENV),
      ROOT: toTop3(t3g.ROOT),
      IRR: toTop3(t3g.IRR),
    },
    enginePayloadApply1: writeRes as any,
  };

  useHistory.getState().attachBaselineSnapshotToLatest(__bs_snap);
  if (signal.aborted) return;

  report.progress(0.92, "Updating cockpit");
  useSheetSnap.getState().setLatestWrite(writeRes);
  useSheetSnap.getState().setLatest(writeRes);
  try {
    publishWire({ type: "sheet:update", payload: writeRes, intake: draft });
  } catch {}

  setIntake(draft);
  setLastIntake(draft);

  report.progress(0.96, "IRR physics solve");
  let __irr: any = null;
  try {
    __irr = await fetchIrrSolve(draft as any);
  } catch {}

  report.progress(0.97, "Reality delta");
  let __rd: any = null;
  try {
    __rd = await fetchRealityDelta(draft as any);
  } catch {}

  useSheetSnap.getState().append({
    t: Date.now(),
    cfg_key: cfgKey,
    intake: draft,
    latestWrite: writeRes,
    irrPlan: __irr,
    realityDelta: __rd,
  });

  try {
    await postRun({
      intake: draft as any,
      evaluate: writeRes,
      irrPlan: __irr,
      realityDelta: __rd,
    });
  } catch {}

  report.progress(1, "Done");
}
