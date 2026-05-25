/** Matches irr-physics normalizeContainerGal for SOP bundle keys (e.g. 1 gal → 1). */
export function normalizeContainerGal(container?: string): string {
  const digits = String(container ?? "1").replace(/[^\d.]/g, "");
  const n = Math.round(Number(digits) || 1);
  return String(Math.max(1, Math.min(10, n)));
}
