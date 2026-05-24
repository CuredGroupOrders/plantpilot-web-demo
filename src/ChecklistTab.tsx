// src/App.tsx
import * as Sheet from "./api/sheet";
import "./skin/theme-vars.css";
import { useEffect, useRef, useState } from "react";
import EmbedFrame from "./cockpit/EmbedFrame";
import GateOdometersPanel from "./components/GateOdometersPanel";
import { publishWire } from "./shared/wire";


/* ================= helpers ================= */
const DEBOUNCE_MS = 350;
const computeDLI = (ppfd: number, hours: number) => +(ppfd * hours * 3.6e-3).toFixed(2);
function computeVPD(tempC: number, rh: number) {
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  return +(svp * (1 - rh / 100)).toFixed(2);
}
function clamp100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const v = x <= 1 ? x * 100 : x;
  return Math.max(0, Math.min(100, Math.round(v)));
}
function mapScoresFromPayload(res: any) {
  const a = Array.isArray(res?.gatePct) ? res.gatePct : [];
  const env = clamp100(a[0]?.pct);
  const root = clamp100(a[1]?.pct);
  const irr = clamp100(a[2]?.pct);
  return (env + root + irr) ? { env, root, irr } : null;
}
type Scores = { env: number; root: number; irr: number };

async function forceEvaluate(intake: Record<string, any>, setScores: (s: Scores) => void) {
  try {
    const res = await Sheet.evaluate(intake);
    try { publishWire({ type: "sheet:update", payload: res, intake }); } catch {}
    (window as any).__sheet = res;
    const mapped = mapScoresFromPayload(res);
    if (mapped) {
      setScores(mapped);
      try { (window as any).__lastScores = mapped; } catch {}
      try {
        if (!(window as any).__sheet_keys_dumped__) {
          (window as any).__sheet_keys_dumped__ = true;
          console.info("[sheet] keys", Object.keys(res || {}), res);
        }
      } catch {}
    }
  } catch (e) { console.warn("forceEvaluate failed", e); }
}
function overallStatusLabel(s: Scores) {
  const m = Math.min(s.env, s.root, s.irr);
  if (m < 50) return "System Critical";
  if (m < 80) return "Needs Attention";
  return "System Stable";
}

/* ================= types ================= */
type Intake = {
  // context
  stage: string;
  medium: string;
  container?: string;
  co2Mode?: string;
  lightcycle?: string;
  photoperiodH: number;

  // ENV
  tempC: number;
  rh: number;
  vpdKpa?: number;
  ppfd: number;
  dliMol?: number;
  co2?: number;

  // ROOT
  rootTempC?: number;
  vwcPct?: number;
  hasVwc?: boolean;
  runoffPh?: number;
  runoffPct?: number;
  reservoirEc?: number;
  reservoirPh?: number;
  reservoirTempC?: number;
  pwec?: number;
  vwcAtLastIrr?: number;
  runoffEc?: number;

  // IRR / CHEM
  ReservoirEC?: number;
  inputPh?: number;
  bulkEc?: number;
  drybackPct24h: number;
  targetAtFirst?: number;

  // meta
  eventsPerDay?: number;
  mlPerEvent?: number;

  // P1
  p1Events?: number;
  p1IntervalMin?: number;
  p1Pct?: number;
  p1MlPerEvent?: number;
  p1SecPerEvent?: number;

  // P2
  p2Events?: number;
  p2IntervalMin?: number;
  p2Pct?: number;
  p2MlPerEvent?: number;
  p2SecPerEvent?: number;
};

/* ================= storage ================= */
const LS_KEY = "smf.last.intake.v1";
function getLastIntake(): Intake | null { try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; } }
function setLastIntake(i: Intake | null) { try { i ? localStorage.setItem(LS_KEY, JSON.stringify(i)) : localStorage.removeItem(LS_KEY); } catch {} }

