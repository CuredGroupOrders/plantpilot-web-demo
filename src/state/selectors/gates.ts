import { useSheetSnap } from "../sheetSnap";

export type OdometerNow = { value: number };

function pickScore(latest: any, key: "env"|"root"|"irr"): number {
  if (!latest) return 0;
  const fromScores = latest?.scores?.[key];
  if (typeof fromScores === "number" && isFinite(fromScores)) return Math.round(fromScores);
  const fromGates  = latest?.gates?.[key]?.score;
  if (typeof fromGates === "number" && isFinite(fromGates)) return Math.round(fromGates);
  return 0;
}

export function useEnvNow(): OdometerNow {
  const v = useSheetSnap(s => pickScore(s.latest, "env"));
  return { value: v };
}
export function useRootNow(): OdometerNow {
  const v = useSheetSnap(s => pickScore(s.latest, "root"));
  return { value: v };
}
export function useIrrNow(): OdometerNow {
  const v = useSheetSnap(s => pickScore(s.latest, "irr"));
  return { value: v };
}
