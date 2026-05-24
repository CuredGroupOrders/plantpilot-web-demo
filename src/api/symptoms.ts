// src/api/symptoms.ts
export type SymptomItem = { key: string; checked: boolean };

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "y" || s === "yes";
}

/** Read Intake!D (keys) + Intake!E (flags) via named ranges. */
export async function readIntakeChecklist(): Promise<SymptomItem[]> {
  const r = await fetch(`/gas?mode=nrs&names=INTAKE_SYM_KEYS,INTAKE_SYM_FLAGS`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`nrs ${r.status}`);
  const j = await r.json();

  const keys  = Array.isArray(j?.ranges?.INTAKE_SYM_KEYS)  ? j.ranges.INTAKE_SYM_KEYS  : [];
  const flags = Array.isArray(j?.ranges?.INTAKE_SYM_FLAGS) ? j.ranges.INTAKE_SYM_FLAGS : [];

  const out: SymptomItem[] = [];
  const n = Math.max(keys.length, flags.length);
  for (let i = 0; i < n; i++) {
    const k = (keys[i]?.[0] ?? "").toString().trim();
    if (!k) break; // stop at first blank key
    const f = toBool(flags[i]?.[0]);
    out.push({ key: k, checked: f });
  }
  return out;
}

/** Save flags only (column E). Keys (column D) are read-only. */
export async function saveIntakeChecklist(items: SymptomItem[]): Promise<void> {
  const payload = {
    keys:  items.map(i => i.key),     // harmless to include
    flags: items.map(i => !!i.checked),
  };
  const r = await fetch(`/gas?mode=setSymptoms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`setSymptoms ${r.status}`);
}
