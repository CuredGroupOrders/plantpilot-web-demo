/** Sidecar base for production (Netlify) or empty for Vite dev proxy. */
export const SIDECAR_BASE = String(
  (import.meta as any).env?.VITE_SIDECAR_BASE ?? "",
).replace(/\/$/, "");

/** Legacy alias — same as VITE_SIDECAR_BASE. */
export const API_BASE = String(
  (import.meta as any).env?.VITE_API_BASE ?? "",
).replace(/\/$/, "") || SIDECAR_BASE;

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = SIDECAR_BASE || API_BASE;
  return base ? `${base}${p}` : p;
}

/** GAS bridge on sidecar (`/gas?mode=…`). Required on Netlify static deploys. */
export function gasUrl(query = ""): string {
  const q = query.startsWith("?") ? query : query ? `?${query}` : "";
  return apiUrl(`/gas${q}`);
}
