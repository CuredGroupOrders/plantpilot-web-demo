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

export function mergeSopProfileList(fromApi: string[] | undefined): string[] {
  const api = (fromApi ?? []).map(String).filter(Boolean);
  const merged = [...new Set([...api, ...KNOWN_SOP_PROFILES])];
  return merged.filter((p) => p.toLowerCase() !== "default");
}
