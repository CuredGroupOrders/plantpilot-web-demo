
 // src/App.tsx
import * as Sheet from "./api/sheet";
import type { BaselineSnapshot, Top3FlagRow } from "./types/baselineSnapshot";
import { computePrimaryConstraint } from "./state/selectors/primaryConstraint";
import { selectOOB } from "./state/selectors/oob";
import { useHistory } from "./state/history";
import "./skin/theme-vars.css";
import { useEffect, useRef, useState, useCallback } from "react";
import EmbedFrame from "./cockpit/EmbedFrame";
import GateOdometersPanel from "./components/GateOdometersPanel";
import SopProfileBadge from "./components/SopProfileBadge";
import { publishWire } from "./shared/wire";
import { useSheetSnap } from "./state/sheetSnap";
import SymptomsTab from "./SymptomsTab";
import SymptomsCard from "./cockpit/SymptomsCard";
import { useTask } from "./TaskSystems";
import athenaLogo from "./assets/athena logo.png";
import athenaLogoBanner from "./assets/AthenaLogobanner.png";
import TrendsStrip from "./dashboard/TrendsStrip";
import { IrrSolverModal } from "./components/IrrSolverModal";
import LightMetricsPanel from "./components/LightMetricsPanel";
import {
  solveIrrDraft as fetchIrrSolve,
  fetchRealityDelta,
  applyIrrPlan as applyIrrSolve,
  postRun,
  type IrrSolvePlan,
} from "./api/irr";
import RnDPhotoStrip from "./RnDPhotoStrip";
import CameraCapture from "./dashboard/CameraCapture";
import { savePhoto } from "./state/photos";
import type { RnDPhotoRecord, RnDNoteRecord } from "./api/sheet";
import type { ExperimentRunSummary } from "./ExperimentRunsPanel";
import ExperimentBrowserPanel from "./ExperimentBrowserPanel";
import IntakeWizard, { type WizardConfig } from "./IntakeWizard";
import { loadRules, type StageProfile } from "./data/growroom-rules";
import NumberInput from "./components/NumberInput";
import { useSnaps } from "./state/snapshots";
import IntakeForm from "./intake/IntakeForm";
import {
  buildEffectivePayload,
  clamp100,
  computeDLI,
  computeVPD,
  mapScoresFromPayload,
  getLastIntake,
  setLastIntake,
  getLastSubmittedIntake,
  DEBOUNCE_MS,
  LS_KEY,
  type Intake,
  type ConfigContext,
  type Scores,
} from "./intake/helpers";









