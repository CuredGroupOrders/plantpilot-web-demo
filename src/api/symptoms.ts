// src/api/symptoms.ts
import { gasUrl } from "../lib/apiUrl";

export type SymptomItem = { key: string; checked: boolean };

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "y" || s === "yes";
}

async function readBundledChecklist(): Promise<SymptomItem[]> {
  const r = await fetch("/checklist.json", { cache: "no-store" });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({} as any));
  const keys: string[] = Array.isArray(j?.features?.symptoms)
    ? j.features.symptoms
    : [];
  return keys.map((key) => ({ key: String(key), checked: false }));
}

/** Read Intake!D (keys) + Intake!E (flags) via sidecar GAS bridge. */
export async function readIntakeChecklist(): Promise<SymptomItem[]> {
  try {
    const r = await fetch(
      gasUrl("mode=nrs&names=INTAKE_SYM_KEYS,INTAKE_SYM_FLAGS"),
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!r.ok) throw new Error(`nrs ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) throw new Error("non-json response");
    const j = await r.json();

    const keys = Array.isArray(j?.ranges?.INTAKE_SYM_KEYS)
      ? j.ranges.INTAKE_SYM_KEYS
      : [];
    const flags = Array.isArray(j?.ranges?.INTAKE_SYM_FLAGS)
      ? j.ranges.INTAKE_SYM_FLAGS
      : [];

    const out: SymptomItem[] = [];
    const n = Math.max(keys.length, flags.length);
    for (let i = 0; i < n; i++) {
      const k = (keys[i]?.[0] ?? "").toString().trim();
      if (!k) break;
      const f = toBool(flags[i]?.[0]);
      out.push({ key: k, checked: f });
    }
    if (out.length) return out;
  } catch {
    /* fall through */
  }
  return readBundledChecklist();
}

/** Save flags only (column E). Keys (column D) are read-only. */
export async function saveIntakeChecklist(items: SymptomItem[]): Promise<void> {
  const payload = {
    keys: items.map((i) => i.key),
    flags: items.map((i) => !!i.checked),
  };
  const r = await fetch(gasUrl("mode=setSymptoms"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`setSymptoms ${r.status}`);
}
