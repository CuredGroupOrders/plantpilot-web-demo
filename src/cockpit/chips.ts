// src/cockpit/chips.ts
export * from "../state/chips";
import type { Chip } from "../state/chips";

/** Text plan grouped by gate, stable order ENV → ROOT → IRR. */
export function toPlan(chips: Chip[]): string {
  const order: Array<"ENV" | "ROOT" | "IRR"> = ["ENV", "ROOT", "IRR"];
  const byGate: Record<"ENV" | "ROOT" | "IRR", Chip[]> = { ENV: [], ROOT: [], IRR: [] };

  for (const c of chips) {
    const g = (c.gate ?? "") as "ENV" | "ROOT" | "IRR";
    if (g && byGate[g]) byGate[g].push(c);
  }

  const lines: string[] = [];
  for (const g of order) {
    const list = byGate[g];
    if (!list.length) continue;
    lines.push(`== ${g} ==`);
    for (const c of list) {
      const title = c.title ?? "";
      const why = c.why ?? "";
      const next = c.next ?? "";
      lines.push(`• ${title}: ${why} → ${next}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Stable key for deduping chips in UIs or sets. */
export function actionKey(a: Partial<Chip>): string {
  const gate = String(a.gate ?? "").toUpperCase().trim();
  const title = String(a.title ?? "").trim();
  return `${gate}:${title}`;
}
