import { getIntakeSnapshot, type FSIntake } from "./intake";

// Re-export the rich Chip type from selectors/chips.ts so all downstream
// consumers (state/planShare.ts, cockpit/chips.ts, ...) see the same shape
// (id/gate/severity/title/why/next). The legacy {id,label,status} shape used
// by the dormant getChips()/evaluate() helpers below is now LegacyChip.
export type { Chip } from "./selectors/chips";

export type ChipStatus = "ok" | "warn" | "bad";

export interface LegacyChip {
  id: string;
  label: string;
  status?: ChipStatus;
}

const SHEET_API = (import.meta as any).env?.VITE_SHEET_API as string | undefined;
const CHIPS_FROM_SHEET = (import.meta as any).env?.VITE_CHIPS_FROM_SHEET;

const shouldUseSheet = () => CHIPS_FROM_SHEET === "1" && !!SHEET_API;

async function fetchTop3FromSheet(intake: FSIntake): Promise<LegacyChip[] | null> {
  if (!SHEET_API) return null;

  const url = new URL(SHEET_API);
  url.searchParams.set("stagePhase", String(intake.stagePhase));
  url.searchParams.set("medium", String(intake.medium));
  if (intake.containerSize != null)
    url.searchParams.set("containerSize", String(intake.containerSize));
  if (typeof intake.co2Mode === "string" && intake.co2Mode.length > 0)
    url.searchParams.set("co2Mode", intake.co2Mode);
  url.searchParams.set("mode", "top3");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error(`Sheet HTTP ${res.status}`);
    const data = await res.json();
    const arr: LegacyChip[] = Array.isArray(data?.top3)
      ? data.top3.map((x: any, i: number) =>
          typeof x === "string"
            ? { id: `t${i + 1}`, label: x }
            : {
                id: String(x?.id ?? `t${i + 1}`),
                label: String(x?.label ?? x?.text ?? ""),
                status: x?.status as ChipStatus | undefined,
              }
        )
      : [];
    return arr.length ? arr : null;
  } catch {
    return null;
  }
}

// Local fallback (legacy shape - not currently consumed but retained for parity
// with prior callers that may import getChips() in tests / scripts).
export function evaluate(intake: FSIntake): LegacyChip[] {
  const stage = intake.stagePhase;
  const out: LegacyChip[] = [];

  if (stage === "early veg") {
    out.push({ id: "light", label: "Raise PPFD gradually", status: "ok" });
    out.push({ id: "irrig", label: "Short pulses to prime roots", status: "ok" });
    out.push({ id: "env", label: "Keep VPD in veg band", status: "ok" });
  } else if (stage === "early bloom") {
    out.push({ id: "stretch", label: "Cap stretch with PPFD ramp", status: "ok" });
    out.push({ id: "feed", label: "Watch ΔEC to avoid drift", status: "ok" });
    out.push({ id: "dehum", label: "Tighten RH schedule overnight", status: "ok" });
  } else {
    out.push({ id: "audit", label: "Audit ENV, ROOT, IRR gates", status: "ok" });
    out.push({ id: "trend", label: "Check trend deltas", status: "ok" });
    out.push({ id: "log", label: "Log notes with photos", status: "ok" });
  }
  return out;
}

export async function getChips(): Promise<LegacyChip[]> {
  const intake = getIntakeSnapshot();
  if (shouldUseSheet()) {
    const fromSheet = await fetchTop3FromSheet(intake);
    if (fromSheet && fromSheet.length) return fromSheet;
  }
  return evaluate(intake);
}
