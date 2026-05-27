import { SOP_PROFILE_META, getSopProfileMeta } from "../state/sopProfileMeta";

/** Canonical SOP names shipped with irr bundles + nutrient lines. */
export const KNOWN_SOP_PROFILES = Object.keys(SOP_PROFILE_META);

/** Map UI label → suffix used in growroom stage profile keys (`…|sharkmousefarms`). */
export function sopProfileKeySuffix(profile: string): string {
  const raw = (profile ?? "").trim();
  const meta = getSopProfileMeta(raw);
  const norm = (meta?.key ?? raw).toLowerCase().replace(/\s+/g, "");
  if (norm === "default" || !norm) return "sharkmousefarms";
  if (norm.includes("sharkmouse")) return "sharkmousefarms";
  if (norm.includes("athena")) return "athenapro";
  if (norm.includes("mikehydro")) return "mikehydro";
  return norm;
}

export function stageProfilesForSop(
  profiles: { key: string }[],
  profile: string,
): { key: string }[] {
  const suffix = sopProfileKeySuffix(profile);
  const matched = profiles.filter((p) =>
    p.key.toLowerCase().endsWith(suffix),
  );
  return matched.length ? matched : profiles;
}

/** Case-insensitive membership for dropdown vs growroom rule sets. */
export function optionSetHas(
  optionSet: Set<string> | Set<number>,
  value: string | number,
): boolean {
  if (typeof value === "number") {
    return (optionSet as Set<number>).has(value);
  }
  const v = String(value).trim().toLowerCase();
  for (const item of optionSet as Set<string>) {
    if (String(item).trim().toLowerCase() === v) return true;
  }
  return false;
}

/** One dropdown label per growroom suffix (SharkmouseFarms vs SharkMouseFarms → SharkmouseFarms). */
function canonicalSopLabel(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "default") return null;

  const meta = getSopProfileMeta(trimmed);
  if (meta) return meta.key;

  const suffix = sopProfileKeySuffix(trimmed);
  for (const key of KNOWN_SOP_PROFILES) {
    if (sopProfileKeySuffix(key) === suffix) return key;
  }
  return trimmed;
}

export function mergeSopProfileList(fromApi: string[] | undefined): string[] {
  const seenSuffix = new Set<string>();
  const out: string[] = [];

  const add = (raw: string) => {
    const label = canonicalSopLabel(raw);
    if (!label) return;
    const suffix = sopProfileKeySuffix(label);
    if (seenSuffix.has(suffix)) return;
    seenSuffix.add(suffix);
    out.push(label);
  };

  for (const p of fromApi ?? []) add(String(p));
  for (const p of KNOWN_SOP_PROFILES) add(p);
  return out;
}
