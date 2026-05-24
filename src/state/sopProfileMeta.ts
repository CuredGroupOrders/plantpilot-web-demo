export type SopProfileMeta = {
  key: string;      // intended dropdown value
  sopName: string;
  brandName?: string;
  igUrl?: string;
  logoSrc?: string; // public path under /public, e.g. "/pfp/sharkmousefarms.png"
  accentHex?: string;
};

export const SOP_PROFILE_META: Record<string, SopProfileMeta> = {
  "Athena Pro": {
    key: "Athena Pro",
    sopName: "Athena Pro",
    brandName: "Athena",
    igUrl: "https://www.instagram.com/athena.ag/",
    logoSrc: "/pfp/athena-pro.png",
    accentHex: "#00F5FF",
  },
  "SharkmouseFarms": {
    key: "SharkmouseFarms",
    sopName: "SharkmouseFarms",
    brandName: "SharkmouseFarms",
    igUrl: "https://www.instagram.com/sharkmousethesecond/",
    logoSrc: "/pfp/sharkmousefarms.png",
    accentHex: "#00F5FF",
  },
  "Mike Hydro": {
    key: "Mike Hydro",
    sopName: "Mike Hydro",
    brandName: "Mike Hydro",
    igUrl: "https://www.instagram.com/mikehydro/",
    logoSrc: "/pfp/mike-hydro.png",
    accentHex: "#00F5FF",
  },
};

function norm(s: string): string {
  // normalize NBSP to space, collapse whitespace, trim, lowercase
  return (s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getSopProfileMeta(profileKey: string | null | undefined): SopProfileMeta | null {
  const raw = (profileKey ?? "").toString();
  if (!raw.trim()) return null;

  // fast path: exact key
  const exact = SOP_PROFILE_META[raw as keyof typeof SOP_PROFILE_META];
  if (exact) return exact;

  // tolerant path: normalized match
  const nk = norm(raw);
  for (const k of Object.keys(SOP_PROFILE_META)) {
    if (norm(k) === nk) return SOP_PROFILE_META[k]!;
  }
  return null;
}