// src/state/selectors/adapt.ts
import { useFrontIntake } from "../intake";

export type IntakeForRules = {
  stage?: "veg" | "flower";
  medium?: "coco" | "rockwool" | "soil" | "dwc";
  ppfd?: number;
  ph?: number;
  vwcPct?: number;
  irrigationsLast24h?: number;
};

export function useIntakeForRules(): IntakeForRules {
  const s = useFrontIntake(x => x.saved);
  const stageRaw = (s as any)?.stage;
  const stage: "veg" | "flower" | undefined =
    stageRaw === "veg" || stageRaw === "flower" ? stageRaw : "veg";
  const phRaw = (s as any)?.ph;
  const ph = typeof phRaw === "number" ? phRaw : undefined;
  return {
    stage,
    medium: (s as any)?.medium,
    ppfd: undefined,
    ph,
    vwcPct: typeof (s as any)?.vwc === "number" ? Number((s as any).vwc) : undefined,
    irrigationsLast24h:
      typeof (s as any)?.irrigationsLast24h === "number"
        ? Number((s as any).irrigationsLast24h)
        : undefined,
  };
}

