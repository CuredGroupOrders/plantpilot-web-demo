// src/state/planShare.ts
import type { Chip } from "./chips";

type Status = "queued"|"done"|"skipped";
type Act = { chipId: string; status: Status };

const ORDER = ["ENV","ROOT","IRR"] as const;
const mark = (s?: Status) => s==="done"?"[x]":s==="skipped"?"[-]":"[ ]";

export function planTextWithActions(chips: Chip[], acts: Act[]): string {
  const status = new Map(acts.map(a => [a.chipId, a.status]));
  const byGate: Record<string, Chip[]> = {};
  for (const c of chips) (byGate[c.gate] ||= []).push(c);

  const out: string[] = [];
  for (const g of ORDER) {
    const list = byGate[g]; if (!list?.length) continue;
    out.push(`== ${g} ==`);
    for (const c of list) out.push(`â€¢ ${mark(status.get(c.id))} ${c.title}: ${c.why} â†’ ${c.next}`);
    out.push("");
  }
  return out.join("\n");
}

