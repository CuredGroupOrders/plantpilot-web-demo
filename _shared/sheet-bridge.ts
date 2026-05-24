export type Intake = Record<string, any>;
export type SheetPayload = Record<string, string>;

const ALLOW_STAGE = [
  "early veg",
  "late veg",
  "early bloom",
  "mid bloom",
  "late bloom",
  "flush",
] as const;
type StagePhase = (typeof ALLOW_STAGE)[number];

const STAGE_MAP: Record<string, StagePhase> = {
  veg: "early veg",
  flower: "early bloom",
};

export function buildSheetPayload(intake: Intake): SheetPayload {
  const out: Record<string, string> = {};

  // normalize stage
  const rawStage = (intake as any)?.stagePhase ?? (intake as any)?.stage;
  if (typeof rawStage === "string") {
    const key = rawStage.toLowerCase();
    const norm = (STAGE_MAP as any)[key] ?? rawStage;
    const stage = String(norm).toLowerCase();
    if ((ALLOW_STAGE as readonly string[]).includes(stage)) out.stagePhase = stage;
  }

  // core fields
  if (typeof intake?.medium !== "undefined") out.medium = String(intake.medium).toLowerCase();
  if (typeof intake?.containerSize !== "undefined") out.containerSize = String(intake.containerSize);
  if (typeof (intake as any)?.co2Mode === "string" && (intake as any).co2Mode.length > 0)
    out.co2Mode = String((intake as any).co2Mode);

  // pass simple scalars through; sheet ignores unknowns
  for (const [k, v] of Object.entries(intake ?? {})) {
    if (v == null) continue;
    const t = typeof v;
    if ((t === "string" || t === "number" || t === "boolean") && !(k in out)) out[k] = String(v);
  }
  return out;
}