/* ================= App ================= */
export default function App() {
  const [intake, setIntake] = useState<Intake | null>(() => getLastIntake());
  const [lists, setLists] = useState<{ stagePhase: string[]; medium: string[]; containerSize: string[]; co2Mode: string[]; lightcycle: string[]; photoperiodH: string[] }>
    ({ stagePhase: [], medium: [], containerSize: [], co2Mode: [], lightcycle: [], photoperiodH: [] });

  const [sheetScores, setSheetScores] = useState<Scores | null>(null);
  const [showCockpit, setShowCockpit] = useState(false);
  const debTimer = useRef<number | NodeJS.Timeout | null>(null);
  const leadTimer = useRef<number | NodeJS.Timeout | null>(null);

  // load LISTS
  useEffect(() => {
    Sheet.fetchOptions()
      .then((options: Record<string, string[]>) => setLists({
        stagePhase: options.stagePhase ?? [],
        medium: options.medium ?? [],
        containerSize: options.containerSize ?? [],
        co2Mode: options.co2Mode ?? [],
        lightcycle: options.lightcycle ?? [],
        photoperiodH: options.photoperiodH ?? [],
      }))
      .catch(console.warn);
  }, []);

  // warm odometers if intake exists on mount
  useEffect(() => {
    if (!intake) return;
    forceEvaluate(intake as any, setSheetScores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced evaluate on intake edit (live odometers)
  useEffect(() => {
    if (!intake) return;
    if (debTimer.current) clearTimeout(debTimer.current as any);
    debTimer.current = setTimeout(() => {
      const d = intake;
      const draft: Record<string, any> = {
        // context
        stage: d.stage || "",
        medium: d.medium || "",
        container: d.container ?? "",
        co2Mode: d.co2Mode ?? "",
        lightcycle: d.lightcycle ?? "",
        photoperiodH: Number.isFinite(d.photoperiodH) ? d.photoperiodH : 12,
        // ENV
        tempC: Number.isFinite(d.tempC) ? d.tempC : 24,
        rh: Number.isFinite(d.rh) ? d.rh : 55,
        vpdKpa: Number.isFinite(d.vpdKpa as any) ? d.vpdKpa : computeVPD(Number(d.tempC) || 24, Number(d.rh) || 55),
        ppfd: Number.isFinite(d.ppfd) ? d.ppfd : 900,
        dliMol: Number.isFinite(d.dliMol as any) ? d.dliMol : computeDLI(Number(d.ppfd) || 900, Number(d.photoperiodH) || 12),
        co2: Number.isFinite(d.co2 as any) ? d.co2 : undefined,
        // ROOT
        rootTempC: Number.isFinite(d.rootTempC as any) ? d.rootTempC : undefined,
        vwcPct: Number.isFinite(d.vwcPct as any) ? d.vwcPct : undefined,
        hasVwc: d.hasVwc ?? (d.vwcPct !== undefined),
        runoffPh: Number.isFinite(d.runoffPh as any) ? d.runoffPh : undefined,
        runoffPct: Number.isFinite(d.runoffPct as any) ? d.runoffPct : undefined,
        reservoirEc: Number.isFinite((d as any).reservoirEc) ? Number((d as any).reservoirEc) : undefined,
        reservoirPh: Number.isFinite((d as any).reservoirPh) ? Number((d as any).reservoirPh) : undefined,
        reservoirTempC: Number.isFinite((d as any).reservoirTempC) ? Number((d as any).reservoirTempC) : undefined,
        pwec: Number.isFinite(d.pwec as any) ? d.pwec : undefined,
        vwcAtLastIrr: Number.isFinite(d.vwcAtLastIrr as any) ? d.vwcAtLastIrr : undefined,
        runoffEc: Number.isFinite(d.runoffEc as any) ? d.runoffEc : undefined,
        // IRR
        ReservoirEC: Number.isFinite(d.ReservoirEC as any) ? d.ReservoirEC : undefined,
        inputPh: Number.isFinite(d.inputPh as any) ? d.inputPh : undefined,
        bulkEc: Number.isFinite(d.bulkEc as any) ? d.bulkEc : undefined,
        drybackPct24h: Number.isFinite(d.drybackPct24h) ? d.drybackPct24h : 18,
        targetAtFirst: Number.isFinite(d.targetAtFirst as any) ? d.targetAtFirst : undefined,
        // meta
        eventsPerDay: Number.isFinite(d.eventsPerDay as any) ? d.eventsPerDay : undefined,
        mlPerEvent: Number.isFinite(d.mlPerEvent as any) ? d.mlPerEvent : undefined,
        // P1/P2
        p1Events: Number.isFinite(d.p1Events as any) ? d.p1Events : undefined,
        p1IntervalMin: Number.isFinite(d.p1IntervalMin as any) ? d.p1IntervalMin : undefined,
        p1Pct: Number.isFinite(d.p1Pct as any) ? d.p1Pct : undefined,
        p1MlPerEvent: Number.isFinite(d.p1MlPerEvent as any) ? d.p1MlPerEvent : undefined,
        p1SecPerEvent: Number.isFinite(d.p1SecPerEvent as any) ? d.p1SecPerEvent : undefined,
        p2Events: Number.isFinite(d.p2Events as any) ? d.p2Events : undefined,
        p2IntervalMin: Number.isFinite(d.p2IntervalMin as any) ? d.p2IntervalMin : undefined,
        p2Pct: Number.isFinite(d.p2Pct as any) ? d.p2Pct : undefined,
        p2MlPerEvent: Number.isFinite(d.p2MlPerEvent as any) ? d.p2MlPerEvent : undefined,
        p2SecPerEvent: Number.isFinite(d.p2SecPerEvent as any) ? d.p2SecPerEvent : undefined,
      };
      forceEvaluate(draft, setSheetScores);
    }, DEBOUNCE_MS) as any;

    return () => { if (debTimer.current) clearTimeout(debTimer.current as any); };
  }, [intake]);

  // prefer sheetScores, then cached, else zeros
  const cached = (window as any).__lastScores as Scores | undefined;
  const useScores = sheetScores ?? cached ?? { env: 0, root: 0, irr: 0 };

  // subtext (from intake, with safe fallbacks)
  const fmt = (v?: number, unit = "", d = 0) =>
    v == null || !Number.isFinite(v) ? "-" : unit ? `${d ? v.toFixed(d) : Math.round(v)}${unit}` : `${d ? v.toFixed(d) : Math.round(v)}`;

  const envVpd = Number.isFinite((intake as any)?.vpdKpa)
    ? Number((intake as any).vpdKpa)
    : computeVPD(intake?.tempC ?? 24, intake?.rh ?? 55);

  const envDli = Number.isFinite((intake as any)?.dliMol)
    ? Number((intake as any).dliMol)
    : computeDLI(intake?.ppfd ?? 900, intake?.photoperiodH ?? 12);

  const rootVwc = Number.isFinite((intake as any)?.vwcAtLastIrr) ? Number((intake as any).vwcAtLastIrr) : undefined;
  const rootRt  = Number.isFinite((intake as any)?.reservoirTempC) ? Number((intake as any).reservoirTempC) : undefined;

  const deltaEcVal = (() => {
    const inEc  = Number.isFinite((intake as any)?.ReservoirEC)  ? Number((intake as any).ReservoirEC)  : 0;
    const outEc = Number.isFinite((intake as any)?.runoffEc) ? Number((intake as any).runoffEc) : undefined;
    if (!Number.isFinite(outEc as any)) return undefined;
    return +(Number(outEc) - Number(inEc)).toFixed(2);
  })();

  const irrIn  = Number.isFinite((intake as any)?.ReservoirEC)  ? Number((intake as any).ReservoirEC)  : undefined;
  const irrOut = Number.isFinite((intake as any)?.runoffEc) ? Number((intake as any).runoffEc) : undefined;

  const envGate  = { value: clamp100(useScores.env),  sub: `VPD ${fmt(envVpd, " kPa", 2)} | DLI ${fmt(envDli, "", 2)}` };
  const rootGate = { value: clamp100(useScores.root), sub: `VWC ${fmt(rootVwc, "%")} | RT ${fmt(rootRt, " Ãƒâ€šÃ‚Â°C", 1)} | ÃƒÅ½Ã¢â‚¬ÂEC ${fmt(deltaEcVal, "", 2)}` };
  const irrGate  = { value: clamp100(useScores.irr),  sub: `ReservoirEC ${fmt(irrIn, "", 2)} | RunoffEC ${fmt(irrOut, "", 2)}` };

  return (
    <div className="container">
      <GateOdometersPanel
        env={envGate}
        root={rootGate}
        irr={irrGate}
        statusText={overallStatusLabel(useScores)}
      />

      {!showCockpit ? (
        <IntakeForm
          lists={lists}
          initial={getLastIntake() ?? undefined}
          onDraftChange={(draft) => setIntake(draft)}   // live updates drive odometers
          onSubmit={async (draft) => {
            await forceEvaluate(draft as any, setSheetScores); // ensure sheet refresh
            setIntake(draft);
            setLastIntake(draft);
            setShowCockpit(true);                        // navigate to cockpit
            // leading evaluate once per typing burst so cockpit sees intake immediately
if (!leadTimer.current) {
  forceEvaluate(draft as any, setSheetScores);
  leadTimer.current = setTimeout(() => { leadTimer.current = null; }, DEBOUNCE_MS) as any;
}

          }}
        />
      ) : (
        <div style={{ marginTop: 12 }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h1>Cockpit</h1>
            <button className="btn ghost" onClick={() => setShowCockpit(false)}>Edit intake</button>
          </header>
          <EmbedFrame />
        </div>
      )}

      <TabBar active={"dashboard"} onDashboard={() => {}} onChecklist={() => {}} />
    </div>
  );
}

/* ---------- TabBar ---------- */
function TabBar({ active, onDashboard, onChecklist }: { active: "dashboard" | "checklist"; onDashboard: () => void; onChecklist: () => void }) {
  return (
    <div className="tabbar">
      <button className={active === "dashboard" ? "active" : ""} onClick={onDashboard}>Dashboard</button>
      <button className={active === "checklist" ? "active" : ""} onClick={onChecklist}>Checklist</button>
    </div>
  );
}

/* ---------- Intake Form ---------- */
function IntakeForm({
  onSubmit, onDraftChange, initial, lists,
}: {
  onSubmit: (i: Intake) => void;
  onDraftChange?: (i: Intake) => void;
  initial?: Partial<Intake>;
  lists: { stagePhase: string[]; medium: string[]; containerSize: string[]; co2Mode: string[]; lightcycle: string[]; photoperiodH: string[] };
}) {

  const [modeOptions, setModeOptions] = useState<string[]>([]);
  const [mode, setMode] = useState<string>("");

  useEffect(() => {
  (async () => {
    try {
      // Call individually so types stay simple even if one is missing
      const ctx = (await (Sheet.getIntakeContext?.() ?? Promise.resolve({}))) as { mode?: string };
      const opts = (await (Sheet.getModeOptions?.() ?? Promise.resolve([]))) as string[];

      const uniq = Array.from(new Set(opts));
      setModeOptions(uniq.length ? uniq : ["automation", "handwater"]);
      if (ctx?.mode) setMode(uniq.includes(ctx.mode) ? ctx.mode : ctx.mode);
      else if (uniq.length) setMode(uniq[0]);
    } catch {
      // fall back silently
    }
  })();
}, []);


  // Context defaults
  const [stage, setStage] = useState<string>((initial?.stage as any) ?? (lists.stagePhase[0] ?? ""));
  const [medium, setMedium] = useState<string>((initial?.medium as any) ?? (lists.medium[0] ?? ""));
  const [container, setContainer] = useState<string>(initial?.container ?? "");
  const [co2Mode, setCo2Mode] = useState<string>((initial as any)?.co2Mode ?? (lists.co2Mode[0] ?? ""));
  const [lightcycle, setLightcycle] = useState<string>((initial as any)?.lightcycle ?? (lists.lightcycle[0] ?? ""));
  const [photoperiodH, setPhotoperiodH] = useState<number>(initial?.photoperiodH ?? Number(lists.photoperiodH[0] ?? 12));

  // ENV
  const [tempC, setTempC] = useState(initial?.tempC ?? 24);
  const [rh, setRh] = useState(initial?.rh ?? 55);
  const [vpdKpa, setVpdKpa] = useState<number | undefined>(undefined);
  const [ppfd, setPpfd] = useState(initial?.ppfd ?? 900);
  const [dliMol, setDliMol] = useState<number | undefined>(undefined);
  const [co2, setCo2] = useState<number | undefined>(initial?.co2);

  // ROOT (form-side optional)
  const [rootTempC, setRootTempC] = useState<number | undefined>(initial?.rootTempC);
  const [vwcPct, setVwcPct] = useState<number | undefined>(initial?.vwcPct);
  const hasVwc = vwcPct !== undefined;

  // IRR / CHEM + meta
  const [ReservoirEC, setReservoirEC] = useState<number | undefined>(initial?.ReservoirEC);
  const [inputPh, setInputPh] = useState<number | undefined>(initial?.inputPh);
  const [runoffPh, setRunoffPh] = useState<number | undefined>(initial?.runoffPh);
  const [bulkEc, setBulkEc] = useState<number | undefined>(initial?.bulkEc);
  const [pwec, setPwec] = useState<number | undefined>(initial?.pwec);
  const [runoffPct, setRunoffPct] = useState<number | undefined>(initial?.runoffPct);
  const [reservoirEc, setReservoirEc] = useState<number | undefined>((initial as any)?.reservoirEc);
  const [reservoirPh, setReservoirPh] = useState<number | undefined>((initial as any)?.reservoirPh);
  const [reservoirTempC, setReservoirTempC] = useState<number | undefined>((initial as any)?.reservoirTempC);
  const [eventsPerDay, setEventsPerDay] = useState<number | undefined>(initial?.eventsPerDay);
  const [mlPerEvent, setMlPerEvent] = useState<number | undefined>(initial?.mlPerEvent);
  const [vwcAtLastIrr, setVwcAtLastIrr] = useState<number | undefined>(initial?.vwcAtLastIrr);
  const [drybackPct24h, setDrybackPct24h] = useState<number>(initial?.drybackPct24h ?? 18);
  const [targetAtFirst, setTargetAtFirst] = useState<number | undefined>(initial?.targetAtFirst);
  const [runoffEc, setRunoffEc] = useState<number | undefined>(initial?.runoffEc);

  // P1/P2
  const [p1Events, setP1Events] = useState<number | undefined>(initial?.p1Events);
  const [p1IntervalMin, setP1IntervalMin] = useState<number | undefined>(initial?.p1IntervalMin);
  const [p1Pct, setP1Pct] = useState<number | undefined>(initial?.p1Pct);
  const [p1MlPerEvent, setP1MlPerEvent] = useState<number | undefined>(initial?.p1MlPerEvent);
  const [p1SecPerEvent, setP1SecPerEvent] = useState<number | undefined>(initial?.p1SecPerEvent);
  const [p2Events, setP2Events] = useState<number | undefined>(initial?.p2Events);
  const [p2IntervalMin, setP2IntervalMin] = useState<number | undefined>(initial?.p2IntervalMin);
  const [p2Pct, setP2Pct] = useState<number | undefined>(initial?.p2Pct);
  const [p2MlPerEvent, setP2MlPerEvent] = useState<number | undefined>(initial?.p2MlPerEvent);
  const [p2SecPerEvent, setP2SecPerEvent] = useState<number | undefined>(initial?.p2SecPerEvent);

  async function submit() {
    const draft: Intake = {
      stage, medium, container, co2Mode, lightcycle, photoperiodH,
      tempC, rh, vpdKpa, ppfd, dliMol, co2,
      rootTempC, vwcPct, hasVwc,
      ReservoirEC, inputPh, runoffPh, bulkEc, pwec, runoffPct,
      eventsPerDay, mlPerEvent, vwcAtLastIrr, drybackPct24h, targetAtFirst, runoffEc,
      p1Events, p1IntervalMin, p1Pct, p1MlPerEvent, p1SecPerEvent,
      p2Events, p2IntervalMin, p2Pct, p2MlPerEvent, p2SecPerEvent,
      reservoirEc, reservoirPh, reservoirTempC,
    };
    onSubmit(draft);
  }

  function resetForm() {
    setMode(modeOptions[0] ?? "automation");
    setStage(lists.stagePhase[0] ?? "");
    setMedium(lists.medium[0] ?? "");
    setContainer("");
    setCo2Mode(lists.co2Mode[0] ?? "");
    setLightcycle(lists.lightcycle[0] ?? "");
    setPhotoperiodH(Number(lists.photoperiodH[0] ?? 12));
    setTempC(24); setRh(55); setVpdKpa(undefined); setPpfd(900); setDliMol(undefined); setCo2(undefined);
    setRootTempC(undefined); setVwcPct(undefined);
    setReservoirEC(undefined); setInputPh(undefined); setRunoffPh(undefined); setBulkEc(undefined); setPwec(undefined); setRunoffPct(undefined);
    setEventsPerDay(undefined); setMlPerEvent(undefined); setVwcAtLastIrr(undefined); setDrybackPct24h(18); setTargetAtFirst(undefined); setRunoffEc(undefined);
    setP1Events(undefined); setP1IntervalMin(undefined); setP1Pct(undefined); setP1MlPerEvent(undefined); setP1SecPerEvent(undefined);
    setP2Events(undefined); setP2IntervalMin(undefined); setP2Pct(undefined); setP2MlPerEvent(undefined); setP2SecPerEvent(undefined);
    setReservoirEc(undefined); setReservoirPh(undefined); setReservoirTempC(undefined);
  }

  // emit live draft changes to App (drives live odometers)
  const emitTimer = useRef<number | NodeJS.Timeout | null>(null);
  function buildDraft(): Intake {
    return {
      stage, medium, container, co2Mode, lightcycle, photoperiodH,
      tempC, rh, vpdKpa, ppfd, dliMol, co2,
      rootTempC, vwcPct, hasVwc,
      ReservoirEC, inputPh, runoffPh, bulkEc, pwec, runoffPct,
      eventsPerDay, mlPerEvent, vwcAtLastIrr, drybackPct24h, targetAtFirst, runoffEc,
      p1Events, p1IntervalMin, p1Pct, p1MlPerEvent, p1SecPerEvent,
      p2Events, p2IntervalMin, p2Pct, p2MlPerEvent, p2SecPerEvent,
      reservoirEc, reservoirPh, reservoirTempC,
    };
  }
  useEffect(() => {
    if (!onDraftChange) return;
    if (emitTimer.current) clearTimeout(emitTimer.current as any);
    emitTimer.current = setTimeout(() => {
      try { onDraftChange(buildDraft()); } catch {}
    }, 250) as any;
    return () => { if (emitTimer.current) clearTimeout(emitTimer.current as any); };
  }, [
    stage, medium, container, co2Mode, lightcycle, photoperiodH,
    tempC, rh, vpdKpa, ppfd, dliMol, co2,
    rootTempC, vwcPct, hasVwc,
    ReservoirEC, inputPh, runoffPh, bulkEc, pwec, runoffPct,
    eventsPerDay, mlPerEvent, vwcAtLastIrr, drybackPct24h, targetAtFirst, runoffEc,
    p1Events, p1IntervalMin, p1Pct, p1MlPerEvent, p1SecPerEvent,
    p2Events, p2IntervalMin, p2Pct, p2MlPerEvent, p2SecPerEvent,
    reservoirEc, reservoirPh, reservoirTempC
  ]);

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1>Intake</h1>
        <div className="sub">Update fields, then Submit &amp; Calculate.</div>
      </header>

      {/* Context */}
      <div className="card">
        <h3>Context</h3>
        <div className="row row-3">
          <div>
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {(modeOptions.length ? modeOptions : ["automation", "handwater"]).map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
          <div>
            <label>Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {(lists.stagePhase.length ? lists.stagePhase : ["early veg","late veg","early bloom","mid bloom","late bloom","flush"]).map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
          <div>
            <label>Medium</label>
            <select value={medium} onChange={(e) => setMedium(e.target.value)}>
              {(lists.medium.length ? lists.medium : ["coco","rockwool","soil","dwc"]).map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
          <div>
            <label>Container / Bed</label>
            {lists.containerSize.length ? (
              <select value={container} onChange={(e) => setContainer(e.target.value)}>
                <option value=""></option>
                {lists.containerSize.map((v) => (<option key={v} value={v}>{v}</option>))}
              </select>
            ) : (<input value={container} onChange={(e) => setContainer(e.target.value)} placeholder="1 / 2 / bed" />)}
          </div>
          <div>
            <label>CO2 mode</label>
            <select value={co2Mode} onChange={(e) => setCo2Mode(e.target.value)}>
              <option value=""></option>
              {(lists.co2Mode || []).map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
          <div>
            <label>Lightcycle</label>
            <select value={lightcycle} onChange={(e) => setLightcycle(e.target.value)}>
              <option value=""></option>
              {(lists.lightcycle ?? []).map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
          <div>
            <label>Photoperiod (h)</label>
            {lists.photoperiodH.length ? (
              <select value={String(photoperiodH)} onChange={(e) => setPhotoperiodH(+e.target.value)}>
                {lists.photoperiodH.map((v) => { const val = String(Number(v)); return (<option key={val} value={val}>{val}</option>); })}
              </select>
            ) : (<input type="number" value={photoperiodH} onChange={(e) => setPhotoperiodH(+e.target.value)} />)}
          </div>
        </div>
      </div>

      {/* ENV */}
      <div className="card">
        <h3>ENV</h3>
        <div className="row row-3">
          <div><label>Canopy temp (Ãƒâ€šÃ‚Â°C)</label><input type="number" value={tempC} onChange={(e) => setTempC(+e.target.value)} /></div>
          <div><label>RH (%)</label><input type="number" value={rh} onChange={(e) => setRh(+e.target.value)} /></div>
          <div><label>VPD (kPa)</label><input type="number" step="0.01" value={Number.isFinite(vpdKpa as any) ? (vpdKpa as number) : ""} onChange={(e) => setVpdKpa(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>PPFD (Ãƒâ€šÃ‚Âµmol/mÃƒâ€šÃ‚Â²/s)</label><input type="number" value={ppfd} onChange={(e) => setPpfd(+e.target.value)} /></div>
          <div><label>DLI (mol/mÃƒâ€šÃ‚Â²/d)</label><input type="number" step="0.1" value={Number.isFinite(dliMol as any) ? (dliMol as number) : ""} onChange={(e) => setDliMol(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>CO2 (ppm)</label><input type="number" value={Number.isFinite(co2 as any) ? (co2 as number) : ""} onChange={(e) => setCo2(e.target.value === "" ? undefined : +e.target.value)} /></div>
        </div>
      </div>

      {/* ROOT */}
      <div className="card">
        <h3>ROOT</h3>
        <div className="row row-3">
          <div><label>Runoff pH</label><input type="number" step="0.1" value={Number.isFinite(runoffPh as any) ? (runoffPh as number) : ""} onChange={(e) => setRunoffPh(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>Runoff %</label><input type="number" value={Number.isFinite(runoffPct as any) ? (runoffPct as number) : ""} onChange={(e) => setRunoffPct(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>Reservoir EC (mS/cm)</label><input type="number" step="0.1" value={Number.isFinite(reservoirEc as any) ? (reservoirEc as number) : ""} onChange={(e) => setReservoirEc(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>Reservoir pH</label><input type="number" step="0.1" value={Number.isFinite(reservoirPh as any) ? (reservoirPh as number) : ""} onChange={(e) => setReservoirPh(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>Reservoir temp (Ãƒâ€šÃ‚Â°C)</label><input type="number" step="0.1" value={Number.isFinite(reservoirTempC as any) ? (reservoirTempC as number) : ""} onChange={(e) => setReservoirTempC(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>PWEC (mS/cm)</label><input type="number" step="0.1" value={Number.isFinite(pwec as any) ? (pwec as number) : ""} onChange={(e) => setPwec(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>VWC% at last irrigation</label><input type="number" value={Number.isFinite(vwcAtLastIrr as any) ? (vwcAtLastIrr as number) : ""} onChange={(e) => setVwcAtLastIrr(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>Runoff EC (mS/cm)</label><input type="number" step="0.1" value={Number.isFinite(runoffEc as any) ? (runoffEc as number) : ""} onChange={(e) => setRunoffEc(e.target.value === "" ? undefined : +e.target.value)} /></div>
        </div>
      </div>

      {/* IRR + P1/P2 */}
      <div className="card">
        <h3>IRR</h3>
        <div className="row row-3">
          <div><label>Input EC (mS/cm)</label><input type="number" step="0.1" value={Number.isFinite(ReservoirEC as any) ? (ReservoirEC as number) : ""} onChange={(e) => setReservoirEC(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>Input pH</label><input type="number" step="0.1" value={Number.isFinite(inputPh as any) ? (inputPh as number) : ""} onChange={(e) => setInputPh(e.target.value === "" ? undefined : +e.target.value)} /></div>

          <div><label>Overnight dryback % target</label><input type="number" value={drybackPct24h} onChange={(e) => setDrybackPct24h(+e.target.value)} /></div>
          <div><label>Target at first event</label><input type="number" value={Number.isFinite(targetAtFirst as any) ? (targetAtFirst as number) : ""} onChange={(e) => setTargetAtFirst(e.target.value === "" ? undefined : +e.target.value)} /></div>

          {/* P1 */}
          <div><label>P1 events</label><input type="number" value={Number.isFinite(p1Events as any) ? (p1Events as number) : ""} onChange={(e) => setP1Events(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>P1 interval (min)</label><input type="number" value={Number.isFinite(p1IntervalMin as any) ? (p1IntervalMin as number) : ""} onChange={(e) => setP1IntervalMin(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>P1 %</label><input type="number" value={Number.isFinite(p1Pct as any) ? (p1Pct as number) : ""} onChange={(e) => setP1Pct(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>ml per P1 event</label><input type="number" value={Number.isFinite(p1MlPerEvent as any) ? (p1MlPerEvent as number) : ""} onChange={(e) => setP1MlPerEvent(e.target.value === "" ? undefined : +e.target.value)} /></div>

          {/* P2 */}
          <div><label>P2 events</label><input type="number" value={Number.isFinite(p2Events as any) ? (p2Events as number) : ""} onChange={(e) => setP2Events(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>P2 interval (min)</label><input type="number" value={Number.isFinite(p2IntervalMin as any) ? (p2IntervalMin as number) : ""} onChange={(e) => setP2IntervalMin(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>P2 %</label><input type="number" value={Number.isFinite(p2Pct as any) ? (p2Pct as number) : ""} onChange={(e) => setP2Pct(e.target.value === "" ? undefined : +e.target.value)} /></div>
          <div><label>ml per P2 event</label><input type="number" value={Number.isFinite(p2MlPerEvent as any) ? (p2MlPerEvent as number) : ""} onChange={(e) => setP2MlPerEvent(e.target.value === "" ? undefined : +e.target.value)} /></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={() => void submit()}>Submit &amp; Calculate</button>
        <button className="btn ghost" onClick={resetForm}>Reset</button>
      </div>
    </div>
  );
}




