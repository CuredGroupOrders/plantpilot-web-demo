import FrontScreenView from "../skin/FrontScreenView";
import { ThermometerSun, Activity, Droplets } from "lucide-react";

// ====== READ from your existing logic (replace the mocks below) ======
// Choose ONE pattern and delete the others.

// --- A) Zustand example ---
// import { useStore } from "../state/store";
// const env  = useStore(s => s.gates.env);   // {value:number, sub:string}
// const root = useStore(s => s.gates.root);
// const irr  = useStore(s => s.gates.irr);

// --- B) Redux example ---
// import { useSelector } from "react-redux";
// const env  = useSelector(state => state.gates.env);
// const root = useSelector(state => state.gates.root);
// const irr  = useSelector(state => state.gates.irr);

// --- C) Context/custom hooks example ---
// const env  = useEnvGate();
// const root = useRootGate();
// const irr  = useIrrGate();

// TEMP fallbacks while wiring (delete once selectors are in)
const env  = (globalThis as any).__ENV  ?? { value: 82, sub: "VPD 1.21 kPa Â· DLI 40 Â· Î”Leaf 1.4Â°C" };
const root = (globalThis as any).__ROOT ?? { value: 76, sub: "VWC 42% Â· Î”EC +0.3 Â· RT 20.8Â°C" };
const irr  = (globalThis as any).__IRR  ?? { value: 68, sub: "Shot: 3.2% Â· Interval 54m Â· RO 18%" };

// If you already compute a single-prescription + lever map, map them here
const prescription = (globalThis as any).__PRESCRIPTION ?? {
  headline: "Increase light output by 6%",
  bullets: [
    "Target DLI 42 mol; keep leaf Î” â‰¤ 2.0Â°C; reassess in 24h.",
    "Extend irrigation interval by 12m",
    "Ca:Mg to 2.7:1 next mix",
    "RH âˆ’3% (VPD to 1.30 kPa)",
    "Log actions to Proof"
  ]
};

const leverMap = (globalThis as any).__LEVERMAP ?? [
  { name: "Light",     tag: "â†‘ 6%",            tone: "ok"  as const },
  { name: "Irrigation",tag: "Interval +12m",   tone: "warn" as const },
  { name: "Climate",   tag: "RH âˆ’3%" },
  { name: "Mix",       tag: "Ca:Mg 2.7:1",     tone: "info" as const }
];

// Build the props for FrontScreenView
const odometers = [
  { label: "ENV Gate",  sub: env.sub,  value: env.value,  color:"#22d3ee", icon: <ThermometerSun className="ic-cyan" /> },
  { label: "ROOT Gate", sub: root.sub, value: root.value, color:"#e879f9", icon: <Activity className="ic-fuchsia" /> },
  { label: "IRR Gate",  sub: irr.sub,  value: irr.value,  color:"#34d399", icon: <Droplets className="ic-emerald" /> },
];

export default function Home() {
  return (
    <FrontScreenView
      odometers={odometers}
      dli="40.6 molÂ·mâ»Â²Â·dâ»Â¹" dliNote="PPFD ramp +6% safe limit"
      dec="+0.3 mS/cm"      decNote="Inside corridor [âˆ’0.5, +0.5]"
      vpd="1.21 kPa"        vpdNote="Target band 1.2â€“1.4"
      prescription={prescription}
      leverMap={leverMap}
    />
  );
}

