// src/state/sheetSync.ts
import { debounce } from "../../_shared/debounce";
import { buildSheetPayload, postIntake } from "../api/sheet";
import { useFrontIntake } from "./intake";

const ENABLE = false; // disabled: do NOT auto-write while editing intake

const stable = (v: unknown) => {
  try { return JSON.stringify(v ?? null); } catch { return ""; }
};

let unsubscribe: (() => void) | undefined;

if (ENABLE && typeof (useFrontIntake as any)?.getState === "function") {
  const send = debounce(async (snap: any) => {
    const payload = buildSheetPayload(snap || {});
    await postIntake(payload);
  }, 800);

  let last = "";

  // store.subscribe(listener) signature
  unsubscribe = (useFrontIntake as any).subscribe((state: any) => {
    const saved = state?.saved;
    const cur = stable(saved);
    if (cur && cur !== last) {
      last = cur;
      send(saved);
    }
  });

  if (typeof window !== "undefined") {
    (window as any).__sheetSyncUnsub = unsubscribe;
  }

  // HMR cleanup
  // @ts-ignore
  if (import.meta.hot) {
    // @ts-ignore
    import.meta.hot.dispose(() => { try { unsubscribe?.(); } catch {} });
  }
}

export {};


