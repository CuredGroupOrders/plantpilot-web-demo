import { useEffect, useRef, useState } from "react";
import * as Sheet from "../api/sheet";
import { solveIrrDraft as fetchIrrSolve, type IrrSolvePlan } from "../api/irr";
import { IrrSolverModal } from "../components/IrrSolverModal";
import LightMetricsPanel from "../components/LightMetricsPanel";
import NumberInput from "../components/NumberInput";
import {
  buildEffectivePayload,
  computePhysicsIrrGate,
  type ConfigContext,
  type Intake,
} from "./helpers";

export default function IntakeForm({
  onSubmit,
  onDraftChange,
  initial,
  lists,
  onOpenChecklist,
  onOpenNutrient,
  targets,
  onApplyConfig,
  compactContext,
  onReconfigure,
}: {
  onSubmit: (i: any) => void;
  onDraftChange?: (i: any) => void;
  initial?: Partial<any>;
  compactContext?: boolean;
  onReconfigure?: () => void;
  lists: {
    stagePhase: string[];
    medium: string[];
    containerSize: string[];
    co2Mode: string[];
    lightcycle: string[];
    photoperiodH: string[];
    sopProfile: string[];
  };
  onOpenChecklist?: () => void;
  onOpenNutrient?: () => void;
  targets: Record<string, number>;
  onApplyConfig: (
    ctx: ConfigContext
  ) => Promise<Record<string, number> | null> | null;
}) {
  const getTarget = (label: string, fallback?: number): number | undefined => {
    const v = targets[label];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return fallback;
  };

  const [modeOptions, setModeOptions] = useState<string[]>([]);
  const [mode, setMode] = useState<string>(
    (initial as any)?.mode ?? "automation"
  );

  useEffect(() => {
    (async () => {
      try {
        const ctx = (await (Sheet.getIntakeContext?.() ??
          Promise.resolve({}))) as { mode?: string };
        const opts = (await (Sheet.getModeOptions?.() ??
          Promise.resolve([]))) as string[];
        const uniq = Array.from(new Set(opts));
        setModeOptions(uniq.length ? uniq : ["automation", "handwater"]);
        if (ctx?.mode && !initial?.mode) {
          setMode(uniq.includes(ctx.mode) ? ctx.mode : ctx.mode);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stage, setStage] = useState<string>(
    (initial?.stage as any) ?? lists.stagePhase?.[0] ?? ""
  );
  const [medium, setMedium] = useState<string>(
    (initial?.medium as any) ?? lists.medium?.[0] ?? ""
  );
  const [container, setContainer] = useState<string>(initial?.container ?? "");
  const [co2Mode, setCo2Mode] = useState<string>(
    (initial as any)?.co2Mode ?? lists.co2Mode?.[0] ?? ""
  );
  const [lightcycle, setLightcycle] = useState<string>(
    (initial as any)?.lightcycle ?? lists.lightcycle?.[0] ?? ""
  );
  const [photoperiodH, setPhotoperiodH] = useState<number>(
    initial?.photoperiodH ?? Number(lists.photoperiodH?.[0] ?? 12)
  );
  const [profile, setProfile] = useState<string>(
    (initial as any)?.profile ?? lists.sopProfile?.[0] ?? "Default"
  );

  const [showIrrAdvanced, setShowIrrAdvanced] = useState(false);


// ENV
  const [tempC, setTempC] = useState<number | undefined>(initial?.tempC);
  const [rh, setRh] = useState<number | undefined>(initial?.rh);
  const [vpdKpa, setVpdKpa] = useState<number | undefined>(initial?.vpdKpa);
  const [ppfd, setPpfd] = useState<number | undefined>(initial?.ppfd);
  const [dliMol, setDliMol] = useState<number | undefined>(initial?.dliMol);
  const [co2, setCo2] = useState<number | undefined>(initial?.co2);

  // ROOT
  const [rootTempC, setRootTempC] =
    useState<number | undefined>(initial?.rootTempC);
  const [vwcPct, setVwcPct] =
    useState<number | undefined>(initial?.vwcPct);
  const hasVwc = vwcPct !== undefined;
  const [runoffPh, setRunoffPh] =
    useState<number | undefined>(initial?.runoffPh);
  const [runoffPct, setRunoffPct] =
    useState<number | undefined>(initial?.runoffPct);
  const [reservoirEc, setReservoirEc] = useState<number | undefined>(
    (initial as any)?.reservoirEc
  );
  const [reservoirPh, setReservoirPh] = useState<number | undefined>(
    (initial as any)?.reservoirPh
  );
  const [reservoirTempC, setReservoirTempC] = useState<number | undefined>(
    (initial as any)?.reservoirTempC
  );
  const [pwec, setPwec] = useState<number | undefined>(initial?.pwec);
  const [vwcAtLastIrr, setVwcAtLastIrr] =
    useState<number | undefined>(initial?.vwcAtLastIrr);
  const [runoffEc, setRunoffEc] =
    useState<number | undefined>(initial?.runoffEc);

  // IRR + meta
  const [eventsPerDay, setEventsPerDay] =
    useState<number | undefined>(initial?.eventsPerDay);
  const [mlPerEvent, setMlPerEvent] =
    useState<number | undefined>(initial?.mlPerEvent);
  const [drybackPct24h, setDrybackPct24h] =
    useState<number | undefined>(initial?.drybackPct24h);
  const [targetAtFirst, setTargetAtFirst] =
    useState<number | undefined>(initial?.targetAtFirst);

  // P1/P2
  const [p1Events, setP1Events] =
    useState<number | undefined>(initial?.p1Events);
  const [p1IntervalMin, setP1IntervalMin] =
    useState<number | undefined>(initial?.p1IntervalMin);
  const [p1Pct, setP1Pct] =
    useState<number | undefined>(initial?.p1Pct);
  const [p1MlPerEvent, setP1MlPerEvent] =
    useState<number | undefined>(initial?.p1MlPerEvent);
  const [p1SecPerEvent, setP1SecPerEvent] =
    useState<number | undefined>(initial?.p1SecPerEvent);
  const [p2Events, setP2Events] =
    useState<number | undefined>(initial?.p2Events);
  const [p2IntervalMin, setP2IntervalMin] =
    useState<number | undefined>(initial?.p2IntervalMin);
  const [p2Pct, setP2Pct] =
    useState<number | undefined>(initial?.p2Pct);
  const [p2MlPerEvent, setP2MlPerEvent] =
    useState<number | undefined>(initial?.p2MlPerEvent);
  const [p2SecPerEvent, setP2SecPerEvent] =
    useState<number | undefined>(initial?.p2SecPerEvent);
function submit() {
    console.log('PP_SUBMIT_CLICKED', Date.now());
    const draft: Intake = {
      stage,
      medium,
      container,
      co2Mode,
      lightcycle,
      photoperiodH,
      mode,
      profile,
      tempC,
      rh,
      vpdKpa,
      ppfd,
      dliMol,
      co2,
      rootTempC,
      vwcPct,
      hasVwc,
      runoffPh,
      runoffPct,
      reservoirEc,
      reservoirPh,
      reservoirTempC,
      pwec,
      vwcAtLastIrr,
      runoffEc,
// DUP_REMOVED: runoffPct,
// DUP_REMOVED: vwcAtLastIrr,
      drybackPct24h,
      targetAtFirst,

      p1Events,
      p1IntervalMin,
      p1Pct,
      p1MlPerEvent,

      p2Events,
      p2IntervalMin,
      p2Pct,
      p2MlPerEvent,
      eventsPerDay,
      mlPerEvent,
// DUP_REMOVED: drybackPct24h,
// DUP_REMOVED: targetAtFirst,
// DUP_REMOVED: p1Events,
// DUP_REMOVED: p1IntervalMin,
// DUP_REMOVED: p1Pct,
// DUP_REMOVED: p1MlPerEvent,
      p1SecPerEvent,
// DUP_REMOVED: p2Events,
// DUP_REMOVED: p2IntervalMin,
// DUP_REMOVED: p2Pct,
// DUP_REMOVED: p2MlPerEvent,
      p2SecPerEvent,
    };
    try { (window as any).__pp_latestIntakeDraft = draft; } catch {}
    // Physics IRR gate: allow schedule-shape drift if daily budgets are met
    const physGate = computePhysicsIrrGate({
      irrPlan,
      p1Events: (draft as any).p1Events,
      p1MlPerEvent: (draft as any).p1MlPerEvent,
      p2Events: (draft as any).p2Events,
      p2MlPerEvent: (draft as any).p2MlPerEvent,
      tolP1DayMl: 100,
      tolP2DayMl: 100,
    });
    (draft as any).physicsIrrGate = physGate;
    try { void (onSubmit as any)(draft); } catch (e) { console.warn("PP_SUBMIT_ERROR", e); }
  }

  const emitTimer = useRef<number | NodeJS.Timeout | null>(null);
  function buildDraft(): Intake {
  return {
    stage,
    medium,
    container,
    co2Mode,
    lightcycle,
    photoperiodH,
    mode,
    profile,

    tempC,
    rh,
    vpdKpa,
    ppfd,
    dliMol,
    co2,

    rootTempC,
    vwcPct,
    hasVwc,

    runoffPh,
    runoffPct,
    reservoirEc,
    reservoirPh,
    reservoirTempC,
    pwec,
    vwcAtLastIrr,
    runoffEc,

    drybackPct24h,
    targetAtFirst,

    p1Events,
    p1IntervalMin,
    p1Pct,
    p1MlPerEvent,
    p1SecPerEvent,

    p2Events,
    p2IntervalMin,
    p2Pct,
    p2MlPerEvent,
    p2SecPerEvent,

    eventsPerDay,
    mlPerEvent,
  };
}
  
useEffect(() => {
    if (!onDraftChange) return;
    if (emitTimer.current) clearTimeout(emitTimer.current as any);
    emitTimer.current = setTimeout(() => {
      try {
        onDraftChange(buildDraft());
      } catch {}
    }, 250) as any;
    return () => {
      if (emitTimer.current) clearTimeout(emitTimer.current as any);
    };
  }, [
    stage,
    medium,
    container,
    co2Mode,
    lightcycle,
    photoperiodH,
    mode,
    profile,
    tempC,
    rh,
    vpdKpa,
    ppfd,
    dliMol,
    co2,
    rootTempC,
    vwcPct,
    hasVwc,
    runoffPh,
    runoffPct,
    reservoirEc,
    reservoirPh,
    reservoirTempC,
    pwec,
    vwcAtLastIrr,
    runoffEc,
    eventsPerDay,
    mlPerEvent,
    drybackPct24h,
    targetAtFirst,
    p1Events,
    p1IntervalMin,
    p1Pct,
    p1MlPerEvent,
    p1SecPerEvent,
    p2Events,
    p2IntervalMin,
    p2Pct,
    p2MlPerEvent,
    p2SecPerEvent,
  ]);

  const canopyTarget =
  getTarget("Canopy temp (°C)") ??
  (typeof targets["tempC"] === "number" && Number.isFinite(targets["tempC"])
    ? targets["tempC"]
    : 24);
  const rhTarget = getTarget("RH (%)", 55);
  const vpdTarget = getTarget("VPD (kPa)");
  const ppfdTarget = getTarget("PPFD (µmol/m²/s)", 900);
  const dliTarget = getTarget("DLI (mol/m²/d)");
  const co2Target = getTarget("CO2 (ppm)");
  const reservoirEcTarget = getTarget("Reservoir EC (mS/cm)");
  const reservoirPhTarget = getTarget("Reservoir pH");
  const runoffPhTarget = getTarget("Runoff pH");
  const reservoirTempTarget = getTarget("Reservoir temp (°C)");
  const pwecTarget = getTarget("PWEC (mS/cm)");
  const vwcLastTarget = getTarget("VWC% at last irrigation");
  const runoffEcTarget = getTarget("Runoff EC (mS/cm)");
  const drybackTarget = getTarget("Overnight dryback % target", 18);
  const targetAtFirstTarget = getTarget("Target at first event");
  const p1EventsTarget = getTarget("P1 events");
  const p1IntTarget = getTarget("P1 interval (min)");
  const p1PctTarget = getTarget("P1 %");
  const p1MlTarget = getTarget("ml per P1 event");
  const p2EventsTarget = getTarget("P2 events");
  const p2IntTarget = getTarget("P2 interval (min)");
  const p2PctTarget = getTarget("P2 %");
  const p2MlTarget = getTarget("ml per P2 event");
  const eventsPerDayTarget = getTarget("eventsPerDay");

  const isHandwater = mode.toLowerCase() === "handwater";

  const targetColorStyle = (isTarget: boolean) => ({
    color: isTarget ? "#888888" : "inherit",
  });

  const disabledStyle = {
    color: "#888888",
    opacity: 0.4,
    backgroundColor: "#333333",
    cursor: "not-allowed" as const,
  };

  const [irrPlan, setIrrPlan] = useState<IrrSolvePlan | null>(null);
  const [irrPlanLoading, setIrrPlanLoading] = useState(false);
  const [irrPlanError, setIrrPlanError] = useState<string>("");
  const [irrSolverOpen, setIrrSolverOpen] = useState(false);

  const refreshIrrPlan = async () => {
    setIrrPlanLoading(true);
    setIrrPlanError("");
    try {
      const plan = await fetchIrrSolve({
        stage,
        medium,
        container,
        profile,
        mode,
        photoperiodH,
        runoffPct,
        drybackPct24h,
        targetAtFirst,
        tempC,
        p1Events,
        p1IntervalMin,
        p1Pct,
        p1MlPerEvent,
        p2Events,
        p2IntervalMin,
        p2Pct,
        p2MlPerEvent,
        vpdKpa,
        dliMol,
        co2Mode,
        co2,
      });
      setIrrPlan(plan);
      if (!plan?.ok) setIrrPlanError(plan?.error || "IRR solver returned ok=false");
    } catch (e: any) {
      setIrrPlanError(String(e?.message || e));
    } finally {
      setIrrPlanLoading(false);
    }
  };

  const onApplyIrrPlan = async () => {
    setIrrPlanLoading(true);
    setIrrPlanError("");
    try {
      const draft = {
  runoffPct,
  p1Events,
  p1IntervalMin,
  p1Pct,
  p1MlPerEvent,
  p2Events,
  p2IntervalMin,
  p2Pct,
  p2MlPerEvent,
  vpdKpa,
  dliMol,
  co2Mode,
  co2,
};
      // APPLY writes solved %/ml into the sheet (GAS)
      await applyIrrSolve(draft);

      // Re-solve using the SAME draft (authoritative UI sync)
      const plan = await fetchIrrSolve(draft);
      setIrrPlan(plan);
      if (!plan?.ok) throw new Error(plan?.error || "IRR solver returned ok=false");

      // CRITICAL: update local UI inputs so Submit can’t write stale values back
      setP1MlPerEvent(plan.p1?.ml_event_ideal);
      setP1Pct(plan.p1?.pct_whc_ideal);
      setP2MlPerEvent(plan.p2?.ml_event_ideal);
      setP2Pct(plan.p2?.pct_whc_ideal);
// keep local card state in sync
      // refreshIrrPlan() already runs above; nothing else required here

    } catch (e: any) {
      setIrrPlanError(String(e?.message || e));
    } finally {
      setIrrPlanLoading(false);
    }
  };

  useEffect(() => {
    void refreshIrrPlan();
  }, []);


  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
                <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>Intake</h1>
          <div className="sub" style={{ flex: "1 1 auto" }}>
            {profile} · {stage} · {medium}
            {lightcycle ? ` · ${lightcycle}` : ""} · {photoperiodH}h
          </div>
          {typeof onReconfigure === "function" && (
            <button type="button" className="btn ghost" onClick={onReconfigure}>
              Change setup
            </button>
          )}
        </div>

      </header>

      {typeof onOpenChecklist === "function" && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <button className="btn" onClick={onOpenChecklist}>
            Open Symptoms Checklist
          </button>
        </div>
      )}

      {/* CONTEXT — hidden when wizard already captured grow config */}
      {!compactContext && (
      <div className="card">
        <h3>Context</h3>
        <div className="row row-3">
          <div>
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {(modeOptions.length ? modeOptions : ["automation", "handwater"]
              ).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {(lists.stagePhase?.length
                ? lists.stagePhase
                : [
                    "early veg",
                    "late veg",
                    "early bloom",
                    "mid bloom",
                    "late bloom",
                    "flush",
                  ]
              ).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Medium</label>
            <select value={medium} onChange={(e) => setMedium(e.target.value)}>
              {(lists.medium?.length
                ? lists.medium
                : ["coco", "rockwool", "soil", "dwc"]
              ).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Container / Bed</label>
            {lists.containerSize?.length ? (
              <select
                value={container}
                onChange={(e) => setContainer(e.target.value)}
              >
                <option value=""></option>
                {lists.containerSize.map((v: string) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={container}
                onChange={(e) => setContainer(e.target.value)}
                placeholder="1 / 2 / bed"
              />
            )}
          </div>

          <div>
            <label>CO₂ mode</label>
            <select
              value={co2Mode}
              onChange={(e) => setCo2Mode(e.target.value)}
            >
              <option value=""></option>
              {(lists.co2Mode?.length ? lists.co2Mode : ["ambient", "co2"]
              ).map((v: string) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Lightcycle</label>
            <select
              value={lightcycle}
              onChange={(e) => setLightcycle(e.target.value)}
            >
              <option value=""></option>
              {(lists.lightcycle?.length
                ? lists.lightcycle
                : ["Day", "Night"]
              ).map((v: string) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Photoperiod (h)</label>
            {lists.photoperiodH?.length ? (
              <select
                value={String(photoperiodH)}
                onChange={(e) => setPhotoperiodH(+e.target.value)}
              >
                {lists.photoperiodH.map((v: string) => {
                  const val = String(Number(v));
                  return (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="number"
                value={photoperiodH}
                onChange={(e) => setPhotoperiodH(+e.target.value)}
              />
            )}
          </div>

          <div>
            <label>SOP profile</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
            >
              {(lists.sopProfile?.length ? lists.sopProfile : ["Default"]
              ).map((v: string) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 24 }}
              onClick={() =>
                void onApplyConfig({
                  stage,
                  medium,
                  container: container ?? "",
                  co2Mode: co2Mode ?? "",
                  lightcycle: lightcycle ?? "",
                  photoperiodH,
                  profile: profile ?? "Default",
                })
              }
            >
              Apply configuration &amp; refresh targets
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ENV */}
      <div className="card">
        <h3>ENV</h3>
        <div className="row row-3">
          <div>
            <label>Canopy temp (°C)</label>
            <NumberInput
              step="0.1"
              value={tempC !== undefined ? tempC : (canopyTarget as number | undefined)}
              onChange={(v) => setTempC(v)}
              style={targetColorStyle(tempC === undefined)}
            />
          </div>
          <div>
            <label>RH (%)</label>
            <NumberInput
              step="0.1"
              value={rh !== undefined ? rh : (rhTarget as number | undefined)}
              onChange={(v) => setRh(v)}
              style={targetColorStyle(rh === undefined)}
            />
          </div>
          <div>
            <label>VPD (kPa)</label>
            <NumberInput
              step="0.01"
              value={vpdKpa !== undefined ? vpdKpa : (vpdTarget as number | undefined)}
              onChange={(v) => setVpdKpa(v)}
              style={targetColorStyle(vpdKpa === undefined)}
            />
          </div>
          <div>
            <label>CO2 (ppm)</label>
            <NumberInput
              step="1"
              value={co2 !== undefined ? co2 : (co2Target as number | undefined)}
              onChange={(v) => setCo2(v)}
              style={targetColorStyle(co2 === undefined)}
            />
          </div>
        </div>
        <LightMetricsPanel
          ppfd={ppfd}
          setPpfd={setPpfd}
          photoperiodH={photoperiodH}
          dliMol={dliMol}
          setDliMol={setDliMol}
        />
      </div>

      {/* ROOT */}
      <div className="card">
        <h3>ROOT</h3>
        <div className="row row-3">
          <div>
            <label>Reservoir EC (mS/cm)</label>
            <NumberInput
              step="0.01"
              value={reservoirEc !== undefined ? reservoirEc : (reservoirEcTarget as number | undefined)}
              onChange={(v) => setReservoirEc(v)}
              style={targetColorStyle(reservoirEc === undefined)}
            />
          </div>
          <div>
            <label>Reservoir pH</label>
            <NumberInput
              step="0.01"
              value={reservoirPh !== undefined ? reservoirPh : (reservoirPhTarget as number | undefined)}
              onChange={(v) => setReservoirPh(v)}
              style={targetColorStyle(reservoirPh === undefined)}
            />
          </div>
          <div>
            <label>Runoff pH</label>
            <NumberInput
              step="0.01"
              value={runoffPh !== undefined ? runoffPh : (runoffPhTarget as number | undefined)}
              onChange={(v) => setRunoffPh(v)}
              style={targetColorStyle(runoffPh === undefined)}
            />
          </div>
                    <div>
            <label>Runoff %</label>
            <NumberInput
              step="0.1"
              value={runoffPct !== undefined ? runoffPct : (getTarget("Runoff %") as number | undefined)}
              onChange={(v) => setRunoffPct(v)}
              style={targetColorStyle(runoffPct === undefined)}
            />
          </div>
          <div>
            <label>Reservoir temp (°C)</label>
            <NumberInput
              step="0.1"
              value={reservoirTempC !== undefined ? reservoirTempC : (reservoirTempTarget as number | undefined)}
              onChange={(v) => setReservoirTempC(v)}
              style={targetColorStyle(reservoirTempC === undefined)}
            />
          </div>
          <div>
            <label>PWEC (mS/cm)</label>
            {isHandwater ? (
              <NumberInput
                step="0.01"
                value={pwec !== undefined ? pwec : (pwecTarget as number | undefined)}
                onChange={() => {}}
                disabled
                style={disabledStyle}
              />
            ) : (
              <NumberInput
                step="0.01"
                value={pwec !== undefined ? pwec : (pwecTarget as number | undefined)}
                onChange={(v) => setPwec(v)}
                style={targetColorStyle(pwec === undefined)}
              />
            )}
          </div>
          <div>
            <label>VWC% at last irrigation</label>
            {isHandwater ? (
              <NumberInput
                step="0.1"
                value={vwcAtLastIrr !== undefined ? vwcAtLastIrr : (vwcLastTarget as number | undefined)}
                onChange={() => {}}
                disabled
                style={disabledStyle}
              />
            ) : (
              <NumberInput
                step="0.1"
                value={vwcAtLastIrr !== undefined ? vwcAtLastIrr : (vwcLastTarget as number | undefined)}
                onChange={(v) => setVwcAtLastIrr(v)}
                style={targetColorStyle(vwcAtLastIrr === undefined)}
              />
            )}
          </div>
          <div>
            <label>Runoff EC (mS/cm)</label>
            <NumberInput
              step="0.01"
              value={runoffEc !== undefined ? runoffEc : (runoffEcTarget as number | undefined)}
              onChange={(v) => setRunoffEc(v)}
              style={targetColorStyle(runoffEc === undefined)}
            />
          </div>
        </div>

        {typeof onOpenNutrient === "function" && profile === "Athena Pro" && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >



            <button
              type="button"
              onClick={() => onOpenNutrient()}
            >
              <div
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "2px solid #b14cff",
                    boxShadow:
                      "0 0 18px rgba(177,76,255,0.9), 0 0 32px rgba(55,255,122,0.5)",
                    backgroundColor: "#05090b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={athenaLogo}
                    alt="Athena Pro"
                    style={{
                      maxWidth: "80%",
                      maxHeight: "80%",
                      objectFit: "contain",
                      filter:
                        "drop-shadow(0 0 10px rgba(177,76,255,0.9)) drop-shadow(0 0 14px rgba(55,255,122,0.85))",
                    }}
                  />
                </div>
                <span
                  style={{ fontSize: 12, color: "#cfeff0", opacity: 0.9 }}
                >
                  Nutrient Mix · tap to expand
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* IRR + P1/P2 */}
      <div className="card">
        <h3>IRR</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <div style={{ fontWeight: 600 }}><span style={{ color: "#00ffff", textShadow: "0 0 10px rgba(0,255,255,0.85)" }}>💧</span>{" "}Irrigation Physics Engine</div></div>
                <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn primary" onClick={() => setIrrSolverOpen(true)}>
              Open IRR Solver
            </button>
            <button type="button" className="btn ghost" onClick={() => void refreshIrrPlan()} disabled={irrPlanLoading}>
              {irrPlanLoading ? "Solving…" : "Quick solve"}
            </button>

            <button type="button" className="btn ghost" onClick={() => void onApplyIrrPlan()} disabled={irrPlanLoading || !irrPlan?.ok}>
              Apply Solver Plan
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowIrrAdvanced((v) => !v)}
            >
              {showIrrAdvanced ? "Simple view" : "Advanced view"} 
            </button>

            {irrPlan?.base_key_effective ? (
              <span style={{ opacity: 0.8, fontSize: 12 }}>key: {irrPlan.base_key_effective}</span>
            ) : null}
          </div>

          {irrPlanError ? (
            <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 12 }}>{irrPlanError}</div>
          ) : null}

          {irrPlan?.ok ? (
            <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.35 }}>
              {/* Simple view (always) */}
              <div>
                <strong>Daily water use:</strong>{" "}
                ~{Math.round(irrPlan?.et_pred_ml_day ?? 0)} ml
              </div>
              <div>
                <strong>Runoff target (P2 only):</strong>{" "}
                {Math.round((irrPlan?.runoff_target_frac ?? 0) * 100)}%
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>P1 — Refill:</strong>{" "}
                {irrPlan?.p1?.events ?? "?"} events × {irrPlan?.p1?.ml_event_ideal ?? "?"} ml
              </div>
              <div>
                <strong>P2 — Maintain:</strong>{" "}
                {irrPlan?.p2?.events ?? "?"} events × {irrPlan?.p2?.ml_event_ideal ?? "?"} ml
              </div>

              {/* Advanced view (optional) */}
              {showIrrAdvanced ? (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                  <div>
                    ET base: <b>{irrPlan.et_base_ml_day?.toFixed?.(0) ?? ""}</b> ml/day | ET pred:{" "}
                    <b>{irrPlan.et_pred_ml_day?.toFixed?.(0) ?? ""}</b> ml/day
                  </div>
                  <div>
                    Applied req: <b>{irrPlan.applied_req_ml_day?.toFixed?.(0) ?? ""}</b> ml/day | Runoff target:{" "}
                    <b>{((irrPlan.runoff_target_frac ?? 0) * 100).toFixed(0)}</b>%
                  </div>
                  <div>
                    P1: <b>{irrPlan.p1?.events}</b> @ <b>{irrPlan.p1?.pct_whc_ideal}</b>% WHC ={" "}
                    <b>{irrPlan.p1?.ml_event_ideal}</b> ml
                  </div>
                  <div>
                    P2: <b>{irrPlan.p2?.events}</b> @ <b>{irrPlan.p2?.pct_whc_ideal}</b>% WHC ={" "}
                    <b>{irrPlan.p2?.ml_event_ideal}</b> ml
                  </div>

                  {irrPlan.coherence?.length ? (
                    <div style={{ marginTop: 8, opacity: 0.9 }}>
                      {irrPlan.coherence.map((c: string, i: number) => (
                        <div key={i}>• {c}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}{irrPlan.coherence?.length ? (
                <div style={{ marginTop: 8, opacity: 0.9 }}>
                  {irrPlan.coherence.map((c: string, i: number) => (
                    <div key={i}>• {c}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

          {showIrrAdvanced && irrPlan?.ok ? (
            <div style={{ marginTop: 10, padding: 10, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 13, lineHeight: 1.35 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>How the solver got these numbers</div>

              <div style={{ opacity: 0.9 }}>
                <div>
                  <b>Field capacity (FC)</b> is your <b>VWC at last irrigation</b> (stage FC proxy). Today it’s{" "}
                  <b>{irrPlan.fc_vwc ?? "?"}%</b>.
                </div>

                <div>
                  <b>Start VWC</b> is your <b>Target at first event</b>. Today it’s{" "}
                  <b>{irrPlan.vwc_start ?? "?"}%</b>.
                </div>

                <div>
                  <b>P1 is refill:</b> the solver computes the water needed to go from Start → FC, converts that into ml using your container volume,
                  then splits it across your P1 event count.
                </div>

                <div style={{ marginTop: 6 }}>
                  Refill required: <b>{irrPlan.w_refill_ml?.toFixed?.(0) ?? "?"}</b> ml/day{" "}
                  (container <b>{irrPlan.v_media_ml?.toFixed?.(0) ?? "?"}</b> ml).
                </div>

                <div style={{ marginTop: 6 }}>
                  <b>P2 is maintenance:</b> it estimates how much VWC you lose between P2 events based on today’s demand (VPD/DLI) and your P2 interval.
                </div>

                <div style={{ marginTop: 6 }}>
                  Demand index: <b>{irrPlan.demand_index != null ? irrPlan.demand_index.toFixed(2) : "?"}</b>{" "}
                  → maintenance dryback: <b>{irrPlan.dbPct_interval != null ? (irrPlan.dbPct_interval * 100).toFixed(2) : "?"}%</b> per interval
                  → retained per interval: <b>{irrPlan.w_maint_event_ml?.toFixed?.(0) ?? "?"}</b> ml.
                </div>

                <div style={{ marginTop: 6 }}>
                  <b>Runoff is applied on P2 only</b>. With runoff target{" "}
                  <b>{irrPlan.p2_runoff_frac != null ? (irrPlan.p2_runoff_frac * 100).toFixed(0) : "?"}%</b>, the solver upsizes P2 ml/event to
                  cover maintenance + runoff.
                </div>

                <div style={{ marginTop: 8, opacity: 0.85 }}>
                  If you change P2 events or interval, the maintenance loss per interval changes, so P2 ml/event changes. If you change Start VWC or FC,
                  the refill budget changes, so P1 ml/event changes.
                </div>
              </div>
            </div>
          ) : null}

        <div className="row row-3">
          <div>
            <label>Overnight dryback % target</label>
            <NumberInput
              step="0.1"
              disabled={isHandwater}
              value={drybackPct24h !== undefined ? drybackPct24h : (drybackTarget as number | undefined)}
              onChange={(v) => setDrybackPct24h(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(drybackPct24h === undefined)}
            />
          </div>
          <div>
            <label>Target at first event</label>
            <NumberInput
              step="0.1"
              disabled={isHandwater}
              value={targetAtFirst !== undefined ? targetAtFirst : (targetAtFirstTarget as number | undefined)}
              onChange={(v) => setTargetAtFirst(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(targetAtFirst === undefined)}
            />
          </div>

          {/* P1 */}
          <div>
            <label>P1 events</label>
            <NumberInput
              step="1"
              disabled={isHandwater}
              value={p1Events !== undefined ? p1Events : (p1EventsTarget as number | undefined)}
              onChange={(v) => setP1Events(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p1Events === undefined)}
            />
          </div>
          <div>
            <label>P1 interval (min)</label>
            <NumberInput
              step="1"
              disabled={isHandwater}
              value={p1IntervalMin !== undefined ? p1IntervalMin : (p1IntTarget as number | undefined)}
              onChange={(v) => setP1IntervalMin(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p1IntervalMin === undefined)}
            />
          </div>
          <div>
            <label>P1 %</label>
            <NumberInput
              step="0.1"
              disabled={isHandwater}
              value={p1Pct !== undefined ? p1Pct : (p1PctTarget as number | undefined)}
              onChange={(v) => setP1Pct(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p1Pct === undefined)}
            />
          </div>
          <div>
            <label>ml per P1 event</label>
            <NumberInput
              step="1"
              disabled={isHandwater}
              value={p1MlPerEvent !== undefined ? p1MlPerEvent : (p1MlTarget as number | undefined)}
              onChange={(v) => setP1MlPerEvent(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p1MlPerEvent === undefined)}
            />
          </div>

          {/* P2 */}
          <div>
            <label>P2 events</label>
            <NumberInput
              step="1"
              disabled={isHandwater}
              value={p2Events !== undefined ? p2Events : (p2EventsTarget as number | undefined)}
              onChange={(v) => setP2Events(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p2Events === undefined)}
            />
          </div>
          <div>
            <label>P2 interval (min)</label>
            <NumberInput
              step="1"
              disabled={isHandwater}
              value={p2IntervalMin !== undefined ? p2IntervalMin : (p2IntTarget as number | undefined)}
              onChange={(v) => setP2IntervalMin(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p2IntervalMin === undefined)}
            />
          </div>
          <div>
            <label>P2 %</label>
            <NumberInput
              step="0.1"
              disabled={isHandwater}
              value={p2Pct !== undefined ? p2Pct : (p2PctTarget as number | undefined)}
              onChange={(v) => setP2Pct(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p2Pct === undefined)}
            />
          </div>
          <div>
            <label>ml per P2 event</label>
            <NumberInput
              step="1"
              disabled={isHandwater}
              value={p2MlPerEvent !== undefined ? p2MlPerEvent : (p2MlTarget as number | undefined)}
              onChange={(v) => setP2MlPerEvent(v)}
              style={isHandwater ? disabledStyle : targetColorStyle(p2MlPerEvent === undefined)}
            />
          </div>

          {/* Events per day (Irrigations in last 24h) */}
          <div>
            <label>Events per day</label>
            <NumberInput
              step="1"
              disabled={!isHandwater}
              value={eventsPerDay !== undefined ? eventsPerDay : (eventsPerDayTarget as number | undefined)}
              onChange={(v) => setEventsPerDay(v)}
              style={!isHandwater ? disabledStyle : targetColorStyle(eventsPerDay === undefined)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={() => submit()}>
          Submit &amp; Calculate
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setStage(lists.stagePhase?.[0] ?? "");
            setMedium(lists.medium?.[0] ?? "");
            setContainer("");
            setCo2Mode(lists.co2Mode?.[0] ?? "");
            setLightcycle(lists.lightcycle?.[0] ?? "");
            setPhotoperiodH(Number(lists.photoperiodH?.[0] ?? 12));
            setMode("automation");
            setProfile(lists.sopProfile?.[0] ?? "Default");
            setTempC(undefined);
            setRh(undefined);
            setVpdKpa(undefined);
            setPpfd(undefined);
            setDliMol(undefined);
            setCo2(undefined);
            setRootTempC(undefined);
            setVwcPct(undefined);
            setRunoffPh(undefined);
            setRunoffPct(undefined);
            setReservoirEc(undefined);
            setReservoirPh(undefined);
            setReservoirTempC(undefined);
            setPwec(undefined);
            setVwcAtLastIrr(undefined);
            setRunoffEc(undefined);
            setEventsPerDay(undefined);
            setMlPerEvent(undefined);
            setDrybackPct24h(undefined);
            setTargetAtFirst(undefined);
            setP1Events(undefined);
            setP1IntervalMin(undefined);
            setP1Pct(undefined);
            setP1MlPerEvent(undefined);
            setP1SecPerEvent(undefined);
            setP2Events(undefined);
            setP2IntervalMin(undefined);
            setP2Pct(undefined);
            setP2MlPerEvent(undefined);
            setP2SecPerEvent(undefined);
          }}
        >
          Reset
        </button>
      </div>

      <IrrSolverModal
        open={irrSolverOpen}
        onClose={() => setIrrSolverOpen(false)}
        intake={{
          stage,
          medium,
          container,
          profile,
          mode,
          photoperiodH,
          tempC,
          vpdKpa,
          dliMol,
          co2,
          co2Mode,
          runoffPct,
          drybackPct24h,
          targetAtFirst,
          p1Events,
          p1IntervalMin,
          p1Pct,
          p1MlPerEvent,
          p2Events,
          p2IntervalMin,
          p2Pct,
          p2MlPerEvent,
        }}
        onApplyFields={(fields) => {
          const n = (k: string) => {
            const v = fields[k];
            if (v == null || v === "") return;
            const num = Number(v);
            const val = Number.isFinite(num) ? num : v;
            if (k === "p1Events") setP1Events(val as number);
            if (k === "p1IntervalMin") setP1IntervalMin(val as number);
            if (k === "p1Pct") setP1Pct(val as number);
            if (k === "p1MlPerEvent") setP1MlPerEvent(val as number);
            if (k === "p2Events") setP2Events(val as number);
            if (k === "p2IntervalMin") setP2IntervalMin(val as number);
            if (k === "p2Pct") setP2Pct(val as number);
            if (k === "p2MlPerEvent") setP2MlPerEvent(val as number);
            if (k === "runoffPct") setRunoffPct(val as number);
          };
          Object.keys(fields).forEach(n);
          void refreshIrrPlan();
        }}
      />
    </div>
  );
}