/* ================= App ================= */
export default function App() {
  const [viewMode, setViewMode] = useState<"intake" | "rnd">("rnd");

  const [intake, setIntake] = useState<Intake | null>(() => getLastIntake());
  const [lastSubmitted, setLastSubmitted] = useState<Intake | null>(() => {
    try { return JSON.parse(localStorage.getItem("smf.last.intake.submitted.v1") || "null"); }
    catch { return null; }
  });
  const [lists, setLists] = useState<{
    stagePhase: string[];
    medium: string[];
    containerSize: string[];
    co2Mode: string[];
    lightcycle: string[];
    photoperiodH: string[];
    sopProfile: string[];
  }>(() => ({
    stagePhase: [],
    medium: [],
    containerSize: [],
    co2Mode: [],
    lightcycle: [],
    photoperiodH: [],
    sopProfile: [],
  }));

  const [targets, setTargets] = useState<Record<string, number>>({});

  const [sheetScores, setSheetScores] = useState<Scores | null>(null);
  const [showCockpit, setShowCockpit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [irrPlan, setIrrPlan] = useState<IrrSolvePlan | null>(null);
    const [realityDelta, setRealityDelta] = useState<any | null>(null);
  const [realityDeltaLoading, setRealityDeltaLoading] = useState(false);
  const [realityDeltaError, setRealityDeltaError] = useState<string | null>(null);
  const [showRealityDeltaAdvanced, setShowRealityDeltaAdvanced] = useState(false);

  const refreshRealityDelta = useCallback(async () => {
    setRealityDeltaLoading(true);
    setRealityDeltaError(null);
    try {
      const d = await fetchRealityDelta((intake || getLastIntake()) as Record<string, unknown>);
      setRealityDelta(d);
      return d;
    } catch (e: any) {
      setRealityDeltaError(String(e?.message || e));
      setRealityDelta(null);
      return null;
    } finally {
      setRealityDeltaLoading(false);
    }
  }, [intake]);


  const { run } = useTask();
  const [cfgKey, setCfgKey] = useState<string | null>(null);

  const setLatest = useSheetSnap((s) => s.setLatest);
  const setLatestWrite = useSheetSnap((s) => s.setLatestWrite);

  const [wizardConfigApplied, setWizardConfigApplied] = useState(false);
  const [stageProfiles, setStageProfiles] = useState<StageProfile[]>([]);

  useEffect(() => {
    loadRules().then((rules) => {
      setStageProfiles(rules.stageProfiles);
    });
  }, []);

  // applyConfig: apply cfg in GAS + fetch fresh targets; return the target map.
  // Hoisted above handleWizardConfigApplied so the useCallback dependency array
  // can reference it without "used before declaration" TS6133/TS2448.
  const applyConfig = useCallback(
    async (ctx: ConfigContext): Promise<Record<string, number> | null> => {
      const newKey = JSON.stringify(ctx);
      if (cfgKey === newKey) {
        return targets;
      }
      setCfgKey(newKey);

      const freshTargets = await run(
        {
          title: "Updating Targets",
          message: "Loading new configuration",
          cancellable: false,
        },
        async (report, signal) => {
          try {
            report.progress(0.1, "Syncing configuration");
            await Sheet.applyConfig(ctx);
            if (signal.aborted) return targets;

            report.progress(0.6, "Loading targets from LIVE");
            const t = await Sheet.fetchTargets();
            if (signal.aborted) return targets;

            report.progress(0.9, "Applying targets to intake");
            setTargets(t);
            report.progress(1, "Done");
            return t;
          } catch (e) {
            console.warn("cfg/targets refresh failed", e);
            throw e;
          }
        }
      ).catch(() => null);

      return freshTargets;
    },
    [cfgKey, intake, run, targets]
  );

  const handleWizardConfigApplied = useCallback(
    async (config: WizardConfig) => {
      if (!intake) {
        setIntake({
          stage: config.stage,
          medium: config.medium,
          container: config.container,
          co2Mode: config.co2Mode,
          lightcycle: config.lightcycle,
          photoperiodH: config.photoperiodH,
          mode: config.mode,
          profile: config.profile,
        } as any);
      } else {
        setIntake({
          ...intake,
          stage: config.stage,
          medium: config.medium,
          container: config.container,
          co2Mode: config.co2Mode,
          lightcycle: config.lightcycle,
          photoperiodH: config.photoperiodH,
          mode: config.mode,
          profile: config.profile,
        });
      }

      await applyConfig({
        stage: config.stage,
        medium: config.medium,
        container: config.container,
        co2Mode: config.co2Mode,
        lightcycle: config.lightcycle,
        photoperiodH: config.photoperiodH,
        profile: config.profile,
      });

      setWizardConfigApplied(true);
    },
    [intake, applyConfig]
  );

  const [showNutrient, setShowNutrient] = useState(false);
  const [nutrientLoading, setNutrientLoading] = useState(false);
  const [nutrientError, setNutrientError] = useState<string | null>(null);
  const [nutrientRecipe, setNutrientRecipe] = useState<any | null>(null);
  const [reservoirGal, setReservoirGal] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("pp.nutrient.reservoir_gal");
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : 50;
    } catch {
      return 50;
    }
  });

  const toStageId = (label?: string) =>
    (label || "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  useEffect(() => {
    try {
      if (Number.isFinite(reservoirGal) && reservoirGal > 0) {
        localStorage.setItem("pp.nutrient.reservoir_gal", String(reservoirGal));
      }
    } catch {}
  }, [reservoirGal]);

      // initial cfg + lists + targets (no boot video — desktop-first)
  useEffect(() => {
    (async () => {
      try {
        await run(
          {
            title: "Loading",
            message: "Fetching options and targets…",
            cancellable: false,
          },
          async () => {
            await Sheet.fetchCfg();
            const options: any = await Sheet.fetchOptions();
            setLists({
              stagePhase: options.stagePhase ?? [],
              medium: options.medium ?? [],
              containerSize: options.containerSize ?? [],
              co2Mode: options.co2Mode ?? [],
              lightcycle: options.lightcycle ?? [],
              photoperiodH: options.photoperiodH ?? [],
              sopProfile: options.sopProfile ?? [],
            });

            const t = await Sheet.fetchTargets();
            setTargets(t);
          }
        );
      } catch (e) {
        console.warn(e);
      }
    })();
  }, [run]);

  // warm odometers once
  useEffect(() => {
    if (!intake) return;
    (async () => {
      const eff = buildEffectivePayload(intake, targets);
      const res = await Sheet.evaluate(eff as any, 0);
      const mapped = mapScoresFromPayload(res);
      if (mapped) setSheetScores(mapped);
      try {
        (window as any).__sheet = res;
        publishWire({ type: "sheet:update", payload: res, intake });
      } catch {}
      setLatest(res);
    })().catch(console.warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live RO odometers – recalc on ANY intake/targets change (including config apply)
  useEffect(() => {
    if (!intake) return;

    if (submitting) return;
    const t = setTimeout(async () => {
      const d = intake;
      const eff = buildEffectivePayload(d, targets);

      if (!Number.isFinite(eff.tempC as any)) eff.tempC = 24;
      if (!Number.isFinite(eff.rh as any)) eff.rh = 55;
      if (
        !Number.isFinite(eff.vpdKpa as any) &&
        Number.isFinite(eff.tempC as any) &&
        Number.isFinite(eff.rh as any)
      ) {
        eff.vpdKpa = computeVPD(eff.tempC, eff.rh);
      }
      if (!Number.isFinite(eff.ppfd as any)) eff.ppfd = 900;
      if (
        !Number.isFinite(eff.dliMol as any) &&
        Number.isFinite(eff.ppfd as any) &&
        Number.isFinite(d.photoperiodH)
      ) {
        eff.dliMol = computeDLI(eff.ppfd, d.photoperiodH);
      }

      const res = await Sheet.evaluate(eff as any, 0).catch(() => null);
      if (!res) return;
      const mapped = mapScoresFromPayload(res);
      if (mapped) setSheetScores(mapped);
      setLatest(res);
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [JSON.stringify(intake), targets, submitting, setLatest, setSheetScores]);
// nutrient overlay fetch
  useEffect(() => {
    if (!showNutrient) return;
    if (!intake) {
      setNutrientError("No intake context for nutrient recipe.");
      setNutrientRecipe(null);
      return;
    }

    const stageId = toStageId(intake.stage);
    const profile = (intake.profile as any) || "Default";

    if (!stageId) {
      setNutrientError("No stage selected for nutrient schedule.");
      setNutrientRecipe(null);
      return;
    }

    setNutrientLoading(true);
    setNutrientError(null);

    Sheet.fetchNutrientRecipe(profile, stageId)
      .then((res: any) => {
        if (!res?.enabled) {
          setNutrientError(
            "No nutrient schedule available for this SOP/stage."
          );
          setNutrientRecipe(null);
        } else {
          setNutrientRecipe(res);
        }
      })
      .catch(() => {
        setNutrientError(
          "Nutrient mix unavailable right now. Try again later."
        );
        setNutrientRecipe(null);
      })
      .finally(() => setNutrientLoading(false));
  }, [showNutrient, intake]);

  const cached = (window as any).__lastScores as Scores | undefined;
  const useScores = sheetScores ?? cached ?? { env: 100, root: 100, irr: 100 };

  const fmt = (v?: number, unit = "", d = 0) =>
    v == null || !Number.isFinite(v)
      ? "-"
      : unit
      ? `${d ? v.toFixed(d) : Math.round(v)}${unit}`
      : `${d ? v.toFixed(d) : Math.round(v)}`;

  const envVpd = Number.isFinite((intake as any)?.vpdKpa)
    ? Number((intake as any).vpdKpa)
    : computeVPD(intake?.tempC ?? 24, intake?.rh ?? 55);

  const envDli = Number.isFinite((intake as any)?.dliMol)
    ? Number((intake as any).dliMol)
    : computeDLI(intake?.ppfd ?? 900, intake?.photoperiodH ?? 12);

  const rootReservoirEc = Number.isFinite((intake as any)?.reservoirEc)
    ? Number((intake as any).reservoirEc)
    : undefined;
  const rootRunoffPh = Number.isFinite((intake as any)?.runoffPh)
    ? Number((intake as any).runoffPh)
    : undefined;

  const irrDryback = Number.isFinite((intake as any)?.drybackPct24h)
    ? Number((intake as any).drybackPct24h)
    : undefined;
  const irrTargetFirst = Number.isFinite((intake as any)?.targetAtFirst)
    ? Number((intake as any).targetAtFirst)
    : undefined;

  const envGate = {
    value: clamp100(useScores.env),
    sub: `VPD ${fmt(envVpd, " kPa", 2)} | DLI ${fmt(envDli, "", 2)}`,
  };
  const rootGate = {
    value: clamp100(useScores.root),
    sub: `Reservoir EC ${fmt(rootReservoirEc, "", 2)} | Runoff pH ${fmt(
      rootRunoffPh,
      "",
      2
    )}`,
  };
  const irrGate = {
    value: clamp100(useScores.irr),
    sub: `Overnight dryback ${fmt(
      irrDryback,
      "%"
    )} | Target@first ${fmt(irrTargetFirst, "%")}`,
  };

  return (
    <div className="container">
      {/* Mode toggle under brand bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          className="btn"
          style={{
            borderRadius: 999,
            padding: "6px 14px",
            fontSize: 12,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            borderColor:
              viewMode === "intake" ? "var(--accent)" : "var(--border)",
            background:
              viewMode === "intake" ? "rgba(0,247,219,.18)" : "transparent",
          }}
          onClick={() => setViewMode("intake")}
        >
          Intake
        </button>
        <button
          type="button"
          className="btn"
          style={{
            borderRadius: 999,
            padding: "6px 14px",
            fontSize: 12,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            borderColor:
              viewMode === "rnd" ? "var(--accent)" : "var(--border)",
            background:
              viewMode === "rnd" ? "rgba(0,247,219,.18)" : "transparent",
          }}
          onClick={() => setViewMode("rnd")}
        >
          R&amp;D
        </button>
      </div>

      {/* Overlays only relevant to Intake mode */}
      {viewMode === "intake" && showChecklist && (
        <div
          className="dialog-backdrop history-backdrop"
          onClick={() => setShowChecklist(false)}
        >
          <div
            className="dialog history-panel hud-glass"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Symptoms Checklist"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0 }}>Symptoms Checklist</h2>
              <button
                className="btn ghost"
                onClick={() => setShowChecklist(false)}
              >
                Close
              </button>
            </div>
            <div className="hr" />
            <SymptomsTab />
          </div>
        </div>
      )}

      {viewMode === "intake" && showNutrient && (
        <div
          className="dialog-backdrop history-backdrop"
          onClick={() => setShowNutrient(false)}
        >
          <div
            className="dialog history-panel hud-glass"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Nutrient Schedule"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0 }}>Nutrient Schedule</h2>
              <button
                className="btn ghost"
                onClick={() => setShowNutrient(false)}
              >
                Close
              </button>
            </div>
            <div className="hr" />

            {nutrientLoading && <div>Loading nutrient mix…</div>}

            {!nutrientLoading && nutrientError && (
              <div style={{ fontSize: 14 }}>{nutrientError}</div>
            )}

            {!nutrientLoading && !nutrientError && nutrientRecipe && (
              <NutrientOverlayContent
                recipe={nutrientRecipe}
                reservoirGal={reservoirGal}
                onReservoirChange={setReservoirGal}
              />
            )}
          </div>
        </div>
      )}

      {/* Odometers only after setup — avoids empty gauges during the wizard */}
      {wizardConfigApplied && (
        <GateOdometersPanel
          env={envGate}
          root={rootGate}
          irr={irrGate}
          statusText={overallStatusLabel(useScores)}
        />
      )}

      {viewMode === "intake" ? (
        <>
          {!showCockpit ? (
            <>
            <IntakeWizard
              lists={lists}
              stageProfiles={stageProfiles}
              initialConfig={intake ? {
                profile: (intake as any).profile,
                stage: (intake as any).stage,
                medium: (intake as any).medium,
                container: (intake as any).container,
                co2Mode: (intake as any).co2Mode,
                lightcycle: (intake as any).lightcycle,
                photoperiodH: (intake as any).photoperiodH,
                mode: (intake as any).mode,
              } : undefined}
              onConfigApplied={handleWizardConfigApplied}
              configApplied={wizardConfigApplied}
            />
            {wizardConfigApplied && (
            <IntakeForm
              lists={lists}
              initial={(intake ?? getLastIntake()) ?? undefined}
              targets={targets}
              compactContext
              onReconfigure={() => setWizardConfigApplied(false)}
              onDraftChange={(draft) => setIntake(draft)}
              onOpenChecklist={() => setShowChecklist(true)}
              onOpenNutrient={() => setShowNutrient(true)}
              onApplyConfig={applyConfig}
              onSubmit={async (draft) => {
                setSubmitting(true);
                try {
                  await run(
                    {
                      title: "Submit & Calculate",
                      message: "Running engine…",
                      cancellable: false,
                    },
                    async (report, signal) => {
                      // persist submitted snapshot
                      setLastSubmitted(draft);
                      try { localStorage.setItem("smf.last.intake.submitted.v1", JSON.stringify(draft)); } catch {}

                      report.progress(0.15, "Applying configuration");
                      const ctx: ConfigContext = {
                        stage: draft.stage || "",
                        medium: draft.medium || "",
                        container: draft.container ?? "",
                        co2Mode: draft.co2Mode ?? "",
                        lightcycle: draft.lightcycle ?? "",
                        photoperiodH: draft.photoperiodH,
                        profile: draft.profile ?? "Default",
                      };

                      const freshTargets = (await Sheet.applyConfig(ctx)) ?? targets;
                      if (signal.aborted) return;

                      report.progress(0.45, "Building payload");
                      const eff = buildEffectivePayload(draft, freshTargets);
                      if (signal.aborted) return;

                      // swap message for the long part (same video; TaskSystems doesn’t reliably hot-swap videos mid-run)
                      report.progress(0.65, "Writing + recalculating engine");
                      const writeRes = await Sheet.evaluate(eff as any, 1);
                                            // --- BaselineSnapshot capture (authoritative apply=1) ---
                      const __bs_pc = computePrimaryConstraint(writeRes as any);
                      if (!__bs_pc) throw new Error("BaselineSnapshot: primaryConstraint missing at capture point");

                      // Build the fully-populated effective payload (targets/defaults resolved) at capture time
                      const __bs_intakeSubmitted = draft as any;
                      const __bs_intakeEffective = buildEffectivePayload(draft as any, freshTargets as any) as any;

                      // Ensure derived ENV helpers exist if missing (match your RO odometer defaults)
                      if (!Number.isFinite(Number(__bs_intakeEffective.tempC))) __bs_intakeEffective.tempC = 24;
                      if (!Number.isFinite(Number(__bs_intakeEffective.rh))) __bs_intakeEffective.rh = 55;
                      if (!Number.isFinite(Number(__bs_intakeEffective.vpdKpa)) &&
                          Number.isFinite(Number(__bs_intakeEffective.tempC)) &&
                          Number.isFinite(Number(__bs_intakeEffective.rh))) {
                        const svp = 0.6108 * Math.exp((17.27 * Number(__bs_intakeEffective.tempC)) / (Number(__bs_intakeEffective.tempC) + 237.3));
                        __bs_intakeEffective.vpdKpa = Number(((1 - (Number(__bs_intakeEffective.rh) / 100)) * svp).toFixed(2));
                      }

                      const __bs_oob = selectOOB(writeRes as any);
                      const __bs_gateList =
                        __bs_pc.gate === "ENV" ? (__bs_oob.env || []) :
                        __bs_pc.gate === "ROOT" ? (__bs_oob.root || []) :
                        (__bs_oob.irr || []);

                      const __bs_evidenceKeys =
                        Array.isArray((__bs_pc as any).evidenceKeys) ? (( __bs_pc as any).evidenceKeys as string[]) : [];

                      const __bs_evidence =
                        __bs_evidenceKeys.length
                          ? __bs_gateList
                              .filter(p => !p?.key || __bs_evidenceKeys.includes(String(p.key)))
                              .slice(0, 6)
                              .map(p => String(p.text || "").trim())
                              .filter(Boolean)
                          : __bs_gateList
                              .slice(0, 6)
                              .map(p => String(p.text || "").trim())
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
                      const __bs_flags = {
                        ENV: toTop3(t3g.ENV),
                        ROOT: toTop3(t3g.ROOT),
                        IRR: toTop3(t3g.IRR),
                      };

                      const a = Array.isArray((writeRes as any)?.gatePct) ? (writeRes as any).gatePct : [];
                      const __bs_gates = {
                        ENV: clamp100(a[0]?.pct),
                        ROOT: clamp100(a[1]?.pct),
                        IRR: clamp100(a[2]?.pct),
                      };

                      const __bs_snap: BaselineSnapshot = {
                        snapshotId: (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now())),
                        capturedAt: Date.now(),
                        cfgKey: String(cfgKey ?? JSON.stringify(ctx) ?? ""),

                        intakeSubmitted: __bs_intakeSubmitted,
                        intakeEffective: __bs_intakeEffective,

                        targets: (freshTargets as any),
                        gates: (__bs_gates as any),

                        primaryConstraint: {
                          gate: __bs_pc.gate,
                          label: String(__bs_pc.label || ""),
                          why: String((__bs_pc as any).why || ""),
                          confidence: Number(__bs_pc.confidence || 0),
                          evidenceKeys: __bs_evidenceKeys,
                          evidence: __bs_evidence,
                        },

                        flags: (__bs_flags as any),
                        enginePayloadApply1: (writeRes as any),
                      };

                      useHistory.getState().attachBaselineSnapshotToLatest(__bs_snap);
                      // --- end BaselineSnapshot capture ---
                      if (signal.aborted) return;

                      report.progress(0.92, "Updating cockpit");
                      setLatestWrite(writeRes);
                      setLatest(writeRes);

                      try {
                        const a = Array.isArray(writeRes?.gatePct) ? writeRes.gatePct : [];
                        const env = clamp100(a[0]?.pct), root = clamp100(a[1]?.pct), irr = clamp100(a[2]?.pct);
                        if (env + root + irr) setSheetScores({ env, root, irr });
                      } catch {}

                      setIntake(draft);
                      setLastIntake(draft);

                      report.progress(0.96, "IRR physics solve");
                      let __irr: any = null;
                      try {
                        __irr = await fetchIrrSolve(draft as any);
                        setIrrPlan(__irr);
                      } catch {}

                      report.progress(0.97, "Reality delta");
                      let __rd: any = null;
                      try {
                        __rd = await fetchRealityDelta(draft as any);
                        setRealityDelta(__rd);
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
                setShowCockpit(true);

                    }
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
            />
            )}
            </>
          ) : (
            <div style={{ marginTop: 12 }}>
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h1>Cockpit</h1>
                <button
                  className="btn ghost"
                  onClick={() => {
                    const snap = lastSubmitted ?? getLastSubmittedIntake() ?? getLastIntake();
                    if (snap) setIntake(snap);
                    setShowCockpit(false);
                  }}
                >
                  Edit intake
                </button>
              </header>
                            <div className="card crt">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <h3 style={{ margin: 0 }}>Reality Delta</h3>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {realityDeltaLoading ? (
                      <span className="pill stat warn">Loading…</span>
                    ) : realityDeltaError ? (
                      <span className="pill stat bad">Error</span>
                    ) : realityDelta ? (
                      <span className="pill stat ok">Ready</span>
                    ) : (
                      <span className="pill stat">—</span>
                    )}

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void refreshRealityDelta()}
                      disabled={realityDeltaLoading}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setShowRealityDeltaAdvanced((v) => !v)}
                    >
                      {showRealityDeltaAdvanced ? "Simple view" : "Advanced view"}
                    </button>
                  </div>
                </div>

                {realityDeltaError ? (
                  <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 12 }}>{realityDeltaError}</div>
                ) : null}

                {realityDelta ? (
  <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.35 }}>
    {(() => {
      const rd: any = realityDelta || {};
      const du: any = rd?.delta?.user || {};
      const ds: any = rd?.delta?.standard || {};
      const n = (x: any) => (typeof x === "number" && Number.isFinite(x) ? x : null);
      const fmt0 = (x: any) => {
        const v = n(x);
        return v == null ? "—" : String(Math.round(v));
      };
      const fmt2 = (x: any) => {
        const v = n(x);
        return v == null ? "—" : v.toFixed(2);
      };
      const demandLabel = (d: number | null) => {
        if (d == null) return "—";
        if (d < 0.33) return "LOW";
        if (d < 0.66) return "MED";
        return "HIGH";
      };

      // Daily deltas (user day ml − required day ml)
      const dP1 = n(du?.p1_delta_day_ml) ?? n(du?.delta_p1_ml);
      const dP2 = n(du?.p2_delta_day_ml) ?? n(du?.delta_p2_ml);

      const p1Status = String(du?.p1_status || "");
      const p2Status = String(du?.p2_status || "");
      const absP1 = dP1 == null ? 0 : Math.abs(dP1);
      const absP2 = dP2 == null ? 0 : Math.abs(dP2);
      const sev =
        p1Status === "ON" && p2Status === "ON"
          ? "ok"
          : p1Status && p2Status
            ? "warn"
            : absP1 < 100 && absP2 < 100
              ? "ok"
              : absP1 <= 300 && absP2 <= 300
                ? "warn"
                : "bad";
      const sevLabel =
        p1Status && p2Status ? `${p1Status}/${p2Status}` : sev === "ok" ? "ON" : sev === "warn" ? "WARN" : "BAD";

      const dir = (d: number | null) => (d == null ? "—" : d < 0 ? "SHORT" : d > 0 ? "OVER" : "ON");
      const act = (d: number | null) =>
        d == null
          ? "—"
          : d < 0
            ? `Increase daily total by ${Math.round(Math.abs(d))} ml/day`
            : d > 0
              ? `Reduce daily total by ${Math.round(Math.abs(d))} ml/day`
              : "On target";

      const p1User = n(du?.p1_user_day_ml) ?? n(du?.p1_ml_user);
      const p1Now = n(du?.p1_required_day_ml) ?? n(du?.p1_ml_now);
      const p2User = n(du?.p2_user_day_ml) ?? n(du?.p2_ml_user);
      const p2Now = n(du?.p2_required_day_ml) ?? n(du?.p2_ml_now);

      const sP1 = n(ds?.delta_p1_ml);
      const sP2 = n(ds?.delta_p2_ml);

      const demandIdx = n(rd?.demand_index);
      const dbPctInterval = n(rd?.dbPct_interval);
      const maintMlEvent = n(rd?.w_maint_event_ml);
      const p2RunoffFrac = n(rd?.p2_runoff_frac);

      const fcVwc = n(rd?.fc_vwc);
      const startVwc = n(rd?.vwc_start);
      const refillDay = n(rd?.w_refill_ml);
      const vMedia = n(rd?.v_media_ml);

      const key = String(rd?.cfg_key_effective ?? "");

      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span className={`pill stat ${sev}`}>{sevLabel}</span>
            <div style={{ opacity: 0.9 }}>
              P1: <b>{dir(dP1)}</b> by <b>{fmt0(dP1 == null ? null : Math.abs(dP1))}</b> ml/day · P2:{" "}
              <b>{dir(dP2)}</b> by <b>{fmt0(dP2 == null ? null : Math.abs(dP2))}</b> ml/day
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div
              style={{
                background: "rgba(0,0,0,.25)",
                border: "1px solid rgba(30,230,214,.20)",
                borderRadius: 12,
                padding: "10px 12px",
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>P1 — Refill</div>
              <div>
                You: <b>{fmt0(p1User)}</b> ml/day → Physics: <b>{fmt0(p1Now)}</b> ml/day
              </div>
              <div style={{ marginTop: 4 }}>
                Δ: <b>{dP1 == null ? "—" : (dP1 >= 0 ? "+" : "") + fmt0(dP1)}</b> ml/day ·{" "}
                <span style={{ opacity: 0.85 }}>{act(dP1)}</span>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                Refill gap: Start <b>{fmt0(startVwc)}%</b> → FC <b>{fmt0(fcVwc)}%</b> · Budget{" "}
                <b>{fmt0(refillDay)}</b> ml/day (container <b>{fmt0(vMedia)}</b> ml)
              </div>
            </div>

            <div
              style={{
                background: "rgba(0,0,0,.25)",
                border: "1px solid rgba(30,230,214,.20)",
                borderRadius: 12,
                padding: "10px 12px",
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>P2 — Maintain + runoff</div>
              <div>
                You: <b>{fmt0(p2User)}</b> ml/day → Physics: <b>{fmt0(p2Now)}</b> ml/day
              </div>
              <div style={{ marginTop: 4 }}>
                Δ: <b>{dP2 == null ? "—" : (dP2 >= 0 ? "+" : "") + fmt0(dP2)}</b> ml/day ·{" "}
                <span style={{ opacity: 0.85 }}>{act(dP2)}</span>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                Demand today: <b>{demandLabel(demandIdx)}</b> (<b>{fmt2(demandIdx)}</b>) · Dryback/interval:{" "}
                <b>{dbPctInterval == null ? "—" : (dbPctInterval * 100).toFixed(2)}%</b> · Maint:{" "}
                <b>{fmt0(maintMlEvent)}</b> ml/event (pre-runoff) · Runoff (P2):{" "}
                <b>{p2RunoffFrac == null ? "—" : (p2RunoffFrac * 100).toFixed(0)}%</b>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid rgba(30,230,214,.18)",
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>Standard (SOP vs Physics)</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
  P1 SOP <b>{fmt0(ds?.p1_ml_sop)}</b> ml/event{" "}
  (<b>{fmt0(ds?.p1_events_sop)}</b> ev) → Physics <b>{fmt0(ds?.p1_ml_now)}</b> ml/event{" "}
  (<b>{fmt0(rd?.p1?.events)}</b> ev) (Δ{" "}
  <b>{sP1 == null ? "—" : (sP1 >= 0 ? "+" : "") + fmt0(sP1)}</b>)
</div>

<div>
  P2 SOP <b>{fmt0(ds?.p2_ml_sop)}</b> ml/event{" "}
  (<b>{fmt0(ds?.p2_events_sop)}</b> ev) → Physics <b>{fmt0(ds?.p2_ml_now)}</b> ml/event{" "}
  (<b>{fmt0(rd?.p2?.events)}</b> ev) (Δ{" "}
  <b>{sP2 == null ? "—" : (sP2 >= 0 ? "+" : "") + fmt0(sP2)}</b>)
</div>

            </div>
        <div style={{ marginTop: 8, opacity: 0.9 }}>{showRealityDeltaAdvanced ? (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(30,230,214,.12)" }}><div style={{ marginTop: 6, opacity: 0.9 }}>
                <b>Why ml/event changes when you change events:</b> budgets are <b>daily</b>.{" "}
                ml/event = (daily budget ÷ events). Intervals don’t change the daily requirement — they change
                delivery risk (dryback/interval).
              </div>
            </div>
          ) : null}
        </div>


                    <div style={{ marginTop: 8, opacity: 0.9 }}>
          <div>
            <b>What this means:</b> “SOP” is the recipe default shot size. “Physics” is today’s required daily water
            budget (Refill to FC + P2 maintenance with P2-only runoff).
          </div>

          {showRealityDeltaAdvanced ? (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(30,230,214,.12)" }}>
              <div>
                <b>Budgets (daily):</b>{" "}
                Refill <b>{fmt0(refillDay)}</b> ml/day ·
                P2 maint <b>{fmt0(n(rd?.w_maint_day_ml))}</b> ml/day ·
                P2 applied{" "}
                <b>
                  {(() => {
                    const md = n(rd?.w_maint_day_ml);
                    const rp = p2RunoffFrac;
                    if (md == null || rp == null) return "—";
                    return fmt0(md / (1 - rp));
                  })()}
                </b>{" "}
                ml/day
              </div>

              <div style={{ marginTop: 6 }}>
                <b>Your plan vs Physics (per event):</b>{" "}
                P1 <b>{fmt0(p1User)}</b> → <b>{fmt0(p1Now)}</b> ·
                P2 <b>{fmt0(p2User)}</b> → <b>{fmt0(p2Now)}</b>
              </div>

              <div style={{ marginTop: 6, opacity: 0.9 }}>
                <b>Why ml/event changes when you change events:</b> the requirement is a daily budget. You can slice that
                daily budget into more/fewer events; Physics recomputes ml/event accordingly. Intervals don’t change the
                daily requirement — they change delivery risk (dryback/interval).
              </div>
            </div>
          ) : null}
        </div>
<div style={{ marginTop: 8, opacity: 0.75 }}>
              key: <span style={{ fontFamily: "monospace" }}>{key}</span>
            </div>
          </div>
        </div>
      );
    })()}
  </div>
) : (
  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
    No delta yet. Submit + Calculate to generate one.
  </div>
)}
              </div>
                            <div className="card crt">
                <h3 style={{ marginTop: 0 }}>Trends</h3>
                <TrendsStrip />
              </div>
    
              <SymptomsCard />
              <EmbedFrame />
            </div>
          )}
        </>
      ) : (
        <RnDWorkspace intake={intake} targets={targets} cfgKey={cfgKey} />
      )}
    </div>
  );
}

/* ---------- Intake Form (unchanged from your version) ---------- */

type NutrientOverlayProps = {
  recipe: any;
  reservoirGal: number;
  onReservoirChange: (v: number) => void;
};

function NutrientOverlayContent({
  recipe,
  reservoirGal,
  onReservoirChange,
}: NutrientOverlayProps) {
  const bottlesRaw = Array.isArray(recipe?.bottles)
    ? recipe.bottles
    : [];

  const bottles = bottlesRaw.filter(
    (b: any) =>
      b &&
      b.bottle_id !== "cleanse" &&
      typeof b.ml_per_gal === "number" &&
      Number.isFinite(b.ml_per_gal)
  );

  const mlValues = bottles.map((b: any) => Number(b.ml_per_gal));
  const maxMl = mlValues.length ? Math.max(...mlValues) : 0;

  const stageLabel = (() => {
    const sid = String(recipe?.stage_id || "").replace(/_/g, " ");
    if (!sid) return "";
    return sid.charAt(0).toUpperCase() + sid.slice(1);
  })();

  const phaseBlock = String(recipe?.phase_block || "").toLowerCase();
  const weekIndex = recipe?.week_index as number | undefined;

  const subtitleParts: string[] = [];
  if (stageLabel) subtitleParts.push(stageLabel);
  if (phaseBlock)
    subtitleParts.push(
      phaseBlock.charAt(0).toUpperCase() + phaseBlock.slice(1)
    );
  if (weekIndex != null) subtitleParts.push(`Week ${weekIndex}`);
  const subtitle = subtitleParts.join(" · ");

  const ecTarget = recipe?.ec_target;
  const phMin = recipe?.ph_min;
  const phMax = recipe?.ph_max;
  const ppm500 = recipe?.ppm_500;
  const ppm700 = recipe?.ppm_700;

  const fmt = (v: any, d = 1) =>
    v == null || !Number.isFinite(Number(v)) ? "-" : Number(v).toFixed(d);

  const cleanse = bottlesRaw.find(
    (b: any) => b?.bottle_id === "cleanse"
  );
  const cleanseMin = cleanse?.cleanse_min_ml_per_gal;
  const cleanseMax = cleanse?.cleanse_max_ml_per_gal;

  const colorForIndex = (idx: number) => {
    const palette = [
      "#b14cff", // purple
      "#37ff7a", // traffic green
      "#00f7db", // cyan
      "#ffb627", // amber
    ];
    return palette[idx % palette.length];
  };

  const handleReservoirChange = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      onReservoirChange(0);
    } else {
      onReservoirChange(n);
    }
  };

  return (
    <div>
      {/* Athena banner header */}
      <div
        style={{
          marginBottom: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <img
          src={athenaLogoBanner}
          alt="Athena Nutrients"
          style={{
            maxWidth: "100%",
            borderRadius: 12,
            boxShadow:
              "0 0 20px rgba(177,76,255,0.8), 0 0 28px rgba(55,255,122,0.6)",
            marginBottom: 6,
          }}
        />
        {subtitle && (
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>

      {bottles.length > 0 && maxMl > 0 && (
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          {bottles.map((b: any, idx: number) => {
            const ml = Number(b.ml_per_gal);
            const pct = Math.max(0.1, (ml / maxMl) * 100);
            const color = colorForIndex(idx);
            const glow = `0 0 14px ${color}cc, 0 0 28px ${color}88`;

            return (
              <div key={b.bottle_id || idx} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span>{b.bottle_label}</span>
                  <span>{ml.toFixed(1)} mL/gal</span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 16,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.6)",
                    overflow: "hidden",
                    border: "1px solid rgba(0,247,219,0.25)",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: color,
                      boxShadow: glow,
                      transition: "width 0.2s ease-out",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cleanse && (cleanseMin != null || cleanseMax != null) && (
        <div
          style={{
            fontSize: 12,
            marginBottom: 12,
            color: "#cfeff0",
            opacity: 0.9,
          }}
        >
          Cleanse:{" "}
          {cleanseMin != null && cleanseMax != null
            ? `${cleanseMin}–${cleanseMax} mL/gal`
            : cleanseMin != null
            ? `${cleanseMin} mL/gal`
            : `${cleanseMax} mL/gal`}
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          marginBottom: 12,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 2fr)",
          gap: 16,
        }}
      >
        <div>
          <label
            style={{ display: "block", fontSize: 13, marginBottom: 4 }}
          >
            Reservoir volume (gal)
          </label>
          <NumberInput
            step="1"
            min={1}
            value={reservoirGal || undefined}
            onChange={(v) => handleReservoirChange(v == null ? "" : String(v))}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #13252a",
              background: "#0b1316",
              color: "#dfe9ea",
            }}
          />
        </div>

        <div>
          <label
            style={{ display: "block", fontSize: 13, marginBottom: 4 }}
          >
            Mix amounts
          </label>
          <div
            style={{
              fontSize: 12,
              maxHeight: 120,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {bottles.map((b: any, idx: number) => {
              const ml = Number(b.ml_per_gal);
              const total =
                reservoirGal && Number.isFinite(ml)
                  ? ml * reservoirGal
                  : NaN;
              const color = colorForIndex(idx);
              return (
                <div
                  key={b.bottle_id || idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color }}>{b.bottle_label}</span>
                  <span>
                    {Number.isFinite(total)
                      ? `${total.toFixed(1)} mL`
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 8 }}>
        {ecTarget != null && (
          <div>Target EC: {fmt(ecTarget, 1)} mS/cm</div>
        )}
        {(ppm500 != null || ppm700 != null) && (
          <div>
            PPM 500: {fmt(ppm500, 0)} · PPM 700: {fmt(ppm700, 0)}
          </div>
        )}
        {(phMin != null || phMax != null) && (
          <div>
            pH:{" "}
            {phMin != null && phMax != null
              ? `${fmt(phMin, 1)}–${fmt(phMax, 1)}`
              : phMin != null
              ? fmt(phMin, 1)
              : fmt(phMax, 1)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- R&D Workspace (CONTROL / VARIANT + visual comparisons) ---------- */

type VariantOverride = {
  enabled: boolean;
  value?: number | "";
};

type VariantOverrides = Record<string, VariantOverride>; // metricKey -> Override
type RnDVariantStore = Record<string, VariantOverrides>; // "<exp>::<group>" -> VariantOverrides;

function RnDWorkspace({
  intake,
  targets,
  cfgKey,
}: {
  intake: Intake | null;
  targets: Record<string, number>;
  cfgKey: string | null;
}) {
  const { run } = useTask();

  const [experimentId, setExperimentId] = useState("EXP-RD-001");
  const [groupId, setGroupId] = useState("GRP-TEST-001");
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // R&D visual evidence (photos)
  const [photosByLogId, setPhotosByLogId] = useState<
    Record<string, RnDPhotoRecord[]>
  >({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
    // R&D symptom options (final keys)
  const RND_SYMPTOM_OPTIONS = [
    { key: "interveinal_chlorosis", label: "Interveinal chlorosis" },
    { key: "uniform_chlorosis", label: "Uniform chlorosis" },
    { key: "tip_burn", label: "Tip burn" },
    { key: "marginal_burn", label: "Marginal burn" },
    { key: "clawing", label: "Clawing" },
    { key: "petioles_red_purple", label: "Petioles red / purple" },
    { key: "stippling_speckling", label: "Stippling / speckling" },
    { key: "powdery_film_pm", label: "Powdery film (PM)" },
    { key: "canoeing_taco", label: "Canoeing / taco leaves" },
    { key: "webbing_mites", label: "Webbing (mites)" },
    { key: "new_growth_yellow", label: "New growth yellow" },
    { key: "necrotic_spots", label: "Necrotic spots" },
    { key: "bronzing", label: "Bronzing" },
    { key: "whole_plant_droop", label: "Whole plant droop" },
    { key: "distorted_new_growth", label: "Distorted new growth" },
    { key: "grey_mold", label: "Grey mold" },
  ] as const;

  type SymKey = (typeof RND_SYMPTOM_OPTIONS)[number]["key"];

  // Persistent symptoms per run: runKey -> { symKey: boolean }
  const [activeSymptomsByRun, setActiveSymptomsByRun] = useState<
    Record<string, Record<SymKey, boolean>>
  >(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.symActive.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });

  // Per-day symptoms: "<exp>::<group>::YYYY-MM-DD" -> SymKey[]
  const [dailySymptoms, setDailySymptoms] = useState<
    Record<string, SymKey[]>
  >(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.symDaily.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });

  const [showSymptomModal, setShowSymptomModal] = useState(false);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingLogForPhoto, setPendingLogForPhoto] = useState<string | null>(
    null
  );
  // 4-slot structured evidence wizard (slot 4 is optional + user-defined).
  const FIXED_SLOT_META = {
    1: { label: "Plant height",  units: "cm" },
    2: { label: "Canopy width",  units: "cm" },
    3: { label: "Stem diameter", units: "mm" },
  } as const;

  const SLOT4_META_KEY = "pp.rnd.slot4Meta.v1";
  const [slot4Meta, setSlot4Meta] = useState<{ label: string; units: string }>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(SLOT4_META_KEY) : null;
      if (raw) {
        const j = JSON.parse(raw);
        if (j && typeof j === "object") {
          return {
            label: typeof j.label === "string" ? j.label : "",
            units: typeof j.units === "string" ? j.units : "",
          };
        }
      }
    } catch {}
    return { label: "", units: "" };
  });

  useEffect(() => {
    try {
      localStorage.setItem(SLOT4_META_KEY, JSON.stringify(slot4Meta));
    } catch {}
  }, [slot4Meta]);

  const slotMeta: Record<1 | 2 | 3 | 4, { label: string; units: string }> = {
    1: FIXED_SLOT_META[1],
    2: FIXED_SLOT_META[2],
    3: FIXED_SLOT_META[3],
    4: { label: slot4Meta.label || "Custom metric", units: slot4Meta.units || "" },
  };

  const [captureStep, setCaptureStep] = useState<1 | 2 | 3 | 4>(1);
  const [slotMetricInputs, setSlotMetricInputs] = useState<{
    1: string;
    2: string;
    3: string;
    4: string;
  }>({
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [metricChartSlot, setMetricChartSlot] = useState<SlotId | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  
   
   const [runStatusByKey, setRunStatusByKey] = useState<
    Record<string, RunStatus>
  >(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.runs.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });
  

  // When the user clicks a card in the experiment run browser we override the
  // active cfg token so the variant store, run lock and current run key all line
  // up with the historical run instead of the live draft cfg.
  const [loadedHistoricalRun, setLoadedHistoricalRun] = useState<{
    runKey: string;
    experimentId: string;
    groupId: string;
    cfgToken: string;
    schemaVersion: number;
  } | null>(null);

  const cfgToken =
    (loadedHistoricalRun &&
    loadedHistoricalRun.experimentId === experimentId &&
    loadedHistoricalRun.groupId === groupId
      ? loadedHistoricalRun.cfgToken
      : cfgKey) ?? "no-cfg";

  const currentRunKey = `${experimentId}::${groupId}::${cfgToken}`;
  const currentRunStatus: RunStatus = runStatusByKey[currentRunKey] ?? "draft";
  const runLocked = currentRunStatus === "finished";

  const currentActiveSymMap: Record<SymKey, boolean> =
    activeSymptomsByRun[currentRunKey] || {};

    const runStatusLabel =
    currentRunStatus === "draft"
      ? "Draft"
      : currentRunStatus === "active"
      ? "Active"
      : "Finished";
  const prevCfgTokenRef = useRef<string | null>(cfgToken);
    // When cfgToken changes for the same experiment/group,
  // demote the previous ACTIVE run to draft so phases don’t blur together.
  useEffect(() => {
    const prevToken = prevCfgTokenRef.current;


    // First render or no change → just update the ref
    if (!prevToken || prevToken === cfgToken) {
      prevCfgTokenRef.current = cfgToken;
      return;
    }

    const oldRunKey = `${experimentId}::${groupId}::${prevToken}`;

    setRunStatusByKey((prev) => {
      const oldStatus = prev[oldRunKey];
      if (oldStatus !== "active") {
        // if it wasn’t active, leave it alone
        return prev;
      }
      return {
        ...prev,
        [oldRunKey]: "draft",
      };
    });

    prevCfgTokenRef.current = cfgToken;
  }, [cfgToken, experimentId, groupId, setRunStatusByKey]);



  const runStatusColor =
    currentRunStatus === "draft"
      ? "rgba(234,179,8,0.95)" // amber
      : currentRunStatus === "active"
      ? "rgba(34,197,163,0.95)" // green/cyan
      : "rgba(148,163,184,0.95)"; // grey for finished




  // Simple local plan store: { "<exp>::<gid>": { label, notes } }
  const [plans, setPlans] = useState<
    Record<string, { label: string; notes: string }>
  >(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.plans.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });

  // Variant overrides per experiment/group
  const [variantStore, setVariantStore] = useState<RnDVariantStore>(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.overrides.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });

  // Daily note store: { "<exp>::<gid>::YYYY-MM-DD": note }
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.dailyNotes.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });
   

  // One-time control initialization per experiment: { "<exp>": true }
  const [controlInitFlags, setControlInitFlags] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.controlInit.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });

  // Local snapshot-today flags: { "<exp>::<gid>::YYYY-MM-DD": true }
  const [snapshotTodayFlags, setSnapshotTodayFlags] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const raw = localStorage.getItem("pp.rnd.snapshotToday.v1");
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  });

  // persist plans
  useEffect(() => {
    try {
      localStorage.setItem("pp.rnd.plans.v1", JSON.stringify(plans));
    } catch {}
  }, [plans]);

  // persist overrides
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.overrides.v1",
        JSON.stringify(variantStore)
      );
    } catch {}
  }, [variantStore]);

  // persist daily notes
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.dailyNotes.v1",
        JSON.stringify(dailyNotes)
      );
    } catch {}
  }, [dailyNotes]);
  

  // persist control init flags
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.controlInit.v1",
        JSON.stringify(controlInitFlags)
      );
    } catch {}
  }, [controlInitFlags]);
  // persist snapshot-today flags
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.snapshotToday.v1",
        JSON.stringify(snapshotTodayFlags)
      );
    } catch {}
  }, [snapshotTodayFlags]);
    // persist run status per experiment/group/cfg
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.runStatus.v1",
        JSON.stringify(runStatusByKey)
      );
    } catch {}
  }, [runStatusByKey]);
   // persist run status per experiment/group/cfg
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.runs.v1",
        JSON.stringify(runStatusByKey)
      );
    } catch {}
  }, [runStatusByKey]);
    // persist activeSymptomsByRun
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.symActive.v1",
        JSON.stringify(activeSymptomsByRun)
      );
    } catch {}
  }, [activeSymptomsByRun]);

  // persist dailySymptoms
  useEffect(() => {
    try {
      localStorage.setItem(
        "pp.rnd.symDaily.v1",
        JSON.stringify(dailySymptoms)
      );
    } catch {}
  }, [dailySymptoms]);

    // Load notes from backend for this experiment/group and merge into local dailyNotes
  useEffect(() => {
    if (!experimentId) return;

    let cancelled = false;

    (async () => {
      try {
        const notes: RnDNoteRecord[] = await Sheet.fetchRNDNotes({
          experimentId,
          groupId,
        });

        if (cancelled) return;

        setDailyNotes((prev) => {
          const next = { ...prev };
          for (const n of notes) {
            const dateKey = (n.date_key || "").slice(0, 10);
            if (!dateKey) continue;
            const key = `${n.experiment_id}::${n.group_id}::${dateKey}`;
            if (!next[key]) {
              next[key] = n.note_text || "";
            }
          }
          return next;
        });
      } catch (err) {
        console.warn("fetchRNDNotes failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [experimentId, groupId]);
      // Load run statuses from backend for all experiments and merge into runStatusByKey
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const runs = await Sheet.fetchAllRDRuns();
        if (cancelled) return;

        setRunStatusByKey((prev) => {
          const next = { ...prev };
          for (const r of runs) {
            const runKey = r.run_key || "";
            if (!runKey) continue;
            const status = (r.status || "draft") as RunStatus;
            // don’t overwrite anything we already have locally
            if (!next[runKey]) {
              next[runKey] = status;
            }
          }
          return next;
        });
      } catch (err) {
        console.warn("fetchAllRDRuns failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const planKey = (exp: string, gid: string) => `${exp}::${gid}`;
  const variantKey = (exp: string, gid: string) => `${exp}::${gid}`;

  const loadSummary = useCallback(async () => {
    if (!experimentId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await Sheet.fetchRDSummary(experimentId);
      setSummary(s);
    } catch (e: any) {
      setError(e?.message || "Unable to load R&D summary.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Load photo evidence for current experiment/group
  useEffect(() => {
    if (!experimentId) return;
    setLoadingPhotos(true);
    Sheet.fetchRnDPhotos({ experimentId, groupId })
      .then((res) => {
        const map: Record<string, RnDPhotoRecord[]> = {};
        for (const p of res.photos || []) {
          const key = p.log_id || "__all__";
          if (!map[key]) map[key] = [];
          map[key].push(p);
        }
        setPhotosByLogId(map);
      })
      .catch((err) => {
        console.warn("fetchRnDPhotos failed", err);
      })
      .finally(() => setLoadingPhotos(false));
  }, [experimentId, groupId]);

  const ALL_LOG_KEY = "__all__";

  // Open camera and prepare to capture a photo for this experiment/group
  const openCameraForEvidence = async () => {
    if (!experimentId || !groupId) {
      setError("Set Experiment ID and Group ID before capturing evidence.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setCameraOpen(true);
      setPendingLogForPhoto(ALL_LOG_KEY);
    } catch (err: any) {
      console.warn("getUserMedia failed", err);
      setError("Unable to access camera for photo capture.");
    }
  };

  // Handle a captured blob from CameraCapture
  const handlePhotoShot = async (blob: Blob) => {
    if (!experimentId || !groupId) return;

    const logId = pendingLogForPhoto || ALL_LOG_KEY;
    const nowIso = new Date().toISOString();

    // close camera
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
    setPendingLogForPhoto(null);

    // ---- derive gate scores + flags from SUMMARY (active group or control) ----
    let envScore: number | undefined;
    let rootScore: number | undefined;
    let irrScore: number | undefined;
    let envFlags = "";
    let rootFlags = "";
    let irrFlags = "";

    try {
      if (summary && summary.groups && typeof summary.groups === "object") {
        const groupsMap = summary.groups as Record<string, any>;
        const groupIds = Object.keys(groupsMap);
        if (groupIds.length > 0) {
          const activeKey = groupsMap[groupId] ? groupId : groupIds[0];
          const g = groupsMap[activeKey];

          const e = Number(g.envScoreAvg ?? NaN);
          const r = Number(g.rootScoreAvg ?? NaN);
          const i = Number(g.irrScoreAvg ?? NaN);
          if (Number.isFinite(e)) envScore = e;
          if (Number.isFinite(r)) rootScore = r;
          if (Number.isFinite(i)) irrScore = i;

          const flagsArr: any[] = Array.isArray(g.flags) ? g.flags : [];
          const envNames = flagsArr
            .filter((f) => String(f.gate || "").toUpperCase() === "ENV")
            .map((f) => String(f.name || "").trim())
            .filter(Boolean);
          const rootNames = flagsArr
            .filter((f) => String(f.gate || "").toUpperCase() === "ROOT")
            .map((f) => String(f.name || "").trim())
            .filter(Boolean);
          const irrNames = flagsArr
            .filter((f) => String(f.gate || "").toUpperCase() === "IRR")
            .map((f) => String(f.name || "").trim())
            .filter(Boolean);

          envFlags = envNames.join(",");
          rootFlags = rootNames.join(",");
          irrFlags = irrNames.join(",");
        }
      }
    } catch (err) {
      console.warn("Failed to derive gate scores/flags for photo", err);
    }
        // Map this capture to the current wizard slot + metric
    const slot = captureStep;
    const metricRaw = slotMetricInputs[slot];
    const metricNum = Number(metricRaw);
    const metricValue = Number.isFinite(metricNum) ? metricNum : null;
    const meta = slotMeta[slot];

    try {
      setSavingPhoto(true);
      const photoRef = await savePhoto(blob);

            const res = await Sheet.appendRnDPhoto({
        log_id: logId,
        experiment_id: experimentId,
        group_id: groupId,
        captured_at: nowIso,
        photo_ref: photoRef,
        env_gate_score: envScore,
        root_gate_score: rootScore,
        irr_gate_score: irrScore,
        env_flags_keys: envFlags,
        root_flags_keys: rootFlags,
        irr_flags_keys: irrFlags,
        slot_index: slot,
        metric_label: meta.label,
        metric_units: meta.units,
        metric_value: metricValue ?? undefined,
      });

            const newRec: RnDPhotoRecord = {
        log_id: res.log_id || logId,
        experiment_id: res.experiment_id || experimentId,
        group_id: res.group_id || groupId,
        captured_at: nowIso,
        view: "",
        tag: "",
        note: "",
        photo_ref: photoRef,
        env_gate_score: envScore ?? null,
        root_gate_score: rootScore ?? null,
        irr_gate_score: irrScore ?? null,
        env_flags_keys: envFlags,
        root_flags_keys: rootFlags,
        irr_flags_keys: irrFlags,
        slot_index: slot,
        metric_label: meta.label,
        metric_units: meta.units,
        metric_value: metricValue ?? null,
      };

      setPhotosByLogId((prev) => {
        const key = newRec.log_id || ALL_LOG_KEY;
        const arr = prev[key] || [];
        return { ...prev, [key]: [...arr, newRec] };
      });
      // First-touch draft persistence for evidence captures, so the run survives a refresh
      // even if the user never enables a variant override.
      ensureDraftRun();
    } catch (err: any) {
      console.warn("appendRnDPhoto failed", err);
      setError(err?.message || "Failed to save photo evidence.");
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleDeletePhoto = async (p: RnDPhotoRecord) => {
    if (!experimentId || !groupId) return;
    try {
      await Sheet.deleteRnDPhoto({
        log_id: p.log_id,
        experiment_id: experimentId,
        group_id: groupId,
        captured_at: p.captured_at,
        photo_ref: p.photo_ref,
      });

      setPhotosByLogId((prev) => {
        const key = p.log_id || ALL_LOG_KEY;
        const list = prev[key] || [];
        const next = list.filter((item) => item !== p);
        return { ...prev, [key]: next };
      });
    } catch (err: any) {
      console.warn("deleteRnDPhoto failed", err);
      setError(err?.message || "Failed to delete photo.");
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
    setPendingLogForPhoto(null);
  };

  const handleTestFlight = async () => {
    if (!experimentId || !groupId) return;
    setShooting(true);
    setError(null);
    try {
      await Sheet.postRDSnapshot({
        experimentId,
        groupId,
        overrides: {}, // engine will snapshot current LIVE state
      });
      await loadSummary();
      // Trends sparklines key off useSnaps; record this control snapshot too.
      try { useSnaps.getState().add("control"); } catch (e) { console.warn("snap add(control) failed", e); }

      // One-time control baseline for this experiment
      const key = experimentId || "";
      setControlInitFlags((prev) => ({
        ...prev,
        [key]: true,
      }));
    } catch (e: any) {
      setError(e?.message || "Snapshot failed.");
    } finally {
      setShooting(false);
    }
  };


   const handleLogVariantSnapshot = async () => {
    if (!experimentId || !groupId) return;
    if (!intake) {
      setError("No Intake context – fill Intake first before R&D.");
      return;
    }

    const vKey = variantKey(experimentId, groupId);
    const overridesForGroup = variantStore[vKey] || {};

    const overridesPayload: Record<string, number> = {};

    for (const [metricKey, ov] of Object.entries(overridesForGroup)) {
      if (!ov || !ov.enabled) continue;
      const raw = ov.value;
      if (raw === undefined || raw === "") continue;
      const num = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(num)) continue;
      overridesPayload[metricKey] = num;
    }

    if (!Object.keys(overridesPayload).length) {
      setError("No variant overrides set – enable at least one metric.");
      return;
    }

              await run(
        {
          title: "R&D Variant Snapshot",
          message: "Saving variant snapshot…",
          cancellable: false,
        },
        async () => {
          await Sheet.postRDSnapshot({
            experimentId,
            groupId,
            overrides: overridesPayload,
          });
          await loadSummary();
          // Trends sparklines refresh: record a "variant" snapshot using the live intake +
          // overrides surfaced via window.__pp_latestIntakeDraft inside useSnaps.add().
          try { useSnaps.getState().add("variant"); } catch (e) { console.warn("snap add(variant) failed", e); }

          // Mark today's variant snapshot as logged (Step 1 complete)
          const tk = getLocalDateKey();
          const dayKey = `${experimentId}::${groupId}::${tk}`;
          setSnapshotTodayFlags((prev) => ({
            ...prev,
            [dayKey]: true,
          }));

      // Log active symptoms for this day into dailySymptoms
      const symKeys = Object.entries(currentActiveSymMap)
        .filter(([, v]) => v)
        .map(([k]) => k as SymKey);

      if (symKeys.length) {
        const symDayKey = `${experimentId}::${groupId}::${tk}`;
        setDailySymptoms((prev) => ({
          ...prev,
          [symDayKey]: symKeys,
        }));

        // Mirror daily symptoms to backend timeline
        void Sheet.postRDSymLog({
          experimentId,
          groupId,
          runKey: currentRunKey,
          dateKey: tk,
          symptoms: symKeys,
        });
      }


          // Mark run as active (unless it was already finished)
          setRunStatusByKey((prev) => {
            const existing = prev[currentRunKey];
            if (existing === "finished") return prev;
            return {
              ...prev,
              [currentRunKey]: "active",
            };
          });

          // Sync run status to backend
          void Sheet.updateRDRunStatus({
            experimentId,
            groupId,
            cfgToken,
            status: "active",
          });
        }
      );


  };
  // Persist a "draft" RND_RUNS row the first time a new run is touched so it survives
  // refresh / cross-device usage. Without this, a fresh run only existed in the local
  // runStatusByKey map and never made it to the backend until it transitioned to "active".
  // The Set guard prevents the 10x duplicate POSTs that would otherwise fire when a user
  // rapidly toggles N variant overrides in the same render frame (state batch hasn't flushed).
  const draftRunPostedRef = useRef<Set<string>>(new Set());
  const ensureDraftRun = useCallback(() => {
    if (!experimentId || !groupId) return;
    const key = currentRunKey;
    if (draftRunPostedRef.current.has(key)) return;
    if (runStatusByKey[key]) {
      draftRunPostedRef.current.add(key);
      return;
    }
    draftRunPostedRef.current.add(key);
    setRunStatusByKey((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: "draft" };
    });
    void Sheet.updateRDRunStatus({
      experimentId,
      groupId,
      cfgToken,
      status: "draft",
    }).catch((err) => {
      draftRunPostedRef.current.delete(key);
      console.warn("updateRDRunStatus(draft) failed", err);
    });
  }, [experimentId, groupId, cfgToken, currentRunKey, runStatusByKey]);

  const handleVariantChange = (
    metricKey: keyof Intake,
    patch: Partial<VariantOverride>
  ) => {
    const vKey = variantKey(experimentId, groupId);
    setVariantStore((prev) => {
      const existing = prev[vKey] || {};
      const current: VariantOverride =
        (existing[metricKey as string] as VariantOverride) || {
          enabled: false,
          value: "",
        };
      const nextMetric: VariantOverride = { ...current, ...patch };
      return {
        ...prev,
        [vKey]: {
          ...existing,
          [metricKey]: nextMetric,
        },
      };
    });
    // First-touch draft persistence: enabling an override or changing its value
    // counts as the user investing in this run.
    if (patch.enabled === true || (patch.value != null && patch.value !== "")) {
      ensureDraftRun();
    }
  };

  const groupsRaw =
    summary?.groups && typeof summary.groups === "object"
      ? Object.entries(summary.groups as Record<string, any>)
      : [];

  // Assign UI roles: first group = CONTROL, others = VARIANT A/B/...
  const groups = groupsRaw.map(([gid, g], idx) => {
    let role = "CONTROL";
    if (idx > 0) {
      const letter = String.fromCharCode("A".charCodeAt(0) + (idx - 1));
      role = `VARIANT ${letter}`;
    }
    return { gid, g, role };
  });

  const vKey = variantKey(experimentId, groupId);
  const currentOverrides: VariantOverrides = variantStore[vKey] || {};

  const controlEff =
    intake && targets ? buildEffectivePayload(intake, targets) : null;

     // ----- DAILY GATING (today key, snapshot/evidence/note) -----
  const getLocalDateKey = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayKey = getLocalDateKey();
  const todayNoteKey = `${experimentId}::${groupId}::${todayKey}`;
  const todayNote = dailyNotes[todayNoteKey] || "";
  const hasNoteToday = todayNote.trim().length > 0;

  const snapshotTodayKey = `${experimentId}::${groupId}::${todayKey}`;
  const hasLocalSnapshotToday = !!snapshotTodayFlags[snapshotTodayKey];

    const hasSnapshotToday = (() => {
    // If we don't have any groups yet, fall back entirely to local flag
    if (!groups.length) return hasLocalSnapshotToday;

    const activeGroup =
      groups.find((g) => g.gid === groupId) ?? groups[0];
    const g = activeGroup.g || {};

    const dates: any[] = Array.isArray(g.snapshotDates)
      ? g.snapshotDates
      : Array.isArray(g.snapshot_dates)
      ? g.snapshot_dates
      : [];

    if (
      dates.some(
        (d: any) => d && String(d).slice(0, 10) === todayKey
      )
    ) {
      return true;
    }

    const last =
      g.lastSnapshotAt ||
      g.last_snapshot_at ||
      g.last_log_at ||
      g.lastLogAt;
    if (last && String(last).slice(0, 10) === todayKey) {
      return true;
    }

    // Fallback: our own local per-day flag
    return hasLocalSnapshotToday;
  })();

  const controlInitKey = experimentId || "";
  const controlInitialized = !!controlInitFlags[controlInitKey];

  const hasEvidenceToday = (() => {
    const all = Object.values(photosByLogId);
    for (const arr of all) {
      for (const p of arr) {
        if (
          p.captured_at &&
          String(p.captured_at).slice(0, 10) === todayKey
        ) {
          return true;
        }
      }
    }
    return false;
  })();
    // Build per-slot metric series from photos (slot_index + metric_value)

  const metricSeriesBySlot: Record<SlotId, MetricPoint[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };

  const allPhotos = Object.values(photosByLogId).flat();

  for (const p of allPhotos) {
    const slotRaw = (p as any).slot_index;
    const valueRaw = (p as any).metric_value;
    const slotNum = Number(slotRaw);
    const valNum = Number(valueRaw);
    if (!Number.isFinite(slotNum) || !Number.isFinite(valNum)) continue;
    if (slotNum !== 1 && slotNum !== 2 && slotNum !== 3 && slotNum !== 4) continue;

    const slot = slotNum as SlotId;
    const dStr = p.captured_at ? String(p.captured_at) : "";
    metricSeriesBySlot[slot].push({ date: dStr, value: valNum });
  }

  // Sort each series by date (oldest -> newest), per slot explicitly
  ([
    1, 2, 3
  ] as SlotId[]).forEach((slot) => {
    metricSeriesBySlot[slot].sort((a, b) => {
      const ta = Date.parse(a.date);
      const tb = Date.parse(b.date);
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
      return ta - tb;
    });
  });
    const buildMetricPath = (
    series: MetricPoint[],
    width: number,
    height: number
  ): string => {
    if (series.length === 0) return "";
    if (series.length === 1) {
      const xMid = width / 2;
      const yMid = height / 2;
      return `M ${xMid} ${yMid} L ${xMid} ${yMid}`;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const p of series) {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return "";

    const span = max - min || 1; // avoid divide-by-zero
    const n = series.length;
    const stepX = n > 1 ? width / (n - 1) : width;

    const points: { x: number; y: number }[] = series.map((p, idx) => {
      const x = idx * stepX;
      const norm = (p.value - min) / span; // 0–1
      const y = height - norm * height;
      return { x, y };
    });

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };
    // Build per-day run history for this experiment/group
  type DaySummary = {
    date: string;
    hasSnapshot: boolean;
    photoCount: number;
    notePreview: string | null;
  };

  const daySummaries: DaySummary[] = (() => {
    const keyPrefix = `${experimentId}::${groupId}::`;
    const dates = new Set<string>();

    // From snapshot flags (variant snapshots logged)
    Object.keys(snapshotTodayFlags).forEach((k) => {
      if (!k.startsWith(keyPrefix)) return;
      const d = k.slice(keyPrefix.length);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        dates.add(d);
      }
    });

    // From notes
    Object.keys(dailyNotes).forEach((k) => {
      if (!k.startsWith(keyPrefix)) return;
      const d = k.slice(keyPrefix.length);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        dates.add(d);
      }
    });

    // From photos (captured_at)
    for (const p of allPhotos) {
      if (!p.captured_at) continue;
      const d = String(p.captured_at).slice(0, 10);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        dates.add(d);
      }
    }

    const out: DaySummary[] = [];
    const dateList = Array.from(dates);
    dateList.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); // newest first

    for (const d of dateList) {
      const snapshotKey = `${experimentId}::${groupId}::${d}`;
      const hasSnapshot = !!snapshotTodayFlags[snapshotKey];

      let photoCount = 0;
      for (const p of allPhotos) {
        if (!p.captured_at) continue;
        if (String(p.captured_at).slice(0, 10) === d) {
          photoCount++;
        }
      }

      const noteKey = `${experimentId}::${groupId}::${d}`;
      const noteRaw = dailyNotes[noteKey] || "";
      const firstLine = noteRaw.split(/\r?\n/)[0]?.trim() || "";
      const notePreview =
        firstLine.length > 0
          ? (firstLine.length > 80
              ? firstLine.slice(0, 77) + "..."
              : firstLine)
          : null;

      out.push({
        date: d,
        hasSnapshot,
        photoCount,
        notePreview,
      });
    }

    return out;
  })();


    // Start capture for a specific slot (1–4) in the structured-evidence wizard.
    // Slots 1–3 are required; slot 4 is optional and uses the user-defined label/units.
    const startCaptureForSlot = (slot: SlotId) => {
    if (!hasSnapshotToday) return;

    const raw = slotMetricInputs[slot];
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setWizardError("Enter a numeric value for this slot before capturing.");
      return;
    }

    if (slot === 4 && !slot4Meta.label.trim()) {
      setWizardError("Set a custom metric label for slot 4 before capturing.");
      return;
    }

    setWizardError(null);
    setCaptureStep(slot);
    void openCameraForEvidence();
  };


      const cmp = buildGateComparison();
  const heatmap = buildHeatmap();
  const flagDeltas = buildFlagDeltas();

  const allRunsForBrowser: ExperimentRunSummary[] = Object.entries(
    runStatusByKey
  )
    .map(([runKey, status]) => {
      const [expId, gid, token] = runKey.split("::");
      if (!expId) return null;
      return {
        runKey,
        experimentId: expId,
        groupId: gid || "",
        cfgToken: token || "",
        status,
      } as ExperimentRunSummary;
    })
    .filter((r): r is ExperimentRunSummary => r !== null);

  const renderMetricRow = (metricKey: keyof Intake) => {
    const label = FIELD_TARGET_LABEL[metricKey] || String(metricKey);
    const controlVal =
      controlEff && typeof (controlEff as any)[metricKey] !== "undefined"
        ? (controlEff as any)[metricKey]
        : undefined;
    const ov = currentOverrides[metricKey as string] || {
      enabled: false,
      value: "",
    };

    // Delta-vs-SOP chip: shows divergence between the variant value and the
    // control/SOP target so users can see at a glance how far they're pushing.
    const sopNum = Number(controlVal);
    const ovNum = ov.value === "" || ov.value == null ? NaN : Number(ov.value);
    const showDelta =
      !!ov.enabled &&
      Number.isFinite(sopNum) &&
      Number.isFinite(ovNum);
    const delta = showDelta ? ovNum - sopNum : 0;
    // Heat color: |delta| / max(|sop|, 1) gives a relative deviation. Reuse the
    // same green/cyan/yellow/red palette as scoreToHeatColor by inverting:
    // 0% deviation -> green, 5% -> cyan, 15% -> yellow, 25%+ -> red.
    const sopBand = Math.max(Math.abs(sopNum) * 0.05, 0.001);
    const ratio = showDelta ? Math.abs(delta) / sopBand : 0;
    const deltaColor = !showDelta
      ? "rgba(148,163,184,0.6)"
      : ratio < 1
      ? "rgba(34,197,163,0.95)"   // green: within ±5%
      : ratio < 3
      ? "rgba(56,189,248,0.95)"    // cyan: within ±15%
      : ratio < 5
      ? "rgba(234,179,8,0.95)"     // yellow: within ±25%
      : "rgba(248,113,113,0.95)";  // red: ≥25%
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "■";
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
    const absStr = Number.isFinite(delta) ? Math.abs(delta).toFixed(2) : "?";

    return (
      <div

        key={metricKey as string}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) 80px 80px 92px",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
        }}
      >
        <div>
          <div style={{ opacity: 0.8 }}>{label}</div>
          <div style={{ opacity: 0.6, fontSize: 10 }}>
            Control:{" "}
            {controlVal == null || !Number.isFinite(Number(controlVal))
              ? "-"
              : Number(controlVal).toFixed(2)}
          </div>
        </div>
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={!!ov.enabled}
              onChange={(e) =>
                handleVariantChange(metricKey, { enabled: e.target.checked })
              }
            />
            <span style={{ opacity: 0.8 }}>Under test</span>
          </label>
        </div>
        <div>
          <NumberInput
            step="0.01"
            disabled={!ov.enabled}
            value={ov.value === "" || ov.value == null ? undefined : Number(ov.value)}
            onChange={(v) =>
              handleVariantChange(metricKey, {
                value: v == null ? "" : (v as number),
              })
            }
            style={{
              width: "100%",
              padding: "4px 6px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: ov.enabled ? "#020509" : "#050505",
              color: "var(--text)",
              fontSize: 11,
              opacity: ov.enabled ? 1 : 0.5,
            }}
          />
        </div>
        <div>
          {showDelta ? (
            <span
              title={`vs SOP ${Number.isFinite(sopNum) ? sopNum.toFixed(2) : "?"}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 6px",
                borderRadius: 999,
                border: `1px solid ${deltaColor}`,
                color: deltaColor,
                background: "rgba(0,0,0,0.35)",
                fontSize: 10,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <span aria-hidden="true">{arrow}</span>
              <span>{sign}{absStr}</span>
            </span>
          ) : (
            <span
              style={{
                display: "inline-block",
                width: "100%",
                textAlign: "center",
                fontSize: 10,
                opacity: 0.35,
              }}
            >
              vs SOP
            </span>
          )}
        </div>
      </div>
    );
  };

  const colorForGate = (gate: string) => {
    const g = gate.toUpperCase();
    if (g === "ENV") return "#22d3ee"; // cyan
    if (g === "ROOT") return "#a855f7"; // purple
    return "#fbbf24"; // amber
  };

  const scoreToHeatColor = (score: number) => {
    if (score >= 85) return "rgba(34,197,163,0.9)"; // strong green
    if (score >= 70) return "rgba(56,189,248,0.95)"; // cyan
    if (score >= 50) return "rgba(234,179,8,0.95)"; // yellow
    return "rgba(248,113,113,0.95)"; // red
  };

  // ---- Gate comparison helper (CONTROL vs ACTIVE) ----
  function buildGateComparison() {
    if (!groups.length) return null;

    const control = groups[0];
    const active =
      groups.find((g) => g.gid === groupId) ?? control;

    const cEnv = Number(control.g.envScoreAvg ?? 0);
    const cRoot = Number(control.g.rootScoreAvg ?? 0);
    const cIrr = Number(control.g.irrScoreAvg ?? 0);

    const aEnv = Number(active.g.envScoreAvg ?? 0);
    const aRoot = Number(active.g.rootScoreAvg ?? 0);
    const aIrr = Number(active.g.irrScoreAvg ?? 0);

    const makeRow = (label: string, cVal: number, aVal: number) => {
      const diff = Math.round((aVal || 0) - (cVal || 0));
      let status: "ahead" | "even" | "behind" = "even";

      if (diff >= 5) status = "ahead";
      else if (diff <= -5) status = "behind";

      let badgeText = "EVEN";
      let badgeColor = "rgba(234,179,8,0.9)"; // yellow-ish
      let badgeGlow = "0 0 10px rgba(234,179,8,0.7)";

      if (status === "ahead") {
        badgeText = "AHEAD";
        badgeColor = "rgba(34,197,163,0.95)"; // cyan/green
        badgeGlow = "0 0 10px rgba(34,197,163,0.8)";
      } else if (status === "behind") {
        badgeText = "BEHIND";
        badgeColor = "rgba(244,63,94,0.95)"; // pink/red
        badgeGlow = "0 0 10px rgba(244,63,94,0.8)";
      }

      const fmt = (v: number) =>
        Number.isFinite(v) ? Math.round(v).toString() : "-";

      const diffLabel =
        diff === 0 ? "0" : diff > 0 ? `+${diff}` : `${diff}`;

      return {
        label,
        control: fmt(cVal),
        active: fmt(aVal),
        diffLabel,
        badgeText,
        badgeColor,
        badgeGlow,
      };
    };

    return {
      controlId: control.gid,
      activeId: active.gid,
      rows: [
        makeRow("ENV", cEnv, aEnv),
        makeRow("ROOT", cRoot, aRoot),
        makeRow("IRR", cIrr, aIrr),
      ],
    };
  }

  // ---- Heatmap helper (3 x N gate matrix) ----
  function buildHeatmap() {
    if (!groups.length) return null;
    const rows = ["ENV", "ROOT", "IRR"] as const;

    const getScore = (g: any, gate: (typeof rows)[number]) => {
      if (gate === "ENV") return Number(g.envScoreAvg ?? 0);
      if (gate === "ROOT") return Number(g.rootScoreAvg ?? 0);
      return Number(g.irrScoreAvg ?? 0);
    };

    return {
      groups,
      rows: rows.map((gate) => ({
        gate,
        cells: groups.map(({ gid, g }) => {
          const score = getScore(g, gate);
          const safe = Number.isFinite(score)
            ? Math.max(0, Math.min(100, score))
            : 0;
          return { gid, score: safe };
        }),
      })),
    };
  }

  // ---- Flag delta helper (active vs control) ----
  function buildFlagDeltas() {
    if (!groups.length) return null;

    const control = groups[0];
    const active =
      groups.find((g) => g.gid === groupId) ?? control;

    if (control.gid === active.gid) return null;

    const cFlags: any[] = Array.isArray(control.g.flags) ? control.g.flags : [];
    const aFlags: any[] = Array.isArray(active.g.flags) ? active.g.flags : [];

    const key = (f: any) =>
      `${String(f.name || "").trim()}::${String(
        f.gate || ""
      ).toUpperCase()}`;

    const controlMap = new Map<string, number>();
    for (const f of cFlags) {
      controlMap.set(key(f), Number(f.count ?? 0));
    }

    const deltas: { name: string; gate: string; delta: number }[] = [];
    for (const f of aFlags) {
      const k = key(f);
      const base = controlMap.get(k) ?? 0;
      const count = Number(f.count ?? 0);
      const d = count - base;
      if (d > 0) {
        deltas.push({
          name: String(f.name || ""),
          gate: String(f.gate || "").toUpperCase(),
          delta: d,
        });
      }
    }

    if (!deltas.length) return null;
    deltas.sort((a, b) => b.delta - a.delta);

    return {
      activeId: active.gid,
      rows: deltas.slice(0, 6),
    };
  }

    const handleTodayNoteChange = (value: string) => {
    setDailyNotes((prev) => ({
      ...prev,
      [todayNoteKey]: value,
    }));

    // Fire-and-forget backend sync so notes are recoverable
    if (experimentId && groupId) {
      const payload = {
        experimentId,
        groupId,
        dateKey: todayKey,          // "YYYY-MM-DD"
        runKey: currentRunKey,
        noteText: value,
      };
      void Sheet.postRNDNote(payload);
    }
  };

    // Step 2 evidence gating: photo + measurement required for slots 1-3 (slot 4 optional).
    const hasPhotoForSlot = (slot: SlotId): boolean => {
      const all = Object.values(photosByLogId);
      for (const arr of all) {
        for (const p of arr) {
          if (!p?.captured_at) continue;
          if (String(p.captured_at).slice(0, 10) !== todayKey) continue;
          const slotRaw = (p as any).slot_index;
          if (Number(slotRaw) === slot) return true;
        }
      }
      return false;
    };
    const requiredSlotsComplete = ([1, 2, 3] as SlotId[]).every(
      (s) => hasPhotoForSlot(s) && (slotMetricInputs[s] ?? "").trim() !== ""
    );

    const noteDisabled = !hasSnapshotToday || !requiredSlotsComplete || runLocked;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Top R&D test-flight bar */}
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
        {/* caution stripe layer */}
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

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Today’s Run gating strip */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 10,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".14em",
                opacity: 0.85,
              }}
            >
              Today’s Run · {todayKey}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "flex-end",
              }}
            >
              {/* Step 1: Snapshot */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: hasSnapshotToday
                    ? "rgba(34,197,94,0.9)"
                    : "rgba(148,163,184,0.8)",
                  background: hasSnapshotToday
                    ? "rgba(34,197,94,0.15)"
                    : "transparent",
                  boxShadow: hasSnapshotToday
                    ? "0 0 12px rgba(34,197,94,0.8)"
                    : "none",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: hasSnapshotToday
                      ? "#22c55e"
                      : "transparent",
                    border: hasSnapshotToday
                      ? "none"
                      : "1px solid rgba(148,163,184,0.9)",
                  }}
                />
                <span>1 · Snapshot</span>
              </div>

              {/* Step 2: Evidence */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: !hasSnapshotToday
                    ? "rgba(75,85,99,0.8)"
                    : hasEvidenceToday
                    ? "rgba(56,189,248,0.9)"
                    : "rgba(148,163,184,0.9)",
                  background: hasEvidenceToday
                    ? "rgba(56,189,248,0.15)"
                    : "transparent",
                  boxShadow: hasEvidenceToday
                    ? "0 0 12px rgba(56,189,248,0.8)"
                    : "none",
                  opacity: !hasSnapshotToday ? 0.45 : 1,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: hasEvidenceToday
                      ? "#38bdf8"
                      : "transparent",
                    border: hasEvidenceToday
                      ? "none"
                      : "1px solid rgba(148,163,184,0.9)",
                  }}
                />
                <span>2 · Evidence</span>
              </div>

              {/* Step 3: Note */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: !hasSnapshotToday
                    ? "rgba(75,85,99,0.8)"
                    : hasNoteToday
                    ? "rgba(249,115,22,0.95)"
                    : "rgba(148,163,184,0.9)",
                  background: hasNoteToday
                    ? "rgba(249,115,22,0.12)"
                    : "transparent",
                  boxShadow: hasNoteToday
                    ? "0 0 12px rgba(249,115,22,0.85)"
                    : "none",
                  opacity: !hasSnapshotToday ? 0.45 : 1,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: hasNoteToday ? "#f97316" : "transparent",
                    border: hasNoteToday
                      ? "none"
                      : "1px solid rgba(148,163,184,0.9)",
                  }}
                />
                <span>3 · Note</span>
              </div>
            </div>
          </div>

          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontFamily: "Audiowide, Orbitron, system-ui",
                fontSize: 14,
                letterSpacing: ".18em",
                textTransform: "uppercase",
              }}
            >
              R&amp;D // TEST FLIGHT
            </div>
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.7,
              }}
            >
              Experimental mode
            </span>
          </header>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ minWidth: 220 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  opacity: 0.8,
                  marginBottom: 4,
                }}
              >
                Experiment ID
              </label>
              <input
                value={experimentId}
                onChange={(e) => setExperimentId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "#000",
                  color: "var(--text)",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ minWidth: 160 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  opacity: 0.8,
                  marginBottom: 4,
                }}
              >
                Group ID
              </label>
              <input
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "#000",
                  color: "var(--text)",
                  fontSize: 12,
                }}
              />
            </div>

                        <div style={{ flex: "0 0 auto", display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={handleTestFlight}
                disabled={shooting || controlInitialized}
                style={{
                  // existing styles unchanged…
                }}
              >
                {/* existing content unchanged */}
              </button>

              <button
                type="button"
                className="btn ghost"
                disabled={shooting || runLocked}
                onClick={handleLogVariantSnapshot}
                style={{
                  fontSize: 11,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  borderRadius: 999,
                  padding: "8px 14px",
                  border: "1px solid rgba(177,76,255,0.85)",
                  background:
                    "radial-gradient(circle at 50% 0, rgba(177,76,255,0.26), rgba(15,23,42,0.96))",
                  color: "#e9d5ff",
                  boxShadow: shooting
                    ? "0 0 4px rgba(177,76,255,0.4)"
                    : "0 0 10px rgba(177,76,255,0.8)",
                  opacity: runLocked ? 0.55 : 1,
                  cursor: runLocked ? "not-allowed" : "pointer",
                }}
              >
                Log VARIANT snapshot
              </button>

              <button
                type="button"
                className="btn ghost"
                disabled={currentRunStatus !== "active"}
                onClick={() =>
                 setRunStatusByKey((prev) => ({
                  ...prev,
                  [currentRunKey]: "finished",
               }))
             }

                style={{
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  borderRadius: 999,
                  padding: "6px 10px",
                  border: "1px solid rgba(248,250,252,0.8)",
                  color:
                    currentRunStatus === "finished" ? "#e5e7eb" : "#f9fafb",
                  opacity: currentRunStatus === "active" ? 1 : 0.5,
                  cursor:
                    currentRunStatus === "active"
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                Finish run
              </button>
            </div>
                        <div
              style={{
                marginTop: 6,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ opacity: 0.7 }}>Run status</span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  backgroundColor: runStatusColor,
                  color: "#020617",
                  boxShadow: `0 0 10px ${runStatusColor}`,
                  fontWeight: 700,
                }}
              >
                {runStatusLabel}
              </span>
            </div>


          </div>

          <p
            style={{
              fontSize: 13,
              opacity: 0.82,
              marginBottom: 10,
              maxWidth: 620,
            }}
          >
            Step 1 logs today&apos;s snapshot against this experiment and
            group. Step 2 captures visual evidence, and Step 3 stores a
            short daily note so future you remembers exactly what you did.
          </p>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: "#f97373",
                marginTop: 4,
                marginBottom: 4,
              }}
            >
              {error}
            </div>
          )}

          {loading && (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Loading summary…
            </div>
          )}

          {!loading && !groups.length && !error && (
            <div
              style={{
                fontSize: 12,
                opacity: 0.75,
                marginTop: 6,
              }}
            >
              No R&amp;D groups logged yet for this experiment. Use a
              consistent <code>Experiment ID</code> and different{" "}
              <code>Group ID</code>s (e.g. <b>GRP-CONTROL</b>,{" "}
              <b>GRP-HIGH-EC</b>) when capturing test flights.
            </div>
          )}


          {/* Visual evidence strip for this experiment/group */}
                    {/* 3-slot structured evidence wizard (height / canopy / stem) */}
          {hasSnapshotToday && (
                        <div
              style={{
                marginTop: 8,
                marginBottom: 6,
                padding: 8,
                borderRadius: 10,
                border: "1px solid rgba(177,76,255,0.7)",
                background:
                  "radial-gradient(circle at 0 0, rgba(177,76,255,0.20), transparent 55%), #020008",
                boxShadow: "0 0 18px rgba(177,76,255,0.35)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  opacity: 0.8,
                  marginBottom: 6,
                }}
              >
                Structured evidence · 3 required + 1 optional
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                  gap: 8,
                  fontSize: 11,
                }}
              >
                {([1, 2, 3, 4] as const).map((slot) => {
                  const s = slot as SlotId;
                  const meta = slotMeta[s];
                  const value = slotMetricInputs[s];
                  const isOptional = s === 4;
                  const slotComplete = hasPhotoForSlot(s) && (value ?? "").trim() !== "";
                  return (
                                        <div
                      key={slot}
                      style={{
                        padding: 6,
                        borderRadius: 8,
                        border: isOptional
                          ? "1px dashed rgba(125,211,252,0.55)"
                          : "1px solid rgba(15,23,42,0.9)",
                        backgroundImage: isOptional
                          ? "repeating-linear-gradient(45deg, #03101a 0, #03101a 4px, #04141f 4px, #04141f 8px)"
                          : "repeating-linear-gradient(45deg, #020617 0, #020617 4px, #040815 4px, #040815 8px)",
                        backgroundColor: isOptional ? "#03101a" : "#020617",
                        boxShadow: isOptional
                          ? "0 0 10px rgba(56,189,248,0.18)"
                          : "0 0 12px rgba(15,23,42,0.8)",
                        opacity: isOptional ? 0.95 : 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                          opacity: 0.75,
                          marginBottom: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 4,
                        }}
                      >
                        <span>Slot {slot}{isOptional ? " · optional" : ""}</span>
                        {slotComplete && (
                          <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                        )}
                      </div>
                      {isOptional ? (
                        <div style={{ display: "grid", gap: 3, marginBottom: 4 }}>
                          <input
                            type="text"
                            value={slot4Meta.label}
                            placeholder="+ custom metric label"
                            onChange={(e) =>
                              setSlot4Meta((prev) => ({ ...prev, label: e.target.value }))
                            }
                            style={{
                              width: "100%",
                              padding: "3px 6px",
                              borderRadius: 6,
                              border: "1px solid var(--border)",
                              background: "#020309",
                              color: "var(--text)",
                              fontSize: 10,
                            }}
                          />
                          <input
                            type="text"
                            value={slot4Meta.units}
                            placeholder="units (e.g. cm, ppm)"
                            onChange={(e) =>
                              setSlot4Meta((prev) => ({ ...prev, units: e.target.value }))
                            }
                            style={{
                              width: "100%",
                              padding: "3px 6px",
                              borderRadius: 6,
                              border: "1px solid var(--border)",
                              background: "#020309",
                              color: "var(--text)",
                              fontSize: 10,
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            marginBottom: 4,
                            fontWeight: 600,
                          }}
                        >
                          {meta.label}
                        </div>
                      )}
                      <div style={{ marginBottom: 4 }}>
                        <NumberInput
                          step="0.01"
                          value={value === "" || value == null ? undefined : Number(value)}
                          onChange={(v) =>
                            setSlotMetricInputs((prev) => ({
                              ...prev,
                              [s]: v == null ? "" : String(v),
                            }))
                          }
                          placeholder={meta.units || (isOptional ? "value" : "")}
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "#020309",
                            color: "var(--text)",
                            fontSize: 11,
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          width: "100%",
                          fontSize: 10,
                          padding: "4px 6px",
                          borderRadius: 999,
                        }}
                        onClick={() => startCaptureForSlot(s)}
                        disabled={savingPhoto || (isOptional && !slot4Meta.label.trim())}
                        title={
                          isOptional && !slot4Meta.label.trim()
                            ? "Set a custom metric label first"
                            : undefined
                        }
                      >
                        {savingPhoto
                          ? "Capturing…"
                          : `Capture slot ${slot}`}
                      </button>
                    </div>
                  );
                })}
              </div>
              {wizardError && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#f97373",
                  }}
                >
                  {wizardError}
                </div>
              )}
            </div>
          )}
                              {/* Slot metric deltas since first recorded measurement */}
          {hasSnapshotToday && (
            <div
              style={{
                marginTop: 4,
                marginBottom: 6,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 11,
              }}
            >
              {([1, 2, 3, 4] as const).map((slot) => {
                const s = slot as SlotId;
                const series = metricSeriesBySlot[s];
                if (!series.length) return null;

                // Inline delta calc: last - first, single-point -> 0
                let delta: number | null = null;
                if (series.length === 1) {
                  delta = 0;
                } else if (series.length > 1) {
                  const first = series[0];
                  const lastPoint = series[series.length - 1];
                  delta = lastPoint.value - first.value;
                }

                if (delta == null) return null;
                const last = series[series.length - 1];

                const meta = slotMeta[s];
                const up = delta >= 0;
                const abs = Math.abs(delta);
                const unit = meta.units;
                const label =
                  s === 1
                    ? "Height"
                    : s === 2
                    ? "Canopy"
                    : s === 3
                    ? "Stem"
                    : (slot4Meta.label || "Custom").slice(0, 10);

                                              const path = buildMetricPath(series, 60, 18);

                return (
                  <div
                    key={`delta-${slot}`}
                    onClick={() => setMetricChartSlot(s)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.7)",
                      background: "rgba(15,23,42,0.96)",
                      boxShadow: "0 0 10px rgba(15,23,42,0.9)",
                      cursor: "pointer",
                    }}
                    title="Tap to expand full metric graph"
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: up ? "#22c55e" : "#f97316",
                        boxShadow: up
                          ? "0 0 8px rgba(34,197,94,0.9)"
                          : "0 0 8px rgba(249,115,22,0.9)",
                      }}
                    />
                    <span
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        opacity: 0.8,
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {up ? "▲" : "▼"} {abs.toFixed(1)} {unit}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        opacity: 0.6,
                      }}
                    >
                      (last: {last.value.toFixed(1)} {unit})
                    </span>
                    {path && (
                      <svg
                        width={60}
                        height={18}
                        viewBox="0 0 60 18"
                        style={{
                          marginLeft: 4,
                          opacity: 0.9,
                        }}
                      >
                        <path
                          d={path}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.2}
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          )}

                    <div style={{ marginTop: 10 }}>
                                <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="btn ghost"
              disabled={!hasSnapshotToday}
              onClick={() => setShowSymptomModal(true)}
              style={{ fontSize: 11 }}
            >
              Log symptoms
            </button>
          </div>

            {loadingPhotos ? (
              <div style={{ fontSize: 11, opacity: 0.75 }}>
                Loading photo evidence…
              </div>
            ) : (
              <RnDPhotoStrip
                photos={photosByLogId[ALL_LOG_KEY] || []}
                onCapture={
                  hasSnapshotToday && !runLocked
                    ? openCameraForEvidence
                    : undefined
                }
                isSaving={savingPhoto}
                onDelete={handleDeletePhoto}
                canCapture={hasSnapshotToday && !runLocked}
                captureHint={
                  runLocked
                    ? "Run finished – capture disabled for this run."
                    : hasSnapshotToday
                    ? hasEvidenceToday
                      ? "Evidence logged for today – capture extra angles if useful."
                      : "Step 2: capture today’s evidence."
                    : "Log today’s snapshot (Step 1) to unlock evidence capture."
                }
              />
            )}
          </div>


          {/* Today’s note (Step 3) */}
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.8,
                marginBottom: 4,
              }}
            >
              Today&apos;s note
            </label>
                                <textarea
              rows={3}
              value={todayNote}
              onChange={(e) => handleTodayNoteChange(e.target.value)}
              disabled={noteDisabled}
              placeholder={
                !hasSnapshotToday
                  ? "Log today’s snapshot first to enable notes."
                  : runLocked
                  ? "Run finished – notes for this run are read-only."
                  : !requiredSlotsComplete
                  ? "Complete the 3 required photo+measurement slots first."
                  : "What did you change, observe, or decide today for this group?"
              }
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: noteDisabled ? "#050814" : "#020309",
                color: "var(--text)",
                fontSize: 11,
                resize: "vertical",
                opacity: noteDisabled ? 0.45 : 1,
              }}
            />


                        {!hasSnapshotToday ? (
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.7,
                  marginTop: 4,
                }}
              >
                Step 3 is locked until you capture a snapshot for{" "}
                <b>{todayKey}</b>. That keeps every note tied to actual
                data.
              </div>
            ) : runLocked ? (
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.8,
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#9ca3af",
                    boxShadow: "0 0 8px rgba(148,163,184,0.8)",
                  }}
                />
                <span>
                  Run finished – daily note for <b>{todayKey}</b> is preserved but
                  cannot be edited for this run.
                </span>
              </div>
            ) : !hasNoteToday ? (
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  marginTop: 4,
                }}
              >
                Type a short note for <b>{todayKey}</b>. It&apos;s saved
                automatically as you type.
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.85,
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#f97316",
                    boxShadow: "0 0 8px rgba(249,115,22,0.8)",
                  }}
                />
                <span>
                  Today&apos;s note logged for <b>{todayKey}</b>.
                </span>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* CONTROL vs ACTIVE gate scoreboard */}
      {cmp && (
        <section
          className="card"
          style={{
            marginBottom: 12,
            borderRadius: 14,
            border: "1px solid rgba(0,247,219,0.35)",
            background:
              "radial-gradient(circle at 0 0, rgba(0,247,219,0.10), transparent 55%), #020509",
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
                Gate Scoreboard
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  marginTop: 2,
                }}
              >
                Comparing <b>{cmp.controlId}</b> (control) vs{" "}
                <b>{cmp.activeId}</b> (active)
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.2fr) 90px 90px 120px",
              gap: 8,
              fontSize: 11,
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.7,
              }}
            >
              Gate
            </div>
            <div style={{ opacity: 0.7 }}>Control</div>
            <div style={{ opacity: 0.7 }}>Active</div>
            <div style={{ opacity: 0.7 }}>Delta</div>

            {cmp.rows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: "contents",
                }}
              >
                <div style={{ fontWeight: 600 }}>{row.label}</div>

                {/* Control bar */}
                <div>
                  <div
                    style={{
                      position: "relative",
                      height: 14,
                      borderRadius: 999,
                      background: "rgba(15,23,42,0.9)",
                      overflow: "hidden",
                      border: "1px solid rgba(148,163,184,0.6)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${Math.max(
                          0,
                          Math.min(100, Number(row.control) || 0)
                        )}%`,
                        background:
                          "linear-gradient(90deg, rgba(148,163,184,0.9), transparent)",
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                        fontSize: 10,
                        padding: "0 6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{row.control}</span>
                    </div>
                  </div>
                </div>

                {/* Active bar */}
                <div>
                  <div
                    style={{
                      position: "relative",
                      height: 14,
                      borderRadius: 999,
                      background: "rgba(15,23,42,0.9)",
                      overflow: "hidden",
                      border: "1px solid rgba(56,189,248,0.7)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${Math.max(
                          0,
                          Math.min(100, Number(row.active) || 0)
                        )}%`,
                        background:
                          "linear-gradient(90deg, rgba(56,189,248,0.9), transparent)",
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                        fontSize: 10,
                        padding: "0 6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{row.active}</span>
                    </div>
                  </div>
                </div>

                {/* Badge */}
                <div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 8px",
                      borderRadius: 999,
                      backgroundColor: row.badgeColor,
                      boxShadow: row.badgeGlow,
                      color: "#020617",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".12em",
                    }}
                  >
                    <span>{row.badgeText}</span>
                    <span
                      style={{
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.diffLabel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Heatmap (data picture book) */}
      {heatmap && (
        <section
          className="card"
          style={{
            marginBottom: 16,
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.5)",
            background:
              "radial-gradient(circle at 0 0, rgba(15,23,42,0.9), transparent 55%), #020409",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
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
                Gate Heatmap
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  marginTop: 2,
                }}
              >
                Quick picture of ENV / ROOT / IRR scores for each group.
              </div>
            </div>
          </div>

          <div
            style={{
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            <div
              style={{
                display: "grid",
                gridAutoColumns: "minmax(70px,1fr)",
                gridAutoFlow: "column",
                gap: 6,
                fontSize: 10,
                alignItems: "center",
                minWidth: 260,
              }}
            >
              {/* Header row: group IDs */}
              <div style={{ fontSize: 10, opacity: 0.7 }}>Gate</div>
              {heatmap.groups.map(({ gid }) => (
                <div
                  key={gid}
                  style={{
                    textAlign: "center",
                    opacity: 0.85,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {gid}
                </div>
              ))}

              {/* Rows for ENV / ROOT / IRR */}
              {heatmap.rows.map((row) => (
                <div
                  key={row.gate}
                  style={{
                    display: "contents",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {row.gate}
                  </div>
                  {row.cells.map((cell) => {
                    const bg = scoreToHeatColor(cell.score);
                    const isControl = cell.gid === heatmap.groups[0].gid;
                    return (
                      <div
                        key={`${row.gate}-${cell.gid}`}
                        style={{
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 18,
                            borderRadius: 6,
                            backgroundColor: bg,
                            boxShadow: `0 0 10px ${bg}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#020617",
                            fontSize: 10,
                            fontWeight: 700,
                            position: "relative",
                          }}
                        >
                          <span>{Math.round(cell.score)}</span>
                          {isControl && (
                            <span
                              style={{
                                position: "absolute",
                                insetInlineStart: -6,
                                insetBlockStart: -6,
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                border: "1px solid #e5e7eb",
                                backgroundColor: "#020617",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Flag deltas (sticker strip for what got worse vs control) */}
      {flagDeltas && (
        <section
          className="card"
          style={{
            marginBottom: 16,
            borderRadius: 14,
            border: "1px solid rgba(248,250,252,0.2)",
            background:
              "radial-gradient(circle at 0 0, rgba(51,65,85,0.6), transparent 55%), #020409",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
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
                Symptom Delta Strip
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  marginTop: 2,
                }}
              >
                Extra flags in <b>{flagDeltas.activeId}</b> compared to
                control.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {flagDeltas.rows.map((f, idx) => {
              const c = colorForGate(f.gate);
              return (
                <div
                  key={`${f.name}-${f.gate}-${idx}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    borderRadius: 999,
                    backgroundColor: "rgba(15,23,42,0.95)",
                    border: `1px solid ${c}`,
                    boxShadow: `0 0 12px ${c}80`,
                    fontSize: 10,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: c,
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {f.name}
                  </span>
                  <span
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      opacity: 0.8,
                    }}
                  >
                    {f.gate}
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: c,
                    }}
                  >
                    +{f.delta}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CONTROL baseline + VARIANT editor */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "Audiowide, Orbitron, system-ui",
                fontSize: 12,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                opacity: 0.9,
              }}
            >
              Control Baseline
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.8,
                marginTop: 4,
              }}
            >
              Current SOP / config as seen by the engine. Read-only baseline.
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>
            {intake ? (
              <>
                <div>
                  Stage: <b>{intake.stage || "—"}</b>
                </div>
                <div>
                  Medium: <b>{intake.medium || "—"}</b> · Container:{" "}
                  <b>{intake.container || "—"}</b>
                </div>
                <div>
                  Mode: <b>{intake.mode || "automation"}</b> · SOP:{" "}
                  <b>{intake.profile || "Default"}</b>
                </div>
              </>
            ) : (
              <span>
                No Intake context yet. Fill Intake once to seed the control
                baseline.
              </span>
            )}
          </div>
        </div>

        {controlEff ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
              gap: 16,
            }}
          >
            {/* CONTROL metrics (compact list) */}
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(0,247,219,.35)",
                padding: 10,
                background:
                  "radial-gradient(circle at 0 0, rgba(0,247,219,.08), transparent 55%)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".14em",
                  marginBottom: 6,
                  opacity: 0.8,
                }}
              >
                ENV / ROOT / IRR targets
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  gap: 6,
                  fontSize: 11,
                }}
              >
                {[...RND_ENV_KEYS, ...RND_ROOT_KEYS, ...RND_IRR_KEYS].map(
                  (key) => {
                    const label =
                      FIELD_TARGET_LABEL[key] || String(key);
                    const v = (controlEff as any)[key];
                    const display =
                      v == null || !Number.isFinite(Number(v))
                        ? "-"
                        : Number(v).toFixed(2);
                    return (
                      <div key={key as string}>
                        <div style={{ opacity: 0.7 }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{display}</div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* VARIANT editor */}
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(177,76,255,.6)",
                padding: 10,
                background:
                  "radial-gradient(circle at 0 0, rgba(177,76,255,.12), transparent 55%)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".14em",
                  marginBottom: 6,
                  opacity: 0.9,
                }}
              >
                Variant Plan · {groupId || "set Group ID"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.8,
                  marginBottom: 8,
                }}
              >
                Tick &quot;under test&quot; for the metrics you&apos;re
                changing and enter the planned target. The VARIANT snapshot
                will only override these; everything else stays on control.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr)",
                  gap: 10,
                  maxHeight: 260,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: ".12em",
                      opacity: 0.75,
                      marginBottom: 4,
                    }}
                  >
                    ENV
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {RND_ENV_KEYS.map(renderMetricRow)}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: ".12em",
                      opacity: 0.75,
                      marginBottom: 4,
                    }}
                  >
                    ROOT
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {RND_ROOT_KEYS.map(renderMetricRow)}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: ".12em",
                      opacity: 0.75,
                      marginBottom: 4,
                    }}
                  >
                    IRR
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {RND_IRR_KEYS.map(renderMetricRow)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            No control metrics yet. Run Intake at least once with a valid
            SOP/config to seed the baseline.
          </div>
        )}
      </section>

      {/* CONTROL / VARIANT cards with plan fields + summary */}
      {groups.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 12,
            }}
          >
            {groups.map(({ gid, g, role }) => {
              const env = Number(g.envScoreAvg ?? 0);
              const root = Number(g.rootScoreAvg ?? 0);
              const irr = Number(g.irrScoreAvg ?? 0);
              const minScore = Math.min(
                Number.isFinite(env) ? env : 0,
                Number.isFinite(root) ? root : 0,
                Number.isFinite(irr) ? irr : 0
              );

              const tier =
                minScore <= 0
                  ? "crit"
                  : minScore <= 60
                  ? "amber"
                  : minScore <= 85
                  ? "yellow"
                  : "cyan";
              const tierColor =
                tier === "cyan"
                  ? "var(--cy)"
                  : tier === "yellow"
                  ? "var(--yl)"
                  : tier === "amber"
                  ? "var(--am)"
                  : "var(--rd)";
              const tierLabel =
                tier === "cyan"
                  ? "Stable"
                  : tier === "yellow"
                  ? "Check soon"
                  : tier === "amber"
                  ? "Needs attention"
                  : "Critical";

              const flags: any[] = Array.isArray(g.flags) ? g.flags : [];

              const key = planKey(experimentId, gid);
              const plan = plans[key] || { label: "", notes: "" };

              return (
                <div
                  key={gid}
                  className="card"
                  style={{
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background:
                      "radial-gradient(circle at 0 0, rgba(0,247,219,.08), transparent 55%), #020508",
                  }}
                >
                  {/* role + id */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
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
                        {role}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                          marginTop: 2,
                        }}
                      >
                        {gid}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        borderRadius: 999,
                        border: `1px solid ${tierColor}`,
                        padding: "4px 8px",
                        color: tierColor,
                      }}
                    >
                      {tierLabel}
                    </span>
                  </div>

                  {/* Plan editor */}
                  <div
                    style={{
                      marginTop: 4,
                      marginBottom: 8,
                      fontSize: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: ".12em",
                        opacity: 0.75,
                        marginBottom: 4,
                      }}
                    >
                      Plan
                    </label>
                    <input
                      placeholder={
                        role === "CONTROL"
                          ? "Control label (e.g. SOP Default)"
                          : "Variant label (e.g. +0.4 EC, longer dryback)"
                      }
                      value={plan.label}
                      onChange={(e) => {
                        const next = {
                          ...plans,
                          [key]: {
                            ...plan,
                            label: e.target.value,
                          },
                        };
                        setPlans(next);
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "#000",
                        color: "var(--text)",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    />
                    <textarea
                      placeholder={
                        role === "CONTROL"
                          ? "What does the control represent?"
                          : "What exactly are you changing in this variant?"
                      }
                      value={plan.notes}
                      onChange={(e) => {
                        const next = {
                          ...plans,
                          [key]: {
                            ...plan,
                            notes: e.target.value,
                          },
                        };
                        setPlans(next);
                      }}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(0,247,219,.4)",
                        background: "#020309",
                        color: "var(--text)",
                        fontSize: 11,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  {/* metrics summary */}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ opacity: 0.7 }}>ENV</div>
                      <div style={{ fontWeight: 700 }}>
                        {Number.isFinite(env) ? env.toFixed(0) : "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.7 }}>ROOT</div>
                      <div style={{ fontWeight: 700 }}>
                        {Number.isFinite(root) ? root.toFixed(0) : "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.7 }}>IRR</div>
                      <div style={{ fontWeight: 700 }}>
                        {Number.isFinite(irr) ? irr.toFixed(0) : "-"}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ opacity: 0.7 }}>Snapshots</div>
                      <div style={{ fontWeight: 700 }}>
                        {g.snapshots ?? 0}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 1,
                      margin: "6px 0 8px",
                      background:
                        "linear-gradient(90deg, transparent, rgba(0,247,219,.35) 16%, rgba(0,247,219,.35) 84%, transparent)",
                    }}
                  />

                  {/* Flags */}
                  {flags.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        fontStyle: "italic",
                      }}
                    >
                      No flags recorded yet for this group in R&amp;D.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {flags.map((f, idx) => (
                        <div
                          key={idx}
                          style={{
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            padding: "6px 8px",
                            background: "rgba(0,0,0,0.65)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {f.name}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                textTransform: "uppercase",
                                opacity: 0.7,
                              }}
                            >
                              {String(f.gate || "").toUpperCase()} · hits{" "}
                              {f.count ?? 0}
                            </span>
                          </div>
                          {f.soft_warning && (
                            <div
                              style={{
                                fontSize: 11,
                                opacity: 0.85,
                                marginTop: 4,
                              }}
                            >
                              {f.soft_warning}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
            {/* Run History · per-day experiment log */}
      {daySummaries.length > 0 && (
        <section
          className="card"
          style={{
            marginBottom: 16,
            borderRadius: 16,
            border: "1px solid rgba(177,76,255,0.7)",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(2,6,23,0.98))",
            boxShadow:
              "0 0 24px rgba(177,76,255,0.55), 0 0 32px rgba(34,211,238,0.45)",
            backdropFilter: "blur(22px)",
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
                Run History
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  marginTop: 2,
                }}
              >
                One line per day this experiment ran for{" "}
                <b>{groupId || "current group"}</b>.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 11,
            }}
          >
            {daySummaries.map((d) => (
              <div
                key={d.date}
                onClick={() => setSelectedDay(d.date)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 10,
                  border: "1px solid rgba(31,41,55,0.9)",
                  background:
                    "linear-gradient(90deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Audiowide, Orbitron, system-ui",
                      fontSize: 11,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      opacity: 0.9,
                    }}
                  >
                    {d.date}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: d.hasSnapshot
                          ? "1px solid rgba(34,197,94,0.9)"
                          : "1px solid rgba(75,85,99,0.8)",
                        background: d.hasSnapshot
                          ? "rgba(22,163,74,0.15)"
                          : "transparent",
                        fontSize: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: d.hasSnapshot
                            ? "#22c55e"
                            : "transparent",
                          border: d.hasSnapshot
                            ? "none"
                            : "1px solid rgba(148,163,184,0.9)",
                        }}
                      />
                      <span>Snapshot</span>
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border:
                          d.photoCount > 0
                            ? "1px solid rgba(56,189,248,0.9)"
                            : "1px solid rgba(75,85,99,0.8)",
                        background:
                          d.photoCount > 0
                            ? "rgba(56,189,248,0.12)"
                            : "transparent",
                        fontSize: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor:
                            d.photoCount > 0 ? "#38bdf8" : "transparent",
                          border:
                            d.photoCount > 0
                              ? "none"
                              : "1px solid rgba(148,163,184,0.9)",
                        }}
                      />
                      <span>Photos ×{d.photoCount}</span>
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: d.notePreview
                          ? "1px solid rgba(249,115,22,0.95)"
                          : "1px solid rgba(75,85,99,0.8)",
                        background: d.notePreview
                          ? "rgba(249,115,22,0.12)"
                          : "transparent",
                        fontSize: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: d.notePreview
                            ? "#f97316"
                            : "transparent",
                          border: d.notePreview
                            ? "none"
                            : "1px solid rgba(148,163,184,0.9)",
                        }}
                      />
                      <span>Note</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    opacity: d.notePreview ? 0.9 : 0.65,
                    fontStyle: d.notePreview ? "normal" : "italic",
                  }}
                >
                  {d.notePreview ? d.notePreview : "No note logged for this day."}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
                     {/* Experiment browser: all experiments and their runs */}
      {loadedHistoricalRun && loadedHistoricalRun.runKey === currentRunKey && (
        <div
          style={{
            margin: "8px 0",
            padding: "8px 12px",
            border: "1px solid rgba(56,189,248,0.6)",
            borderRadius: 10,
            background: "rgba(2,132,199,0.12)",
            color: "var(--ink)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
          role="status"
        >
          <span>
            Loaded historical run · cfg <code>{loadedHistoricalRun.cfgToken.slice(0, 16)}</code>
            {loadedHistoricalRun.cfgToken.length > 16 ? "…" : ""}
            . Variant inputs reflect the prior configuration.
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => setLoadedHistoricalRun(null)}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <ExperimentBrowserPanel
        runs={allRunsForBrowser}
        currentRunKey={currentRunKey}
        onSelectRun={(run) => {
          if (run.experimentId) {
            setExperimentId(run.experimentId);
          }
          if (run.groupId) {
            setGroupId(run.groupId);
          }
          // Restore cfg token via the historical-run override so currentRunKey,
          // variant store key and run lock all reflect the prior configuration.
          setLoadedHistoricalRun({
            runKey: run.runKey,
            experimentId: run.experimentId,
            groupId: run.groupId,
            cfgToken: run.cfgToken,
            schemaVersion: 1,
          });
        }}
      />
            {/* Per-day detail modal (from Run History click) */}
      {selectedDay && (() => {
        const date = selectedDay;
        const snapshotKey = `${experimentId}::${groupId}::${date}`;
        const hasSnapshot = !!snapshotTodayFlags[snapshotKey];

        const noteKey = `${experimentId}::${groupId}::${date}`;
        const noteRaw = dailyNotes[noteKey] || "";

        const photosForDay = allPhotos.filter((p) => {
          if (!p.captured_at) return false;
          return String(p.captured_at).slice(0, 10) === date;
        });

        const slotValues: Record<SlotId, number | null> = { 1: null, 2: null, 3: null, 4: null };
        photosForDay.forEach((p) => {
          const slotNum = Number((p as any).slot_index);
          const valNum = Number((p as any).metric_value);
          if (!Number.isFinite(slotNum) || !Number.isFinite(valNum)) return;
          if (slotNum !== 1 && slotNum !== 2 && slotNum !== 3 && slotNum !== 4) return;
          const s = slotNum as SlotId;
          slotValues[s] = valNum; // last value wins
        });

        const fullNote = noteRaw.trim();

                const symKey = `${experimentId}::${groupId}::${date}`;
        const symKeysForDay = (dailySymptoms[symKey] || []) as SymKey[];

        const symptomLabelMap: Record<SymKey, string> = RND_SYMPTOM_OPTIONS.reduce(
          (acc, opt) => {
            acc[opt.key] = opt.label;
            return acc;
          },
          {} as Record<SymKey, string>
        );


        return (
          <div
            className="dialog-backdrop history-backdrop"
            onClick={() => setSelectedDay(null)}
          >
            <div
              className="dialog history-panel hud-glass"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Run summary ${date}`}
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "Audiowide, Orbitron, system-ui",
                      fontSize: 12,
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      opacity: 0.9,
                    }}
                  >
                    Run summary
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.8,
                    }}
                  >
                    {date} · {groupId || "current group"}
                  </div>
                </div>
                <button
                  className="btn ghost"
                  onClick={() => setSelectedDay(null)}
                >
                  Close
                </button>
              </div>

              {/* Snapshot / photos / note chips */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  fontSize: 10,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: hasSnapshot
                      ? "1px solid rgba(34,197,94,0.9)"
                      : "1px solid rgba(75,85,99,0.8)",
                    background: hasSnapshot
                      ? "rgba(22,163,74,0.15)"
                      : "transparent",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: hasSnapshot ? "#22c55e" : "transparent",
                      border: hasSnapshot
                        ? "none"
                        : "1px solid rgba(148,163,184,0.9)",
                    }}
                  />
                  <span>Snapshot</span>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border:
                      photosForDay.length > 0
                        ? "1px solid rgba(56,189,248,0.9)"
                        : "1px solid rgba(75,85,99,0.8)",
                    background:
                      photosForDay.length > 0
                        ? "rgba(56,189,248,0.12)"
                        : "transparent",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor:
                        photosForDay.length > 0 ? "#38bdf8" : "transparent",
                      border:
                        photosForDay.length > 0
                          ? "none"
                          : "1px solid rgba(148,163,184,0.9)",
                    }}
                  />
                  <span>Photos ×{photosForDay.length}</span>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: fullNote
                      ? "1px solid rgba(249,115,22,0.95)"
                      : "1px solid rgba(75,85,99,0.8)",
                    background: fullNote
                      ? "rgba(249,115,22,0.12)"
                      : "transparent",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: fullNote ? "#f97316" : "transparent",
                      border: fullNote
                        ? "none"
                        : "1px solid rgba(148,163,184,0.9)",
                    }}
                  />
                  <span>Note</span>
                </div>
              </div>

              {/* Structured metrics for this day */}
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(31,41,55,0.9)",
                  padding: 8,
                  background:
                    "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".12em",
                    opacity: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Structured metrics
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                    gap: 8,
                    fontSize: 11,
                  }}
                >
                  {([1, 2, 3, 4] as const).map((slot) => {
                    const s = slot as SlotId;
                    const meta = slotMeta[s];
                    const v = slotValues[s];
                    return (
                      <div key={slot}>
                        <div
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: ".08em",
                            opacity: 0.75,
                            marginBottom: 2,
                          }}
                        >
                          Slot {slot}
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                          }}
                        >
                          {meta.label}
                        </div>
                        <div
                          style={{
                            opacity: 0.85,
                          }}
                        >
                          {v == null
                            ? "—"
                            : `${v.toFixed(1)} ${meta.units}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

                            {/* Symptoms for this day */}
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(31,41,55,0.9)",
                  padding: 8,
                  background:
                    "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
                  fontSize: 11,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".12em",
                    opacity: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Symptoms
                </div>
                {symKeysForDay.length === 0 ? (
                  <div
                    style={{
                      opacity: 0.7,
                      fontStyle: "italic",
                    }}
                  >
                    No symptoms logged for this day.
                  </div>
                ) : (
                  <ul
                    style={{
                      listStyle: "disc",
                      paddingLeft: 16,
                      margin: 0,
                    }}
                  >
                    {symKeysForDay.map((sym) => (
                      <li key={sym}>{symptomLabelMap[sym]}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Full note */}
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(31,41,55,0.9)",
                  padding: 8,
                  background:
                    "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
                  fontSize: 11,
                  maxHeight: 160,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".12em",
                    opacity: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Day note
                </div>
                <div style={{ opacity: fullNote ? 0.95 : 0.7, fontStyle: fullNote ? "normal" : "italic" }}>
                  {fullNote || "No note logged for this day."}
                </div>
              </div>
            </div>
          </div>
        );
      })()}


            {/* Trends / future R&D graph zone */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Trends (Prototype)</h3>
        <p
          style={{
            fontSize: 12,
            opacity: 0.8,
            marginBottom: 8,
          }}
        >
          This strip reuses your existing trends capture. It will be adapted
          to R&amp;D experiments so you can overlay test flights over time.
        </p>
        <TrendsStrip />
      </section>

      {/* Full metric history modal (clickable from delta chips) */}
      {metricChartSlot && (
        <div
          className="dialog-backdrop history-backdrop"
          onClick={() => setMetricChartSlot(null)}
        >
          <div
            className="dialog history-panel hud-glass"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Metric history"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {(() => {
              const slot = metricChartSlot as SlotId;
              const series = metricSeriesBySlot[slot];
              if (!series.length) return null;

              const meta = slotMeta[slot];
              const label =
                slot === 1
                  ? "Plant height"
                  : slot === 2
                  ? "Canopy width"
                  : slot === 3
                  ? "Stem diameter"
                  : (slot4Meta.label || "Custom metric");

              const path = buildMetricPath(series, 260, 80);

              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {label} history
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                        }}
                      >
                        {series.length} measurement
                        {series.length === 1 ? "" : "s"} · {meta.units}
                      </div>
                    </div>
                    <button
                      className="btn ghost"
                      onClick={() => setMetricChartSlot(null)}
                    >
                      Close
                    </button>
                  </div>

                  <div
                    style={{
                      padding: 8,
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,0.7)",
                      background:
                        "radial-gradient(circle at 0 0, rgba(15,23,42,0.9), transparent 55%), #020409",
                    }}
                  >
                    {path ? (
                      <svg
                        width={260}
                        height={80}
                        viewBox="0 0 260 80"
                        style={{ display: "block", margin: "0 auto" }}
                      >
                        <path
                          d={path}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth={1.6}
                        />
                      </svg>
                    ) : (
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                          textAlign: "center",
                          padding: 12,
                        }}
                      >
                        Not enough data to draw a graph yet.
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

            {/* R&D Symptoms modal */}
      {showSymptomModal && (
        <div
          className="dialog-backdrop history-backdrop"
          onClick={() => setShowSymptomModal(false)}
        >
          <div
            className="dialog history-panel hud-glass"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Log R&D symptoms"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "Audiowide, Orbitron, system-ui",
                    fontSize: 12,
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                    opacity: 0.9,
                  }}
                >
                  R&amp;D Symptoms
                </div>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  {experimentId} · {groupId || "current group"}
                </div>
              </div>
              <button
                className="btn ghost"
                onClick={() => setShowSymptomModal(false)}
              >
                Close
              </button>
            </div>

            <div
              style={{
                fontSize: 11,
                opacity: 0.8,
                marginBottom: 4,
              }}
            >
              Tick symptoms that are currently present on this run. They will
              automatically be logged with each snapshot until you untick them.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 8,
                fontSize: 11,
              }}
            >
              {RND_SYMPTOM_OPTIONS.map((opt) => {
                const checked = !!currentActiveSymMap[opt.key];
                return (
                  <label
                    key={opt.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(31,41,55,0.9)",
                      background: checked
                        ? "rgba(34,197,94,0.10)"
                        : "rgba(15,23,42,0.96)",
                      boxShadow: checked
                        ? "0 0 10px rgba(34,197,94,0.7)"
                        : "none",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const nextChecked = e.target.checked;

                        setActiveSymptomsByRun((prev) => {
                          const next = { ...prev };

                          const curr = (
                            (next[currentRunKey] as Record<SymKey, boolean>) ||
                            {}
                          ) as Record<SymKey, boolean>;

                          const updated: Record<SymKey, boolean> = {
                            ...curr,
                            [opt.key]: nextChecked,
                          };
                          next[currentRunKey] = updated;

                          // Compute active keys and mirror to backend
                          const activeKeys = Object.entries(updated)
                            .filter(([, v]) => v)
                            .map(([k]) => k as SymKey);

                          void Sheet.postRDSymActive({
                            runKey: currentRunKey,
                            experimentId,
                            groupId,
                            symptoms: activeKeys,
                          });

                          return next;
                        });
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Camera overlay for R&D photo capture */}
      {cameraOpen && (
        <div
          className="dialog-backdrop history-backdrop"
          onClick={closeCamera}
        >
          <div
            className="dialog history-panel hud-glass"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Capture R&D photo"
          >
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
              Capture R&amp;D Photo
            </h2>
            <CameraCapture
              stream={cameraStream}
              onClose={closeCamera}
              onShot={handlePhotoShot}
            />
          </div>
        </div>
      )}
    </div>
  );
}
































































