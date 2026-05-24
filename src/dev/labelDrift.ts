// src/dev/labelDrift.ts
//
// Dev-only label drift detector. Subscribes to the first engine response that
// lands in useSheetSnap and logs any keys / labels that aren't covered by
// src/labels.ts so we catch new engine fields before they silently regress.
import { useSheetSnap } from "../state/sheetSnap";
import { key2label, label2key, labelAliases } from "../labels";

let installed = false;
let alreadyLogged = false;

export function installLabelDriftDetector() {
  if (installed) return;
  if (typeof window === "undefined") return;
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.PROD) return;
  installed = true;

  const knownLabels = new Set<string>([
    ...Object.values(key2label),
    ...Object.keys(labelAliases),
  ]);
  const knownKeys = new Set<string>(Object.keys(key2label));

  const inspect = (snap: any) => {
    if (!snap || alreadyLogged) return;
    const applied = snap?.summary?.applied as
      | Array<{ key?: string; label?: string }>
      | undefined;
    if (!Array.isArray(applied) || applied.length === 0) return;

    const missingKeys = new Set<string>();
    const missingLabels = new Set<string>();

    for (const row of applied) {
      const k = String(row?.key || "");
      const l = String(row?.label || "");
      if (k && !knownKeys.has(k)) missingKeys.add(k);
      if (l && !knownLabels.has(l) && !label2key[l]) missingLabels.add(l);
    }

    if (missingKeys.size === 0 && missingLabels.size === 0) {
      alreadyLogged = true;
      return;
    }

    alreadyLogged = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[labels] drift detected vs src/labels.ts",
      {
        missingKeys: [...missingKeys],
        missingLabels: [...missingLabels],
      }
    );
  };

  inspect(useSheetSnap.getState().latest ?? useSheetSnap.getState().latestWrite);
  useSheetSnap.subscribe((s) => {
    inspect(s.latestWrite ?? s.latest);
  });
}
